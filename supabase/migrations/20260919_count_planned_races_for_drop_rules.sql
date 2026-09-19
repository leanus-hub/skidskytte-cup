-- Drop rules are based on the cup's scheduled number of races, not only races already published.
-- Cancelled races are excluded.
create or replace view public.cup_result_breakdown with (security_invoker=true) as
with race_totals as (
 select c.id cup_id,
   count(ra.id) filter (where ra.status <> 'cancelled')::integer as scheduled_race_count
 from public.cups c left join public.races ra on ra.cup_id=c.id group by c.id
), ranked as (
 select rp.*, rt.scheduled_race_count as published_race_count,
   public.syd_cup_drop_count(rt.scheduled_race_count) as dropped_race_count,
   greatest(rt.scheduled_race_count-public.syd_cup_drop_count(rt.scheduled_race_count),0) as max_counted_races,
   row_number() over(partition by rp.cup_id,rp.class_id,rp.athlete_id order by rp.region_place,rp.shooting_fraction desc nulls last,rp.race_date,rp.sort_order,rp.race_id)::integer as count_priority
 from public.cup_result_points rp join race_totals rt on rt.cup_id=rp.cup_id
)
select result_id,race_id,cup_id,race_name,race_date,sort_order,class_id,class_name,athlete_id,athlete_name,
 club_id,club_name,region_id,region_name,source_place,status,shooting_hits,shooting_shots,shooting_fraction,region_place,cup_points,
 published_race_count,dropped_race_count,max_counted_races,count_priority,count_priority<=max_counted_races as is_counted
from ranked;
