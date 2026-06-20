# Premium Templates — System Plan

How premium templates are **authored in Admin**, **applied by sellers**, and **paid for** when premium.
Grounded in the existing `pages` + `templates` tables and the studio builder content model.

---

## 1. Where we are today (real codebase state)

| Piece | File / table | Status |
|-------|--------------|--------|
| Template catalog | `templates` table (`20260618290000_admin_templates.sql`) | ✅ exists — **metadata only** |
| Admin template manager | `app/admin/templates/` | ✅ CRUD on metadata (name, type, tier, price, thumb, status, sales_count) |
| Design store | `pages` table — `content jsonb`, `template_id`, `is_premium` | ✅ every seller surface is a `pages` row |
| Builders | `app/studio/{bio,store,course,website,...}` | ✅ edit `pages.content` |
| Renderer | `app/sites/[domain]/[[...path]]/page.tsx` + `components/*View.tsx` | ✅ reads `pages.content` |
| Content schema | `lib/{website,bio,store,course,...}.ts` → `*Content` types | ✅ rich, typed |
| One-click presets | `lib/website.ts` `TEMPLATES` (Sunset/Minimal/Bold) | ✅ client-only token patches |

**The gap:** the `templates` table stores a *marketing card* (name/price/thumbnail) but **no design payload**.
There is nothing to copy into a seller's page, so a template **cannot actually be applied** — and there is
**no purchase/ownership flow** for premium ones.

> **Core insight:** a *template* = a named, pre-filled **`pages.content` blob (+ theme tokens)** for one `page_type`.
> "Applying" a template = deep-copy that blob into the seller's `pages.content`.

---

## 2. What we build (5 capabilities)

1. **Template payload** — give `templates` real design data (`content` + `theme` JSONB).
2. **Apply engine** — `applyTemplate()` copies the payload into the seller's page (ownership-checked).
3. **Admin authoring** — three ways to create the payload: *save-from-studio*, *import manifest*, *generate with AI*.
4. **Seller gallery** — browse → preview → Apply (free) / Buy & Apply (premium).
5. **Paid flow + revenue** — wallet or Razorpay unlock, per-store license, surfaces in Admin Revenue.

---

## 3. Data model changes

### 3.1 Extend `templates` (new migration)
```sql
alter table templates add column if not exists slug         text unique;
alter table templates add column if not exists tags         text[] not null default '{}';
alter table templates add column if not exists content      jsonb  not null default '{}'::jsonb; -- the design (a pages.content)
alter table templates add column if not exists theme        jsonb  not null default '{}'::jsonb; -- token overrides (optional; may also live inside content)
alter table templates add column if not exists demo_page_id uuid;        -- optional live-preview page
alter table templates add column if not exists version      integer not null default 1;
alter table templates add column if not exists updated_at   timestamptz not null default now();
-- `type`, `tier`, `price_paise`, `thumbnail_url`, `status`, `sales_count` already exist.
```

### 3.2 Ownership — `template_purchases` (new table)
```sql
create table if not exists template_purchases (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores(id) on delete cascade,
  template_id  uuid not null references templates(id) on delete cascade,
  price_paise  integer not null default 0,
  source       text not null check (source in ('wallet','razorpay','free','admin_grant')),
  payment_ref  text,                         -- razorpay payment id / wallet ledger id
  created_at   timestamptz not null default now(),
  unique (store_id, template_id)             -- one license per store (per-store model)
);
-- RLS: seller reads own rows; insert only via server action after payment; admin full.
```

### 3.3 Revenue integration
Template sales are **platform revenue** (admin-authored ⇒ 100% platform). Two options:
- **A (recommended):** write a row to the existing platform revenue source the Admin Revenue page already
  unions (it merges `plan_payments` + `wallet_ledger`). Add a `template` kind to that feed, OR
- **B:** join `template_purchases` into `/admin/revenue`'s transaction query as a third source.

Either way `/admin/revenue` gains a **Template** transaction type + a "Template sales" KPI, and each template's
`sales_count` increments on purchase.

---

## 4. Apply engine

`applyTemplate(templateId, { pageType, targetPageId? })` — server action:

1. Load template; assert `status='published'` and `type` matches `pageType`.
2. **If `tier='premium'`:** require a `template_purchases` row for this store → else return `{ needsPurchase: true, price_paise }`.
3. Resolve the seller's target page (`pages` row for that `page_type` / `targetPageId`); create it if missing.
4. **Merge** `template.content` (+ `theme`) into `pages.content`:
   - Replace **design/layout** keys (theme, order, sections, heads, hero, secStyle, …).
   - **Preserve seller-owned data** by policy: products/catalog, domain, SEO slugs, connected pixels, real
     contact info — these are *the seller's*, not the template's. (Whitelist of "keep" keys per type.)
5. Set `pages.template_id = templateId`, `is_premium = (tier='premium')`, bump `updated_at`.
6. Return success → builder reloads showing the new design, fully editable.

> Apply is **non-destructive to commerce data** and **fully editable afterwards** — a template is a starting point, not a lock.

