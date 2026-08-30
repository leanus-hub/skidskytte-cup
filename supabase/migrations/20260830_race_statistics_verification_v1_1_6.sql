-- Skidskytte Cup v1.1.6
-- Race Statistics Verification
--
-- Race statistics are limited to published races.
-- Regional statistics use the same validity criteria as cup_result_points:
-- result status OK, non-null place, active club, and club in the cup region.

create or replace view public.cup_race_statistics
with (security_invoker = true)
as
select
    cu.id as cup_id,
    cu.name as cup_name,
    s.name as season_name,
    cu.region_id,
    rg.name as region_name,
    ra.id as race_id,
    ra.name as race_name,
    ra.race_date,
    ra.sort_order,
    count(distinct r.athlete_id) filter (
        where r.status = 'OK'
          and r.place is not null
          and cb.active
          and cb.region_id = cu.region_id
    )::integer as regional_participants,
    count(distinct r.athlete_id) filter (
        where r.status = 'OK'
          and r.place is not null
          and cb.active
    )::integer as all_participants,
    count(distinct cb.id) filter (
        where r.status = 'OK'
          and r.place is not null
          and cb.active
          and cb.region_id = cu.region_id
    )::integer as regional_clubs,
    count(distinct r.class_id) filter (
        where r.status = 'OK'
          and r.place is not null
          and cb.active
          and cb.region_id = cu.region_id
    )::integer as regional_classes,
    case
        when coalesce(sum(r.shooting_shots) filter (
            where r.status = 'OK'
              and r.place is not null
              and cb.active
              and cb.region_id = cu.region_id
        ), 0) > 0 then
            round(
                100.0 * sum(r.shooting_hits) filter (
                    where r.status = 'OK'
                      and r.place is not null
                      and cb.active
                      and cb.region_id = cu.region_id
                )::numeric
                / nullif(sum(r.shooting_shots) filter (
                    where r.status = 'OK'
                      and r.place is not null
                      and cb.active
                      and cb.region_id = cu.region_id
                ), 0)::numeric,
                2
            )
        else null::numeric
    end as shooting_percentage
from public.races ra
join public.cups cu on cu.id = ra.cup_id
join public.seasons s on s.id = cu.season_id
join public.regions rg on rg.id = cu.region_id
left join public.results r on r.race_id = ra.id
left join public.athletes a on a.id = r.athlete_id
left join public.clubs cb on cb.id = a.club_id
where ra.status = 'published'
group by
    cu.id,
    cu.name,
    s.name,
    cu.region_id,
    rg.name,
    ra.id,
    ra.name,
    ra.race_date,
    ra.sort_order;
