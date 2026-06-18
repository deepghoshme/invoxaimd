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

- [x] **Auth UI** (`/login`) — Email OTP (signInWithOtp → verifyOtp, 2-step) +
  Google OAuth; `/auth/callback` exchanges the OAuth code for a session
- [x] **Onboarding wizard** (`/onboarding`) — store name → subdomain (live
  availability via `is_subdomain_available` RPC, debounced) → category (shows
  commission rate) → billing (jsonb). Server actions write RLS-scoped; advances
  `onboarding_step`; sets `onboarding_completed` on finish. `lib/auth.ts` helpers.
- [x] **Dashboard** (`/dashboard`) — onboarding guard (redirects to `/onboarding`
  until complete; both redirect to `/login` when signed out — verified), store
  summary + "create first page" CTA, sign-out server action
- [x] Shared UI primitives in `globals.css` (card/input/btn/alert/steps)
- [x] Build green; route guards + tls-check verified at runtime

- [x] **Live on the VPS** — `deploy/setup.sh` + `caddy-step.sh` run: `invoxai-web`
  systemd service + Caddy 2.11.4 (auto-HTTPS). Hostinger cloud firewall opened
  80/443. Domains serve over HTTPS.
- [x] **Host-based routing** (`app/page.tsx`): `app.*`→`/dashboard`, `admin.*`→`/admin`,
  else marketing landing
- [x] **Google OAuth** configured in Supabase + Google Cloud (Site URL fixed to
  `https://app.invoxai.io`, redirect allow-list, `…supabase.co/auth/v1/callback`)
- [x] **Thin admin panel** (`/admin`, `admin.invoxai.io`): stats, per-category
  commission editor (RLS admin-write), reserved subdomains. Auth checked IN-page
  before any fetch (verified: unauth → 307 /login, no payload leak).
- [x] **Admin role granted** to `iamdeep.mk@gmail.com` (user-confirmed)
- Note: auth cookies are **host-only** by design → each surface (app/admin) has its
  own login; admin session does not leak to seller subdomains.

- [x] **Bio page end-to-end (Phase 1 core)** — first real seller page:
  - public renderer `app/sites/[domain]/[[...path]]` resolves store by host
    (subdomain or verified custom domain, service role) → renders published page
  - `middleware.ts` rewrites seller hosts → `/sites/<host>/<path>`; platform hosts
    keep the auth-session refresh (note: folder must NOT be `_`-prefixed — Next
    treats `_name` as private/non-routable)
  - sunset `BioTemplate` + `PixelInjector` (Meta + Google) on public pages
  - `generateMetadata` → SEO title/desc/OG/Twitter/canonical/robots from `page.seo`
  - dashboard editor `/dashboard/pages/bio` (profile, links, SEO, pixels,
    draft/save/publish; RLS owner-scoped). "Build your bio page" CTA wired.
  - Verified: claimed subdomain `dmkad.invoxai.io/bio` → 200 ("not published yet"
    until the seller publishes); unclaimed subdomains get no cert (tls-check denies)

- [x] **Bio page builder COMPLETE** (full feature, not just MVP):
  - 8 themes (`lib/bioThemes.ts`); backgrounds: theme/solid/gradient/image-upload;
    entrance animations (fade/rise/pop); button styles (rounded/pill/outline)
  - social icons (`components/SocialIcon.tsx`, 11 platforms) + per-link custom icon
  - two-pane builder with **live web/mobile preview** (shared `BioTemplate`)
  - publish gated by minimum requirements (name + ≥1 link/social)
  - `ImageInput` (local upload + URL) on avatar / OG / background / link icons
  - storage `media` bucket + `/api/upload`
  - **left-sidebar AppShell** (seller + admin), responsive hamburger on mobile
  - professional full-width layouts (`.page-wrap` / `.wide-wrap`)
  - 📌 memory: image-upload-everywhere + left-sidebar-responsive saved

