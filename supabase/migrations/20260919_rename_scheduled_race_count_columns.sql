-- The count now represents all scheduled, non-cancelled races in the cup.
-- Rename the legacy column without rebuilding dependent views.
alter view public.cup_result_breakdown rename column published_race_count to scheduled_race_count;
alter view public.cup_standings rename column published_race_count to scheduled_race_count;
