-- SVENSK SKIDSKYTTE CUP – NATIONELL INSTALLATION VERSION 6.1
-- VARNING: Raderar alla säsonger, cuper, tävlingar, resultat, åkare, regioner, klubbar och klasser.
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
drop table if exists public.regions cascade;
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
  competition_scope text not null default 'national' check (competition_scope in ('national','region')),
  region_id uuid,
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

-- Svenska skidskytteförbundets regioner.
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.cups
  add constraint cups_region_fk foreign key (region_id) references public.regions(id),
  add constraint cups_scope_region_check check (
    (competition_scope = 'national' and region_id is null)
    or (competition_scope = 'region' and region_id is not null)
  );

-- GLOBALA klubbar: återanvänds av samtliga cuper.
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references public.regions(id),
  name text not null unique,
  short_name text,
  aliases text[] not null default '{}',
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

-- Nationellt region- och föreningsregister, baserat på listan som tillhandahölls.
insert into public.regions (name, sort_order) values
  ('Norra Norrland', 10),
  ('Mittnorrland', 20),
  ('Jämtland Härjedalen', 30),
  ('Gävle Dala', 40),
  ('Väst', 50),
  ('Öst', 60),
  ('Syd', 70);

insert into public.clubs (region_id, name, short_name, aliases, active) values
  ((select id from public.regions where name='Norra Norrland'), 'Arjeplogs Sportklubb', 'Arjeplogs Sportklubb', array['Arjeplogs Sportklubb'], true),
  ((select id from public.regions where name='Norra Norrland'), 'I 19 Idrottsförening', 'I 19 Idrottsförening', array['I 19 Idrottsförening'], true),
  ((select id from public.regions where name='Norra Norrland'), 'IFK Arvidsjaur Skidor', 'IFK Arvidsjaur Skidor', array['IFK Arvidsjaur Skidor'], true),
  ((select id from public.regions where name='Norra Norrland'), 'Jokkmokks Skidklubb', 'Jokkmokks Skidklubb', array['Jokkmokks Skidklubb'], true),
  ((select id from public.regions where name='Norra Norrland'), 'Luleå Gjutarens IF', 'Luleå Gjutarens IF', array['Luleå Gjutarens IF'], true),
  ((select id from public.regions where name='Norra Norrland'), 'Malmbergets Allmänna IF', 'Malmbergets Allmänna IF', array['Malmbergets Allmänna IF'], true),
  ((select id from public.regions where name='Norra Norrland'), 'Piteå Skidskytteklubb', 'Piteå Skidskytteklubb', array['Piteå Skidskytteklubb'], true),
  ((select id from public.regions where name='Norra Norrland'), 'Sportklubben Gränsen', 'Sportklubben Gränsen', array['Sportklubben Gränsen'], true),
  ((select id from public.regions where name='Norra Norrland'), 'Älvsby IF Skidskytteklubb', 'Älvsby IF Skidskytteklubb', array['Älvsby IF Skidskytteklubb'], true),
  ((select id from public.regions where name='Norra Norrland'), 'Överkalix Idrottsförening', 'Överkalix Idrottsförening', array['Överkalix Idrottsförening'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Anundsjö Skytteförening', 'Anundsjö Skytteförening', array['Anundsjö Skytteförening'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Bondsjöhöjdens Idrottsförening', 'Bondsjöhöjdens Idrottsförening', array['Bondsjöhöjdens Idrottsförening'], true),
  ((select id from public.regions where name='Mittnorrland'), 'I 21 Idrottsförening', 'I 21 Idrottsförening', array['I 21 Idrottsförening'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Kågedalens SK', 'Kågedalens SK', array['Kågedalens SK'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Lycksele Idrottsförening', 'Lycksele Idrottsförening', array['Lycksele Idrottsförening'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Robertsfors Skyttesportförening', 'Robertsfors Skyttesportförening', array['Robertsfors Skyttesportförening'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Röbäcks Skidklubb', 'Röbäcks Skidklubb', array['Röbäcks Skidklubb'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Sollefteå Skidgymnasium Biathlon Skol-IF', 'Sollefteå Skidgymnasium Biathlon Skol-IF', array['Sollefteå Skidgymnasium Biathlon Skol-IF'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Sundsvall Biathlon', 'Sundsvall Biathlon', array['Sundsvall Biathlon'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Sävar Idrottsklubb', 'Sävar Idrottsklubb', array['Sävar Idrottsklubb'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Vilhelmina Skidskytteklubb', 'Vilhelmina Skidskytteklubb', array['Vilhelmina Skidskytteklubb'], true),
  ((select id from public.regions where name='Mittnorrland'), 'Övik Skidskytteförening', 'Övik Skidskytteförening', array['Övik Skidskytteförening'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Biathlon Östersund Idrottsförening', 'Biathlon Östersund Idrottsförening', array['Biathlon Östersund Idrottsförening'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Edsåsdalens Sportklubb', 'Edsåsdalens Sportklubb', array['Edsåsdalens Sportklubb'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Frösö Idrottsförening', 'Frösö Idrottsförening', array['Frösö Idrottsförening'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Fältjägarnas Idrottsförening', 'Fältjägarnas Idrottsförening', array['Fältjägarnas Idrottsförening'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Hede Skidklubb', 'Hede Skidklubb', array['Hede Skidklubb'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'IFK Strömsund', 'IFK Strömsund', array['IFK Strömsund'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Näldens Idrottsförening', 'Näldens Idrottsförening', array['Näldens Idrottsförening'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Ramundbergets Skidskytteklubb', 'Ramundbergets Skidskytteklubb', array['Ramundbergets Skidskytteklubb'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Skyttegillet Fullt hus', 'Skyttegillet Fullt hus', array['Skyttegillet Fullt hus'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Svegs Idrottsklubb', 'Svegs Idrottsklubb', array['Svegs Idrottsklubb'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Tandsbyns IF', 'Tandsbyns IF', array['Tandsbyns IF'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Tullus Skyttegille', 'Tullus Skyttegille', array['Tullus Skyttegille'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Ås Idrottsförening', 'Ås Idrottsförening', array['Ås Idrottsförening'], true),
  ((select id from public.regions where name='Jämtland Härjedalen'), 'Åsarna Idrottsklubb', 'Åsarna Idrottsklubb', array['Åsarna Idrottsklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Dala-Järna Idrottsklubb', 'Dala-Järna Idrottsklubb', array['Dala-Järna Idrottsklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Dalregementets Idrottsförening', 'Dalregementets Idrottsförening', array['Dalregementets Idrottsförening'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Hedesunda Idrottsförening', 'Hedesunda Idrottsförening', array['Hedesunda Idrottsförening'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Hälsinglands Sportklubb', 'Hälsinglands Sportklubb', array['Hälsinglands Sportklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'IFK Grängesberg Skidklubb', 'IFK Grängesberg Skidklubb', array['IFK Grängesberg Skidklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Järbo Idrottsförening', 'Järbo Idrottsförening', array['Järbo Idrottsförening'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Lima Skyttegille', 'Lima Skyttegille', array['Lima Skyttegille'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Mora Biathlonklubb', 'Mora Biathlonklubb', array['Mora Biathlonklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Norrbärke Skidklubb', 'Norrbärke Skidklubb', array['Norrbärke Skidklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Näs Idrottsförening', 'Näs Idrottsförening', array['Näs Idrottsförening'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Näsvikens Idrottsklubb', 'Näsvikens Idrottsklubb', array['Näsvikens Idrottsklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Ornäs Skidskytteklubb', 'Ornäs Skidskytteklubb', array['Ornäs Skidskytteklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Oxbergs Idrottsförening', 'Oxbergs Idrottsförening', array['Oxbergs Idrottsförening'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Trönö Idrottsklubb', 'Trönö Idrottsklubb', array['Trönö Idrottsklubb'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Valbo Allmänna Idrottsförening', 'Valbo Allmänna Idrottsförening', array['Valbo Allmänna Idrottsförening'], true),
  ((select id from public.regions where name='Gävle Dala'), 'Älvdalen SKG Skidskytteförening', 'Älvdalen SKG Skidskytteförening', array['Älvdalen SKG Skidskytteförening'], true),
  ((select id from public.regions where name='Väst'), 'Ekshärads Skidförening', 'Ekshärads Skidförening', array['Ekshärads Skidförening'], true),
  ((select id from public.regions where name='Väst'), 'Finnskoga Idrottsförening', 'Finnskoga Idrottsförening', array['Finnskoga Idrottsförening'], true),
  ((select id from public.regions where name='Väst'), 'Garphyttans IF', 'Garphyttans IF', array['Garphyttans IF'], true),
  ((select id from public.regions where name='Väst'), 'I2 Idrottsförening', 'I2 Idrottsförening', array['I2 Idrottsförening'], true),
  ((select id from public.regions where name='Väst'), 'KONG AIF', 'KONG AIF', array['KONG AIF'], true),
  ((select id from public.regions where name='Väst'), 'Skidklubben Bore Torsby', 'Skidklubben Bore Torsby', array['Skidklubben Bore Torsby'], true),
  ((select id from public.regions where name='Väst'), 'Stjerneskolans Idrottsförening', 'Stjerneskolans Idrottsförening', array['Stjerneskolans Idrottsförening'], true),
  ((select id from public.regions where name='Väst'), 'Zinkgruvans Idrottsförening', 'Zinkgruvans Idrottsförening', array['Zinkgruvans Idrottsförening'], true),
  ((select id from public.regions where name='Öst'), 'Eskilstuna Skidskytte', 'Eskilstuna Skidskytte', array['Eskilstuna Skidskytte'], true),
  ((select id from public.regions where name='Öst'), 'Häverödals Sportklubb', 'Häverödals Sportklubb', array['Häverödals Sportklubb'], true),
  ((select id from public.regions where name='Öst'), 'Medåkers Idrottsförening', 'Medåkers Idrottsförening', array['Medåkers Idrottsförening'], true),
  ((select id from public.regions where name='Öst'), 'Mälarö SOK', 'Mälarö SOK', array['Mälarö SOK'], true),
  ((select id from public.regions where name='Öst'), 'Norbergs Skidklubb', 'Norbergs Skidklubb', array['Norbergs Skidklubb'], true),
  ((select id from public.regions where name='Öst'), 'Storvreta Idrottsklubb', 'Storvreta Idrottsklubb', array['Storvreta Idrottsklubb'], true),
  ((select id from public.regions where name='Öst'), 'Sätra Idrottsförening', 'Sätra Idrottsförening', array['Sätra Idrottsförening'], true),
  ((select id from public.regions where name='Öst'), 'Täby IS Skidklubb', 'Täby IS Skidklubb', array['Täby IS Skidklubb'], true),
  ((select id from public.regions where name='Öst'), 'Täby Viggbyholm/Ö. Ryds Skytteförening', 'Täby Viggbyholm/Ö. Ryds Skytteförening', array['Täby Viggbyholm/Ö. Ryds Skytteförening'], true),
  ((select id from public.regions where name='Öst'), 'Västerås Skidklubb', 'Västerås Skidklubb', array['Västerås Skidklubb'], true),
  ((select id from public.regions where name='Öst'), 'Ärla Idrottsförening', 'Ärla Idrottsförening', array['Ärla Idrottsförening'], true),
  ((select id from public.regions where name='Syd'), 'Allmänna Skidklubben Växjö', 'Allmänna Skidklubben Växjö', array['Allmänna Skidklubben Växjö'], true),
  ((select id from public.regions where name='Syd'), 'Borås Gymnastik o Idrottsförening', 'Borås Gymnastik o Idrottsförening', array['Borås Gymnastik o Idrottsförening'], true),
  ((select id from public.regions where name='Syd'), 'Borås Skidlöparklubb', 'Borås Skidlöparklubb', array['Borås Skidlöparklubb'], true),
  ((select id from public.regions where name='Syd'), 'Boxholm-Ekeby Skidklubb', 'Boxholm-Ekeby Skidklubb', array['Boxholm-Ekeby Skidklubb'], true),
  ((select id from public.regions where name='Syd'), 'Finnspångs Skid och Orienteringsklubb', 'Finnspångs Skid och Orienteringsklubb', array['Finnspångs Skid och Orienteringsklubb'], true),
  ((select id from public.regions where name='Syd'), 'Hestra Idrottsförening', 'Hestra Idrottsförening', array['Hestra Idrottsförening'], true),
  ((select id from public.regions where name='Syd'), 'Idrottsklubben Stern', 'Idrottsklubben Stern', array['Idrottsklubben Stern'], true),
  ((select id from public.regions where name='Syd'), 'IF Hallby Skid o Orienteringsklubb', 'IF Hallby Skid o Orienteringsklubb', array['IF Hallby Skid o Orienteringsklubb'], true),
  ((select id from public.regions where name='Syd'), 'IF Ski Team Skåne', 'IF Ski Team Skåne', array['IF Ski Team Skåne'], true),
  ((select id from public.regions where name='Syd'), 'IFK Skövde Skidklubb', 'IFK Skövde Skidklubb', array['IFK Skövde Skidklubb'], true),
  ((select id from public.regions where name='Syd'), 'Karlskrona Skid- och Orienteringsklubb', 'Karlskrona Skid- och Orienteringsklubb', array['Karlskrona Skid- och Orienteringsklubb'], true),
  ((select id from public.regions where name='Syd'), 'Kimstad Gymnastik o IF', 'Kimstad Gymnastik o IF', array['Kimstad Gymnastik o IF'], true),
  ((select id from public.regions where name='Syd'), 'Landsbro IF Skidklubb', 'Landsbro IF Skidklubb', array['Landsbro IF Skidklubb'], true),
  ((select id from public.regions where name='Syd'), 'Linköpings Skidklubb', 'Linköpings Skidklubb', array['Linköpings Skidklubb'], true),
  ((select id from public.regions where name='Syd'), 'Nässjö Ski Idrottsförening', 'Nässjö Ski Idrottsförening', array['Nässjö Ski Idrottsförening'], true),
  ((select id from public.regions where name='Syd'), 'OK Landehof', 'OK Landehof', array['OK Landehof'], true),
  ((select id from public.regions where name='Syd'), 'Ronneby Orienteringsklubb', 'Ronneby Orienteringsklubb', array['Ronneby Orienteringsklubb'], true),
  ((select id from public.regions where name='Syd'), 'Svaide Roma Skid- och Orienteringsklubb', 'Svaide Roma Skid- och Orienteringsklubb', array['Svaide Roma Skid- och Orienteringsklubb'], true),
  ((select id from public.regions where name='Syd'), 'Sya Skidklubb', 'Sya Skidklubb', array['Sya Skidklubb'], true),
  ((select id from public.regions where name='Syd'), 'Söderköpings Skidklubb', 'Söderköpings Skidklubb', array['Söderköpings Skidklubb'], true),
  ((select id from public.regions where name='Syd'), 'Trollhättans Skid o Orienteringsklubb', 'Trollhättans Skid o Orienteringsklubb', array['Trollhättans Skid o Orienteringsklubb'], true),
  ((select id from public.regions where name='Syd'), 'Tvärreds Idrottsförening', 'Tvärreds Idrottsförening', array['Tvärreds Idrottsförening'], true),
  ((select id from public.regions where name='Syd'), 'Ulricehamns Idrottsförening', 'Ulricehamns Idrottsförening', array['Ulricehamns Idrottsförening'], true),
  ((select id from public.regions where name='Syd'), 'Vreta Skid o Motionsklubb', 'Vreta Skid o Motionsklubb', array['Vreta Skid o Motionsklubb'], true),
  ((select id from public.regions where name='Syd'), 'Ätrans Idrottsförening', 'Ätrans Idrottsförening', array['Ätrans Idrottsförening'], true);

-- Poängunderlag för nationella eller regionala cuper.
create view public.cup_result_points with (security_invoker = true) as
with eligible_results as (
  select r.id result_id, ra.id race_id, ra.cup_id, ra.name race_name, ra.race_date, ra.sort_order,
         r.class_id, cl.name class_name, r.athlete_id, a.full_name athlete_name,
         cb.id club_id, coalesce(cb.short_name, cb.name, '') club_name,
         rg.id region_id, rg.name region_name,
         r.place source_place, r.status, r.shooting_hits, r.shooting_shots,
         case when r.shooting_shots > 0 then r.shooting_hits::numeric / r.shooting_shots else null end shooting_fraction,
         rank() over (partition by ra.id, r.class_id order by r.place nulls last)::integer region_place
  from public.results r
  join public.races ra on ra.id = r.race_id and ra.status = 'published'
  join public.cups cu on cu.id = ra.cup_id
  join public.classes cl on cl.id = r.class_id
  join public.athletes a on a.id = r.athlete_id
  join public.clubs cb on cb.id = a.club_id and cb.active
  left join public.regions rg on rg.id = cb.region_id
  where r.status = 'OK' and r.place is not null
    and (cu.competition_scope = 'national' or cb.region_id = cu.region_id)
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
  select c.id cup_id, c.name cup_name, c.cup_type, c.competition_scope, c.region_id cup_region_id,
         c.season_id, s.name season_name,
         b.class_id, b.class_name, b.athlete_id, b.athlete_name, b.club_id, b.club_name,
         b.region_id, b.region_name,
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
  group by c.id,c.name,c.cup_type,c.competition_scope,c.region_id,c.season_id,s.name,c.min_races_for_prize,
           b.class_id,b.class_name,b.athlete_id,b.athlete_name,b.club_id,b.club_name,b.region_id,b.region_name
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
  select cs.cup_id,cs.cup_name,cs.season_name,cs.club_id,cs.club_name,cs.region_id,cs.region_name,
         count(distinct cs.athlete_id)::integer athlete_count,
         sum(cs.total_points)::integer total_points,
         sum(cs.races_participated)::integer total_starts,
         sum(cs.shooting_hits)::integer shooting_hits,
         sum(cs.shooting_shots)::integer shooting_shots
  from public.cup_standings cs
  group by cs.cup_id,cs.cup_name,cs.season_name,cs.club_id,cs.club_name,cs.region_id,cs.region_name
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
with eligible_results as (
  select r.id result_id,
         rank() over (partition by r.race_id,r.class_id order by r.place nulls last)::integer region_place
  from public.results r
  join public.races ra on ra.id=r.race_id
  join public.cups cu on cu.id=ra.cup_id
  join public.athletes a on a.id=r.athlete_id
  join public.clubs cb on cb.id=a.club_id and cb.active
  where r.status='OK' and r.place is not null
    and (cu.competition_scope='national' or cb.region_id=cu.region_id)
)
select ra.id race_id,ra.cup_id,ra.name race_name,ra.race_date,ra.status race_status,
       cl.id class_id,cl.name class_name,r.id result_id,r.bib,a.full_name athlete_name,
       coalesce(cb.short_name,cb.name,'') club_name,rg.name region_name,
       (cu.competition_scope='national' or cb.region_id=cu.region_id) is_region_club,
       r.place source_place,er.region_place,public.syd_cup_points(er.region_place) cup_points,
       r.status result_status,r.shooting_hits,r.shooting_shots,r.total_time_ms,r.raw_data,
       case when r.status<>'OK' then 'Status '||r.status
            when cb.region_id is null then 'Föreningen saknar region – kontrollera klubbregistret'
            when cu.competition_scope='region' and cb.region_id<>cu.region_id then 'Utanför cupens region – inga poäng'
            when r.place is null then 'Placering saknas'
            when er.region_place is null then 'Ingår inte i poängunderlaget'
            else null end review_warning
from public.results r
join public.races ra on ra.id=r.race_id
join public.cups cu on cu.id=ra.cup_id
join public.classes cl on cl.id=r.class_id
join public.athletes a on a.id=r.athlete_id
left join public.clubs cb on cb.id=a.club_id
left join public.regions rg on rg.id=cb.region_id
left join eligible_results er on er.result_id=r.id;

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
alter table public.regions enable row level security;
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
create policy "public read regions" on public.regions for select using (true);
create policy "public read clubs" on public.clubs for select using (true);
create policy "public read athletes" on public.athletes for select using (true);
create policy "public read results" on public.results for select using (
  exists(select 1 from public.races ra where ra.id=race_id and ra.status='published') or public.is_admin()
);
create policy "admins manage seasons" on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage cups" on public.cups for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage races" on public.races for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage classes" on public.classes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage regions" on public.regions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage clubs" on public.clubs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage athletes" on public.athletes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage results" on public.results for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage imports" on public.import_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon,authenticated;
grant select on public.seasons,public.cups,public.races,public.classes,public.regions,public.clubs,public.athletes,public.results,
  public.cup_result_points,public.cup_result_breakdown,public.cup_standings,
  public.cup_class_standings,public.cup_club_standings,public.race_result_review to anon,authenticated;
grant all on public.profiles,public.seasons,public.cups,public.races,public.classes,public.regions,public.clubs,
  public.athletes,public.results,public.import_jobs to authenticated;
grant execute on function public.syd_cup_points(integer),public.syd_cup_drop_count(integer),
  public.canonical_class_name(text),public.normalized_class_name(text) to anon,authenticated;

insert into public.seasons(name,starts_on,ends_on,is_active)
values ('Säsong 2026','2026-01-01','2026-12-31',true);

commit;

-- KONTROLL: classes ska vara 13 och cup_id ska inte finnas.
select 'classes' kontroll, count(*)::text värde from public.classes
union all select 'regions', count(*)::text from public.regions
union all select 'clubs', count(*)::text from public.clubs
union all select 'results', count(*)::text from public.results
union all select 'classes_has_cup_id', count(*)::text
from information_schema.columns
where table_schema='public' and table_name='classes' and column_name='cup_id';
