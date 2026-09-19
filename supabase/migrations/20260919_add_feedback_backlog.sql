create table if not exists public.feedback_items (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 type text not null check(type in ('result_error','data_error','technical','improvement')),
 status text not null default 'new' check(status in ('new','planned','in_progress','done','rejected')),
 priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
 message text not null check(char_length(message) between 3 and 5000), name text, email text, page_url text, admin_note text, roadmap_ref text);
alter table public.feedback_items enable row level security;
create policy "public submit feedback" on public.feedback_items for insert to anon, authenticated with check(status='new' and priority='normal' and admin_note is null and roadmap_ref is null);
create policy "admins read feedback" on public.feedback_items for select to authenticated using(public.is_admin());
create policy "admins update feedback" on public.feedback_items for update to authenticated using(public.is_admin()) with check(public.is_admin());
grant insert on public.feedback_items to anon, authenticated;
grant select,update on public.feedback_items to authenticated;