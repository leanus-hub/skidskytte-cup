-- Public cup pages must not need to execute is_admin through ruleset RLS.
drop policy if exists "Public can read active cup rulesets" on public.cup_rulesets;
create policy "Public can read active cup rulesets" on public.cup_rulesets for select using (active);
grant execute on function public.is_admin() to anon,authenticated;
