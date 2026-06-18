-- ============================================================================
-- invoxai.io — Product catalog (store products, distinct from one-page `opp`)
-- ----------------------------------------------------------------------------
-- "Store products" are lightweight catalog items a seller adds via a popup on
-- the Store page (name, price, image, type…) with a per-item "show in store"
-- toggle. They render in the storefront and check out inline (no landing page).
-- One-page products (`pages.page_type = 'opp'`) remain separate full pages and
-- may be created FROM a catalog product (prefill) — see createProduct().
-- ============================================================================

create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  store_id          uuid not null references public.stores (id) on delete cascade,
  name              text not null default 'Untitled product',
  description       text,
  price             numeric(12,2),
  compare_at_price  numeric(12,2),
  currency          text not null default 'INR',
  image             text,
  gallery           jsonb not null default '[]'::jsonb,   -- string[] image urls
  category          text,
  badge             text,
  product_type      text not null default 'digital',      -- digital|physical|service|subscription
  digital           jsonb,                                 -- { kind:'file'|'url', file?, url? }
  plans             jsonb not null default '[]'::jsonb,    -- [{ label, price, period }]
  delivery_days     integer,
  store_visible     boolean not null default true,
  sort              integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists products_store_idx on public.products (store_id, sort, created_at desc);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists products_owner_all on public.products;
create policy products_owner_all on public.products
  for all
  using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));

-- Storefront is rendered with the service role, but allow public read of visible
-- items as a safety net (e.g. anon supabase-js reads).
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select using (store_visible = true);

-- Orders can now reference a catalog product (page_id stays null for these).
alter table public.orders add column if not exists product_id uuid references public.products (id) on delete set null;

notify pgrst, 'reload schema';
