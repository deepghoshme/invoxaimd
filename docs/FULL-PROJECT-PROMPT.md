# InvoxAI — Full Project Prompt / Master Spec

> A complete, build-from-scratch prompt describing the entire InvoxAI platform: purpose, architecture, data model, every dashboard & admin menu page (logic + functions + features), the page builders, the public multi-tenant renderer, the commerce/checkout flow, and the full design system. Hand this to an AI (or engineer) to reconstruct or extend the product.

---

## 0. One-line summary

Build **InvoxAI** — a multi-tenant, India-first creator/seller commerce SaaS (a blend of Linktree + SuperProfile + Shopify). Each seller gets a subdomain `{store}.invoxai.io` (and optional custom domain) on which they publish a **link-in-bio page, a multi-section website, a product storefront, and one-page product/landing+checkout pages**. Sellers connect **their own Razorpay keys** and sell digital/physical/service/subscription products; the platform snapshots a per-category **commission** on each order. A seller **dashboard** and a platform **admin** panel manage everything.

**Stack:** Next.js (App Router, RSC + server actions), TypeScript, Supabase (Postgres + Auth + Storage, RLS), Razorpay payments, plain CSS design system (CSS variables), deployed on a VPS via `next start` + systemd + Caddy (production build, no hot reload).

---

## 1. Domains, hosts & deployment

- **Platform hosts:** `invoxai.io` / `www.invoxai.io` (marketing), `app.invoxai.io` (seller dashboard), `admin.invoxai.io` (admin), plus `localhost`.
- **Tenant hosts:** any other host = a seller site → `{subdomain}.invoxai.io` or a verified `custom_domain`.
- **`middleware.ts`:** if host ∉ platform hosts and path isn't internal (`/_next`, `/sites`, `/api`, `/auth`), **rewrite** `host + path` → `/sites/{host}{path}`. Refresh Supabase session cookies for platform hosts.
- **Root `app/page.tsx`:** host-based redirect — `app.*`→`/dashboard`, `admin.*`→`/admin`, else marketing landing.
- **Deploy model:** production build served by `next start` behind Caddy; **edits require `npm run build` + `sudo systemctl restart invoxai-web`** to go live. DB migrations applied via `node scripts/db-apply.mjs <file.sql>` (reads `DATABASE_URL` from `.env.local`; idempotent SQL; `notify pgrst,'reload schema'` after new tables).

---

## 2. Auth & onboarding

- **`/login`** — client OTP (6-digit email code) **or Google OAuth** via Supabase. After auth: `admin.*`→`/admin`, else `/dashboard`. `/auth/callback` exchanges code→session (honors `X-Forwarded-*` from Caddy); `/auth/signout` POST clears session.
- **`/onboarding`** — guarded wizard. On first visit `ensureStore()` creates the `stores` row. Steps (enum `onboarding_step`): `otp → store_name → subdomain → category → billing → done`.
  - store_name (2–60 chars), subdomain (3–63, DNS-label, **live availability** via `is_subdomain_available()` RPC, debounced 400ms, blocks reserved names), category (shows commission rate), billing ({full_name, phone, country, business_name?, address?, city?, state?, postal_code?, tax_id?}). Final step sets `onboarding_completed=true`.
- **Guards:** dashboard requires auth (else `/login`) and `onboarding_completed` (else `/onboarding`); admin requires `user_roles.role='admin'`.

---

## 3. URL scheme (public seller site)

| Surface | URL | page_type / handler |
|---|---|---|
| Bio (link-in-bio) | `/` (root fallback) | `bio` |
| Website (homepage) | `/`, `/about`, `/contact`, `/{slug}`, legal `/privacy` `/terms` `/refund` `/shipping` `/disclaimer` `/cookies` | `website` (+ sub-page key) |
| Store catalog | `/store` | `store` |
| Catalog product (Shopify-style PDP) | `/p/{product_id}` | `products` table row |
| One-page product | `/opp/{public_id}` | `opp` |
| Future "many" types | `/{pay,book,ldf,vpc,led,env}/{public_id}` | reserved |
| Checkout | `/{page_type}/checkout/{order_id}` | order render |

