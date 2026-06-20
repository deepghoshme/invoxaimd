# Template Authoring Format & Guide

The single, machine-precise spec for creating an invoxai template — by hand **or with AI**.
A template is one JSON object: a **manifest envelope** + a **`content`** blob matching the page type's schema.

> **Golden rule:** the canonical schema for each `type` is the TypeScript `*Content` type in `lib/<type>.ts`
> (`WebsiteContent`, `BioContent`, `StoreContent`, `CourseContent`, …). This doc is the human/AI-readable
> contract; the TS type is the validator. Emit only keys that exist there.

---

## 1. Manifest envelope

```json
{
  "name": "Sunset Studio",
  "type": "website",
  "tier": "premium",
  "price_paise": 49900,
  "description": "Bold, dark agency homepage with animated hero and pricing.",
  "tags": ["agency", "bold", "dark", "saas"],
  "thumbnail_url": "",
  "theme": { "...token overrides..." : "see §3" },
  "content": { "...page-type content...": "see §4" }
}
```

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | 2–40 chars, human title. |
| `type` | enum | `bio · store · product · courses · website · booking · event · vip · lead · payment · checkout`. Must match a builder. |
| `tier` | enum | `free` or `premium`. |
| `price_paise` | int ≥ 0 | `0` when free; in **paise** (₹499 = `49900`). |
| `description` | string | One sentence; also seeds AI tone. |
| `tags` | string[] | lowercase keywords for gallery filtering. |
| `thumbnail_url` | string | leave `""` to auto-generate from a render. |
| `theme` | object | universal design tokens (§3). May be merged into `content`. |
| `content` | object | the design itself, per `type` (§4). |

Validation rejects: unknown top-level keys, wrong `type` enum, `price_paise > 0` with `tier:"free"`, and any
`content` key not in the type's `*Content` schema.

---

## 2. The model (how a template renders)

```
templates.content  ──apply──▶  pages.content  ──renderer──▶  components/<Type>View.tsx
        +theme                  (+template_id)                 (CSS variables + sections)
```

Every builder shares the same **design language** (theme tokens) and a **section system**
(`order[]` + `sections{}` + `heads{}` + per-section style). Type-specific data lives in typed arrays.

---

## 3. Universal theme tokens (the design language)

These keys appear (some optional) across `website / store / bio / course`. Source: `lib/website.ts`, `lib/bio.ts`.

| Token | Values | Meaning |
|-------|--------|---------|
| `theme` | `"light"` \| `"dark"` | base colour scheme |
| `accent` | index `0…N` into **ACCENTS** | preset brand gradient |
| `accentColor` | hex `#RRGGBB` | custom brand colour — **overrides** `accent` |
| `font` | `sora · poppins · montserrat · playfair · dmsans · space · inter` | heading font (FONTS) |
| `pageWidth` | `standard · wide · xwide · full` | container width (WIDTHS) |
| `bg` | `none · aurora · mesh · blobs · waves · dots · grid · rays · glow · auroraflow · silk · meshblobs · flowfield · starfield · shapes` | animated background (BGS) |
| `btshape` | `soft · pill · sq` | button corner style |
| `anim` | `none · fade · rise · zoom · slide` | section scroll-reveal (REVEALS) |
| `btnAnim` | `none · shine · pulse · glow · lift` | button animation (BTN_ANIMS) |
| `divider` | `none · slant · tilt · round` | shape divider on coloured sections (DIVIDERS) |
| `nav` | `a · b · c · d` | header layout variant (website) |
| `sticky` | bool | sticky header |

**ACCENTS** (index → name): `0 Sunset · 1 Coral · 2 Violet · 3 Gold · …` (full list in `lib/bio.ts ACCENTS`).
Use the **index** for a preset, or set `accentColor` for an exact brand hex.

> Contrast is handled by the renderer's CSS variables — you only pick a consistent `theme` + `accent`.
> Never hardcode hex colours inside section data; use the tokens above.

---

## 4. Content schema by type

Top-level keys below; consult the TS type for nested shapes. Shared keys
(`theme, accent, accentColor, font, btshape, order, sections, heads`) behave as in §3.

### 4.1 `website` — `lib/website.ts WebsiteContent` (the most expressive; use as the model)
- **Brand:** `site, logo, logoSize, favicon, theme, font, pageWidth, accent, accentColor, bg, btshape`
- **Motion:** `anim, btnAnim, htitleGrad, divider`
- **Header:** `nav, sticky, cta, ctaurl, menu{home,about,contact}, menuLinks[]`
- **Hero:** `heroLayout(right|left|center|none), heroEyebrow, heroRating, heroBg, heroTyping, heroVideo, himg, htitle, hsub, hb1, hb1url, hb2, hb2url`
- **Sections:** `order[]`, `sections{key:bool}`, `heads{key:{title,sub}}`, `secStyle{key:auto|plain|tint|grad|dark}`, `secPad{key:sm|md|lg}`, `secCols{key:number}`, `tint`
  - **Section keys (`order`):** `features · steps · spotlight · stats · banner · logos · gallery · brands · team · pricing · shop · countdown · video · about · map · testimonials · faq · newsletter · cta`
- **Section data arrays:** `features[]{ic,t,x}`, `stats[]{n,l}`, `pricing/plans[]{n,p,py,f,pop,url}`, `spotlight[]{img,title,text}`, `testimonials[]{n,r,q}`, `faq[]{q,a}`
- **Multi-page sites:** `pages[]{slug,label,inMenu,order[],intro,data}` (each composes its own sections)
- **SEO:** `seo{title,description,ogImage}`

