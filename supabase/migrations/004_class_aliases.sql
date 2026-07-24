-- Klassalias och automatisk sammanslagning av klassnamn
-- Kör denna migration efter 003_biathlontiming_import.sql.
begin;

alter table public.classes
  add column if not exists aliases text[] not null default '{}';

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
          '([0-9])\s*[.–—]\s*([0-9])', '\1-\2', 'g'
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

-- Normalisera och slå ihop befintliga dubbletter inom respektive cup.
do $$
declare
  class_row record;
  target_id uuid;
  target_name text;
  target_aliases text[];
  canonical_name text;
  alias_values text[];
begin
  for class_row in
    select c.* from public.classes c order by c.cup_id, c.sort_order, c.id
  loop
    -- Klassen kan redan ha tagits bort när en tidigare dubblett slogs ihop.
    if not exists (select 1 from public.classes where id = class_row.id) then
      continue;
    end if;

    canonical_name := public.canonical_class_name(class_row.name);
    target_id := null;
    target_name := null;
    target_aliases := '{}';

    select c.id, c.name, c.aliases
      into target_id, target_name, target_aliases
    from public.classes c
    where c.cup_id = class_row.cup_id
      and c.id <> class_row.id
      and public.normalized_class_name(c.name) = public.normalized_class_name(canonical_name)
    order by
      case when c.name = canonical_name then 0 else 1 end,
      c.sort_order,
      c.id
    limit 1;

    if target_id is null then
      alias_values := coalesce(class_row.aliases, '{}');
      if class_row.name <> canonical_name and not (class_row.name = any(alias_values)) then
        alias_values := array_append(alias_values, class_row.name);
      end if;
      update public.classes
      set name = canonical_name, aliases = alias_values
      where id = class_row.id;
    else
      -- Om båda klasserna har samma deltagare i samma lopp behålls målklassens rad.
      delete from public.results r
      where r.class_id = class_row.id
        and exists (
          select 1 from public.results existing
          where existing.class_id = target_id
            and existing.race_id = r.race_id
            and existing.athlete_id = r.athlete_id
        );

      update public.results set class_id = target_id where class_id = class_row.id;

      update public.classes
      set aliases = coalesce((
        select array_agg(distinct value order by value)
        from unnest(
          coalesce(target_aliases, '{}') ||
          coalesce(class_row.aliases, '{}') ||
          array[class_row.name]
        ) value
        where value is not null and trim(value) <> '' and value <> target_name
      ), '{}')
      where id = target_id;

      delete from public.classes where id = class_row.id;
    end if;
  end loop;
end $$;

comment on column public.classes.aliases is
  'Alternativa klassnamn från resultatsystem, exempelvis Pojkar 10.11 eller Pojkar 10-11 Massstart.';

commit;
