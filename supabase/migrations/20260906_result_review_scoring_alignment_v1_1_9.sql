-- Skidskytte Cup v1.1.9
-- Result Review Scoring Alignment
--
-- Keep race_result_review aligned with cup_result_points so that review/admin
-- always displays the same region placement and cup points as the scoring engine.
-- Special scoring rules are therefore inherited from cup_result_points:
-- * Flickor/Pojkar Nybörjare: 0 cup points.
-- * Öppen Klass: 0 cup points.
-- * Flickor/Pojkar 10-11: 5 participation points per valid regional result.
-- * Other classes: standard Syd Cup placement points.

create or replace view public.race_result_review
with (security_invoker = true)
as
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
    rp.region_place,
    coalesce(rp.cup_points, 0)::integer as cup_points,
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
        when rp.result_id is null then 'Ingår inte i poängunderlaget'
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
left join public.cup_result_points rp
  on rp.result_id = r.id;
