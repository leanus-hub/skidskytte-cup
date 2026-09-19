-- Foundation for selectable cup rulesets.
-- Applied to production before this migration was committed.
create table if not exists public.cup_rulesets (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, description text,
 points_by_place jsonb not null default '{"1":15,"2":13,"3":12,"4":11,"5":10,"6":9,"7":8,"8":7,"9":6,"10":5,"11":4,"12":3,"13":2,"14":1}'::jsonb,
 participation_points integer not null default 1,
 drop_schedule jsonb not null default '{"0":0,"1":0,"2":0,"3":0,"4":1,"5":2,"6":2,"7":2,"8":3,"9":3,"10":3,"11":4}'::jsonb,
 min_races_for_prize integer not null default 3, club_points_use_all boolean not null default true,
 medal_league_enabled boolean not null default true, active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.cup_rulesets enable row level security;
drop policy if exists "Public can read active cup rulesets" on public.cup_rulesets;
create policy "Public can read active cup rulesets" on public.cup_rulesets for select using (active or public.is_admin());
drop policy if exists "Admins manage cup rulesets" on public.cup_rulesets;
create policy "Admins manage cup rulesets" on public.cup_rulesets for all using (public.is_admin()) with check (public.is_admin());
insert into public.cup_rulesets(code,name,description) values ('syd-cup-2026','Syd Cup 2026','Nuvarande Syd Cup-regler: 15 poäng för seger, 13 för tvåa, därefter fallande till 1 poäng. Klubbkampen räknar alla insamlade poäng.') on conflict(code) do nothing;
alter table public.cups add column if not exists ruleset_id uuid references public.cup_rulesets(id);
update public.cups set ruleset_id=(select id from public.cup_rulesets where code='syd-cup-2026') where ruleset_id is null;
create or replace function public.cup_points_for_place(p_ruleset_id uuid,p_place integer) returns integer language sql stable set search_path='' as $$ select case when p_place is null or p_place<1 then 0 when (r.points_by_place ->> p_place::text) is not null then (r.points_by_place ->> p_place::text)::int else r.participation_points end from public.cup_rulesets r where r.id=p_ruleset_id $$;
create or replace function public.cup_drop_count_for_ruleset(p_ruleset_id uuid,p_race_count integer) returns integer language sql stable set search_path='' as $$ select coalesce((r.drop_schedule ->> least(greatest(coalesce(p_race_count,0),0),11)::text)::int,case when coalesce(p_race_count,0)>11 then 4 else 0 end) from public.cup_rulesets r where r.id=p_ruleset_id $$;
grant select on public.cup_rulesets to anon,authenticated;
grant execute on function public.cup_points_for_place(uuid,integer) to anon,authenticated;
grant execute on function public.cup_drop_count_for_ruleset(uuid,integer) to anon,authenticated;
