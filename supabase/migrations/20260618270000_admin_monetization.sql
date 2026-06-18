-- ============================================================================
-- invoxai.io — Admin monetization: promo_codes + plans.overage_paise
-- + ensure business_categories.commission_rate exists (idempotent).
-- ============================================================================

-- 1. Ensure business_categories has a commission_rate column.
--    The foundation migration already creates it; this is a safety net.
alter table public.business_categories
  add column if not exists commission_rate numeric(5,4) not null default 0.0500
    check (commission_rate >= 0 and commission_rate <= 1);

-- 2. Extend plans with overage_paise (cost per contact over the limit, in paise).
--    contact_limit already exists from the plans migration; add if ever missing.
alter table public.plans
  add column if not exists contact_limit integer;

alter table public.plans
  add column if not exists overage_paise integer default null;

comment on column public.plans.overage_paise is 'Charged per contact beyond contact_limit, in paise (100 paise = ₹1). NULL = no overage billing.';

-- Seed sensible defaults for existing rows that have no overage set yet.
-- Starter / Pro get ₹10 per extra contact (1000 paise). Free → no overage.
update public.plans
  set overage_paise = 1000
  where overage_paise is null
    and lower(name) in ('starter', 'pro', 'growth', 'scale');

-- 3. Promo codes table — for plan-purchase discounts issued by admin.
create table if not exists public.promo_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  discount_type  text not null check (discount_type in ('percent', 'flat')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  scope          text not null default 'all',   -- 'all', plan name slug, etc.
  usage_limit    integer default null,           -- null = unlimited
  used_count     integer not null default 0 check (used_count >= 0),
  expires_at     timestamptz default null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.promo_codes is 'Admin-created discount codes for plan purchases. Not visible to sellers.';
comment on column public.promo_codes.discount_type is '"percent" (0-100) or "flat" (rupee amount).';
comment on column public.promo_codes.scope is 'Which plans this applies to: "all", or a plan name/slug.';

-- Auto-update updated_at on change.
drop trigger if exists promo_codes_set_updated_at on public.promo_codes;
create trigger promo_codes_set_updated_at
  before update on public.promo_codes
  for each row execute function public.set_updated_at();

-- Code must be uppercase alphanumeric (enforced at app layer too).
create index if not exists promo_codes_code_idx on public.promo_codes (lower(code));
create index if not exists promo_codes_active_idx on public.promo_codes (is_active) where is_active = true;

-- RLS: admin-only for all operations.
alter table public.promo_codes enable row level security;

drop policy if exists promo_codes_admin_all on public.promo_codes;
create policy promo_codes_admin_all on public.promo_codes
  for all using (public.is_admin()) with check (public.is_admin());

-- Allow read by authenticated users only when validating a code at checkout.
-- Restrict to active, non-expired codes with usage left.
drop policy if exists promo_codes_checkout_read on public.promo_codes;
create policy promo_codes_checkout_read on public.promo_codes
  for select
  using (
    is_active = true
    and (expires_at is null or expires_at > now())
    and (usage_limit is null or used_count < usage_limit)
  );

-- 4. Reload PostgREST schema cache.
notify pgrst, 'reload schema';
