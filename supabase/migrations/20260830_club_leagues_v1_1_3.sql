-- Skidskytte Cup v1.1.3
-- Club leagues
--
-- Club points use every valid regional result, including results that are
-- dropped from an athlete's individual cup standing.
-- Medal league scoring: gold 3, silver 2, bronze 1.
-- Open Class is excluded from medals.

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
        rp.cup_id,
        cu.name as cup_name,
        se.name as season_name,
        rp.club_id,
        rp.club_name,
        rp.region_id,
        rp.region_name,
        count(distinct rp.athlete_id)::integer as athlete_count,
        sum(rp.cup_points)::integer as total_points,
        count(*)::integer as total_starts,
        coalesce(sum(rp.shooting_hits), 0)::integer as shooting_hits,
        coalesce(sum(rp.shooting_shots), 0)::integer as shooting_shots
    from public.cup_result_points rp
    join public.cups cu on cu.id = rp.cup_id
    join public.seasons se on se.id = cu.season_id
    group by
        rp.cup_id,
        cu.name,
        se.name,
        rp.club_id,
        rp.club_name,
        rp.region_id,
        rp.region_name
),
combined as (
    select
        t.*,
        coalesce(m.gold, 0)::integer as gold,
        coalesce(m.silver, 0)::integer as silver,
        coalesce(m.bronze, 0)::integer as bronze
    from totals t
    left join medal_rows m
        on m.cup_id = t.cup_id
       and m.club_id = t.club_id
),
scored as (
    select
        c.*,
        (c.gold + c.silver + c.bronze)::integer as medals,
        (c.gold * 3 + c.silver * 2 + c.bronze)::integer as medal_points,
        case
            when c.shooting_shots > 0 then
                round(100.0 * c.shooting_hits::numeric / c.shooting_shots::numeric, 2)
            else null::numeric
        end as shooting_percentage
    from combined c
)
select
    s.cup_id,
    s.cup_name,
    s.season_name,
    s.club_id,
    s.club_name,
    s.region_id,
    s.region_name,
    s.athlete_count,
    s.total_points,
    s.total_starts,
    s.shooting_hits,
    s.shooting_shots,
    s.gold,
    s.silver,
    s.bronze,
    s.medals,
    s.medal_points,
    s.shooting_percentage,
    rank() over (
        partition by s.cup_id
        order by
            s.total_points desc,
            s.shooting_percentage desc nulls last
    )::integer as club_place,
    rank() over (
        partition by s.cup_id
        order by
            s.medal_points desc,
            s.gold desc,
            s.silver desc
    )::integer as medal_place
from scored s;
