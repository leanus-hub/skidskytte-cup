create table public.external_series (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.external_series_seasons (
 id uuid primary key default gen_random_uuid(), series_id uuid not null references public.external_series(id) on delete restrict,
 season_name text not null, points_by_place jsonb not null default '{}'::jsonb, best_results_count integer,
 ties_same_points boolean not null default true, active boolean not null default true, created_at timestamptz not null default now(),
 unique(series_id,season_name), check(best_results_count is null or best_results_count>0)
);
alter table public.external_result_imports add column series_season_id uuid references public.external_series_seasons(id) on delete restrict;
alter table public.external_results add column series_season_id uuid references public.external_series_seasons(id) on delete restrict;
create index idx_external_series_seasons_series_id on public.external_series_seasons(series_id);
create index idx_external_result_imports_series_season_id on public.external_result_imports(series_season_id);
create index idx_external_results_series_season_id on public.external_results(series_season_id);
alter table public.external_series enable row level security; alter table public.external_series_seasons enable row level security;
create policy "Admins manage external series" on public.external_series for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "Admins manage external series seasons" on public.external_series_seasons for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.external_series to authenticated; grant select,insert,update,delete on public.external_series_seasons to authenticated;
insert into public.external_series(code,name) values('swecup','SweCup');
insert into public.external_series_seasons(series_id,season_name,points_by_place,best_results_count,ties_same_points)
select id,'2025-2026','{"1":50,"2":45,"3":41,"4":37,"5":34,"6":31,"7":28,"8":26,"9":24,"10":22,"11":20,"12":19,"13":18,"14":17,"15":16,"16":15,"17":14,"18":13,"19":12,"20":11,"21":10,"22":9,"23":8,"24":7,"25":6,"26":5,"27":4,"28":3,"29":2,"30":1}'::jsonb,8,true from public.external_series where code='swecup';
