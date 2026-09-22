-- Preserve club membership at the time of each result.
alter table public.results add column if not exists club_id uuid references public.clubs(id);
update public.results r set club_id=a.club_id from public.athletes a where a.id=r.athlete_id and r.club_id is null;
alter table public.results alter column club_id set not null;
create index if not exists results_club_idx on public.results(club_id);
-- Scoring, review and race-statistics views are migrated in production to join clubs through results.club_id rather than athletes.club_id.
