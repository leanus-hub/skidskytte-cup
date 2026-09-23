-- External result staging for non-cup sources (SweCup, IBU, CSV, etc.)
-- Deliberately separate from public.results so staged/external data can never affect cup standings.

create table if not exists public.external_result_imports (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('csv','excel','swecup','ibu','other')),
  source_name text not null,
  source_url text,
  event_name text,
  event_date date,
  status text not null default 'preview' check (status in ('preview','needs_review','approved','rejected','imported','failed')),
  row_count integer not null default 0 check (row_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz
);

create table if not exists public.external_result_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.external_result_imports(id) on delete cascade,
  source_row integer not null check (source_row > 0),
  athlete_name text not null,
  club_name text,
  class_name text,
  place integer,
  status text,
  shooting jsonb not null default '[]'::jsonb,
  shooting_hits integer,
  shooting_shots integer,
  matched_athlete_id uuid references public.athletes(id) on delete set null,
  match_status text not null default 'unmatched' check (match_status in ('matched','unmatched','ambiguous','new')),
  match_note text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(import_id, source_row),
  check (shooting_hits is null or shooting_hits >= 0),
  check (shooting_shots is null or shooting_shots >= 0),
  check (shooting_hits is null or shooting_shots is null or shooting_hits <= shooting_shots)
);

create index if not exists idx_external_result_rows_import_id on public.external_result_rows(import_id);
create index if not exists idx_external_result_rows_matched_athlete_id on public.external_result_rows(matched_athlete_id);

alter table public.external_result_imports enable row level security;
alter table public.external_result_rows enable row level security;

create policy "Admins manage external result imports"
on public.external_result_imports for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage external result rows"
on public.external_result_rows for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.external_result_imports to authenticated;
grant select, insert, update, delete on public.external_result_rows to authenticated;

comment on table public.external_result_imports is 'Admin-only staging batches for results outside the official cup result model.';
comment on table public.external_result_rows is 'Admin-only staged external result rows. Never included in cup standings.';
