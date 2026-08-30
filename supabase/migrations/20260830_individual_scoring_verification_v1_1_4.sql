-- Skidskytte Cup v1.1.4
-- Individual Scoring Verification
--
-- Verified rules:
-- * Drop count is based on the number of published races in the cup.
-- * The best placements are counted; the worst placements are dropped.
-- * Shooting percentage uses counted races only.
-- * Cup ranking uses total points, then shooting percentage, with shared places
--   when both are equal.
-- * Prize eligibility uses cups.min_races_for_prize.

create or replace view public.cup_result_breakdown
with (security_invoker = true)
as
with race_totals as (
    select
        c.id as cup_id,
        count(ra.id)::integer as published_race_count
    from public.cups c
    left join public.races ra
        on ra.cup_id = c.id
       and ra.status = 'published'
    group by c.id
),
ranked as (
    select
        rp.result_id,
        rp.race_id,
        rp.cup_id,
        rp.race_name,
        rp.race_date,
        rp.sort_order,
        rp.class_id,
        rp.class_name,
        rp.athlete_id,
        rp.athlete_name,
        rp.club_id,
        rp.club_name,
        rp.region_id,
        rp.region_name,
        rp.source_place,
        rp.status,
        rp.shooting_hits,
        rp.shooting_shots,
        rp.shooting_fraction,
        rp.region_place,
        rp.cup_points,
        rt.published_race_count,
        public.syd_cup_drop_count(rt.published_race_count) as dropped_race_count,
        greatest(
            rt.published_race_count
            - public.syd_cup_drop_count(rt.published_race_count),
            0
        ) as max_counted_races,
        row_number() over (
            partition by rp.cup_id, rp.class_id, rp.athlete_id
            order by
                rp.region_place,
                rp.shooting_fraction desc nulls last,
                rp.race_date,
                rp.sort_order,
                rp.race_id
        )::integer as count_priority
    from public.cup_result_points rp
    join race_totals rt
        on rt.cup_id = rp.cup_id
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
    cup_points,
    published_race_count,
    dropped_race_count,
    max_counted_races,
    count_priority,
    count_priority <= max_counted_races as is_counted
from ranked;

create or replace view public.cup_standings
with (security_invoker = true)
as
with aggregated as (
    select
        c.id as cup_id,
        c.name as cup_name,
        c.cup_type,
        c.competition_scope,
        c.region_id as cup_region_id,
        c.season_id,
        s.name as season_name,
        b.class_id,
        b.class_name,
        b.athlete_id,
        b.athlete_name,
        b.club_id,
        b.club_name,
        b.region_id,
        b.region_name,
        max(b.published_race_count) as published_race_count,
        max(b.dropped_race_count) as dropped_race_count,
        count(*)::integer as races_participated,
        count(*) filter (where b.is_counted)::integer as races_counted,
        coalesce(sum(b.cup_points) filter (where b.is_counted), 0::bigint)::integer as total_points,
        coalesce(sum(b.shooting_hits) filter (where b.is_counted), 0::bigint)::integer as shooting_hits,
        coalesce(sum(b.shooting_shots) filter (where b.is_counted), 0::bigint)::integer as shooting_shots,
        case
            when coalesce(sum(b.shooting_shots) filter (where b.is_counted), 0::bigint) > 0 then
                round(
                    100.0
                    * (sum(b.shooting_hits) filter (where b.is_counted))::numeric
                    / nullif(sum(b.shooting_shots) filter (where b.is_counted), 0)::numeric,
                    2
                )
            else null::numeric
        end as shooting_percentage,
        count(*) >= c.min_races_for_prize as eligible_for_prize
    from public.cup_result_breakdown b
    join public.cups c
        on c.id = b.cup_id
    join public.seasons s
        on s.id = c.season_id
    group by
        c.id,
        c.name,
        c.cup_type,
        c.competition_scope,
        c.region_id,
        c.season_id,
        s.name,
        c.min_races_for_prize,
        b.class_id,
        b.class_name,
        b.athlete_id,
        b.athlete_name,
        b.club_id,
        b.club_name,
        b.region_id,
        b.region_name
),
placed as (
    select
        aggregated.*,
        rank() over (
            partition by aggregated.cup_id, aggregated.class_id
            order by
                aggregated.total_points desc,
                aggregated.shooting_percentage desc nulls last
        )::integer as cup_place
    from aggregated
)
select
    cup_id,
    cup_name,
    cup_type,
    competition_scope,
    cup_region_id,
    season_id,
    season_name,
    class_id,
    class_name,
    athlete_id,
    athlete_name,
    club_id,
    club_name,
    region_id,
    region_name,
    published_race_count,
    dropped_race_count,
    races_participated,
    races_counted,
    total_points,
    shooting_hits,
    shooting_shots,
    shooting_percentage,
    eligible_for_prize,
    cup_place
from placed;
