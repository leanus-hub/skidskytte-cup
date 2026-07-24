-- KÖR ENDAST I ETT NYTT/TOMT PROJEKT.
-- Skriptet rensar tidigare halvfärdiga tabeller för just denna app och skapar allt på nytt.

begin;

DROP VIEW IF EXISTS public.cup_standings CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP TABLE IF EXISTS public.import_jobs CASCADE;
DROP TABLE IF EXISTS public.results CASCADE;
DROP TABLE IF EXISTS public.athletes CASCADE;
DROP TABLE IF EXISTS public.clubs CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.races CASCADE;
DROP TABLE IF EXISTS public.cups CASCADE;
DROP TABLE IF EXISTS public.seasons CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.cups (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  max_counted_races integer,
  created_at timestamptz not null default now(),
  unique(season_id, name)
);
create table public.races (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  external_race_id text not null unique,
  source_url text not null,
  name text,
  race_date date,
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  created_at timestamptz not null default now()
);
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique(cup_id, name)
);
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_year integer,
  club_id uuid references public.clubs(id),
  created_at timestamptz not null default now()
);
create table public.results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  class_id uuid not null references public.classes(id),
  athlete_id uuid not null references public.athletes(id),
  bib integer,
  place integer,
  status text not null default 'OK' check (status in ('OK','DNS','DNF','DSQ','UNKNOWN')),
  total_time_ms integer,
  time_behind_ms integer,
  shooting jsonb not null default '[]'::jsonb,
  points numeric(8,2) not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  unique(race_id, class_id, athlete_id)
);
create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  external_race_id text not null,
  status text not null default 'pending' check (status in ('pending','processing','review','published','failed')),
  error_message text,
  payload jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index results_class_points_idx on public.results(class_id, points desc);
create index results_athlete_idx on public.results(athlete_id);
create index races_cup_date_idx on public.races(cup_id, race_date);

create view public.cup_standings with (security_invoker = true) as
select c.id cup_id, cl.id class_id, cl.name class_name, a.id athlete_id,
       a.full_name athlete_name, coalesce(cb.name, '') club_name,
       sum(r.points)::numeric(10,2) total_points,
       count(*) filter (where r.status = 'OK')::integer races_counted
from public.results r
join public.races ra on ra.id = r.race_id and ra.status = 'published'
join public.classes cl on cl.id = r.class_id
join public.cups c on c.id = cl.cup_id
join public.athletes a on a.id = r.athlete_id
left join public.clubs cb on cb.id = a.club_id
group by c.id, cl.id, cl.name, a.id, a.full_name, cb.name;

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.cups enable row level security;
alter table public.races enable row level security;
alter table public.classes enable row level security;
alter table public.clubs enable row level security;
alter table public.athletes enable row level security;
alter table public.results enable row level security;
alter table public.import_jobs enable row level security;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin); $$;

create policy "public read seasons" on public.seasons for select using (true);
create policy "public read cups" on public.cups for select using (true);
create policy "public read races" on public.races for select using (status = 'published' or public.is_admin());
create policy "public read classes" on public.classes for select using (true);
create policy "public read clubs" on public.clubs for select using (true);
create policy "public read athletes" on public.athletes for select using (true);
create policy "public read results" on public.results for select using (
  exists(select 1 from public.races ra where ra.id = race_id and ra.status = 'published') or public.is_admin()
);
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage seasons" on public.seasons for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage cups" on public.cups for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage races" on public.races for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage classes" on public.classes for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage clubs" on public.clubs for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage athletes" on public.athletes for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage results" on public.results for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage imports" on public.import_jobs for all using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.seasons, public.cups, public.races, public.classes, public.clubs, public.athletes, public.results, public.cup_standings to anon, authenticated;
grant all on public.profiles, public.seasons, public.cups, public.races, public.classes, public.clubs, public.athletes, public.results, public.import_jobs to authenticated;

insert into public.seasons(name, starts_on, ends_on, is_active)
values ('Säsong 2026', '2026-01-01', '2026-12-31', true);

commit;
