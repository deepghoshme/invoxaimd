# invoxai.io

All-in-one creator/business platform (India-first + global). Sellers build pages,
stores, courses, bookings and paid communities on a subdomain or custom domain,
add Meta/Google pixels, connect their own payment gateway, and sell to
SEO-friendly, sunset-themed pages. Buyers track orders. Admin controls plans,
per-category commission, branding, revenue and email. A prepaid wallet collects
platform commission.

**Stack:** Supabase (Postgres + Auth + Storage + RLS) · Next.js (SSR) on
Hostinger KVM2 VPS · Caddy (wildcard + custom-domain SSL) · CDN.

See `docs/` for the full spec, checklist and URL structure. Track build state in
`PROGRESS.md`.

## Status — Foundation phase

Schema + auth + RLS is the first deliverable (done): see `supabase/migrations/`.

| Migration | Contents |
|---|---|
| `…120000_foundation_identity_roles` | profiles, user_roles, role helpers, new-user trigger |
| `…120100_foundation_categories_reserved` | business categories (commission), reserved subdomains, availability fn |
| `…120200_foundation_stores_tenancy` | stores (tenant), onboarding, custom-domain fields, seller-role grant |
| `…120300_foundation_pages` | pages (builder source): types, content/seo/pixels JSONB, draft/publish |

## Apply the schema

These migrations target a hosted Supabase project (they use `auth.users` /
`auth.uid()`), so they can't run against a bare Postgres.

```bash
# Option A — Supabase CLI (recommended)
supabase link --project-ref <your-project-ref>
supabase db push

# Option B — paste each file in supabase/migrations/ into the
# Supabase Dashboard → SQL Editor, in filename order.
```

Then in the Supabase Dashboard:
1. **Auth → Providers**: enable Google (set client id/secret) and Email (OTP).
2. **Auth → Email Templates**: confirm the OTP template.

## Verify RLS (smoke test)

After applying, create two test users and confirm isolation:
- User A creates a store → gets `seller` role automatically; cannot see User B's store or pages.
- `select public.is_subdomain_available('app')` → `false`; a free name → `true`.
- A non-admin cannot `insert`/`update` `business_categories` or `user_roles`.

## Conventions
- Multi-tenant isolation via `owns_store(store_id)`; roles via separate
  `user_roles` table + `SECURITY DEFINER` helpers (no RLS recursion).
- **Public pages render server-side with the service role.** Anon has no direct
  read on `stores`/`pages`/`profiles` — keep this invariant.
- Two payment layers (platform billing vs seller payments) stay separate in code.
