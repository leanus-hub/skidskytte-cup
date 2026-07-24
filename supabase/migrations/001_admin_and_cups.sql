-- Säker uppgradering: behåller befintliga säsonger och klubbar.
begin;

alter table public.clubs
  add column if not exists short_name text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists active boolean not null default true;

alter table public.cups
  add column if not exists cup_type text not null default 'vinter'
    check (cup_type in ('sommar', 'vinter')),
  add column if not exists min_races_for_prize integer not null default 3,
  add column if not exists active boolean not null default true;

alter table public.races
  add column if not exists sort_order integer not null default 0;

-- Skapa automatiskt en profil när en användare skapas i Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Befintliga Auth-användare får också en profil.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', email)
from auth.users
on conflict (id) do nothing;

-- Inloggade användare måste kunna läsa sin egen profil.
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_admin());

commit;