**Resolution (`app/sites/[domain]/[[...path]]/page.tsx` + `lib/sites.ts`):**
1. `resolveStoreByHost(host)` → store by subdomain or verified custom_domain.
2. If `path[0] ∈ MANY_PREFIXES` and `path[1]≠"checkout"` → fetch published page by `public_id`.
3. Else `pageTypeForPath(path)` → singleton page (`website`/`store`/`bio`/`courses`); empty path falls back to `bio`.
4. Single unknown segment may match a custom website page slug.
5. Special routes handled before resolve: `/p/{id}` (catalog product) and `/{type}/checkout/{orderId}`.
6. `generateMetadata` builds SEO/OG/Twitter from page `seo` (website stores seo+favicon inside `content`).

---

## 4. Data model (Supabase / Postgres, all RLS-protected)

Helper: `owns_store(store_id)` (SECURITY DEFINER) = `auth.uid()` is the store owner. Public seller pages render with the **service role** (anon has no direct table read). Enums: `app_role(admin|seller|buyer)`, `page_type`, `page_status(draft|published)`, `onboarding_step`, order `status(created|paid|failed)`.

- **profiles** — `id`(=auth.users), email, full_name, avatar_url. RLS: own/admin.
- **user_roles** — user_id, role(app_role), unique(user_id,role). Trigger grants `buyer` on signup, `seller` on store create. Admin-only writes.
- **business_categories** — name, slug, `commission_rate`(numeric 5,4), is_active, sort_order. Seeded (Digital 5%, Courses 5%, Coaching 7%, Events 4%, Services 6%, Physical 3%, Memberships 7%, Other 5%). Public read; admin write.
- **reserved_subdomains** — name(PK), reason. Used by `is_subdomain_available()`. Admin-only.
- **stores** (tenant root) — owner_id(unique), store_name, subdomain(unique), category_id, `commission_rate_override`, custom_domain(unique), custom_domain_verified, primary_domain, onboarding_step, onboarding_completed, `billing`(jsonb). RLS: own/admin.
- **pages** — store_id, `page_type`, `public_id`(nanoid for many-types), slug, title, template_id, `content`(jsonb), `seo`(jsonb), `pixels`(jsonb), status, is_premium, published_at. Unique(store_id,public_id) & (store_id,slug); singleton unique(store_id,page_type) for website/store/bio/courses. RLS via owns_store.
- **platform_settings** — singleton; `show_brand_badge`(bool). Public read; admin write.
- **payment_gateways** — store_id(PK), provider('razorpay'), key_id, **key_secret (server-only)**, is_enabled. RLS via owns_store; service role for checkout.
- **orders** — store_id, page_id(nullable), `product_id`(nullable, catalog), page_type, buyer_email/name/phone, product_title, `amount`(int paise), currency, gateway, gateway_order_id/payment_id/signature, status, `commission_rate` + `commission_amount`(snapshot), paid_at. RLS: owner read; insert/update via service role (guest checkout).
- **products** (store catalog, distinct from `opp` pages) — store_id, name, description, price, compare_at_price, currency, image, `gallery`(jsonb[]), category, badge, product_type, `digital`(jsonb), `plans`(jsonb), delivery_days, **store_visible**, sort, + **PDP fields**: `details`(jsonb [{label,value}]), `highlights`(jsonb[]), `options`(jsonb [{name,values[]}] variants), `reviews`(jsonb [{name,rating,text,date}]), rating, reviews_count, stock, sku, vendor, shipping_info, returns_info, `trust_badges`(jsonb[]). RLS: owner all; **public read where store_visible=true**.
- **page_events** — page_id, store_id, kind(view|click), link_label, device(mobile|tablet|desktop). Owner read; service-role insert. Powers all analytics.
- **site_messages** — store_id, page_id, kind(contact|newsletter), name, email, phone, message. Owner read; service-role insert (public forms).
- **plans** — name, price(₹/mo), page_limit, contact_limit, features(text[]), is_popular, is_active, sort_order. Seeded Free/Starter/Pro. Public read; admin write.

---

## 5. Backend functions & API

