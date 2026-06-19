-- Order-bump upsell support on orders.
-- A bump adds the upsell offer product to a single-product order. We snapshot
-- the bump on the order row so fulfillment knows the buyer also purchased the
-- offer product, and so the amount breakdown is auditable. Amount is the bump's
-- contribution to `orders.amount` (paise), price already discounted server-side.
alter table public.orders
  add column if not exists bump_offer_id uuid
    references public.upsell_offers (id) on delete set null;

alter table public.orders
  add column if not exists bump_amount integer
    check (bump_amount is null or bump_amount >= 0);

alter table public.orders
  add column if not exists bump_title text;

comment on column public.orders.bump_offer_id is 'Upsell order-bump applied at checkout (null = none).';
comment on column public.orders.bump_amount  is 'Paise added to amount by the bump (already discounted).';
comment on column public.orders.bump_title   is 'Snapshot of the bump product name at order time.';
