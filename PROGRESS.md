# PROGRESS — invoxai.io

> Session-to-session build log. Pairs with `docs/FINAL-master-prompt.md`,
> `docs/FULL-PLAN-CHECKLIST.md`, `docs/URL-STRUCTURE.md`.
> Rule #1: scope discipline — one module at a time, phase by phase.

## Current phase: **Foundation**

### Done
- [x] Repo init + `.gitignore`
- [x] Supabase migration scaffolding (`supabase/migrations/`, `config.toml`)
- [x] **Schema + RLS — identity & roles** (`20260615120000`)
  - `profiles` (1:1 auth.users, global buyer/seller/admin identity)
  - `user_roles` + `app_role` enum (separate table → no RLS recursion)
  - `has_role()`, `is_admin()` SECURITY DEFINER helpers
  - new-user trigger: auto-create profile + grant `buyer`
- [x] **Schema + RLS — categories & reserved names** (`20260615120100`)
  - `business_categories` w/ per-category `commission_rate` (revenue stream #2)
  - `reserved_subdomains` seeded (blocks app/admin/www/api/…)
  - `is_subdomain_available()` (SECURITY DEFINER, no table leak)
- [x] **Schema + RLS — stores / tenancy** (`20260615120200`)
  - `stores` tenant table: subdomain, custom domain, onboarding, commission override
  - auto-grant `seller` role on store create
  - `owns_store()` helper (multi-tenant isolation backbone)
- [x] **Schema + RLS — pages** (`20260615120300`)
  - `pages` w/ JSONB content/seo/pixels, draft/publish, all page types
  - singleton uniqueness (website/store/bio/courses), `public_id` for "many"
- [x] `config.toml` auth: Google + Email OTP (6-digit, 10-min)
- [x] **Applied all 4 migrations to hosted Supabase** (project `rfprazujzxykmjzobmtl`) — verified: 6 tables RLS-on, policies present, helpers SECURITY DEFINER, seeds + enums + `is_subdomain_available()` all correct
- [x] `.env.local` (gitignored) with Supabase URL + publishable/anon/service_role keys + DATABASE_URL; `.env.example` committed
- [x] **Initial git commit** of foundation work (was untracked) — `de9d3f1`
- [x] **Next.js app scaffold** (App Router, TS, SSR) — `package.json`, `tsconfig.json`,
  `next.config.ts`, root `layout.tsx` (Sora + Inter via `next/font`), marketing
  landing placeholder `app/page.tsx`. `npm run build` green; prod server returns 200.
- [x] **Supabase client layer** (`lib/supabase/`):
  - `client.ts` browser (anon, RLS) · `server.ts` cookie-bound SSR (anon, RLS) ·
    `admin.ts` service-role (`server-only`, bypasses RLS — narrow use only)
  - `lib/env.ts` validated env access (service-role read lazily so client bundles can't leak it)
  - `middleware.ts` refreshes the auth session cookies on every request
- [x] **Design system tokens** in `app/globals.css` — Sunset (light) + Twilight (dark)
  as named CSS vars, brand gradient, 16px radius, Sora/Inter wiring

- [x] **DNS verified live** — apex, `www`, `app`, `admin`, and wildcard `*.invoxai.io`
  all resolve to the VPS `93.127.195.147` (confirmed via dig)
- [x] **Caddy + deploy config prepared** (`deploy/`):
  - `Caddyfile` — reverse-proxy → `127.0.0.1:3000`; auto-HTTPS for apex/www/app/admin;
    **on-demand TLS** for seller subdomains + custom domains (www→apex redirect, gzip/zstd)
  - `app/api/tls-check/route.ts` — Caddy "ask" endpoint; allows a host only if it matches
    a claimed `stores.subdomain` or a verified `stores.custom_domain` (rate-limit guard)
  - `invoxai-web.service` systemd unit (nvm node path baked in) + `deploy/README.md` runbook
  - ⏳ **NOT yet applied** — needs sudo: user runs the `deploy/README.md` steps to
    install Caddy, the systemd service, and provision certs

### Next (still Foundation)
- [ ] **Rotate DB password + service_role key** (were shared in chat) once stable
- [ ] Verify RLS as real users (anon/authenticated JWT), not just service-role DDL
- [ ] Email config schema (admin + seller, encrypted creds) + "send test" + OTP send
- [ ] Onboarding flow (OTP → store name → subdomain check → category → billing)
- [ ] Thin admin (categories, commission rates, reserved names)
- [ ] First sunset template + renderer (design tokens already in `app/globals.css`)

## Decisions / open questions
- **Contact overage ₹10/extra** — marked *confirm* in spec; not yet modeled.
- One store per seller (unique owner_id). Extra subdomains = paid add-on, modeled later.
- Public pages render server-side via service role (anon has NO direct table read) — keep this invariant.
- Commission: rate lives on category; `stores.commission_rate_override` for special deals.

## How to apply migrations
```bash
# from your machine, with Supabase CLI + project linked:
supabase link --project-ref <your-ref>
supabase db push
# or paste each file in supabase/migrations/ into the Supabase SQL editor, in order.
```