**`lib/sites.ts`:** resolveStoreByHost, getPublishedPage, getPublishedPageByPublicId, getStoreProducts (published opp for website Shop), getStoreCatalog (visible catalog), getProductById, getPageById, getPaidOrderCount (drives "seats left"), getStoreGateway, getStoreCommissionRate (override→category→0.05), createOrderRecord, getOrderById, updateOrder, getPlatformSettings, pageTypeForPath, websiteSubPage.
**`lib/razorpay.ts`:** createRazorpayOrder(keys,params), verifyRazorpaySignature (HMAC-SHA256, constant-time). **`lib/ids.ts`:** publicId(9-char base62). **`lib/supabase/{server,admin,client}.ts`:** RLS user client / service-role client / browser client.

**API routes (`app/api/**`):**
- `POST /checkout/create` — `{page_id | product_id, qty?, variant?}` → fetch price from DB (never trust client), validate stock/published, snapshot commission, `createOrderRecord` → `{order_id, page_type}`.
- `POST /checkout/start` — `{order_id, buyer_*}` → save buyer, read seller gateway secret (server-only), create Razorpay order → `{key_id, razorpay_order_id, amount, currency}`.
- `POST /checkout/verify` — verify HMAC signature → set order paid (or failed) → `{ok, amount, currency}` (for pixel firing).
- `POST /upload` — auth required, ≤5MB, image MIME only → Supabase Storage `media` bucket → `{url}`.
- `POST /site/contact` — public contact/newsletter → insert `site_messages`.
- `GET /bio/go` — record link click + redirect (validates URL). `POST /bio/track` — record bio view.
- `GET /tls-check` — custom-domain TLS verification util.

**Commerce flow:** create → start (Razorpay modal with seller keys) → verify → mark paid → fire Meta/Google purchase pixels. Sellers receive funds directly (their Razorpay); platform commission is snapshotted on the order (wallet deduction/invoicing = Phase 2).

---

## 6. Seller dashboard (`app.invoxai.io/dashboard`)

Shell `app/dashboard/layout.tsx` + `components/AppShell.tsx`; design-system kit `components/dx/ui.tsx` (Phead, Kpis, Card, Table, Tag, Live, Buyer, Donut, AreaChart, Bars, Templates, PageType, ComingSoon). Dynamic pages via `components/dx/sellerPages.tsx` + catch-all `app/dashboard/[...slug]/page.tsx`.

**Nav groups:** Main (Dashboard, Analytics) · Pages (Website, Bio, Store, One-page product, Courses, Booking, Events, Payment page, Lead form, VIP, Landing) · Sell (Orders, CRM, Coupons, Abandoned cart, Upsell, Checkout) · Money (Payment gateways) · Marketing (Email, Pixels & SEO) · Account (Domains, Plan & billing, Settings).

**Pages — logic / functions / features (✅ live · ⚠️ placeholder):**
- ✅ **Dashboard home** — KPIs (Revenue paid, Orders, Visitors, Wallet) + revenue AreaChart + quick-start cards (build bio / create product / connect payments).
- ✅ **Store** (`/dashboard/store`) — KPIs (views, in-store count, clicks, status) from `page_events`; "Open builder ↗" → `/studio/store`; **ProductCatalog** manager (catalog `products` via popup modal — see §7); link to one-page products.
- ✅ **Bio** (`/dashboard/pages/bio`) — real analytics: views, link clicks, CTR, **device donut**, top-clicked links; Edit → bio builder.
- ✅ **Website** (`/dashboard/website`) — real analytics: views, CTA clicks, CTR, device donut, top CTAs, **recent form messages** (`site_messages`), enabled-section count; "Open builder ↗" → `/studio/website`.
- ✅ **One-page products** (`/dashboard/pages/products`) — KPIs (count, revenue, sold); table (links to `/studio/product/{id}`); **NewProductButton** modal: pick design (landing|pdp) + optionally start from an existing catalog product (prefill).
- ✅ **Orders** — table (buyer, product, gateway, amount, status); KPIs total/paid/pending. ✅ **CRM** — customers deduped by buyer email (orders, spend). ✅ **Wallet** — balance + commission rate. ✅ **Domains** — subdomain + custom domain status. ✅ **Settings** (store name, subdomain, category) + **Settings → Payments** (Razorpay key_id/secret + enable toggle; secret never re-sent).
- ⚠️ Analytics, Courses, Booking, Events, Payment pages, Lead forms, VIP, Landing, Coupons, Abandoned cart, Checkout, Email, SEO/Pixels, Billing — scaffolded via `PageType()`/`ComingSoon()`, structure ready, no backend yet.

