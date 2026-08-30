-- Skidskytte Cup v1.1.1
-- Open Class Participation Points
--
-- Valid results in the official "Öppen Klass" receive one participation
-- point regardless of placement. All other classes retain the existing
-- Syd Cup placement points.
--
-- Official class_id for Öppen Klass:
-- 5ef5e33c-b112-4c0d-853c-7a2a32af2c5f

create or replace view public.cup_result_points
with (security_invoker = true)
as
with eligible_results as (
    select
        r.id as result_id,
        ra.id as race_id,
        ra.cup_id,
        ra.name as race_name,
        ra.race_date,
        ra.sort_order,
        r.class_id,
        cl.name as class_name,
        r.athlete_id,
        a.full_name as athlete_name,
        cb.id as club_id,
        coalesce(cb.short_name, cb.name, '') as club_name,
        rg.id as region_id,
        rg.name as region_name,
        r.place as source_place,
        r.status,
        r.shooting_hits,
        r.shooting_shots,
        case
            when r.shooting_shots > 0
                then r.shooting_hits::numeric / r.shooting_shots::numeric
            else null::numeric
        end as shooting_fraction,
        rank() over (
            partition by ra.id, r.class_id
            order by r.place
        )::integer as region_place
    from public.results r
    join public.races ra
        on ra.id = r.race_id
       and ra.status = 'published'
    join public.cups cu
        on cu.id = ra.cup_id
    join public.classes cl
        on cl.id = r.class_id
    join public.athletes a
        on a.id = r.athlete_id
    join public.clubs cb
        on cb.id = a.club_id
       and cb.active
    left join public.regions rg
        on rg.id = cb.region_id
    where r.status = 'OK'
      and r.place is not null
      and cb.region_id = cu.region_id
)
select
    result_id,
    race_id,
    cup_id,
    race_name,
    race_date,
    sort_order,
    class_id,
    class_name,
    athlete_id,
    athlete_name,
    club_id,
    club_name,
    region_id,
    region_name,
    source_place,
    status,
    shooting_hits,
    shooting_shots,
    shooting_fraction,
    region_place,
    case
        when class_id = '5ef5e33c-b112-4c0d-853c-7a2a32af2c5f'::uuid
            then 1
        else public.syd_cup_points(region_place)
    end as cup_points
from eligible_results;
