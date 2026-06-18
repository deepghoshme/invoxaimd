-- ============================================================================
-- invoxai.io — Event tickets table
-- Stores issued tickets after a confirmed payment for an event page.
-- Event details (title, date/time, location, tiers, poster) live in
-- pages.content JSONB; this table tracks individual issued tickets only.
-- ============================================================================

-- Ensure 'event' is a valid page_type (idempotent DO block).
do $$ begin
  alter type public.page_type add value if not exists 'event';
exception when others then null; end $$;

-- Main table ----------------------------------------------------------------
create table if not exists public.event_tickets (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references public.pages (id) on delete cascade,
  store_id      uuid not null references public.stores (id) on delete cascade,

  tier_name     text not null,                          -- e.g. "General", "VIP"
  buyer_name    text,
  buyer_email   text,
  qty           integer not null default 1 check (qty >= 1),

  -- The QR / verification code. Unique, server-generated, non-guessable.
  code          text not null unique,

  order_id      uuid references public.orders (id) on delete set null,
  status        text not null default 'issued'          -- issued | cancelled | used
                  check (status in ('issued', 'cancelled', 'used')),

  created_at    timestamptz not null default now()
);

comment on table public.event_tickets is
  'Issued tickets for event pages. One row per ticket code (may span qty > 1). Linked back to the order that created it.';

-- Indexes -------------------------------------------------------------------
create index if not exists event_tickets_page_idx    on public.event_tickets (page_id);
create index if not exists event_tickets_store_idx   on public.event_tickets (store_id);
create index if not exists event_tickets_order_idx   on public.event_tickets (order_id);
create index if not exists event_tickets_email_idx   on public.event_tickets (buyer_email);

-- RLS -----------------------------------------------------------------------
alter table public.event_tickets enable row level security;

-- Store owner reads their own tickets (via stores ownership).
drop policy if exists "owner reads own tickets" on public.event_tickets;
create policy "owner reads own tickets"
  on public.event_tickets for select
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

-- Public INSERT is NOT granted — creation is server-side via service role only.
-- No UPDATE/DELETE policies for public; admin manages via service role.

-- PostgREST schema cache reload ---------------------------------------------
notify pgrst, 'reload schema';
