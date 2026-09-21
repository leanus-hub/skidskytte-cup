alter table public.cup_rulesets add column if not exists club_min_races_per_athlete integer not null default 0 check (club_min_races_per_athlete >= 0);

-- Club points become eligible retroactively once an athlete reaches the configured minimum starts.
create or replace view public.cup_club_standings with (security_invoker = true) as
with athlete_starts as (
 select rp.cup_id,rp.athlete_id,count(distinct rp.race_id)::integer starts from public.cup_result_points rp group by rp.cup_id,rp.athlete_id
), club_totals as (
 select rp.cup_id,cu.name cup_name,se.name season_name,rp.club_id,rp.club_name,rp.region_id,rp.region_name,
 count(distinct rp.athlete_id) filter(where ast.starts>=rs.club_min_races_per_athlete)::integer athlete_count,
 coalesce(sum(rp.cup_points) filter(where ast.starts>=rs.club_min_races_per_athlete),0)::integer total_points,
 count(*) filter(where ast.starts>=rs.club_min_races_per_athlete)::integer total_starts,
 coalesce(sum(rp.shooting_hits),0)::integer shooting_hits,coalesce(sum(rp.shooting_shots),0)::integer shooting_shots,
 count(*) filter(where rp.region_place=1 and coalesce(cr.medal_eligible,true) and rs.medal_league_enabled)::integer gold,
 count(*) filter(where rp.region_place=2 and coalesce(cr.medal_eligible,true) and rs.medal_league_enabled)::integer silver,
 count(*) filter(where rp.region_place=3 and coalesce(cr.medal_eligible,true) and rs.medal_league_enabled)::integer bronze
 from public.cup_result_points rp join public.cups cu on cu.id=rp.cup_id join public.seasons se on se.id=cu.season_id
 join public.cup_rulesets rs on rs.id=cu.ruleset_id join athlete_starts ast on ast.cup_id=rp.cup_id and ast.athlete_id=rp.athlete_id
 left join public.cup_ruleset_class_rules cr on cr.ruleset_id=cu.ruleset_id and cr.class_id=rp.class_id
 group by rp.cup_id,cu.name,se.name,rp.club_id,rp.club_name,rp.region_id,rp.region_name
), calculated as (
 select ct.*,(ct.gold+ct.silver+ct.bronze) medals,case when ct.shooting_shots>0 then round(100.0*ct.shooting_hits/nullif(ct.shooting_shots,0),2) end shooting_percentage,(ct.gold*3+ct.silver*2+ct.bronze) medal_points from club_totals ct
), ranked as (
 select c.*,rank() over(partition by c.cup_id order by c.total_points desc,c.shooting_percentage desc nulls last)::integer club_place,rank() over(partition by c.cup_id order by c.medal_points desc,c.gold desc,c.silver desc)::integer medal_place from calculated c
)
select cup_id,cup_name,season_name,club_id,club_name,region_id,region_name,athlete_count,total_points,total_starts,shooting_hits,shooting_shots,gold,silver,bronze,medals,shooting_percentage,club_place,medal_points,medal_place from ranked;
grant select on public.cup_club_standings to anon,authenticated;