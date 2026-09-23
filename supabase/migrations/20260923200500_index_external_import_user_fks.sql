-- Cover auth user foreign keys reported by Supabase Performance Advisor.
create index if not exists idx_external_result_imports_created_by on public.external_result_imports(created_by);
create index if not exists idx_external_result_imports_approved_by on public.external_result_imports(approved_by);
