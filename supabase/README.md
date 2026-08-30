# Supabase migrations

This folder contains forward-only SQL migrations that describe intentional database changes for the current application.

## Rules

- Do not rebuild or reset the production database from historical installation scripts.
- Do not rerun old v6.1/v6.2/v6.3 setup files against production unless they have first been reviewed against the current schema.
- Every production database change should be added here as a new migration file after it has been verified.
- Prefer small, reversible, single-purpose migrations.
- RLS, grants and SECURITY DEFINER functions must be reviewed together because they form one authorization model.
- Public views should use `security_invoker = true` so underlying table RLS remains effective.

## Current baseline

The production database was reviewed on 2026-08-30. At that point:

- RLS was enabled on all public base tables.
- Public scoring/statistics views used `security_invoker = true`.
- Public race/result reads were separated from admin authorization.
- `anon` no longer had EXECUTE permission on `public.is_admin()`.
- `authenticated` and `service_role` retained EXECUTE permission on `public.is_admin()`.
- `public.handle_new_user()` remained a hardened SECURITY DEFINER trigger function with an empty search path and no direct EXECUTE grant to anon/authenticated/service_role.

Historical v6.x SQL files still exist in Git history, but they are not the authoritative migration path for the current production database.
