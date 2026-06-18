# Dashboard build plan — from the full-interface mockup

Design system + shell ported from the user's HTML mockup. Scoped under `.dx`
(`app/dashboard/dx.css`) so it never touches public/marketing pages.

## Files
- `app/dashboard/dx.css` — design system (tokens, cards, kpi, table, nav, sidebar, switch, plans…)
- `components/dx/Icon.tsx` — line-icon set
- `components/dx/Shell.tsx` — sticky topbar + grouped sidebar + theme toggle
- `components/dx/ui.tsx` — Phead, Kpis, Card, Table, AreaChart, ComingSoon
- `app/dashboard/layout.tsx` — seller nav config + DxShell wrap
- `app/dashboard/page.tsx` — Home (real order count; revenue/wallet placeholders)
- `app/dashboard/[...slug]/page.tsx` — placeholder for unbuilt nav routes

## Phase 1 — DONE
- [x] Scoped design system + shell (sidebar groups, topbar, theme toggle, mobile)
- [x] Seller nav (Main / Pages / Sell / Money / Marketing / Account)
- [x] Home page (KPIs + revenue chart + wallet card + quick-start)
- [x] Placeholder route for every unbuilt seller page
- [x] Real routes kept: bio builder, product builder/list, payment gateways

## Phase 2 — seller pages (static design → then data)
Build each with the mockup layout, real data where it exists:
- Orders (real: orders table) · CRM · Coupons · Abandoned · Upsell · Checkout
- Analytics (placeholder charts until events tracked)
- Store / Courses / Booking / Events / Payment / Lead form / VIP / Landing
  (page-type "manage" view: KPIs + table + templates)
- Wallet (needs wallet/ledger backend — Phase 2 schema) · Email · SEO · Domains · Billing · Settings

## Phase 3 — Buyer surface
- `app/(buyer)` or `account.*`: My orders · My purchases · Account. Reuse `.dx`.

## Phase 4 — Admin surface in `.dx`
- Rebuild `/admin` with DxShell + admin nav (Overview, Revenue, Sellers, Buyers,
  Plans, Commission, Limits, Templates, Promo, Domains, Emails, Branding,
  Gateways, Maintenance, Settings). Wire the ones with backend (commission,
  branding toggle, reserved names already exist).

## Notes
- Surface switch (seller/buyer/admin) in the mockup is demo-only; in production
  these are separate auth surfaces (app./account/admin.), not a toggle.
- Backends still to build for full data: analytics/events, wallet+ledger,
  coupons, CRM, email automation, plans/billing, templates marketplace.
