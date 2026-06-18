-- ============================================================================
-- invoxai.io — Subscriptions (one active subscription per store)
-- ----------------------------------------------------------------------------
-- Tracks which plan each store is subscribed to, the amount locked at
-- subscription time, and billing period. Plan MRR is computed as the sum of
-- amount_paise across all rows where status = 'active'.
--
-- RLS:
--   • store owner can SELECT their own subscription
--   • is_admin() can SELECT all
--   • INSERT / UPDATE / DELETE: service-role or admin only (no public writes)
--     — sellers go through the server action which uses the service-role client
-- ============================================================================

create table if not exists public.subscriptions (
  id                 uuid        primary key default gen_random_uuid(),
  store_id           uuid        not null unique references public.stores (id) on delete cascade,
  plan_id            uuid        not null references public.plans (id) on delete restrict,
  status             text        not null default 'active'
                                   check (status in ('active', 'canceled', 'past_due')),
  -- amount locked at subscription time (paise). plans.price is INR; we store
  -- paise here so aggregation matches every other monetary column on the platform.
  amount_paise       integer     not null check (amount_paise >= 0),
  started_at         timestamptz not null default now(),
  current_period_end timestamptz not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.subscriptions is
  'One active subscription per store. amount_paise is locked at selection time from plans.price * 100. Plan MRR = SUM(amount_paise) WHERE status = ''active''.';

create index if not exists subscriptions_store_idx  on public.subscriptions (store_id);
create index if not exists subscriptions_plan_idx   on public.subscriptions (plan_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.subscriptions enable row level security;

-- store owner reads their own subscription
drop policy if exists subscriptions_owner_read on public.subscriptions;
create policy subscriptions_owner_read on public.subscriptions
  for select
  using (public.owns_store(store_id));

-- admin reads all
drop policy if exists subscriptions_admin_read on public.subscriptions;
create policy subscriptions_admin_read on public.subscriptions
  for select
  using (public.is_admin());

-- no public INSERT / UPDATE / DELETE — service-role client only
-- (server actions call createAdminClient() which bypasses RLS)

notify pgrst, 'reload schema';
