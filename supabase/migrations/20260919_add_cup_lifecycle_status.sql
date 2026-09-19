alter table public.cups add column if not exists lifecycle_status text not null default 'ongoing';
alter table public.cups drop constraint if exists cups_lifecycle_status_check;
alter table public.cups add constraint cups_lifecycle_status_check
  check (lifecycle_status in ('planned','ongoing','completed'));

update public.cups
set lifecycle_status='completed'
where id in (
  'fbe43004-0668-4693-9629-3d7c6c3c06de',
  '3b92845e-289b-47d9-8931-6774c35a4d8d'
);
