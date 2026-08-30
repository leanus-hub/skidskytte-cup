-- Cleanup v1.0.2
-- Verified in production on 2026-08-30.
-- Purpose: separate public read access from admin authorization and remove
-- unnecessary anon EXECUTE permission on public.is_admin().

begin;

-- Public users may only read published races.
drop policy if exists "public read races" on public.races;
create policy "public read races"
on public.races
for select
to public
using (status = 'published');

-- Public users may only read results from published races.
drop policy if exists "public read results" on public.results;
create policy "public read results"
on public.results
for select
to public
using (
  exists (
    select 1
    from public.races ra
    where ra.id = results.race_id
      and ra.status = 'published'
  )
);

-- Admin policies use public.is_admin(); public/anon policies no longer do.
revoke execute on function public.is_admin() from anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;

commit;
