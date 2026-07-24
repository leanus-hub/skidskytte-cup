-- Importstatus och granskningsinformation för BiathlonTiming.
begin;

alter table public.races
  add column if not exists import_status text not null default 'not_imported'
    check (import_status in ('not_imported','processing','imported','failed')),
  add column if not exists import_error text,
  add column if not exists imported_at timestamptz,
  add column if not exists imported_result_count integer not null default 0,
  add column if not exists import_source_used text,
  add column if not exists import_warnings text[] not null default '{}';

create index if not exists athletes_name_club_idx on public.athletes(lower(full_name), club_id);
create index if not exists classes_cup_lower_name_idx on public.classes(cup_id, lower(name));

grant select on public.races to anon, authenticated;

commit;
