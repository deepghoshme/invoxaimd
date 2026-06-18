-- A/B Tests + Variants
-- Apply: node scripts/db-apply.mjs supabase/migrations/20260618240000_ab_tests.sql

-- Main test table
create table if not exists ab_tests (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  page_id     uuid references pages(id) on delete set null,
  name        text not null,
  status      text not null default 'running' check (status in ('running','done','paused')),
  traffic_split integer not null default 50 check (traffic_split between 10 and 90),
  winner      text check (winner in ('A','B')),
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- Per-variant stats (updated by edge function or server action on each visitor/conversion)
create table if not exists ab_variants (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references ab_tests(id) on delete cascade,
  key         text not null check (key in ('A','B')),
  headline    text not null default '',
  visitors    integer not null default 0,
  conversions integer not null default 0,
  revenue_paise bigint not null default 0,   -- sum of order amounts in paise for RPV
  unique (test_id, key)
);

-- Indexes
create index if not exists ab_tests_store_id_idx on ab_tests(store_id);
create index if not exists ab_variants_test_id_idx on ab_variants(test_id);

-- RLS: owner only
alter table ab_tests enable row level security;
alter table ab_variants enable row level security;

create policy "owner select ab_tests"
  on ab_tests for select
  using (store_id in (select id from stores where owner_id = auth.uid()));

create policy "owner insert ab_tests"
  on ab_tests for insert
  with check (store_id in (select id from stores where owner_id = auth.uid()));

create policy "owner update ab_tests"
  on ab_tests for update
  using (store_id in (select id from stores where owner_id = auth.uid()));

create policy "owner delete ab_tests"
  on ab_tests for delete
  using (store_id in (select id from stores where owner_id = auth.uid()));

create policy "owner select ab_variants"
  on ab_variants for select
  using (test_id in (
    select id from ab_tests
    where store_id in (select id from stores where owner_id = auth.uid())
  ));

create policy "owner insert ab_variants"
  on ab_variants for insert
  with check (test_id in (
    select id from ab_tests
    where store_id in (select id from stores where owner_id = auth.uid())
  ));

create policy "owner update ab_variants"
  on ab_variants for update
  using (test_id in (
    select id from ab_tests
    where store_id in (select id from stores where owner_id = auth.uid())
  ));

create policy "owner delete ab_variants"
  on ab_variants for delete
  using (test_id in (
    select id from ab_tests
    where store_id in (select id from stores where owner_id = auth.uid())
  ));