---

## 5. Admin authoring (3 paths)

All three produce the same **Template Manifest** (see `TEMPLATE-AUTHORING-FORMAT.md`) and save it to `templates`.

1. **Save-from-studio (fastest):** admin builds a page in the normal studio, clicks **"Save as template"** →
   exports that page's `content` + theme into a draft template; admin sets tier/price/thumbnail/tags → publish.
2. **Import manifest (power users):** paste a manifest JSON (or upload `.json`) → validate against the type's
   schema → preview → save. Good for versioning templates in git / bulk seeding.
3. **Generate with AI (the "easy for AI" path):** admin types a prompt ("bold dark course landing for a fitness
   coach"). Backend sends the AI **`TEMPLATE-AUTHORING-FORMAT.md` + the target type's `*Content` TS type** as the
   spec; the model returns a manifest; admin previews + tweaks + publishes. This is why the authoring format must
   be machine-precise — see the companion doc.

Admin manager additions: a **content editor / preview pane**, **tags**, **slug**, and a **"Generate with AI"** button.

---

## 6. Seller gallery + apply flow

New surface `/dashboard/templates` (and a **"Browse templates"** entry inside each studio):

- **Grid** of published templates, filterable by `type` + `tags`, premium badge + price.
- **Preview**: thumbnail → live preview (render `demo_page_id` or the template content in a sandbox route).
- **Action button:**
  - `free` → **Apply** (calls `applyTemplate`, redirects into the studio).
  - `premium` + owned → **Apply**.
  - `premium` + not owned → **Buy & Apply** → purchase flow (§7) → on success, auto-apply.

---

## 7. Paid flow (monetization)

```
Seller clicks "Buy & Apply" on a premium template
        │
        ├─ Rail A: WALLET (instant)   → debit seller wallet by price_paise
        │                                (if balance < price → prompt recharge)
        │
        └─ Rail B: RAZORPAY           → create order (like plan purchase),
                                         open checkout, verify signature server-side
        │
   on success (server):
        • insert template_purchases (store_id, template_id, price_paise, source, payment_ref)
        • increment templates.sales_count
        • record platform revenue  → shows in /admin/revenue
        • applyTemplate() runs automatically
        • (optional) email branded receipt / invoice
```

**Policy decisions (LOCKED with owner):**
- **License = all three models, chosen per template** via `templates.license_model ∈ ('per_store','per_page','all_access')`:
  - `per_store` — pay once, that store applies/re-applies forever.
  - `per_page` — a `template_purchases` row per `(store, template, page)`; pay each time applied to a new page.
  - `all_access` — unlocked by an active plan feature (`templates_all_access` feature key) — no per-template
    charge while subscribed; ties into the §3.3 plan-feature system from Wave 4.
- **Both rails enabled:** Wallet (instant debit) **+** Razorpay (direct card/UPI).
- **Authoring is admin-only** (separate admin area, incl. AI generation). **Sellers never author** — apply only.
- **Revenue = 100% platform.** Non-refundable digital good (ties to the Refund Policy).

---

## 8. Build phases

| Phase | Deliverable | Depends on |
|-------|-------------|-----------|
| **A. Schema** | `templates` payload cols + `template_purchases` + revenue kind | — |
| **B. Apply engine** | `applyTemplate()` + per-type "keep" whitelists + ownership guard | A |
| **C. Admin authoring** | Save-from-studio + manifest import + preview pane | A, B |
| **D. Seller gallery** | `/dashboard/templates` + preview + Apply (free) | B |
| **E. Paid flow** | Wallet + Razorpay buy → purchase → auto-apply | A, D |
| **F. Revenue + analytics** | `/admin/revenue` Template type + per-template sales | A, E |
| **G. AI generation** | "Generate with AI" using the authoring format | C |

Phases A→B→D give a working **free**-template system; E adds money; G adds AI authoring.

---

## 9. Decisions (LOCKED)

1. **License model** — ✅ **all three**, per-template (`license_model`): `per_store · per_page · all_access`.
2. **Payment rails** — ✅ **wallet + Razorpay**.
3. **Authoring** — ✅ **admin-only**, separate admin area. **AI generation = admin tool only.** Sellers apply-only.
4. **Schema headroom** — reserve `author_store_id` + `rev_share_pct` (default platform) so a future seller→seller
   marketplace is non-breaking. Not built in v1.

Add to §3.1 migration: `license_model text not null default 'per_store' check (license_model in
('per_store','per_page','all_access'))`, plus `author_store_id uuid`, `rev_share_pct numeric not null default 0`.
`template_purchases` gets a nullable `page_id uuid` (used only for `per_page`); the unique key becomes
`(store_id, template_id, coalesce(page_id,'00000000-0000-0000-0000-000000000000'))`.

---

## 10. Companion document

`docs/TEMPLATE-AUTHORING-FORMAT.md` — the exact **Template Manifest** format + design-token vocabulary + rules +
worked example, written so a human **or an AI** can produce a valid template for any page type.
