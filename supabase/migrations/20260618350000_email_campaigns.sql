-- Email Campaigns (seller-facing)
-- Apply: node scripts/db-apply.mjs supabase/migrations/20260618350000_email_campaigns.sql
--
-- Stores campaigns a seller composes and sends (or saves as draft) to their
-- buyer / subscriber audience. Actual delivery is handled by the platform's
-- email service (email_config, admin-managed). This table only tracks intent
-- and status; it does not store per-recipient delivery records.

create table if not exists email_campaigns (
  id               uuid        primary key default gen_random_uuid(),
  store_id         uuid        not null references stores(id) on delete cascade,
  subject          text        not null,
  body_html        text        not null default '',
  -- audience segment the sender chose
  audience         text        not null default 'all'
                                check (audience in ('all_buyers', 'subscribers', 'all')),
  -- lifecycle
  status           text        not null default 'draft'
                                check (status in ('draft', 'sent')),
  recipient_count  integer     not null default 0,
  sent_at          timestamptz null,
  created_at       timestamptz not null default now()
);

create index if not exists email_campaigns_store_id_idx
  on email_campaigns(store_id);

create index if not exists email_campaigns_store_status_idx
  on email_campaigns(store_id, status);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table email_campaigns enable row level security;

-- Seller reads their own campaigns
create policy "ec_select_owner"
  on email_campaigns for select
  using (public.owns_store(store_id));

-- Seller creates campaigns scoped to their store
create policy "ec_insert_owner"
  on email_campaigns for insert
  with check (public.owns_store(store_id));

-- Seller updates (save draft / mark sent)
create policy "ec_update_owner"
  on email_campaigns for update
  using (public.owns_store(store_id));

-- Seller deletes drafts
create policy "ec_delete_owner"
  on email_campaigns for delete
  using (public.owns_store(store_id));

-- ── PostgREST schema-cache reload ────────────────────────────────────────────
notify pgrst, 'reload schema';
