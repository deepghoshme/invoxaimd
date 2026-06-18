# Store + Product builders — build plan (follows the Website builder)

> Brings the **Store** (`/store`), **Product Detail Page (PDP)**, and enhanced
> **One-page product (opp)** to the same studio/preview/click-to-edit quality as
> the Website builder. Source: the 3 provided mockups. Pairs with
> `docs/WEBSITE-BUILDER-FULL-PROMPT.md` (the proven pattern) and the master prompt.

## 0. Principles (reuse what works)
Every builder mirrors the Website builder exactly:
- `lib/<type>.ts` — content model + constants + `DEFAULT_<TYPE>` seed (no server imports).
- `components/<type>/<Type>View.tsx` — client renderer, `.<type>view` scoped CSS, sections.
- `components/<type>/<Type>Builder.tsx` — two-pane builder: accordion panels, Quick
  sections, click-to-edit, web/mobile + Builder/Public toggles, save/publish.
- `app/studio/<type>/page.tsx` — full-screen studio (no dashboard chrome), opened in a new tab.
- `app/dashboard/<type>/{page,actions}.tsx` — overview (real `page_events` analytics) + server actions.
- Public render in `app/sites/[domain]/[[...path]]`.
- Honour the 6 builder rules + acceptance checklist from the website spec.
- Reuse: `ACCENTS`, `BTSHAPES`, fonts, content-width, dividers, animations, dark theme,
  per-section bg/pad/cols, `getStoreProducts()`, `page_events`, `/api/upload`.

## 1. STORE builder (`page_type:"store"`, singleton, at `/store`)
The storefront — catalog of the seller's **real published products** (`opp` pages,
via `getStoreProducts`) with merchandising sections around them.

**`lib/store.ts` — `StoreContent`:**
- brand: `store, tagline, logo, accent, accentColor, btshape, font, theme, pageWidth, menu[]`
- sections (reorder+toggle): `banner` (hero slider) · `brands` (logo marquee) ·
  `topselling` (auto-slider) · `featured` (big product banner) · `catalog` (grid/list/row)
- `announce{on,text}` · `footerPay(bool)` · `bottomNav(bool, mobile)` · legal docs
- `banner[]` `{img,heading,sub,cta,url}` · `brands`/`brandLogos[]`
- `featuredId` (which product) · `display('grid'|'list'|'row')` · `cols`
- products come from `opp` pages → mapped to `{id,name,cat,price,compareAt,img,rating,badge,url}`.
  Category from the product's category/tag; search + sort + category filter are client-side.

**`StoreView`:** announcement → sticky topbar (logo, menu, account btn, cart icon) →
banner slider (auto) → brand marquee → top-selling auto-row → featured banner →
controls (search/category chips/sort) → catalog (grid/list/row, columns) → footer
(pay logos) → mobile bottom-nav. **Cart drawer** + **account/login drawer** = client
overlay (v1: cart links each item to its product/checkout; full multi-item order =
Phase 2 commerce, needs `orders.meta`). Wishlist = local. Click-to-edit on sections.

**Routing:** `pageTypeForPath` already maps `/store` → `store`; add the `store` branch
to the public renderer (fetch products, pass in). Replace the `store` placeholder in
`sellerPages.tsx`; add `app/dashboard/store/` overview + `app/studio/store/`.

## 2. PRODUCT DETAIL PAGE (PDP) — richer product template
A catalog-style product page (gallery, variants, pincode delivery, tabs
desc/included/specs/reviews, related, sticky add-to-cart). Two options:
- **(a) New `pdp` template** for store products (separate from `opp`), OR
- **(b) Add a "layout: storefront | landing" switch to `opp`** so one product type
  renders either the existing landing page or this PDP.
**Recommendation:** (b) — extend `OppContent` with `layout` + the PDP fields
(`gallery, variants[], specs[], includes[], reviews[], related, highlights[], offers[],
delivery, productType`). The existing `opp` builder gains a PDP mode + these editors;
`ProductTemplate` renders PDP when `layout==="pdp"`. Reuses checkout/orders already built.

## 3. One-page product (opp) enhancements (mostly exist; fill gaps)
Per PROGRESS, `ProductTemplate` already has sticky buy, countdown, seats/sold-out,
live-purchase popups, gallery, testimonials, FAQ, policies. Gap-fill from the mockup:
**available-offers list, EMI line, scarcity progress bar, highlights bullets, bonuses,
stats, "what's inside" curriculum, guarantee block, section reorder** — port these into
`OppContent` + builder if missing, matching the website-builder editors.

## 4. Dashboard consistency (Admin & Seller)
The `.dx` design system already themes the dashboard (sunset/twilight, same tokens as the
mockups). Pass = audit every seller + admin page renders cleanly in the `.dx` shell, fix
any off pages, ensure overview pages use real data + the `Phead/Kpis/Card/Table/Donut`
primitives, and that every builder opens full-screen via `/studio/*`. No redesign —
alignment/consistency only.

## 5. Phase order (one at a time, build+deploy+verify each)
1. **Store v1** — `lib/store.ts` → `StoreView` → public renderer branch → `StoreBuilder` →
   studio + overview. (Cart/account drawers client-side; products real.)
2. **Store polish** — banners/brands/featured editors, display modes, categories, search/sort.
3. **PDP** — extend `opp` with `layout:"pdp"` + PDP fields + renderer + builder editors.
4. **opp gap-fill** — offers/EMI/scarcity/highlights/bonuses/etc.
5. **Multi-item cart + buyer accounts** — real cart → multi-item order (`orders.meta`),
   buyer login/account (ties to the website Login/My-account buttons). (Master-plan Phase 2.)
6. **Dashboard consistency audit** — admin + seller pages.

## 6. Acceptance (per builder)
- [ ] `.dx`/sunset theme, light+dark; live preview instant; click-to-edit.
- [ ] Save/publish persist; public URL renders; analytics on overview.
- [ ] Real products in the store; cards link to working checkout.
- [ ] Mobile: bottom-nav, drawers, responsive grids; no overflow.
- [ ] Reuses website-builder constants/options (width, fonts, dividers, animations…).
