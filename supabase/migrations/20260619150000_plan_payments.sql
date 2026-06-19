-- Single-use ledger for seller plan-subscription payments. The UNIQUE index on
-- razorpay_order_id makes /api/plans/subscribe/verify idempotent and prevents a
-- paid order from being replayed to re-activate / extend a plan for free.
create table if not exists public.plan_payments (
  id                  uuid        primary key default gen_random_uuid(),
  store_id            uuid        not null references public.stores (id) on delete cascade,
  plan_id             uuid        references public.plans (id) on delete set null,
  razorpay_order_id   text        not null unique,
  razorpay_payment_id text,
  amount              integer     not null check (amount >= 0),
  created_at          timestamptz not null default now()
);

create index if not exists plan_payments_store_idx on public.plan_payments (store_id, created_at desc);

alter table public.plan_payments enable row level security;
-- Service-role only (the verify route uses the admin client); no public policies.

comment on table public.plan_payments is 'One row per confirmed plan-subscription payment; razorpay_order_id unique = single-use.';
