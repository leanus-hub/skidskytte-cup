-- Flera sammanställningar samt granskningsunderlag per deltävling.
begin;

create or replace view public.cup_class_standings
with (security_invoker = true)
as
select
  cs.cup_id,
  cs.cup_name,
  cs.season_name,
  cs.class_id,
  cs.class_name,
  count(*)::integer as athlete_count,
  sum(cs.total_points)::integer as total_points,
  sum(cs.races_participated)::integer as total_starts,
  sum(cs.shooting_hits)::integer as shooting_hits,
  sum(cs.shooting_shots)::integer as shooting_shots,
  case when sum(cs.shooting_shots) > 0
    then round(100.0 * sum(cs.shooting_hits) / nullif(sum(cs.shooting_shots), 0), 2)
    else null end as shooting_percentage
from public.cup_standings cs
group by cs.cup_id, cs.cup_name, cs.season_name, cs.class_id, cs.class_name;

create or replace view public.cup_club_standings
with (security_invoker = true)
as
with medal_rows as (
  select
    rp.cup_id,
    rp.club_id,
    count(*) filter (where rp.region_place = 1)::integer as gold,
    count(*) filter (where rp.region_place = 2)::integer as silver,
    count(*) filter (where rp.region_place = 3)::integer as bronze
  from public.cup_result_points rp
  group by rp.cup_id, rp.club_id
), totals as (
  select
    cs.cup_id,
    cs.cup_name,
    cs.season_name,
    cs.club_id,
    cs.club_name,
    count(distinct cs.athlete_id)::integer as athlete_count,
    sum(cs.total_points)::integer as total_points,
    sum(cs.races_participated)::integer as total_starts,
    sum(cs.shooting_hits)::integer as shooting_hits,
    sum(cs.shooting_shots)::integer as shooting_shots
  from public.cup_standings cs
  group by cs.cup_id, cs.cup_name, cs.season_name, cs.club_id, cs.club_name
)
select
  t.*,
  coalesce(m.gold, 0)::integer as gold,
  coalesce(m.silver, 0)::integer as silver,
  coalesce(m.bronze, 0)::integer as bronze,
  (coalesce(m.gold, 0) + coalesce(m.silver, 0) + coalesce(m.bronze, 0))::integer as medals,
  case when t.shooting_shots > 0
    then round(100.0 * t.shooting_hits / nullif(t.shooting_shots, 0), 2)
    else null end as shooting_percentage,
  rank() over (partition by t.cup_id order by t.total_points desc, t.shooting_hits::numeric / nullif(t.shooting_shots, 0) desc nulls last)::integer as club_place
from totals t
left join medal_rows m on m.cup_id = t.cup_id and m.club_id = t.club_id;

create or replace view public.race_result_review
with (security_invoker = true)
as
with region_results as (
  select
    r.id as result_id,
    rank() over (
      partition by r.race_id, r.class_id
      order by r.place nulls last
    )::integer as region_place
  from public.results r
  join public.athletes a on a.id = r.athlete_id
  join public.clubs cb on cb.id = a.club_id and cb.is_region_club and cb.active
  where r.status = 'OK' and r.place is not null
)
select
  ra.id as race_id,
  ra.cup_id,
  ra.name as race_name,
  ra.race_date,
  ra.status as race_status,
  cl.id as class_id,
  cl.name as class_name,
  r.id as result_id,
  r.bib,
  a.full_name as athlete_name,
  coalesce(cb.short_name, cb.name, '') as club_name,
  cb.is_region_club,
  r.place as source_place,
  rr.region_place,
  public.syd_cup_points(rr.region_place) as cup_points,
  r.status as result_status,
  r.shooting_hits,
  r.shooting_shots,
  r.total_time_ms,
  r.raw_data,
  case
    when r.status <> 'OK' then 'Status ' || r.status
    when not coalesce(cb.is_region_club, false) then 'Utanför Region Syd – inga poäng'
    when r.place is null then 'Placering saknas'
    when rr.region_place is null then 'Ingår inte i poängunderlaget'
    else null
  end as review_warning
from public.results r
join public.races ra on ra.id = r.race_id
join public.classes cl on cl.id = r.class_id
join public.athletes a on a.id = r.athlete_id
left join public.clubs cb on cb.id = a.club_id
left join region_results rr on rr.result_id = r.id;

grant select on public.cup_class_standings, public.cup_club_standings, public.race_result_review to anon, authenticated;

commit;
