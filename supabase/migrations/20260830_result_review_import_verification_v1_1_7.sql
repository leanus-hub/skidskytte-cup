-- Skidskytte Cup v1.1.7
-- Result Review & Import Verification
--
-- Align race_result_review with official cup scoring behavior:
-- * Only published races contribute region placement / cup points.
-- * Open Class always receives 1 participation point per valid result.
-- * DNS/DNF/UNKNOWN and out-of-region results remain visible in the review view
--   with warnings, but do not enter the scoring basis.

create or replace view public.race_result_review
with (security_invoker = true)
as
with eligible_results as (
    select
        r_1.id as result_id,
        rank() over (
            partition by r_1.race_id, r_1.class_id
            order by r_1.place
        )::integer as region_place
    from public.results r_1
    join public.races ra_1
      on ra_1.id = r_1.race_id
    join public.cups cu_1
      on cu_1.id = ra_1.cup_id
    join public.athletes a_1
      on a_1.id = r_1.athlete_id
    join public.clubs cb_1
      on cb_1.id = a_1.club_id
     and cb_1.active
    where ra_1.status = 'published'
      and r_1.status = 'OK'
      and r_1.place is not null
      and cb_1.region_id = cu_1.region_id
)
select
    ra.id as race_id,
    ra.cup_id,
    ra.name as race_name,
    ra.race_date,
    ra.status as race_status,
    cl.id as class_id,
    cl.name as class_name,
    r.id as result_id,
    r.bib,
    a.full_name as athlete_name,
    coalesce(cb.short_name, cb.name, '') as club_name,
    rg.name as region_name,
    cb.region_id = cu.region_id as is_region_club,
    r.place as source_place,
    er.region_place,
    case
        when er.region_place is null then 0
        when cl.name = 'Öppen Klass' then 1
        else public.syd_cup_points(er.region_place)
    end as cup_points,
    r.status as result_status,
    r.shooting_hits,
    r.shooting_shots,
    r.total_time_ms,
    r.raw_data,
    case
        when r.status <> 'OK' then 'Status ' || r.status
        when cb.region_id is null then 'Föreningen saknar region – kontrollera klubbregistret'
        when cb.region_id <> cu.region_id then 'Utanför cupens region – inga poäng'
        when r.place is null then 'Placering saknas'
        when er.region_place is null then 'Ingår inte i poängunderlaget'
        else null
    end as review_warning
from public.results r
join public.races ra
  on ra.id = r.race_id
join public.cups cu
  on cu.id = ra.cup_id
join public.classes cl
  on cl.id = r.class_id
join public.athletes a
  on a.id = r.athlete_id
left join public.clubs cb
  on cb.id = a.club_id
left join public.regions rg
  on rg.id = cb.region_id
left join eligible_results er
  on er.result_id = r.id;
