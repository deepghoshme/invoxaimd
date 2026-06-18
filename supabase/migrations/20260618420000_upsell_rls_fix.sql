-- Close the cross-tenant read on upsell_offers at the DB layer: the previous
-- "authenticated can SELECT active" policy let any logged-in seller read another
-- store's offers via direct REST. Restrict SELECT to the owning store; the
-- checkout renderer uses the service-role client (which bypasses RLS) anyway.
drop policy if exists upsell_offers_auth_select_active on public.upsell_offers;

do $$ begin
  create policy upsell_offers_owner_select on public.upsell_offers
    for select using (public.owns_store(store_id) or public.is_admin());
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
