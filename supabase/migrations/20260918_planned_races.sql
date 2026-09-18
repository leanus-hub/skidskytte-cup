-- Allow a cup calendar to be planned before timing/results exist.
alter table public.races alter column external_race_id drop not null;
alter table public.races alter column source_url drop not null;
alter table public.races add column if not exists organizer_club_id uuid references public.clubs(id) on delete set null;
alter table public.races add column if not exists location text;
