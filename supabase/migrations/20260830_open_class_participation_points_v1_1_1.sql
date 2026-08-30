-- Skidskytte Cup v1.1.1
-- Open Class Participation Points
--
-- Valid results in the official "Öppen Klass" receive one participation
-- point regardless of placement. All other classes retain the existing
-- Syd Cup placement points.
--
-- Öppen Klass is also excluded from club medal statistics.
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

create or replace view public.cup_club_standings
with (security_invoker = true)
as
with medal_rows as (
    select
        rp.cup_id,
        rp.club_id,
        count(*) filter (
            where rp.region_place = 1
              and rp.class_id <> '5ef5e33c-b112-4c0d-853c-7a2a32af2c5f'::uuid
        )::integer as gold,
        count(*) filter (
            where rp.region_place = 2
              and rp.class_id <> '5ef5e33c-b112-4c0d-853c-7a2a32af2c5f'::uuid
        )::integer as silver,
        count(*) filter (
            where rp.region_place = 3
              and rp.class_id <> '5ef5e33c-b112-4c0d-853c-7a2a32af2c5f'::uuid
        )::integer as bronze
    from public.cup_result_points rp
    group by rp.cup_id, rp.club_id
),
totals as (
    select
        cs.cup_id,
        cs.cup_name,
        cs.season_name,
        cs.club_id,
        cs.club_name,
        cs.region_id,
        cs.region_name,
        count(distinct cs.athlete_id)::integer as athlete_count,
        sum(cs.total_points)::integer as total_points,
        sum(cs.races_participated)::integer as total_starts,
        sum(cs.shooting_hits)::integer as shooting_hits,
        sum(cs.shooting_shots)::integer as shooting_shots
    from public.cup_standings cs
    group by
        cs.cup_id,
        cs.cup_name,
        cs.season_name,
        cs.club_id,
        cs.club_name,
        cs.region_id,
        cs.region_name
)
select
    t.cup_id,
    t.cup_name,
    t.season_name,
    t.club_id,
    t.club_name,
    t.region_id,
    t.region_name,
    t.athlete_count,
    t.total_points,
    t.total_starts,
    t.shooting_hits,
    t.shooting_shots,
    coalesce(m.gold, 0) as gold,
    coalesce(m.silver, 0) as silver,
    coalesce(m.bronze, 0) as bronze,
    coalesce(m.gold, 0) + coalesce(m.silver, 0) + coalesce(m.bronze, 0) as medals,
    case
        when t.shooting_shots > 0 then
            round(
                100.0 * t.shooting_hits::numeric
                / nullif(t.shooting_shots, 0)::numeric,
                2
            )
        else null::numeric
    end as shooting_percentage,
    rank() over (
        partition by t.cup_id
        order by
            t.total_points desc,
            (
                t.shooting_hits::numeric
                / nullif(t.shooting_shots, 0)::numeric
            ) desc nulls last
    )::integer as club_place
from totals t
left join medal_rows m
    on m.cup_id = t.cup_id
   and m.club_id = t.club_id;
