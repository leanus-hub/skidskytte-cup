-- Version 6.3: Förbättrad sammanställning
-- Säker migrering: rör inte klasser, klassalias, resultat, cuper eller föreningsalias.

begin;

create or replace view public.cup_race_statistics with (security_invoker = true) as
select
  cu.id cup_id,
  cu.name cup_name,
  s.name season_name,
  cu.region_id,
  rg.name region_name,
  ra.id race_id,
  ra.name race_name,
  ra.race_date,
  ra.sort_order,
  count(distinct r.athlete_id) filter (
    where r.status = 'OK' and cb.region_id = cu.region_id
  )::integer regional_participants,
  count(distinct r.athlete_id) filter (
    where r.status = 'OK'
  )::integer all_participants,
  count(distinct cb.id) filter (
    where r.status = 'OK' and cb.region_id = cu.region_id
  )::integer regional_clubs,
  count(distinct r.class_id) filter (
    where r.status = 'OK' and cb.region_id = cu.region_id
  )::integer regional_classes,
  case when coalesce(sum(r.shooting_shots) filter (
      where r.status = 'OK' and cb.region_id = cu.region_id
    ),0) > 0
    then round(
      100.0 * sum(r.shooting_hits) filter (
        where r.status = 'OK' and cb.region_id = cu.region_id
      ) / nullif(sum(r.shooting_shots) filter (
        where r.status = 'OK' and cb.region_id = cu.region_id
      ),0),
      2
    )
    else null
  end shooting_percentage
from public.races ra
join public.cups cu on cu.id = ra.cup_id
join public.seasons s on s.id = cu.season_id
join public.regions rg on rg.id = cu.region_id
left join public.results r on r.race_id = ra.id
left join public.athletes a on a.id = r.athlete_id
left join public.clubs cb on cb.id = a.club_id
group by cu.id,cu.name,s.name,cu.region_id,rg.name,ra.id,ra.name,ra.race_date,ra.sort_order;

grant select on public.cup_race_statistics to anon, authenticated;

commit;

select 'cup_race_statistics' kontroll, count(*) antal from public.cup_race_statistics;