---

## 7. Admin panel (`admin.invoxai.io/admin`)

Layout role-guards on `user_roles.role='admin'`. Pages via `components/dx/adminPages.tsx` + catch-all.
- ✅ **Overview** — GMV, sellers, users, commission + revenue/seller-growth charts. ✅ **Revenue** — by stream (commission/subs/add-ons). ✅ **Sellers** / **Buyers** — tables + CSV export. ✅ **Commission** — edit per-category rate (`updateCommission`, RLS admin). ✅ **Plans** (`/admin/plans` → `PlansAdmin`) — CRUD plans (name, price, limits, features[], popular). ✅ **Domains** — custom-domain status. ✅ **Settings** — reserved subdomains. ✅ **Branding** — global "Built with InvoxAI" badge toggle (`setBrandBadge` → `platform_settings`, optimistic UI).
- ⚠️ Limits, Templates, Promo codes, Emails, Gateways, Maintenance — placeholder.

---

## 8. Builders (full-screen `/studio/*`, shared UX)

**Shared studio pattern (memory rule — apply to every edit/builder page):** full-screen route under `/studio/...` opened in a **new tab**; chrome = `.dx.studio` shell (brand + Exit) → `.dx-phead` toolbar (Builder/Preview toggle, status pill, Save draft / Publish / View) → `.webbuild` grid: **left `.webacc` accordion** of collapsible `<Sec>` cards, **right sticky browser preview** (`.browser`/`.bchrome`/`.scr`) with 🖥/📱 device toggle; desktop scaled by a **`ScaledFrame`** (CSS zoom). Controls: `.field`+label, `.chips`/`.chip.on`, `.switch`, `.swatches`/`.sw`, `.up` uploads, `.frow`/`.rowfull`/`.addrow`/`.del`. Live preview updates in real time; the old `/dashboard/...` editor route redirects to the studio. **Gotcha:** `ScaledFrame` uses `zoom` which doesn't contain `position:fixed`; keep `.webbuild .scr{transform:translateZ(0)}` + `.web-public-view{transform:translateZ(0)}` so floating bars/sticky elements stay inside the preview.

### 8.1 Website builder — `lib/website.ts` (`WebsiteContent`)
Sections (toggle + reorder): hero, features, steps (how-it-works), spotlight (image+text), stats, banner, logos, gallery, brands, team, pricing, shop (pulls published opp), countdown, video, about, map, testimonials, faq, newsletter, cta. Plus custom **Pages** (slug/label/menu/per-page section overrides), header nav variants (a/b/c/d) + sticky + CTA, announcement bar, WhatsApp widget, cookies, back-to-top, scroll progress, login/signup, social links, per-section bg/padding/cols/bg-image/headings, **SEO + favicon**, legal docs.
Theme constants: `ACCENTS` (16 gradients, from `lib/bio.ts`), `FONTS` (7), `WIDTHS` (4), `BTSHAPES` (soft/pill/sq), `BGS` (15 animated backgrounds), `REVEALS`, `BTN_ANIMS`, `DIVIDERS`, `SEC_STYLES`, `STEP_STYLES`, `CD_STYLES`, `CONTACT_STYLES`, `TEMPLATES` (6 presets). Renderer `WebsiteView.tsx` (`.webview`), animated `sitebg sbg-*` backgrounds, scroll-reveal on live only.

### 8.2 Store builder — `lib/store.ts` (`StoreContent`)
Sections: brand&theme, sections reorder (banner slider, brand slider, top-selling, featured, catalog), top banner slider, brand logo slider, catalog+featured (layout grid/list/row, cols 2/3/4, featured index), announcement+nav (announce bar, mobile bottom-nav, footer pay logos), footer policies. Renderer `StoreView.tsx` (`.storeview`): sticky topbar, announcement, banner carousel (autoplay), brand marquee, top-selling carousel, featured banner, catalog grid/list/row + search/category/sort, cart + login drawers, mobile bottom-nav. **Catalog products come from the `products` table** (visible ones), each card → `/p/{id}` (new tab) + a quick **Buy now** inline checkout. Shares website theme constants.

