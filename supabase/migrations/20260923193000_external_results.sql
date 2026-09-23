-- Durable approved external results. These are intentionally isolated from public.results.
create table if not exists public.external_results (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.external_result_imports(id) on delete restrict,
  source_row integer not null,
  athlete_id uuid references public.athletes(id) on delete set null,
  external_athlete_name text not null,
  club_name text,
  class_name text,
  event_name text,
  event_date date,
  source_type text not null,
  source_name text not null,
  place integer,
  status text,
  shooting jsonb not null default '[]'::jsonb,
  shooting_hits integer,
  shooting_shots integer,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(import_id, source_row),
  check (shooting_hits is null or shooting_hits >= 0),
  check (shooting_shots is null or shooting_shots >= 0),
  check (shooting_hits is null or shooting_shots is null or shooting_hits <= shooting_shots)
);
create index if not exists idx_external_results_athlete_id on public.external_results(athlete_id);
create index if not exists idx_external_results_event_date on public.external_results(event_date);
alter table public.external_results enable row level security;
create policy "Admins manage external results" on public.external_results for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.external_results to authenticated;
comment on table public.external_results is 'Approved non-cup results for athlete history, shooting analysis and zero-miss features; never part of cup standings.';