- [x] **Bio builder polish (2026-06-15)**: full-width FB cover (bottom-curved) +
  avatar position L/C/R; featured link (shine + size/text controls + colors);
  full-width mobile sticky CTA; 14 themes; 10 looping animated backgrounds;
  scroll-safe centered fill; contained centered column on web (full-width mobile);
  hidden preview scrollbar; smaller modern brand badge

- [x] **Dashboard + admin redesign (2026-06-16)**: persistent sticky **header**
  (page title · View site · light/dark toggle · account menu), modern sidebar,
  dynamic stat cards. No-flash theme boot script. Theme-adaptive **"⚡ Built with
  InvoxAI"** badge + admin **global on/off** (`platform_settings` table, migration
  `20260616120000`, applied). Bio: no cover image → clean normal page (no banner).

- [x] **One-page product (`opp`) + seller Razorpay checkout (2026-06-16)** —
  Phase-1 seller-payments slice (seller's OWN keys; commission snapshot on order,
  wallet deduction deferred to Phase 2):
  - migration `20260616130000`: `orders` + `payment_gateways` (applied; RLS on —
    orders owner-read, gateways owner-all; checkout writes via service role)
  - **Products** builder: list (`/dashboard/pages/products`) + two-pane editor
    (`/[id]`) w/ live `ProductTemplate` preview, draft/publish, SEO+pixels, features
  - **Payments** settings (`/dashboard/settings/payments`): connect Razorpay
    (key_id + secret, enable toggle; secret server-only, blank-keeps-existing)
  - public renderer: `/opp/{id}` product page (Buy → creates order) + page-type-aware
    checkout `/opp/checkout/{order_id}` (buyer form → Razorpay → verify signature →
    mark paid → fire Purchase pixels). Routes: `/api/checkout/{create,start,verify}`
  - `lib/`: `ids.ts` (nanoid public_id), `products.ts` (money), `razorpay.ts`
    (order create + HMAC verify), `sites.ts` (gateway/order/commission helpers)
  - ⚠️ **Not yet tested end-to-end** — needs a seller to connect real Razorpay
    (test) keys; signature verify + pixel fire are coded but unverified live.

- [x] **Product page richness + sticky Buy (2026-06-16)**: sticky bottom Buy bar
  (web+mobile) w/ offer/retail price + **% OFF** badge + looping white shine;
  mobile **edge-to-edge full-screen**; **auto-fit** image slider (swipe + dots,
  `object-fit:contain`); optional **testimonials / FAQ / Privacy·T&C·Refund**
  sections. Builder gained gallery/testimonial/FAQ/policy editors. (content-only,
  no schema change.)

- [x] **Product polish + Urgency suite (2026-06-16)**:
  - web **two-column** (image left / sticky summary right, Shopify-like); mobile
    full-screen; **scroll-reveal sticky Buy** (inline at top → slides up on scroll,
    web+mobile); fixed earlier mobile-buy CSS source-order bug
  - image slider **auto-scroll** + interval; **title align + icon**; trust **badges**
    (presets+custom); footer payment text-logos (toggle) + **seller-uploaded icons**;
    **seller contact** (email required to publish, phone optional)
  - **Urgency**: offer **countdown** (+expiry msg, optional disable-buy past end),
    **limited seats** (auto-decrements from paid order count → Sold out disables buy),
    **live-purchase popups** (seller list or built-in pool). All content-only (JSONB).

- [x] **Product page → SuperProfile-style 2-col + embedded checkout (2026-06-16)**:
  desktop two columns — left ≈65% white content (title, banner image, description,
  gallery, testimonials 2×2, FAQ, policies, footer + Powered-by InvoxAI), right
  ≈35% **sticky blue hex-pattern panel** with an **on-page checkout form**
  (`InlineCheckout`: email/name/phone+country → create order → Razorpay → verify →
  purchase pixels, no page nav). Mobile: title → checkout → content. Sold-out →
  contact button (custom url/text/icon, else WhatsApp, else email). Button
  icon+animation (none/shine/pulse), countdown align, seats above button.
  Note: old single-column `.prod-*` / BuyButton / StickyBuyBar now unused (the
  `/opp/checkout/{id}` page + CheckoutForm still exist for direct order links).

