-- Skidskytte Cup v1.1.5
-- Class Standings Verification
--
-- Verified against public.cup_standings:
-- * athlete_count counts individual standings rows per cup/class.
-- * total_points sums individual cup totals after drop rules.
-- * total_starts sums all valid participations.
-- * shooting totals and percentage use the already-counted races from cup_standings.

create or replace view public.cup_class_standings
with (security_invoker = true)
as
select
    cup_id,
    cup_name,
    season_name,
    class_id,
    class_name,
    count(*)::integer as athlete_count,
    sum(total_points)::integer as total_points,
    sum(races_participated)::integer as total_starts,
    sum(shooting_hits)::integer as shooting_hits,
    sum(shooting_shots)::integer as shooting_shots,
    case
        when sum(shooting_shots) > 0 then
            round(
                100.0 * sum(shooting_hits)::numeric
                / nullif(sum(shooting_shots), 0)::numeric,
                2
            )
        else null::numeric
    end as shooting_percentage
from public.cup_standings
 group by
    cup_id,
    cup_name,
    season_name,
    class_id,
    class_name;
