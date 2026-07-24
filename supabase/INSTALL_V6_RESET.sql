-- REGION SYD SKIDSKYTTE CUP – REN INSTALLATION VERSION 6.0
-- VARNING: Raderar alla säsonger, cuper, tävlingar, resultat, åkare, klubbar och klasser.
-- Supabase Auth-användare och befintlig adminbehörighet i public.profiles bevaras.
-- Kör HELA filen på en gång i Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

-- Ta bort triggern innan funktioner/tabeller byggs om.
drop trigger if exists on_auth_user_created on auth.users;

-- Ta bort appens vyer och funktioner.
drop view if exists public.race_result_review cascade;
drop view if exists public.cup_club_standings cascade;
drop view if exists public.cup_class_standings cascade;
drop view if exists public.cup_standings cascade;
drop view if exists public.cup_result_breakdown cascade;
drop view if exists public.cup_result_points cascade;
drop function if exists public.syd_cup_points(integer) cascade;
drop function if exists public.syd_cup_drop_count(integer) cascade;
drop function if exists public.canonical_class_name(text) cascade;
drop function if exists public.normalized_class_name(text) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;

-- Ta bort all cupdata. profiles lämnas kvar för att bevara adminbehörighet.
drop table if exists public.import_jobs cascade;
drop table if exists public.results cascade;
drop table if exists public.athletes cascade;
drop table if exists public.clubs cascade;
drop table if exists public.classes cascade;
drop table if exists public.races cascade;
drop table if exists public.cups cascade;
drop table if exists public.seasons cascade;

-- Skapa eller komplettera profilregistret utan att radera befintliga admins.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

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
  cup_type text not null default 'vinter' check (cup_type in ('sommar','vinter')),
  max_counted_races integer,
  min_races_for_prize integer not null default 3,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(season_id, name)
);

create table public.races (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  external_race_id text not null unique,
  source_url text not null,
  name text not null,
  race_date date,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  import_status text not null default 'not_imported' check (import_status in ('not_imported','processing','imported','failed')),
  import_error text,
  imported_at timestamptz,
  imported_result_count integer not null default 0,
  import_source_used text,
  import_warnings text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- GLOBALA klasser: ingen cup_id finns eller behövs.
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  aliases text[] not null default '{}',
  is_official boolean not null default true,
  created_at timestamptz not null default now()
);

-- GLOBALA klubbar: återanvänds av samtliga cuper.
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  aliases text[] not null default '{}',
  is_region_club boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
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
  shooting_hits integer,
  shooting_shots integer,
  points numeric(8,2) not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(race_id, class_id, athlete_id),
  check (
    (shooting_hits is null and shooting_shots is null)
    or (shooting_hits >= 0 and shooting_shots >= 0 and shooting_hits <= shooting_shots)
  )
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

create index races_cup_date_idx on public.races(cup_id, race_date, sort_order);
create unique index classes_global_lower_name_idx on public.classes(lower(name));
create index athletes_name_club_idx on public.athletes(lower(full_name), club_id);
create index results_class_points_idx on public.results(class_id, points desc);
create index results_athlete_idx on public.results(athlete_id);
create index results_race_idx on public.results(race_id);

create or replace function public.canonical_class_name(input_name text)
returns text language sql immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(coalesce(input_name, ''), '([0-9])\s*[.–—.]\s*([0-9])', '\1-\2', 'g'),
      '\s+(massstart|sprint|distans|kortdistans|individuell|jaktstart|stafett|supersprint)(\s+.*)?$', '', 'i'
    ),
    '\s+', ' ', 'g'
  ));
$$;

create or replace function public.normalized_class_name(input_name text)
returns text language sql immutable
as $$
  select lower(regexp_replace(public.canonical_class_name(input_name), '[^a-zA-ZåäöÅÄÖ0-9]+', '', 'g'));
$$;

create or replace function public.syd_cup_points(p_place integer)
returns integer language sql immutable
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
returns integer language sql immutable
as $$
  select case
    when coalesce(p_race_count, 0) <= 3 then 0
    when p_race_count = 4 then 1
    when p_race_count between 5 and 7 then 2
    when p_race_count between 8 and 10 then 3
    else 4
  end;
$$;