- [x] **Dashboard fully rebuilt to the mockup `.dx` design (2026-06-16)** — single
  source of truth `app/dashboard/dx.css` (scoped `.dx`, light/dark). `components/dx/`:
  `Shell` (full-height sidebar w/ one logo, scrollable hidden-scrollbar nav, profile
  footer; topbar = wallet pill + icon theme toggle + profile avatar w/ Google pic +
  dropdown Account/Billing/Sign-out; client-side nav so no jump-to-top), `Icon`,
  `ProfileMenu`, `ui` (Phead/Kpis/Card/Table/charts/Donut/PageType/ComingSoon).
  Seller + admin surfaces both use it. Page registries `sellerPages.tsx` /
  `adminPages.tsx` render every menu page with **real data where a backend exists,
  empty states otherwise** (no demo data). Functional so far: **Seller Settings**
  (save store name/category), **Admin Plans** (CRUD on new `plans` table, migration
  `20260616140000`, applied). Spec: `docs/DASHBOARD-PLAN.md`, `docs/OPP-PAGE-SPEC.md`.

- [x] **Bio builder rebuilt (Linktree-style) + analytics (2026-06-16)**:
  - `lib/bio.ts` model + 16 themes, 4 button styles, 3 shapes, 8 bg animations, 6
    templates. `components/bio/`: `BioView` (renders bio; `stage` = public full-screen
    bg + centered ~440 mobile column; no cover → no blank banner), `BioBuilder`
    (two-pane live preview, Builder/Public toggle), `SocialIcon` (official brand icons),
    `BioTracker` (view beacon). CSS `app/bio.css` (scoped `.bioview` / `.biobuild`).
  - Features: cover/profile/featured uploads w/ Change+Remove buttons, links (icon
    or thumbnail, highlight ★, header type, reorder ↑↓), socials (platform dropdown +
    official icon), **Meta-blue fixed verified badge**, themes/bg/shape, save/publish.
  - Builder at `/dashboard/pages/bio/edit`; menu/overview at `/dashboard/pages/bio`.
  - **Real analytics**: `page_events` table (migration `20260616150000`, applied).
    Views via `/api/bio/track` beacon; clicks via `/api/bio/go` redirect (records +
    device). Bio menu page shows real Views/Clicks/CTR/Top-links/Devices.
  - Public renderer (`app/sites/.../[[...path]]`) now uses `BioView` (was BioTemplate).

