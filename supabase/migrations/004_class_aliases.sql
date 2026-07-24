-- Officiella Region Syd-klasser och säkra klassalias
-- Ersätter den tidigare versionen av 004_class_aliases.sql.
-- Kör efter 003_biathlontiming_import.sql.
begin;

alter table public.classes
  add column if not exists aliases text[] not null default '{}';

alter table public.classes
  add column if not exists is_official boolean not null default false;

create or replace function public.canonical_class_name(input_name text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(input_name, ''),
          '([0-9])\s*[.–—.]\s*([0-9])', '\1-\2', 'g'
        ),
        '\s+(massstart|sprint|distans|kortdistans|individuell|jaktstart|stafett|supersprint)(\s+.*)?$',
        '',
        'i'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

create or replace function public.normalized_class_name(input_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(public.canonical_class_name(input_name), '[^a-zA-ZåäöÅÄÖ0-9]+', '', 'g'));
$$;

-- Klasslistan kommer direkt från cupunderlaget för Sommar 2026.
create temporary table official_class_seed (
  name text primary key,
  sort_order integer not null,
  aliases text[] not null
) on commit drop;

insert into official_class_seed (name, sort_order, aliases) values
  ('Flickor Nybörjare', 10, array['Flickor nybörjare']),
  ('Flickor 10-11',     20, array['Flickor 10.11', 'Flickor 10–11', 'F 10-11', 'F10-11']),
  ('Pojkar 10-11',      30, array['Pojkar 10.11', 'Pojkar 10–11', 'P 10-11', 'P10-11']),
  ('Flickor 12-13',     40, array['Flickor 12.13', 'Flickor 12–13', 'F 12-13', 'F12-13']),
  ('Pojkar 12-13',      50, array['Pojkar 12.13', 'Pojkar 12–13', 'P 12-13', 'P12-13']),
  ('Flickor 14-15',     60, array['Flickor 14.15', 'Flickor 14–15', 'F 14-15', 'F14-15']),
  ('Pojkar 14-15',      70, array['Pojkar 14.15', 'Pojkar 14–15', 'P 14-15', 'P14-15']),
  ('Damer 16-17',       80, array['Damer 16.17', 'Damer 16–17', 'D 16-17', 'D16-17']),
  ('Herrar 16-17',      90, array['Herrar 16.17', 'Herrar 16–17', 'H 16-17', 'H16-17']),
  ('Damer 18-21',      100, array['Damer 18.21', 'Damer 18–21', 'D 18-21', 'D18-21']),
  ('Herrar 18-21',     110, array['Herrar 18.21', 'Herrar 18–21', 'H 18-21', 'H18-21']),
  ('Damer Senior',     120, array['Damer senior', 'D Senior', 'D Seniorer']),
  ('Herrar Senior',    130, array['Herrar senior', 'H Senior', 'H Seniorer']);

-- Skapa den officiella listan för varje befintlig cup.
insert into public.classes (cup_id, name, sort_order, aliases, is_official)
select c.id, s.name, s.sort_order, s.aliases, true
from public.cups c
cross join official_class_seed s
on conflict (cup_id, name) do update
set sort_order = excluded.sort_order,
    aliases = (
      select coalesce(array_agg(distinct a order by a), '{}')
      from unnest(public.classes.aliases || excluded.aliases) a
      where trim(a) <> '' and a <> public.classes.name
    ),
    is_official = true;

-- Flytta bara klasser som säkert matchar ett officiellt namn eller alias.
do $$
declare
  source_row record;
  target_row record;
begin
  for source_row in
    select c.*
    from public.classes c
    where not c.is_official
    order by c.cup_id, c.sort_order, c.id
  loop
    select official.* into target_row
    from public.classes official
    where official.cup_id = source_row.cup_id
      and official.is_official
      and (
        public.normalized_class_name(source_row.name) = public.normalized_class_name(official.name)
        or exists (
          select 1 from unnest(official.aliases) a
          where public.normalized_class_name(source_row.name) = public.normalized_class_name(a)
        )
      )
    order by official.sort_order
    limit 1;

    if target_row.id is not null then
      delete from public.results r
      where r.class_id = source_row.id
        and exists (
          select 1 from public.results existing
          where existing.class_id = target_row.id
            and existing.race_id = r.race_id
            and existing.athlete_id = r.athlete_id
        );

      update public.results
      set class_id = target_row.id
      where class_id = source_row.id;

      update public.classes
      set aliases = (
        select coalesce(array_agg(distinct a order by a), '{}')
        from unnest(aliases || source_row.aliases || array[source_row.name]) a
        where trim(a) <> '' and a <> name
      )
      where id = target_row.id;

      delete from public.classes where id = source_row.id;
    end if;
  end loop;
end $$;

comment on column public.classes.aliases is
  'Alternativa importerade klassnamn som kopplas till den officiella klassen.';
comment on column public.classes.is_official is
  'Endast officiella klasser får användas vid resultatimport och cupsammanställning.';

commit;