### 8.3 Store products (catalog) — `lib/catalog.ts` + `components/store/ProductCatalog.tsx`
Managed on the Store dashboard via a **popup form** (`.pm-*` modal), separate from one-page products. Fields: image + **multi-image gallery**, name, category, price/compare/currency, product type (digital/physical/service/subscription) with digital delivery / plans / delivery-days, badge, description, **product details (specs)**, highlights, **variants/options**, rating + review count, customer reviews, stock, SKU, vendor, trust badges, shipping/returns info, and a **"Show in store" toggle**. CRUD: `products-actions.ts` (createCatalogProduct/update/setProductVisible/delete, whitelisted clean()).

### 8.4 One-page product editor — `lib/products.ts` (`OppContent`), `ProductEditor.tsx`
Two layouts via `layout: "landing" | "pdp"`. Accordion sections: **Brand & theme** (presets `OPP_THEMES`, accent swatches, custom color, light/dark, font, button shape, width, landing background), **Layout & details** (layout, headline, category, product type, plans, digital delivery, delivery days, title icon/align, subheadline, rich-text description, image), **Pricing & buy** (price/compare/currency, button label/icon/animation, sticky buy), **Features** (icon+text), **Urgency & scarcity** (countdown {end/expiry-msg/align/disable-buy}, limited seats → "Only N left"/sold-out, sold-out→contact {WhatsApp/email/custom URL+label+icon}, **live purchase popups**), **Trust badges** (`BADGE_PRESETS` + custom), **Image gallery** (autoplay/interval), **Testimonials**, **FAQ**, **Footer policies**, **Seller contact** (email required to publish), **Payment logos**, **SEO & pixels** (Meta Pixel, Google tag). Helpers `toMinorUnit`/`formatPrice`; `DEFAULT_CURRENCY="INR"`.

### 8.5 Bio builder — `lib/bio.ts` (`BioContent`), `BioBuilder.tsx`
Sections: cover & profile (cover/profile images, name, headline, bio, verified), theme & effects (templates, 16 accents, button style soft/grad/outline/glass, shape rounded/pill/square, 8 animated bgs), **links** (icon/title/url/thumbnail/highlight; header rows), **social icons**, **featured product** (image/title/price/strike/CTA/url). Renderer `BioView.tsx` (`.bioview`): cover banner, overlapping avatar, verified badge, socials row, full-width link buttons with hover lift + highlighted shine, featured card, animated backgrounds, staggered mount animation, brand badge.

### 8.6 Shared theme system — `lib/oppTheme.ts`
`resolveOppTheme(theme)` → `{solid, gradient, fontFam, dark, btshape, bg, widthPx, googleHref}`. ACCENTS entries are gradients → derive a **solid** color (first hex) + **gradient**; custom color builds a gradient via `color-mix`; emits a Google-Fonts `<link>` href for non-preloaded fonts. Both product templates set `--p`/`--brand-gradient`/`--font-sora` (landing also `--color-primary`) on the root; dark via `.pdp-dark`/`.prod-dark`; button shape via `.pdp-bt-*`; landing bg via `.aurora.bg-*`.

**Save/publish actions** (all: auth → create page row if missing → update `content` jsonb → revalidate): website `saveWebsite/publishWebsite`; store `saveStore/publishStore/saveStoreProducts`; product `saveProduct/setProductStatus` (publish requires price>0 + seller_email) `/createProduct`/`deleteProduct`; bio `saveBioPage/setBioStatus`.

---

## 9. Public templates (commerce)