- [x] **Website builder built (mirrors bio, 2026-06-17)** — multi-section
  homepage page type (renders at the store **root** `subdomain.invoxai.io`):
  - `lib/website.ts` model + constants (reuses bio `ACCENTS`; `BGS`/`NAVS`/
    `BTSHAPES`/`ICONS`/`SECTIONS`) + `DEFAULT_WEBSITE` seed.
  - `app/website.css` — full mockup port scoped `.webview` (public + preview) /
    `.webbuild` (builder), incl. class-driven `.site.m` mobile preview.
  - `components/website/`: `WebsiteView` (client; hero + 11 reorderable sections —
    features/stats/gallery/brands/pricing/video/about/testimonials/faq/newsletter/
    cta; internal nav home/about/contact/legal:*; FAQ/slider/cookie/hamburger/
    YouTube; `stage` for public), `WebsiteTracker` (view beacon, reuses
    `/api/bio/track`). CTA clicks routed through `/api/bio/go`.
  - `app/dashboard/website/{page,edit/page,actions}.tsx` — overview w/ real
    `page_events` analytics (Views/CTA clicks/CTR/devices) + two-pane live builder
    (web/mobile + Builder/Public toggles, save/publish). Removed the placeholder
    `website:` stub in `sellerPages.tsx` (dedicated route wins).
  - Public renderer branch added for `page_type === "website"`. Spec:
    `docs/WEBSITE-PAGE-SPEC.md`. Build green; deployed; routes verified.
  - **Fixes/round 2 (2026-06-17):** preview overlap fixed (web preview renders at
    1280px + zoom-scales to fit via `ScaledFrame`/ResizeObserver — was squishing
    desktop grids into the narrow pane); **favicon** wired into published
    `<head>` (`generateMetadata` icons) + website **SEO** (meta title/desc/OG)
    stored in `content.seo`; pro **centered container** (content capped 1180px,
    full-bleed bands); new builder options: **hero layout** (right/left/center/
    none), **logo height**, **sticky header** toggle.
  - **Features/round 3 (2026-06-17):**
    - **Quick-start templates** (`TEMPLATES` in `lib/website.ts`) — design presets
      applied over content (keeps text).
    - **Alternating section tint** (`content.tint`, `.tintbg`).
    - **Working contact form + newsletter** — new table `site_messages` (migration
      `20260617120000`, applied; RLS owner-read, service-role insert) +
      `POST /api/site/contact` + functional `ContactForm`/`NewsletterForm` in
      `WebsiteView` (success states; preview no-ops). Leads shown on the website
      overview ("Recent messages"). Verified end-to-end (200 + row insert).
    - **Real sub-page URLs**: `pageTypeForPath` maps `/about /contact /privacy
      /terms /refund` → website; `websiteSubPage()` → `initialPage`; nav/footer
      links are real anchors w/ `history.pushState` (instant nav + deep-links).
  - **Round 26 — Store builder v1 + polish (2026-06-17):** built the Store builder
    end-to-end (mirrors website): `components/store/{StoreView,StoreBuilder}`,
    `app/store.css` (`.storeview`), `app/dashboard/store/{page,actions}`,
    `app/studio/store/page` (full-screen), public renderer `store` branch (pulls
    real `opp` products via `getStoreProducts`), removed sellerPages `store` stub.
    Storefront: announce, sticky topbar, banner slider (autoplay), brand marquee,
    top-selling (autoplay), featured banner, catalog grid/list/row + search/cat/sort,
    cart + login drawers (client), mobile bottom-nav, footer pay logos, dark theme.
    Cards link to `/opp/{id}` (v1). Editable section headings. **Inline Products
    manager** added (`StoreItem`/`content.products[]` — add/edit/remove name/cat/
    price/MRP/badge/rating/img/link in the builder; merged with real opp products
    in `StoreView`). Then moved product management to a **dedicated Products
    section on `/dashboard/store`** (`StoreProducts` client + `saveStoreProducts`
    action merging into `content.products`; add/edit/remove + list) and removed the
    inline Products panel from the builder.
  - **Round 27 — PDP layout on opp (2026-06-17):** `OppContent.layout` ("landing"|
    "pdp") + PDP fields (variants/specs/related/highlights/offers/productType/
    deliveryDays/category/rating/reviews_count). New `PDPTemplate` (catalog detail:
    gallery+thumbs, highlights, variants, pincode delivery, tabs desc/included/specs/
    reviews, related, reuses `InlineCheckout`); `ProductTemplate` branches to it.
    `.pdp-*` CSS in globals. ProductEditor: layout toggle + Category field. PDP v1
    renders from existing content.
  - **Round 30 — fix blank product editor (2026-06-17):** `/dashboard/pages/
    products/[id]/page.tsx` was a leftover stub returning `null` → editor blank
    (and why product-type/plans/digital "didn't show" — ProductEditor never
    rendered). Restored: loads the `opp` page (owner-scoped) + gateway → renders
    `ProductEditor` with content/publicUrl/payEnabled. All add-product options now
    visible.
  - **Round 29 — unify store products → real products (2026-06-17):** the Store
    dashboard Products section now manages **real opp products** (NewProductButton →
    createProduct → full editor; list of opp products w/ thumb/type/price/status +
    Edit links). Removed inline StoreItem manager from the dashboard (StoreView keeps
    SAMPLE fallback for builder preview; `DEFAULT_STORE.products=[]`). This surfaces
    all the rich add-product options (image/type/plans/digital/seats) which live in
    the opp editor. `.dx-prow` list CSS.
  - **Round 28 — product type/plans/digital (2026-06-17):** `OppContent.productType`
    (digital/physical/service/subscription) + `plans[{label,period,price}]` +
    `digital{kind,file,url}`; constants `PRODUCT_TYPES`/`PLAN_PERIODS`. ProductEditor:
    type selector, plans editor (service/subscription, Monthly/Yearly/Lifetime/Custom
    + price), digital delivery (URL or file/PDF upload via /api/upload), physical
    delivery-days. PDPTemplate: plan selector sets checkout amount (subscription
    "per mo/yr"), digital instant-delivery note. NEXT: PDP variants/specs/offers/
    related editors; opp gap-fill; buyer accounts; dashboard audit.
  - **Round 25-26 prior. NEXT after PDP editors: opp
    `layout` switch), then opp gap-fill, multi-item cart + buyer auth, dashboard audit.
  - **Round 25 — Store/PDP plan + store model (2026-06-17):** wrote
    `docs/STORE-PDP-PLAN.md` (Store builder, PDP via `opp layout`, opp gap-fill,
    dashboard consistency — all mirroring the website builder, phased). Started
    Phase 1: `lib/store.ts` (`StoreContent` model + `STORE_SECTIONS`/`DISPLAYS`/
    `PAY_METHODS` + `DEFAULT_STORE`, reuses website constants; products come from
    real `opp` pages via `getStoreProducts`). NEXT: `StoreView` → public `store`
    renderer branch → `StoreBuilder` → `/studio/store` + `/dashboard/store`.
  - **Round 24 — Shop section (2026-06-17):** new `shop` section auto-pulls the
    store's published `opp` products → cards (img/title/price/compare) linking to
    `/opp/{public_id}`. `getStoreProducts()` in lib/sites; renderer maps via
    `formatPrice`/OppContent and passes `products` to `WebsiteView`; builder shows
    samples + Shop panel (heading + note); `GRID_SECTIONS`/PANEL_FOR updated.
  - **Round 23 — per-section bg image (2026-06-17):** `secBgImg` per section →
    `.sec-bgimg` photo band + dark overlay + white headings; 🖼 upload/clear button
    in the Sections list row.
  - **Round 22 — SEO preview (2026-06-17):** live Google search-snippet + OG social
    share preview cards in the SEO panel (`.seo-google`/`.seo-og`), update as you
    type, dark-aware.
  - **Round 21 — scroll fx (2026-06-17):** `backTop` (floating back-to-top) +
    `scrollProgress` (top reading bar) via `ScrollFx` (window scroll listener);
    toggles in Add-ons panel; `.scrollfx`/`.backtop` CSS (fixed).
  - **Round 20 — polish + dividers (2026-06-17):** design-polish pass (card hover
    lifts, popular-plan emphasis, button hovers, animated nav underline, FAQ/footer
    hovers, typography). **Section shape dividers** (`divider`: none/slant/tilt/round,
    `DIVIDERS`) via clip-path/border-radius on colored bands (tint/grad/dark) + auto
    top-padding; control in Animations panel.
  - **Round 19 — custom brand color (2026-06-17):** `accentColor` (hex) overrides
    the accent preset → drives `--siteGrad` (2-tone) + `--primary/--secondary/--accent`
    inline on `.site`; Brand panel `<input type=color>` + "use a preset" clear.
  - **Round 18 — quick sections + click-to-edit (2026-06-17):** "Quick sections"
    chip panel (top of builder) to show/hide sections fast for Home or the active
    page. **Click-to-edit**: sections render with `data-sec` (incl. hero); builder
    `.scr` onClick maps the clicked section → its editor panel via `PANEL_FOR`
    (opens accordion + scrolls); hover outline; link nav suppressed in preview.
  - **Round 17 — more builder + width revert (2026-06-17):** reverted default
    `pageWidth` → standard (normal). New options: **gallery layout** (slider/grid,
    `galStyle`), **testimonials layout** (grid/carousel, `testStyle`), **count-up
    stats** (`statsCount`, `StatNum` IntersectionObserver, live only). Also earlier
    this session: preview URL bar + device toggle merged into browser chrome,
    preview pinned sticky; studio `.dx.studio{display:block}` killed the 240px
    phantom sidebar (the `.dx` grid). NOTE: dmkad has pageWidth:"wide" saved →
    change in builder to go normal.
  - **Round 16 — per-page content + wide default (2026-06-17):** default
    `pageWidth` → **wide** (1400) incl. fallback, so existing/new sites aren't
    narrow. **Per-page section content**: builder "Editing: Home/Page" target
    (`editTarget`); `cFull`/derived `c`/`set` — section edits on a page write to
    `pages[i].data` (overrides), page structure stays global via `setGlobal`,
    **save writes `cFull`** (no corruption). Banner + preview `initialPage` wired.
    Renderer merges `pages[].data` over base for the active page
    (`pages[].data: Partial<WebsiteContent>`).
  - **Round 15 — content width setting (2026-06-17):** exposed the `--ww` content
    container as a real builder setting — `pageWidth` (`WIDTHS`/`WIDTH_PX`:
    standard 1180 / wide 1400 / xwide 1600 / full ≈edge-to-edge) emitted inline as
    `--ww` on `.site` (Brand panel chips). Persists through publish; full-bleed
    bands unaffected.
  - **Round 14 — studio full-screen + per-page intro (2026-06-17):** studio
    builder now fills the screen (removed 1600px wrap cap; `.browser` max-width
    100%; `ScaledFrame` renders at pane width when wider than desktop, scales
    smaller panes up — no centered empty sides). Started per-page content:
    `pages[].intro {title,sub,text,img}` renders a unique intro block above each
    custom page's sections (`.pageintro` CSS + Pages-panel intro fields). NEXT:
    per-page section content overrides (`page.data` merge).
  - **Round 13 — builder UX + legal + fixes (2026-06-17):** **Legal** is now a
    flexible doc set (`legal: Record`, `LEGAL_DOCS` = privacy/terms/refund/shipping/
    disclaimer/cookies, editable titles; `WEBSITE_SUBPATHS`+`websiteSubPage` route
    all legal slugs). **Newsletter** form stacks on mobile (no overlap).
    **Builder accordion** — panels collapse, opening one auto-closes others
    (class-toggle via `editorRef` effect + `.webacc` CSS; native-free, survives
    re-renders). **Full-screen builder** moved to **`/studio/website`** (top-level
    route, wrapped in `.dx`, no dashboard chrome) opened in a **new tab**; old
    `/dashboard/website/edit` redirects there; overview links use `target=_blank`.
  - **Round 12 — website quick wins (2026-06-17):** 3 new sections —
    **spotlight** (image+text alt rows `spots[]`), **banner** strip, **map** (embed
    from `mapAddr`/city); **pricing monthly/yearly toggle** (`pricingYearly` +
    `WSPlan.py`, stateful `Pricing` component); **per-section padding** (`secPad`
    sm/md/lg → `.pad-*`) + **columns** (`secCols` → grid `--cols` var on grid
    sections, `GRID_SECTIONS`); **hero video background** (`heroVideo` →
    `.hero-vid` video+overlay). Builder: Sections rows gained Spacing/Columns
    dropdowns; Spotlight/Banner/Map editors; pricing yearly fields; hero video URL.
    Constants `PADS`/`GRID_SECTIONS`. Also fixed bottom horizontal scrollbar at the
    `html,body` level (`overflow-x: clip`).
  - **Round 11 — overflow + mobile/dark polish (2026-06-17):** killed the
    auto-moving bottom scroll line (`overflow-x: clip` on `.webview`/`.site`);
    hero image now clean (image only; gradient only as `.himg.ph` placeholder);
    `.webview` filled with `--bg` (no white gaps/overscroll in dark); comprehensive
    mobile pass — header Logo·CTA·☰ with theme/auth in the menu, 18px padding,
    scaled headings, compact countdown/stats, full-width capped gallery+hero
    images. Inspected live `dmkad` (dark, all sections + custom page OK).
  - **Round 10 — premium options + fixes (2026-06-17):** +6 backgrounds
    (auroraflow/silk/meshblobs/flowfield/starfield/shapes); hero image height,
    gallery slide height + **auto-play** (`Slider` component), video width;
    **brand marquee blank fix** (6 copies); per-plan **pricing link** (`WSPlan.url`);
    **cookie shows once** (localStorage, live only); footer centered; +3 step
    layouts (gradient/connected/minimal); **contact layouts** (split/card/stacked/
    map) `CONTACT_STYLES`; **page-section reorder** (▲▼ + add chips);
    **mobile header** = logo+CTA+☰ (theme toggle + auth moved into the menu via
    `.navtools` hidden on mobile + `.mtool`); mobile gallery full-width;
    **Login/Sign-up/My-account** nav buttons (`content.auth`, configurable links —
    full buyer-auth/session deferred).
  - **Round 9 — custom Pages system (2026-06-17):** `content.pages[]` =
    `{slug,label,inMenu,order[]}`. Each page composes any sections (shared
    content), gets a real URL + menu link. `WebsiteView` renders custom pages via
    extracted `renderSections()`; nav lists them; `lib/sites.ts websiteSubPage`
    passes custom slugs through; public `resolve()` matches a single unknown
    segment against `content.pages[].slug` (falls back to the website page).
    Builder gained a **Pages** editor (add/rename, slug auto + unique, show-in-menu,
    section chips). Build green; `/services` route returns 200 (no crash).
    NOTE: section *content* is shared across pages in v1 (per-page unique content
    is a future step). Could not live-test custom-page render — sandbox blocked
    writing to the prod `pages` record (correct).
  - **Round 8 — builder/site improvements (2026-06-17):** hero **button 1&2 links**
    (`hb1url`/`hb2url`); **logo → home** (header+footer clickable); **editable
    menu** (labels/show-hide + custom links via `menu`/`menuLinks`); **gallery
    rebuilt** (real `<img>`, light bg not black, mobile-sized, empty state);
    **brand slider** logo image upload (`brandLogos`) + seamless loop; **floating
    chat** custom icon/label(pill)/link; **Steps** 3 layouts (`stepStyle`:
    cards/numbers/timeline) + hover; **Countdown** 3 styles (`cdStyle`:
    cards/solid/minimal); **mobile UX** (stacked full-width hero buttons, bigger
    gallery, working hamburger). Constants `STEP_STYLES`/`CD_STYLES`.
  - **Round 7 — fixes (2026-06-17):** **cookie click hid all content** —
    root cause: `Nav`/`Content`/`Foot` were inline components rendered as
    `<Content/>`, so any state change (cookie dismiss/menu/theme) remounted the
    subtree and the imperative scroll-reveal `.in` class was lost → sections stuck
    at opacity:0. Fixed by rendering them as function calls `{Content()}` (stable
    DOM, `.in` persists). **Mobile menu** now opens on the real published site
    (added `@media(max-width:760)` `.snav.open .mmenu` rules — previously only the
    builder's `.site.m` had them). **"Powered by invoxai"** alignment fixed (footer
    `<a>` is `display:block` by default → forced it inline). Sections-list rows
    hardened against overflow.
  - **Round 6 — Wix-level pass (2026-06-17):** **dark site theme** (`theme` +
    `.dark-site` tokens) + **visitor light/dark toggle** (`themeToggle`); **font
    picker** (7 families, Google fonts loaded on demand via injected `<link>`,
    applied through `--font-sora`); **hero upgrades** (eyebrow pill, rotating
    **typewriter**, star **rating** line, gradient hero bg); **new sections**
    Team / Logos grid / **live Countdown** timer; **per-section background**
    selector (auto/plain/tint/gradient/dark via `secStyle` + `.gradbg`/`.darkbg`).
    New constants `FONTS`/`FONT_FAMILY`/`FONT_GOOGLE`/`SEC_STYLES` in
    `lib/website.ts`. Builder gained font/theme controls, hero extras, Team/Logos/
    Countdown editors, and a per-section bg dropdown. Build green; deployed;
    published `dmkad` verified rendering. (Existing sites pick up new sections on
    next builder open+save — edit page backfills `order`/`sections`.)
  - **Round 5 — premium/Wix pass (2026-06-17):** full-site **animated background
    motion layer** (`.sitebg` + 8 variants: aurora/mesh/blobs/waves/particles/
    grid/rays/spotlight) behind a `.sitewrap` z-layer; **scroll-reveal** section
    animations (fade/rise/zoom/slide via IntersectionObserver, **live-site only**
    to avoid builder flicker — gated by `live` prop); **animated gradient
    headline** (`htitleGrad`); **button animations** (shine/pulse/glow/lift); new
    **How-it-works / Steps** section. Builder gained an **Animations & effects**
    panel + Steps editor. Edit page backfills `order`/`sections` so existing sites
    get new sections. Constants `BGS`(9)/`REVEALS`/`BTN_ANIMS` in `lib/website.ts`.
    Verified: published `dmkad` renders `banim-shine anim-rise` + `sitebg` + 12
    reveal wrappers, no errors. (New defaults apply to new/re-saved sites.)
  - **Round 4 (2026-06-17):** **editable section headings** for every section
    (`content.heads[key].{title,sub}`, `headFields()` in builder, fallbacks in
    `WebsiteView`); **public-view left-align fixed** (Public tab renders
    `WebsiteView` responsively/centered — removed the fixed-1280 `ScaledFrame`
    that left-aligned on wide panes; `ScaledFrame` now flex-centers too); **editor
    overlap hardening** (border-box + `min-width:0` on flex form rows); fixed a
    preview remount/flicker (`{Preview()}` call instead of `<Preview/>`).

