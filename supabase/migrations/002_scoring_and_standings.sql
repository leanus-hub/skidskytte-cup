-- Automatisk poängberäkning och sammanställning för Syd Cup.
-- Skriptet behåller all befintlig data.
begin;

alter table public.clubs
  add column if not exists is_region_club boolean not null default false;

-- Alla klubbar som fanns innan denna migration är det godkända Region Syd-registret.
update public.clubs set is_region_club = true where active is distinct from false;

alter table public.results
  add column if not exists shooting_hits integer,
  add column if not exists shooting_shots integer;

alter table public.results drop constraint if exists results_shooting_values_check;
alter table public.results add constraint results_shooting_values_check check (
  (shooting_hits is null and shooting_shots is null)
  or (
    shooting_hits is not null and shooting_shots is not null
    and shooting_hits >= 0 and shooting_shots >= 0
    and shooting_hits <= shooting_shots
  )
);

create or replace function public.syd_cup_points(p_place integer)
returns integer
language sql
immutable
as $$
  select case
    when p_place is null or p_place < 1 then 0
    when p_place = 1 then 15
    when p_place = 2 then 13
    when p_place between 3 and 14 then 15 - p_place
    else 1
  end;
$$;

create or replace function public.syd_cup_drop_count(p_race_count integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_race_count, 0) <= 3 then 0
    when p_race_count = 4 then 1
    when p_race_count between 5 and 7 then 2
    when p_race_count between 8 and 10 then 3
    else 4
  end;
$$;

drop view if exists public.cup_standings;
drop view if exists public.cup_result_breakdown;
drop view if exists public.cup_result_points;

-- En rad per publicerat resultat, med omräknad placering efter att
-- deltagare från klubbar utanför Region Syd har tagits bort.
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
    r.place as source_place,
    r.status,
    r.shooting_hits,
    r.shooting_shots,
    case
      when r.shooting_shots > 0 then r.shooting_hits::numeric / r.shooting_shots
      else null
    end as shooting_fraction,
    rank() over (
      partition by ra.id, r.class_id
      order by r.place nulls last
    )::integer as region_place
  from public.results r
  join public.races ra on ra.id = r.race_id and ra.status = 'published'
  join public.classes cl on cl.id = r.class_id and cl.cup_id = ra.cup_id
  join public.athletes a on a.id = r.athlete_id
  join public.clubs cb on cb.id = a.club_id and cb.is_region_club and cb.active
  where r.status = 'OK' and r.place is not null
)
select
  er.*,
  public.syd_cup_points(er.region_place) as cup_points
from eligible_results er;

-- Underlag som markerar exakt vilka tävlingar som räknas respektive stryks.
create or replace view public.cup_result_breakdown
with (security_invoker = true)
as
with race_totals as (
  select c.id as cup_id, count(ra.id)::integer as published_race_count
  from public.cups c
  left join public.races ra on ra.cup_id = c.id and ra.status = 'published'
  group by c.id
), ranked as (
  select
    rp.*,
    rt.published_race_count,
    public.syd_cup_drop_count(rt.published_race_count) as dropped_race_count,
    greatest(rt.published_race_count - public.syd_cup_drop_count(rt.published_race_count), 0) as max_counted_races,
    row_number() over (
      partition by rp.cup_id, rp.class_id, rp.athlete_id
      order by
        rp.region_place asc,
        rp.shooting_fraction desc nulls last,
        rp.race_date asc nulls last,
        rp.sort_order asc,
        rp.race_id
    )::integer as count_priority
  from public.cup_result_points rp
  join race_totals rt on rt.cup_id = rp.cup_id
)
select
  ranked.*,
  (ranked.count_priority <= ranked.max_counted_races) as is_counted
from ranked;

create or replace view public.cup_standings
with (security_invoker = true)
as
with aggregated as (
  select
    c.id as cup_id,
    c.name as cup_name,
    c.cup_type,
    c.season_id,
    s.name as season_name,
    b.class_id,
    b.class_name,
    b.athlete_id,
    b.athlete_name,
    b.club_id,
    b.club_name,
    max(b.published_race_count)::integer as published_race_count,
    max(b.dropped_race_count)::integer as dropped_race_count,
    count(*)::integer as races_participated,
    count(*) filter (where b.is_counted)::integer as races_counted,
    coalesce(sum(b.cup_points) filter (where b.is_counted), 0)::integer as total_points,
    coalesce(sum(b.shooting_hits) filter (where b.is_counted), 0)::integer as shooting_hits,
    coalesce(sum(b.shooting_shots) filter (where b.is_counted), 0)::integer as shooting_shots,
    case
      when coalesce(sum(b.shooting_shots) filter (where b.is_counted), 0) > 0
      then round(
        100.0 * sum(b.shooting_hits) filter (where b.is_counted)
        / nullif(sum(b.shooting_shots) filter (where b.is_counted), 0),
        2
      )
      else null
    end as shooting_percentage,
    (count(*) >= c.min_races_for_prize) as eligible_for_prize
  from public.cup_result_breakdown b
  join public.cups c on c.id = b.cup_id
  join public.seasons s on s.id = c.season_id
  group by
    c.id, c.name, c.cup_type, c.season_id, s.name, c.min_races_for_prize,
    b.class_id, b.class_name, b.athlete_id, b.athlete_name, b.club_id, b.club_name
), placed as (
  select
    aggregated.*,
    rank() over (
      partition by cup_id, class_id
      order by total_points desc, shooting_percentage desc nulls last
    )::integer as cup_place
  from aggregated
)
select * from placed;

grant select on public.cup_result_points, public.cup_result_breakdown, public.cup_standings to anon, authenticated;
grant execute on function public.syd_cup_points(integer), public.syd_cup_drop_count(integer) to anon, authenticated;

commit;