### 4.2 `store` — `lib/store.ts StoreContent`
`store, tagline, logo, accent, accentColor, btshape, font, theme, pageWidth, menu, order, sections, heads,
banner, brands, brandLogos, products, featuredIdx, display, cols, announce, footerPay, bottomNav, legal`
> `products`/catalog are **seller-owned** — a template seeds layout/theme/banner/announce, **not** real products.

### 4.3 `courses` — `lib/course.ts CourseContent`
`headline, subheadline, description_html, thumbnail, price, compare_at_price, currency, theme, accent,
instructor_name, instructor_bio, instructor_avatar, outcomes, includes, category, cta_label,
seo_title, seo_description, og_image`

### 4.4 `bio` — `lib/bio.ts BioContent`
`cover_url, profile_url, name, handle, bio, verified, accent, button_style, button_shape, bg, socials, links, featured`

> `booking · event · vip · lead · payment · product · checkout`: same pattern — open `lib/<type>.ts` (or the
> studio default content) for the exact keys; envelope + theme tokens are identical.

---

## 5. Authoring rules (for humans and AI)

1. **Pick `type` first.** Emit only keys in that type's `*Content`. Unknown keys are rejected.
2. **Theme = one coherent choice:** one `theme` (light/dark) + one `accent` (or `accentColor`) + one `font` +
   one `bg` + one `btshape`. Don't mix conflicting vibes.
3. **Sections:** set `order[]` to the exact sequence; set `sections{key:true}` for each visible one; give every
   visible content-section a matching `heads{key:{title,sub}}` **and** its data array. Omit/`false` the rest.
4. **Real copy, on-brand:** write actual headlines/benefits matching `name` + `description` + `tags`. **No lorem.**
5. **Images:** use real https URLs you control, or leave blank (`""`) — the renderer shows graceful empty states.
   Never hotlink third-party images.
6. **Never** hardcode colours/fonts inside data strings — use tokens (§3).
7. **Don't** invent commerce data: leave `products`, prices the seller sets, contact info, domains empty.
8. **Output:** strict JSON — no comments, no trailing commas, no markdown fences.
9. **Self-check** before saving: valid JSON · `type` valid · every `content` key exists in the schema ·
   every visible section has data · theme tokens are from the allowed sets.

---

## 6. Worked example (a `website` premium template)

```json
{
  "name": "Sunset Studio",
  "type": "website",
  "tier": "premium",
  "price_paise": 49900,
  "description": "Bold dark agency homepage with an animated gradient hero and 3-tier pricing.",
  "tags": ["agency", "bold", "dark", "saas"],
  "thumbnail_url": "",
  "theme": {},
  "content": {
    "site": "Sunset Studio",
    "theme": "dark",
    "accent": 0,
    "font": "space",
    "pageWidth": "wide",
    "bg": "auroraflow",
    "btshape": "pill",
    "anim": "rise",
    "btnAnim": "shine",
    "htitleGrad": true,
    "nav": "c",
    "sticky": true,
    "cta": "Start a project",
    "ctaurl": "#cta",
    "heroLayout": "center",
    "heroEyebrow": "Design & build studio",
    "htitle": "We craft brands that move.",
    "hsub": "Strategy, design and engineering for ambitious teams.",
    "hb1": "See our work", "hb1url": "#gallery",
    "hb2": "Get a quote", "hb2url": "#cta",
    "order": ["features", "spotlight", "stats", "gallery", "pricing", "testimonials", "faq", "cta"],
    "sections": { "features": true, "spotlight": true, "stats": true, "gallery": true, "pricing": true, "testimonials": true, "faq": true, "cta": true },
    "heads": {
      "features": { "title": "What we do", "sub": "End-to-end product design" },
      "pricing":  { "title": "Engagements", "sub": "Pick a pace that fits" },
      "faq":      { "title": "Questions", "sub": "" }
    },
    "secStyle": { "pricing": "tint", "cta": "grad" },
    "features": [
      { "ic": "✦", "t": "Brand systems", "x": "Identity, voice and design tokens that scale." },
      { "ic": "▲", "t": "Product design", "x": "Flows and interfaces users love." },
      { "ic": "◆", "t": "Engineering", "x": "Shipped, fast, accessible front-ends." }
    ],
    "stats": [ { "n": "120+", "l": "Projects" }, { "n": "4.9", "l": "Avg rating" }, { "n": "8 yrs", "l": "In studio" } ],
    "pricing": [
      { "n": "Sprint", "p": "₹80k", "py": "/wk", "f": "1 designer · weekly delivery", "pop": false },
      { "n": "Squad", "p": "₹3L", "py": "/mo", "f": "Design + build team", "pop": true },
      { "n": "Retainer", "p": "Custom", "f": "Ongoing partnership", "pop": false }
    ],
    "testimonials": [ { "n": "Aarav, CEO", "r": "Fintech", "q": "They doubled our signups." } ],
    "faq": [ { "q": "How fast can we start?", "a": "Usually within a week." } ]
  }
}
```

---

## 7. AI generation prompt contract

When Admin clicks **"Generate with AI"**, the backend sends the model:
1. **This document** (§1–§6) as the format spec.
2. The **`*Content` TS type** for the requested `type` (source of truth for keys).
3. The admin's brief (vibe, audience, page type, free/premium, price).

The model must return **one JSON manifest only**, obeying §5, ready to validate and preview. Invalid keys or
non-JSON output are rejected and regenerated. This is what makes "AI creates any design/template/theme" reliable:
a **closed vocabulary** (tokens + section keys) + a **typed content schema** + **explicit rules**.