## ⏭️ RESUME HERE NEXT SESSION (start 2026-06-17)
**Dashboard is the active workstream** — make pages functional one prompt at a time
(user provides per-page prompts). Follow [[builder-page-rules]]. Done: Seller Settings,
Admin Plans, Bio builder+analytics. **Next candidates:** product (opp) builder rebuilt
in `.dx` (still uses old `ProductEditor`/`ProductTemplate` — not yet ported to the new
shell), buyer surface (My orders/purchases/account — NOT built), Admin Commission
editable, real analytics on product pages. Migrations applied via
`node scripts/db-apply.mjs <file>` (see [[deploy-workflow]]).

### Older Phase B remainder (product checkout commerce)
Rework the order/pricing flow (needs a migration: add `orders.meta jsonb` for
bumps/coupon/custom-field answers, recompute amount server-side at /api/checkout/start):
- **Full-screen checkout** (mobile fit, like the product page)
- **Custom fields**: seller-defined fields (label + required toggle) collected at checkout
- **Order bumps**: add-on products (image + title + price + offer price) selectable on checkout
- **Coupon codes**: seller-defined (percent/flat), applied on checkout → discount
Product `content` already JSONB — add `custom_fields[]`, `bumps[]`, `coupons[]` to OppContent;
amount must be recomputed + re-validated server-side (never trust client totals).

### Next (still Foundation / Phase 1)
- [ ] **OTP email template** (user, Supabase dashboard): ensure it contains `{{ .Token }}`
- [ ] **Hosted Supabase auth config** (user, in dashboard): enable Google provider
  (client id/secret) + ensure the OTP email template includes `{{ .Token }}`
  (default template sends a magic link, not the 6-digit code)
- [ ] **Apply deploy** (`deploy/setup.sh`, needs sudo) to put domains on HTTPS
- [ ] **Rotate DB password + service_role key** (were shared in chat) once stable
- [ ] Email config schema (admin + seller, encrypted creds) + "send test"
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
