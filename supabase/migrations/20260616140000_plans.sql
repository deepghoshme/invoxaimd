-- ============================================================================
-- invoxai.io — Subscription plans (admin-managed, public-readable for pricing)
-- ============================================================================

create table if not exists public.plans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  price          integer not null default 0,       -- ₹ per month
  page_limit     integer,                           -- null = unlimited
  contact_limit  integer,
  features       text[] not null default '{}',
  is_popular     boolean not null default false,
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

insert into public.plans (name, price, page_limit, contact_limit, features, is_popular, sort_order) values
  ('Free',    0,    1,    100,   '{"1 page","100 contacts"}', false, 10),
  ('Starter', 499,  10,   1000,  '{"10 pages","1,000 contacts","Custom domain"}', true, 20),
  ('Pro',     1999, null, 10000, '{"Unlimited pages","10,000 contacts","3 custom domains"}', false, 30)
on conflict do nothing;

alter table public.plans enable row level security;

drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans for select using (true);

drop policy if exists plans_admin_write on public.plans;
create policy plans_admin_write on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
