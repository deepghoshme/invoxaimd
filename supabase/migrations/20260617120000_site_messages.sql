-- ============================================================================
-- invoxai.io — Site messages (website contact form + newsletter signups)
-- Inserts happen server-side with the service role (public form, no session).
-- Seller (owns store) + admin can READ their leads.
-- ============================================================================

create table if not exists public.site_messages (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  page_id     uuid references public.pages (id) on delete set null,
  kind        text not null default 'contact' check (kind in ('contact', 'newsletter')),
  name        text,
  email       text,
  phone       text,
  message     text,
  created_at  timestamptz not null default now()
);

create index if not exists site_messages_store_idx on public.site_messages (store_id, created_at desc);

alter table public.site_messages enable row level security;

drop policy if exists site_messages_owner_read on public.site_messages;
create policy site_messages_owner_read on public.site_messages
  for select using (public.owns_store(store_id) or public.is_admin());

notify pgrst, 'reload schema';