- **Landing** (`ProductTemplate.tsx`, `.prod2-*`): two-column merged card (≈65% content / 35% sticky accent panel with hex pattern + dark scrim) on web; **mobile order = title → hero image → urgency section (countdown+seats+badges) → content**. Aurora animated background. Inline checkout in the right panel (web); mobile uses the bottom bar → order → checkout page.
- **Catalog/PDP** (`PDPTemplate.tsx`, `.pdp-*`): sticky topbar, sticky gallery + thumbnails, breadcrumb, review snippet, price/compare/%off, stock indicator, variants, plans selector, offers, pincode delivery (physical), digital-delivery note, tabs (Description/Included/Specs/Reviews), related products, inline checkout.
- **Catalog product page** (`ProductPage.tsx`, `.pdpx-*`, route `/p/{id}`): Shopify-style — themed from the store's `StoreContent`; gallery+thumbs, review snippet, price/%off, stock, **variant buttons**, **quantity stepper**, Add-to-cart + Buy-it-now (inline `StoreCheckout`, qty+variant), trust row, highlights, accordions (description/details/shipping/returns), reviews, **related products**, sticky bar.
- **Shared fixed buy bar** (`BuyBar.tsx`, `.buybar`): persistent on **mobile**, **reveal-on-scroll on web**; shows offer price + struck compare + % off + CTA; themed via `--brand-gradient` (fallbacks `--p*`); `mode:"scroll"` (→ inline form) or `"order"` (→ create order). Used by both product layouts.
- **Checkout** (`InlineCheckout.tsx` / `StoreCheckout.tsx` / `CheckoutForm.tsx`): email/name/phone → create→start→verify→Razorpay modal→pixels. Urgency widgets: `CountdownTimer`, `LiveProof` (rotating social-proof popups), `ImageSlider`. `FooterPolicies`, `PixelInjector` (Meta + Google), trackers (`WebsiteTracker`/`BioTracker` → `page_events`).
- **Shared:** `ImageInput` (upload/paste), `RichText` (HTML editor), `BrandBadge`.

---

## 10. Design system (CSS variables, plain CSS)

**Tokens (`app/globals.css`):** light "Sunset" — `--color-bg:#fff9f4`, `--color-card:#fff`, `--color-primary:#ff6a3d`, `--color-secondary:#ff4d7d`, `--color-accent:#7b3fe4`, `--color-highlight:#ffb23e`, `--color-text:#2b1b2e`, `--color-muted:#7a6770`, `--color-border:#f0e1d6`; dark "Twilight" via `@media(prefers-color-scheme:dark)` / `[data-theme="dark"]`. **Brand gradient:** `linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4)`. Fonts: **Sora** (headings/`--font-heading`/`--font-sora`) + **Inter** (body). Spacing `--space-1..5` (8/16/24/40/64), radius 16/10, soft shadows. Primitives: `.card`, `.input`/`.select` (focus glow), `.btn`/`.btn-gradient`/`.btn-ghost`, `.alert-*`, `.switch`.
**CSS files & namespaces:** `globals.css` (tokens + product/checkout), `dashboard/dx.css` (`.dx` dashboard), `website.css` (`.webview` + builder `.webbuild`), `store.css` (`.storeview` + `.pdpx-*`), `bio.css` (`.bioview`). Public templates scope under `.prod2-*` (landing), `.pdp-*` (PDP), `.storeview`, `.webview`, `.bioview`.
**Visual language:** warm gradient-accent, rounded 16px cards, generous spacing, animated aurora/mesh/glow/grid backgrounds, smooth easing, scroll-reveal, sticky nav, fixed bottom buy bar, full light/dark coherence (every surface uses tokens), reduced-motion respected.

---

## 11. Build order (suggested)

1. Supabase schema + RLS + seeds (identity/roles → categories/reserved → stores → pages → platform_settings → orders/gateways → plans → page_events → site_messages → products + PDP fields).
2. Auth + onboarding wizard + middleware (subdomain rewrite) + root host router.
3. Design tokens + `dx` UI kit + dashboard shell + nav.
4. Public renderer `app/sites/[domain]/[[...path]]` with all page_type branches + metadata.
5. Builders one at a time (bio → website → store → product), each = content model + studio shell + accordion editor + live preview + save/publish + public renderer. Follow the shared studio pattern.
6. Catalog products (table + popup CRUD + storefront + `/p/{id}` PDP).
7. Commerce: payment gateway settings + checkout create/start/verify + Razorpay + BuyBar + InlineCheckout/StoreCheckout + pixels + commission snapshot.
8. Analytics (page_events trackers + dashboard charts) + site_messages forms.
9. Admin panel (overview/revenue/sellers/buyers/commission/plans/branding/domains/settings).
10. Theme system (`oppTheme`) applied across product pages; polish responsive + dark mode.

---

*Generated from a full codebase survey. Companion specs: `docs/WEBSITE-BUILDER-FULL-PROMPT.md`, `docs/WEBSITE-PAGE-SPEC.md`, `docs/STORE-PDP-PLAN.md`, `docs/OPP-PAGE-SPEC.md`, `docs/DASHBOARD-PLAN.md`.*
