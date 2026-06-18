-- ============================================================================
-- invoxai.io — Page events (bio/page views + link clicks for analytics)
-- Inserts happen server-side with the service role (public, no session).
-- ============================================================================

create table if not exists public.page_events (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.pages (id) on delete cascade,
  store_id    uuid references public.stores (id) on delete cascade,
  kind        text not null check (kind in ('view', 'click')),
  link_label  text,
  device      text,                          -- mobile | desktop | tablet
  created_at  timestamptz not null default now()
);

create index if not exists page_events_idx on public.page_events (page_id, kind, created_at desc);
create index if not exists page_events_store_idx on public.page_events (store_id, created_at desc);

alter table public.page_events enable row level security;

-- Seller (owns store) + admin can READ their analytics. Writes via service role.
drop policy if exists page_events_owner_read on public.page_events;
create policy page_events_owner_read on public.page_events
  for select using (public.owns_store(store_id) or public.is_admin());

notify pgrst, 'reload schema';
