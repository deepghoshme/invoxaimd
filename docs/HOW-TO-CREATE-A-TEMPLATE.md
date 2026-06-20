# How to Create & Upload a Template (step-by-step)

The plain-English companion to `TEMPLATE-AUTHORING-FORMAT.md` (the formal spec).
A **template = one JSON file** (a "Template Manifest"): an **envelope** (catalog info) + a **`content`** block
(the actual design + theme tokens). You create the JSON, upload it in admin, preview, publish. Sellers then Apply it.

---

## 1. The shape (minimum valid file)

```json
{
  "name": "Sunset Studio",
  "type": "website",
  "tier": "premium",
  "price_paise": 49900,
  "description": "Bold dark agency homepage with animated hero and pricing.",
  "tags": ["agency", "bold", "dark"],
  "thumbnail_url": "",
  "theme": {},
  "content": {
    "site": "Sunset Studio",
    "theme": "dark",
    "accent": 0,
    "font": "sora",
    "bg": "auroraflow",
    "btshape": "pill",
    "htitle": "We craft brands that move.",
    "hsub": "Strategy, design and engineering for ambitious teams.",
    "order": ["features", "stats", "pricing", "testimonials", "faq", "cta"],
    "sections": { "features": true, "stats": true, "pricing": true, "testimonials": true, "faq": true, "cta": true }
  }
}
```

**Envelope (exactly these 9 keys — any extra key is rejected):**
`name` (2–40 chars) · `type` (`bio·store·product·courses·booking·event·payment·lead·website·checkout·vip`) ·
`tier` (`free`/`premium`) · `price_paise` (paise; ₹499 = `49900`; must be `0` if free) · `description` (one sentence) ·
`tags` (lowercase array) · `thumbnail_url` (`""`) · `theme` (`{}`) · `content` (the design — not empty).

**A "theme" = a set of token choices inside `content`** (same design + different tokens = a new theme variant):
- `theme`: `light` / `dark`
- `accent`: index into the ACCENTS presets (see `lib/bio.ts`), **or** `accentColor`: a hex (`"#FF6B5C"`) for an exact brand colour
- `font`: `sora·poppins·montserrat·playfair·dmsans·space·inter`
- `bg`: `none·aurora·mesh·blobs·waves·dots·grid·rays·glow·auroraflow·silk·meshblobs·flowfield·starfield·shapes`
- `btshape`: `soft·pill·sq`

The remaining `content` keys are per-type — the canonical list is the `*Content` type in `lib/<type>.ts`
(full key lists for website/store/bio/courses are in `TEMPLATE-AUTHORING-FORMAT.md` §4).

---

## 2. Create the file — three ways

**A. With Claude (outside the app):** open Claude, paste the whole of `docs/TEMPLATE-AUTHORING-FORMAT.md`, then:
> *"Using this Template Manifest format, create a **premium courses** template for **a trading masterclass, dark
> theme, gold accent**, priced ₹4999. Return ONE JSON object only — no markdown, no comments, no extra top-level
> keys. Use only the allowed `content` keys for that type."*
> (Ask for "3 versions with different `accent` + `bg`" to mass-produce theme variants.)

**B. Save from a built page (no JSON):** build a page in the studio → admin **"Save as template"** exports its design.

**C. Generate with AI inside admin:** `/admin/templates` → **"Generate with AI"** → type a brief → preview → save.
*(Runs in stub mode until `ANTHROPIC_API_KEY` is set in `.env.local`; then it calls Claude for real.)*

---

## 3. Upload & publish (live now)

1. Log in as admin → **`/admin/templates`** → **Import manifest**.
2. **Drag-and-drop** your `.json` (or click to browse, or paste into the textarea).
3. **Validation** runs instantly: red = exact error to fix; green strip = valid (name/type/tier/price).
4. **Live preview**: bio/store/website render through the real renderer; other types show a structural summary.
5. **Import as draft** → find the card in the grid → set price/tags/license → **Publish**.
6. It now shows in every seller's **`/dashboard/templates`** gallery to Apply (free) or Buy & Apply (premium).

> Upload saves as **draft → one-click Publish** (a deliberate safety step; it does **not** auto-publish).

---

## 4. Good to know

- **Render fidelity by type:** Course/Product/Store/Bio render richly today. Some very specialised blocks
  (e.g. stock ticker, KPI gauges, reviews marquee) have **no matching renderer section yet** — a manifest can't
  reproduce those until those sections are added to the builders.
- **Licensing** is per-template: `per_store` (pay once, reuse), `per_page` (pay per page), `all_access` (unlocked by plan).
- **Payment**: wallet (instant) or Razorpay. Template sales appear in `/admin/revenue`.
