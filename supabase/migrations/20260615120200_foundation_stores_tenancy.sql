-- ============================================================================
-- invoxai.io — Foundation migration 3/4: Stores (tenants) & onboarding
-- ----------------------------------------------------------------------------
-- A store is the tenant. One store per seller (the included subdomain). Extra
-- subdomains / custom domains are paid add-ons handled in a later phase.
-- Multi-tenant isolation lives here: every seller resource hangs off store_id
-- and is gated by the owns_store() helper.
-- ============================================================================

do $$ begin
  create type public.onboarding_step as enum
    ('otp', 'store_name', 'subdomain', 'category', 'billing', 'done');
exception when duplicate_object then null; end $$;

create table if not exists public.stores (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  store_name    text,
  -- Primary included subdomain. Lowercased + validated; globally unique.
  subdomain     text unique,
  category_id   uuid references public.business_categories (id),
  -- Optional per-store override of the category commission rate (admin/special
  -- deals). When null, the category's rate applies at sale time.
  commission_rate_override numeric(5,4) check (commission_rate_override >= 0 and commission_rate_override <= 1),

  -- Custom domain (1 included). On verify, pages auto-shift + subdomain 301s.
  custom_domain          text unique,
  custom_domain_verified boolean not null default false,
  -- Which host is canonical for SEO + redirects: 'subdomain' or 'custom'.
  primary_domain         text not null default 'subdomain'
                           check (primary_domain in ('subdomain', 'custom')),

  -- Onboarding (block dashboard until 'done'; resumable).
  onboarding_step      public.onboarding_step not null default 'otp',
  onboarding_completed boolean not null default false,
  billing              jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One store per owner for now (the single included subdomain).
  unique (owner_id),
  -- Enforce lowercase + DNS-label format at the DB layer too.
  constraint stores_subdomain_format
    check (subdomain is null or subdomain ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$'),
  constraint stores_custom_domain_lower
    check (custom_domain is null or custom_domain = lower(custom_domain))
);
comment on table public.stores is 'Tenant root. One per seller. Holds subdomain, custom domain, commission + onboarding state.';

create index if not exists stores_owner_idx        on public.stores (owner_id);
create index if not exists stores_custom_domain_idx on public.stores (custom_domain) where custom_domain is not null;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- Grant the 'seller' role automatically when a user creates their store -------
create or replace function public.handle_new_store()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.owner_id, 'seller')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

drop trigger if exists on_store_created on public.stores;
create trigger on_store_created
  after insert on public.stores
  for each row execute function public.handle_new_store();

-- Ownership helper used by every tenant-scoped table's RLS -------------------
create or replace function public.owns_store(_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores
    where id = _store_id and owner_id = auth.uid()
  );
$$;

-- RLS -----------------------------------------------------------------------
alter table public.stores enable row level security;

-- A seller sees only their own store; admins see all. Public storefront
-- rendering is done server-side with the service role, so anon needs no access.
drop policy if exists stores_select_own on public.stores;
create policy stores_select_own on public.stores
  for select using (owner_id = auth.uid() or public.is_admin());

-- A user may create exactly one store, owned by themselves.
drop policy if exists stores_insert_own on public.stores;
create policy stores_insert_own on public.stores
  for insert with check (owner_id = auth.uid());

drop policy if exists stores_update_own on public.stores;
create policy stores_update_own on public.stores
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists stores_delete_own on public.stores;
create policy stores_delete_own on public.stores
  for delete using (owner_id = auth.uid() or public.is_admin());
