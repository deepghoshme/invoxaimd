-- VIP Community: vip_members table
-- CEO applies this via: node scripts/db-apply.mjs supabase/migrations/20260618400000_vip.sql

create table if not exists public.vip_members (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references public.pages(id) on delete cascade,
  store_id     uuid not null references public.stores(id) on delete cascade,
  buyer_name   text,
  buyer_email  text not null,
  plan         text not null check (plan in ('monthly', 'yearly', 'lifetime')),
  status       text not null default 'active' check (status in ('active', 'expired')),
  invite_link  text,
  order_id     uuid references public.orders(id) on delete set null,
  joined_at    timestamptz not null default now(),
  expires_at   timestamptz
);

-- Indexes for efficient lookups
create index if not exists vip_members_page_id_idx   on public.vip_members(page_id);
create index if not exists vip_members_store_id_idx  on public.vip_members(store_id);
create index if not exists vip_members_email_idx     on public.vip_members(buyer_email);
create index if not exists vip_members_order_id_idx  on public.vip_members(order_id);

-- RLS
alter table public.vip_members enable row level security;

-- Store owner can read their own members (via stores.owner_id)
create policy "store owner reads own vip_members"
  on public.vip_members for select
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

-- Service role (server-side via admin client) handles inserts — no anon insert policy.

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