-- Officiella globala klasser från cupunderlaget.
insert into public.classes (name, sort_order, aliases, is_official) values
  ('Flickor Nybörjare', 10, array['Flickor nybörjare'], true),
  ('Flickor 10-11', 20, array['Flickor 10.11','Flickor 10–11','F 10-11','F10-11'], true),
  ('Pojkar 10-11', 30, array['Pojkar 10.11','Pojkar 10–11','P 10-11','P10-11'], true),
  ('Flickor 12-13', 40, array['Flickor 12.13','Flickor 12–13','F 12-13','F12-13'], true),
  ('Pojkar 12-13', 50, array['Pojkar 12.13','Pojkar 12–13','P 12-13','P12-13'], true),
  ('Flickor 14-15', 60, array['Flickor 14.15','Flickor 14–15','F 14-15','F14-15'], true),
  ('Pojkar 14-15', 70, array['Pojkar 14.15','Pojkar 14–15','P 14-15','P14-15'], true),
  ('Damer 16-17', 80, array['Damer 16.17','Damer 16–17','D 16-17','D16-17'], true),
  ('Herrar 16-17', 90, array['Herrar 16.17','Herrar 16–17','H 16-17','H16-17'], true),
  ('Damer 18-21', 100, array['Damer 18.21','Damer 18–21','D 18-21','D18-21'], true),
  ('Herrar 18-21', 110, array['Herrar 18.21','Herrar 18–21','H 18-21','H18-21'], true),
  ('Damer Senior', 120, array['Damer senior','D Senior','D Seniorer'], true),
  ('Herrar Senior', 130, array['Herrar senior','H Senior','H Seniorer'], true);

-- Region Syd-klubbar som förekommer i det bifogade cupunderlaget.
insert into public.clubs (name, short_name, aliases, is_region_club, active) values
  ('Borås Skidlöparklubb', 'Borås SK', array['Borås Skidlöparklubb','Borås SK'], true, true),
  ('Föreningen Nässjö Ski', 'Nässjö Ski', array['Föreningen Nässjö Ski','Nässjö Ski'], true, true),
  ('Hestra Idrottsförening', 'Hestra IF', array['Hestra Idrottsförening','Hestra IF'], true, true),
  ('IF Ski Team Skåne', 'Ski Team Skåne', array['IF Ski Team Skåne','Ski Team Skåne'], true, true),
  ('Idrottsklubben Stern', 'IK Stern', array['Idrottsklubben Stern','IK Stern'], true, true),
  ('Kimstad Gymnastik o IF', 'Kimstad GoIF', array['Kimstad Gymnastik o IF','Kimstad Gymnastik och IF','Kimstad GoIF'], true, true),
  ('Landsbro IF Skidklubb', 'Landsbro IF', array['Landsbro IF Skidklubb','Landsbro IF'], true, true),
  ('Linköpings Skidklubb', 'Linköpings SK', array['Linköpings Skidklubb','Linköpings SK'], true, true),
  ('OK Landehof', 'OK Landehof', array['OK Landehof','Landehof'], true, true),
  ('Sya Skidklubb', 'Sya SK', array['Sya Skidklubb','Sya SK'], true, true),
  ('Trollhättans Skid o Orienteringsklubb', 'Trollhättan SOK', array['Trollhättans Skid o Orienteringsklubb','Trollhättans Skid och Orienteringsklubb','Trollhättan SOK'], true, true),
  ('Ulricehamns Idrottsförening', 'Ulricehamns IF', array['Ulricehamns Idrottsförening','Ulricehamns IF'], true, true),
  ('Vreta Skid o Motionsklubb', 'Vreta Ski', array['Vreta Skid o Motionsklubb','Vreta Skid och Motionsklubb','Vreta Ski'], true, true);

-- Tydligt externa klubbar i underlaget, sparas men får inga Region Syd-poäng.
insert into public.clubs (name, short_name, aliases, is_region_club, active) values
  ('Biathlon Östersund Idrottsförening', 'Biathlon Östersund', array['Biathlon Östersund Idrottsförening','Biathlon Östersund IF'], false, true),
  ('Garphyttans Idrottsförening', 'Garphyttans IF', array['Garphyttans Idrottsförening','Garphyttans IF'], false, true);

-- Poängunderlag: endast publicerade tävlingar och aktiva Region Syd-klubbar.
create view public.cup_result_points with (security_invoker = true) as
with eligible_results as (
  select r.id result_id, ra.id race_id, ra.cup_id, ra.name race_name, ra.race_date, ra.sort_order,
         r.class_id, cl.name class_name, r.athlete_id, a.full_name athlete_name,
         cb.id club_id, coalesce(cb.short_name, cb.name, '') club_name,
         r.place source_place, r.status, r.shooting_hits, r.shooting_shots,
         case when r.shooting_shots > 0 then r.shooting_hits::numeric / r.shooting_shots else null end shooting_fraction,
         rank() over (partition by ra.id, r.class_id order by r.place nulls last)::integer region_place
  from public.results r
  join public.races ra on ra.id = r.race_id and ra.status = 'published'
  join public.classes cl on cl.id = r.class_id
  join public.athletes a on a.id = r.athlete_id
  join public.clubs cb on cb.id = a.club_id and cb.is_region_club and cb.active
  where r.status = 'OK' and r.place is not null
)
select er.*, public.syd_cup_points(er.region_place) cup_points from eligible_results er;

