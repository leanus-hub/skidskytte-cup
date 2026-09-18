-- Security hardening applied to production on 2026-09-18.
-- Pin helper-function search paths and make the public standings view obey
-- the permissions/RLS of the querying role.

alter function public.syd_cup_points(integer) set search_path = '';
alter function public.syd_cup_drop_count(integer) set search_path = '';
alter function public.canonical_class_name(text) set search_path = '';
alter function public.normalized_class_name(text) set search_path = '';

alter view public.cup_club_standings set (security_invoker = true);
