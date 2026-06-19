-- Orders: support admin refunds.
-- Adds 'refunded' to the status CHECK and refund bookkeeping columns.
-- Apply via: node scripts/db-apply.mjs supabase/migrations/20260619130000_orders_refund.sql

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'orders') then
    -- Widen the status CHECK to include 'refunded'
    alter table public.orders drop constraint if exists orders_status_check;
    alter table public.orders add constraint orders_status_check
      check (status in ('created', 'paid', 'failed', 'refunded'));

    -- Refund bookkeeping
    alter table public.orders add column if not exists refunded_at   timestamptz;
    alter table public.orders add column if not exists refund_reason text;
  end if;
end $$;

notify pgrst, 'reload schema';