create view public.cup_result_breakdown with (security_invoker = true) as
with race_totals as (
  select c.id cup_id, count(ra.id)::integer published_race_count
  from public.cups c left join public.races ra on ra.cup_id = c.id and ra.status = 'published'
  group by c.id
), ranked as (
  select rp.*, rt.published_race_count, public.syd_cup_drop_count(rt.published_race_count) dropped_race_count,
         greatest(rt.published_race_count - public.syd_cup_drop_count(rt.published_race_count), 0) max_counted_races,
         row_number() over (
           partition by rp.cup_id, rp.class_id, rp.athlete_id
           order by rp.region_place asc, rp.shooting_fraction desc nulls last,
                    rp.race_date asc nulls last, rp.sort_order asc, rp.race_id
         )::integer count_priority
  from public.cup_result_points rp join race_totals rt on rt.cup_id = rp.cup_id
)
select ranked.*, (ranked.count_priority <= ranked.max_counted_races) is_counted from ranked;

create view public.cup_standings with (security_invoker = true) as
with aggregated as (
  select c.id cup_id, c.name cup_name, c.cup_type, c.season_id, s.name season_name,
         b.class_id, b.class_name, b.athlete_id, b.athlete_name, b.club_id, b.club_name,
         max(b.published_race_count)::integer published_race_count,
         max(b.dropped_race_count)::integer dropped_race_count,
         count(*)::integer races_participated,
         count(*) filter (where b.is_counted)::integer races_counted,
         coalesce(sum(b.cup_points) filter (where b.is_counted),0)::integer total_points,
         coalesce(sum(b.shooting_hits) filter (where b.is_counted),0)::integer shooting_hits,
         coalesce(sum(b.shooting_shots) filter (where b.is_counted),0)::integer shooting_shots,
         case when coalesce(sum(b.shooting_shots) filter (where b.is_counted),0) > 0
              then round(100.0 * sum(b.shooting_hits) filter (where b.is_counted)
                         / nullif(sum(b.shooting_shots) filter (where b.is_counted),0), 2)
              else null end shooting_percentage,
         (count(*) >= c.min_races_for_prize) eligible_for_prize
  from public.cup_result_breakdown b
  join public.cups c on c.id = b.cup_id
  join public.seasons s on s.id = c.season_id
  group by c.id,c.name,c.cup_type,c.season_id,s.name,c.min_races_for_prize,
           b.class_id,b.class_name,b.athlete_id,b.athlete_name,b.club_id,b.club_name
), placed as (
  select aggregated.*,
         rank() over (partition by cup_id,class_id order by total_points desc, shooting_percentage desc nulls last)::integer cup_place
  from aggregated
)
select * from placed;

create view public.cup_class_standings with (security_invoker = true) as
select cs.cup_id, cs.cup_name, cs.season_name, cs.class_id, cs.class_name,
       count(*)::integer athlete_count, sum(cs.total_points)::integer total_points,
       sum(cs.races_participated)::integer total_starts,
       sum(cs.shooting_hits)::integer shooting_hits, sum(cs.shooting_shots)::integer shooting_shots,
       case when sum(cs.shooting_shots)>0 then round(100.0*sum(cs.shooting_hits)/nullif(sum(cs.shooting_shots),0),2) else null end shooting_percentage
from public.cup_standings cs
 group by cs.cup_id,cs.cup_name,cs.season_name,cs.class_id,cs.class_name;

create view public.cup_club_standings with (security_invoker = true) as
with medal_rows as (
  select rp.cup_id,rp.club_id,
         count(*) filter (where rp.region_place=1)::integer gold,
         count(*) filter (where rp.region_place=2)::integer silver,
         count(*) filter (where rp.region_place=3)::integer bronze
  from public.cup_result_points rp group by rp.cup_id,rp.club_id
), totals as (
  select cs.cup_id,cs.cup_name,cs.season_name,cs.club_id,cs.club_name,
         count(distinct cs.athlete_id)::integer athlete_count,
         sum(cs.total_points)::integer total_points,
         sum(cs.races_participated)::integer total_starts,
         sum(cs.shooting_hits)::integer shooting_hits,
         sum(cs.shooting_shots)::integer shooting_shots
  from public.cup_standings cs
  group by cs.cup_id,cs.cup_name,cs.season_name,cs.club_id,cs.club_name
)
select t.*,coalesce(m.gold,0)::integer gold,coalesce(m.silver,0)::integer silver,
       coalesce(m.bronze,0)::integer bronze,
       (coalesce(m.gold,0)+coalesce(m.silver,0)+coalesce(m.bronze,0))::integer medals,
       case when t.shooting_shots>0 then round(100.0*t.shooting_hits/nullif(t.shooting_shots,0),2) else null end shooting_percentage,
       rank() over (partition by t.cup_id order by t.total_points desc,
                    t.shooting_hits::numeric/nullif(t.shooting_shots,0) desc nulls last)::integer club_place
