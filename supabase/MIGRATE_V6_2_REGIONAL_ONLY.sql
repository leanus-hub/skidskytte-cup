-- Regional Skidskyttecup v6.2
-- ICKE-DESTRUKTIV MIGRERING
-- Behåller klasser, klassalias, klubbalias, cuper, tävlingar, resultat och användare.

begin;

create extension if not exists pgcrypto;

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.clubs add column if not exists region_id uuid;
alter table public.clubs add column if not exists short_name text;
alter table public.clubs add column if not exists aliases text[] not null default '{}';
alter table public.clubs add column if not exists active boolean not null default true;

alter table public.cups add column if not exists competition_scope text;
alter table public.cups add column if not exists region_id uuid;

-- Ta bort äldre scope-/regionvillkor innan regional-only-regeln sätts.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid='public.cups'::regclass and contype in ('c','f')
      and (pg_get_constraintdef(oid) ilike '%competition_scope%' or pg_get_constraintdef(oid) ilike '%region_id%')
  loop execute format('alter table public.cups drop constraint %I', r.conname); end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid='public.clubs'::regclass and conname='clubs_region_fk'
  ) then
    alter table public.clubs add constraint clubs_region_fk foreign key(region_id) references public.regions(id);
  end if;
end $$;

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
  ((select id from public.regions where name='Syd'), 'Ätrans Idrottsförening', 'Ätrans Idrottsförening', array['Ätrans Idrottsförening'], true)
on conflict (name) do update set
  region_id = excluded.region_id,
  short_name = coalesce(public.clubs.short_name, excluded.short_name),
  aliases = (select array_agg(distinct x) from unnest(coalesce(public.clubs.aliases,'{}'::text[]) || excluded.aliases) x),
  active = true;


-- Befintliga cuper utan region antas vara Region Syd, eftersom systemet tidigare var Region Syd Cup.
update public.cups
set region_id=(select id from public.regions where name='Syd')
where region_id is null;

update public.cups set competition_scope='region';
alter table public.cups alter column competition_scope set default 'region';
alter table public.cups alter column competition_scope set not null;
alter table public.cups alter column region_id set not null;

alter table public.cups add constraint cups_region_fk foreign key(region_id) references public.regions(id);
alter table public.cups add constraint cups_regional_only_check check (competition_scope='region');

-- Skapa om vyerna utan att röra underliggande data.
drop view if exists public.race_result_review cascade;
drop view if exists public.cup_club_standings cascade;
drop view if exists public.cup_class_standings cascade;
drop view if exists public.cup_standings cascade;
drop view if exists public.cup_result_breakdown cascade;
drop view if exists public.cup_result_points cascade;

-- Poängunderlag för regionala cuper.
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
    and cb.region_id = cu.region_id
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
    and cb.region_id=cu.region_id
)
select ra.id race_id,ra.cup_id,ra.name race_name,ra.race_date,ra.status race_status,
       cl.id class_id,cl.name class_name,r.id result_id,r.bib,a.full_name athlete_name,
       coalesce(cb.short_name,cb.name,'') club_name,rg.name region_name,
       (cb.region_id=cu.region_id) is_region_club,
       r.place source_place,er.region_place,public.syd_cup_points(er.region_place) cup_points,
       r.status result_status,r.shooting_hits,r.shooting_shots,r.total_time_ms,r.raw_data,
       case when r.status<>'OK' then 'Status '||r.status
            when cb.region_id is null then 'Föreningen saknar region – kontrollera klubbregistret'
            when cb.region_id<>cu.region_id then 'Utanför cupens region – inga poäng'
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


grant select on public.regions,public.clubs,public.cup_result_points,public.cup_result_breakdown,
  public.cup_standings,public.cup_class_standings,public.cup_club_standings,public.race_result_review to anon,authenticated;
grant insert,update on public.regions,public.clubs to authenticated;

commit;

-- Kontroll: klasser och alias ska vara oförändrade; alla cuper ska vara regionala.
select 'classes' kontroll, count(*) antal from public.classes
union all select 'class_aliases', coalesce(sum(cardinality(aliases)),0) from public.classes
union all select 'regions', count(*) from public.regions
union all select 'clubs', count(*) from public.clubs
union all select 'cups_without_region', count(*) from public.cups where region_id is null;
