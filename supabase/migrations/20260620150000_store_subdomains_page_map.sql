-- ============================================================================
-- MIGRATION: store_subdomains — page_id + label columns
--
-- Adds two optional columns to store_subdomains:
--   page_id  uuid  — when non-null, the subdomain resolves to that specific
--                    published page instead of the store root.
--   label    text  — friendly display name (e.g. "Summer campaign") shown in
--                    the dashboard; purely informational, not part of routing.
--
-- Idempotent: safe to re-run. The RLS update policy already exists
-- (store_subdomains_owner_update, created in 20260619220000) and covers all
-- columns on the row — no new policy needed.
-- ============================================================================

alter table public.store_subdomains
  add column if not exists page_id uuid
    references public.pages(id)
    on delete set null;

alter table public.store_subdomains
  add column if not exists label text;

comment on column public.store_subdomains.page_id is
  'Optional: when set, this subdomain resolves to the specific page (by id) '
  'instead of the store root. page_id must belong to the same store and be published. '
  'NULL means "store root" (original behavior).';

comment on column public.store_subdomains.label is
  'Optional friendly label shown in the seller dashboard (e.g. "Summer campaign"). '
  'Not used for routing.';

-- PostgREST schema cache reload
notify pgrst, 'reload schema';