from totals t left join medal_rows m on m.cup_id=t.cup_id and m.club_id=t.club_id;

-- Admin-granskning fungerar även innan tävlingen publicerats.
create view public.race_result_review with (security_invoker = true) as
with region_results as (
  select r.id result_id,
         rank() over (partition by r.race_id,r.class_id order by r.place nulls last)::integer region_place
  from public.results r
  join public.athletes a on a.id=r.athlete_id
  join public.clubs cb on cb.id=a.club_id and cb.is_region_club and cb.active
  where r.status='OK' and r.place is not null
)
select ra.id race_id,ra.cup_id,ra.name race_name,ra.race_date,ra.status race_status,
       cl.id class_id,cl.name class_name,r.id result_id,r.bib,a.full_name athlete_name,
       coalesce(cb.short_name,cb.name,'') club_name,coalesce(cb.is_region_club,false) is_region_club,
       r.place source_place,rr.region_place,public.syd_cup_points(rr.region_place) cup_points,
       r.status result_status,r.shooting_hits,r.shooting_shots,r.total_time_ms,r.raw_data,
       case when r.status<>'OK' then 'Status '||r.status
            when not coalesce(cb.is_region_club,false) then 'Utanför Region Syd – inga poäng'
            when r.place is null then 'Placering saknas'
            when rr.region_place is null then 'Ingår inte i poängunderlaget'
            else null end review_warning
from public.results r
join public.races ra on ra.id=r.race_id
join public.classes cl on cl.id=r.class_id
join public.athletes a on a.id=r.athlete_id
left join public.clubs cb on cb.id=a.club_id
left join region_results rr on rr.result_id=r.id;

-- Admin och Auth.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'display_name',new.email))
  on conflict(id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles(id,display_name)
select id,coalesce(raw_user_meta_data->>'display_name',email) from auth.users
on conflict(id) do update set display_name=coalesce(public.profiles.display_name,excluded.display_name);

-- RLS.
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.cups enable row level security;
alter table public.races enable row level security;
alter table public.classes enable row level security;
alter table public.clubs enable row level security;
alter table public.athletes enable row level security;
alter table public.results enable row level security;
alter table public.import_jobs enable row level security;

drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using (id=(select auth.uid()) or public.is_admin());
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public read seasons" on public.seasons for select using (true);
create policy "public read cups" on public.cups for select using (true);
create policy "public read races" on public.races for select using (status='published' or public.is_admin());
create policy "public read classes" on public.classes for select using (true);
create policy "public read clubs" on public.clubs for select using (true);
create policy "public read athletes" on public.athletes for select using (true);
create policy "public read results" on public.results for select using (
  exists(select 1 from public.races ra where ra.id=race_id and ra.status='published') or public.is_admin()
);
create policy "admins manage seasons" on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage cups" on public.cups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage races" on public.races for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage classes" on public.classes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage clubs" on public.clubs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage athletes" on public.athletes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage results" on public.results for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage imports" on public.import_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon,authenticated;
grant select on public.seasons,public.cups,public.races,public.classes,public.clubs,public.athletes,public.results,
  public.cup_result_points,public.cup_result_breakdown,public.cup_standings,
  public.cup_class_standings,public.cup_club_standings,public.race_result_review to anon,authenticated;
grant all on public.profiles,public.seasons,public.cups,public.races,public.classes,public.clubs,
  public.athletes,public.results,public.import_jobs to authenticated;
grant execute on function public.syd_cup_points(integer),public.syd_cup_drop_count(integer),
  public.canonical_class_name(text),public.normalized_class_name(text) to anon,authenticated;

insert into public.seasons(name,starts_on,ends_on,is_active)
values ('Säsong 2026','2026-01-01','2026-12-31',true);

commit;

-- KONTROLL: classes ska vara 13 och cup_id ska inte finnas.
select 'classes' kontroll, count(*)::text värde from public.classes
union all select 'clubs', count(*)::text from public.clubs
union all select 'results', count(*)::text from public.results
union all select 'classes_has_cup_id', count(*)::text
from information_schema.columns
where table_schema='public' and table_name='classes' and column_name='cup_id';
