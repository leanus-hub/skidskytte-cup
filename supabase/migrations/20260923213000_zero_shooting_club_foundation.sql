create table public.zero_shooting_club (
 id uuid primary key default gen_random_uuid(), athlete_id uuid references public.athletes(id) on delete set null,
 athlete_name text not null, club_name text, season_label text, event_name text not null, event_date date, class_name text, discipline text,
 medal_level text not null check(medal_level in ('gold','silver','bronze')), source_type text not null check(source_type in ('legacy','syd_cup','external','manual')),
 source_url text, source_result_id uuid references public.results(id) on delete set null, source_external_result_id uuid references public.external_results(id) on delete set null,
 verified boolean not null default true, created_at timestamptz not null default now(),
 unique(athlete_name,season_label,event_name,class_name,discipline,source_type)
);
create index idx_zero_shooting_club_athlete_id on public.zero_shooting_club(athlete_id);
create index idx_zero_shooting_club_event_date on public.zero_shooting_club(event_date);
create index idx_zero_shooting_club_source_result_id on public.zero_shooting_club(source_result_id);
create index idx_zero_shooting_club_source_external_result_id on public.zero_shooting_club(source_external_result_id);
alter table public.zero_shooting_club enable row level security;
create policy "Public read zero shooting club" on public.zero_shooting_club for select to anon,authenticated using(true);
create policy "Admins manage zero shooting club" on public.zero_shooting_club for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.zero_shooting_club to anon,authenticated; grant insert,update,delete on public.zero_shooting_club to authenticated;