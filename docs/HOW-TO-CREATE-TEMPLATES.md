# How to Create a Premium Template + Theme (Full Guide)

A template = ONE JSON file (the "manifest"). You author it (by hand or with Claude AI),
upload it in /admin/templates, preview it, and publish. Sellers then browse, buy, and apply it.

================================================================================
PART 1 — THE FORMAT (copy this skeleton every time)
================================================================================

A template is one JSON object with exactly these 9 top-level fields (no others allowed):

{
  "name": "My Template",          // 2-40 characters
  "type": "website",              // see TYPES below
  "tier": "premium",              // "free" or "premium"
  "price_paise": 9900,            // PAISE. Rs.99 = 9900. Must be 0 if tier is "free"
  "description": "One sentence about the template.",
  "tags": ["finance", "dark", "webinar"],   // lowercase keywords
  "thumbnail_url": "",            // leave empty
  "theme": {},                    // leave EMPTY {} - the design lives in content
  "content": { ... }              // THE DESIGN + THEME (see PART 2/3)
}

TYPES (the "type" field): bio | store | product | courses | booking | event |
payment | lead | website | checkout | vip

Rule: every key inside "content" must be a real key for that type, or the upload is rejected.

================================================================================
PART 2 — THE THEME (goes INSIDE content as flat keys)
================================================================================

"Creating a theme" = picking these values inside content. Same design + different
values = a new theme. Use the EXACT values below (others are rejected).

  "theme":  "light"  or  "dark"
  "accent": a NUMBER 0-15 (preset color gradient):
              0 Sunset   1 Coral    2 Violet   3 Gold
              4 Berry    5 Ocean    6 Forest   7 Mono
              8 Peach    9 Mint    10 Sky     11 Rose
             12 Aqua    13 Ember   14 Grape   15 Night
  "accentColor": "#A855F7"   (OPTIONAL hex - overrides accent for your EXACT brand color)
  "font":   one of: sora | poppins | montserrat | playfair | dmsans | space | inter
  "bg":     animated background, one of:
             none | aurora | mesh | blobs | waves | dots | grid | rays | glow |
             auroraflow | silk | meshblobs | flowfield | starfield | shapes
  "btshape":  soft | pill | sq
  "btnAnim":  none | shine | pulse | glow | lift   (button animation)
  "anim":     none | fade | rise | zoom | slide    (section scroll reveal)
  "htitleGrad": true        (gradient on the hero headline)

================================================================================
PART 3 — THE CONTENT (sections), per type
================================================================================

WEBSITE (most powerful - use for landing pages, masterclass, agency, SaaS):
  Brand/theme: site, theme, accent, accentColor, font, bg, btshape, anim, btnAnim, htitleGrad
  Header:      nav (a|b|c|d), sticky, cta, ctaurl, menu, menuLinks
  Hero:        heroLayout (right|left|center|none), heroEyebrow, htitle, hsub,
               hb1, hb1url, hb2, hb2url, heroTitleSize (sm|md|lg|xl), heroTitleAlign (left|center|right)
  Sections:    order[]  (the exact sequence)
               sections{}  (which are visible: {features:true, faq:true, ...})
               heads{}  (per-section title/sub: {features:{title,sub}})
  Section keys you can put in order[] / sections{}:
      features, steps, spotlight, stats, banner, logos, gallery, brands, team,
      pricing, shop, countdown, video, about, map, testimonials, faq, newsletter, cta,
      ticker, kpi, gauges, badge        <-- NEW premium sections
  Section DATA arrays (field names matter - use EXACTLY these):
      feats:  [{ "ic":"emoji", "t":"title", "x":"description" }]
      stats:  [{ "n":"10,000+", "l":"label" }]          + "statsCount": true to animate
      pricing:[{ "n":"Plan", "p":"Rs.999", "py":"/mo", "f":"features", "pop":true, "url":"#", "btn":"Choose" }]
      tests:  [{ "n":"Name, City", "r":"role", "q":"quote", "img":"" }]   + "testStyle":"grid|carousel|marquee"
      faq:    [{ "q":"question", "a":"answer" }]
      badge:  [{ "text":"SEBI Reg No: ...", "icon":"emoji or img url" }]   (credential pills)
      kpi:    [{ "label":"Net Profit", "value":"75", "suffix":"L" }]      (metric cards)
      gauges: [{ "label":"Accuracy", "percent":78 }]                      (progress bars)
      ticker: [{ "label":"NIFTY", "value":"24,812", "change":"+0.84%", "up":true }]  (scrolling bar)
      countdown: { "title":"Closes in", "sub":"date line", "date":"2026-06-27T05:30:00.000Z" }
      ctaBand:   { "title":"Enroll now", "sub":"detail", "btn":"Enroll Rs.99", "url":"#register" }
  SEO/footer: seo{title,description}, legal{disclaimer,terms,refund,privacy each {on,title,text}}, announce{on,text,cta}

STORE:
  store, tagline, logo, accent, font, theme, btshape, pageWidth,
  order[], sections{}, heads{}, banner, products(leave empty - seller's own), featuredIdx,
  display, cols, announce, footerPay, legal
  Store section keys: banner, brands, topselling, featured, catalog

BIO (link in bio):
  name, handle, bio, profile_url, cover_url, verified, accent, font,
  button_style (soft|grad|outline|glass), button_shape (rounded|pill|square), bg,
  socials[], links[{ "t":"title", "u":"url", "highlight":true }], featured

COURSES:
  headline, subheadline, description_html, thumbnail, price, compare_at_price, currency,
  theme, accent, font, instructor_name, instructor_bio, instructor_avatar,
  outcomes[], includes[], category, cta_label, seo_title, seo_description, og_image

(For product / event / booking / lead / vip / payment: any sensible keys are accepted -
 open the studio for that type to see its fields, or ask Claude to match them.)

================================================================================
PART 4 — CREATE IT WITH CLAUDE AI (the easy path)
================================================================================

1. Open Claude. Paste the file docs/TEMPLATE-AUTHORING-FORMAT.md (the full spec).
2. Then paste THIS prompt (fill the [brackets]):

   "Using the Template Manifest format above, create a [premium] [website] template for
    [a trading masterclass: royal violet dark theme, gold/violet accent, finance vibe].
    Price it at Rs.99 (price_paise 9900). Use ONLY valid content keys for type 'website'.
    Include these sections in order: badge, kpi, gauges, features, testimonials (marquee),
    stats, faq, countdown, cta. Return ONE JSON object only - no markdown, no comments,
    no extra top-level keys."

3. Claude returns a JSON block. Save it as my-template.json.

   To make THEME VARIANTS of the same design, add:
   "Give me 3 versions, each with a different accent (2, 14, 5) and bg (auroraflow, silk, mesh)."

================================================================================
PART 5 — UPLOAD IT (step by step)
================================================================================

1. Log in as admin -> go to /admin/templates.
   (If buttons look dead, HARD REFRESH the page: Ctrl+Shift+R / Cmd+Shift+R.)
2. Click "Import manifest".
3. Drag your my-template.json onto the drop zone (or click to browse, or paste the JSON).
4. It validates instantly:
     - Green "valid" badge  = good, a live preview shows.
     - Red box              = it tells you exactly what to fix. Fix and re-drop.
5. (Optional) tick "Publish immediately" to make it live the moment you import.
6. Click "Import" (as draft) OR "Import & publish".
7. If you imported as draft: find the card in the grid -> click "Publish".
8. Done. It now appears in every seller's /dashboard/templates gallery.

Other ways to create (no JSON needed):
  - "Save as template": build a page in the studio, then export it as a template from admin.
  - "Generate with AI": the in-admin button (runs a stub until ANTHROPIC_API_KEY is set,
    then calls Claude directly inside the admin).

================================================================================
PART 6 — WHAT THE SELLER EXPERIENCES (buy -> see -> edit -> publish)
================================================================================

1. Seller opens /dashboard/templates, sees your published template (with price + preview).
2. Free template: clicks "Apply". Premium: clicks "Buy & Apply" -> pays by Wallet or Card/UPI.
3. On success it auto-applies and opens the builder showing YOUR theme + sections.
4. Seller edits any text/button/image, then Publishes -> their live site shows it.

================================================================================
QUICK CHECKLIST before you upload
================================================================================
[ ] Only the 9 top-level keys, nothing extra
[ ] type is one of the 11 valid types
[ ] tier free => price_paise 0 ; premium => price_paise > 0 (in PAISE)
[ ] theme is {} (empty); all design tokens are inside content
[ ] every content key is valid for the type
[ ] accent is a number 0-15 ; font/bg/btshape from the allowed lists
[ ] order[] lists your sections ; sections{} sets them true ; data arrays use the exact field names
[ ] valid JSON (no comments, no trailing commas)

================================================================================
## Page Builder v6 Template format
================================================================================

> NOTE: This section describes the v6 code-defined template format. It
> SUPERSEDES the old manifest (JSON-upload) format described above for any page
> that is managed by Page Builder v6. The old manifest format still applies to
> pages built with the legacy per-type studios (website, store, bio, etc.).

Page Builder v6 uses a single Section[] engine for all page types. Templates
are TypeScript objects stored in the `TEMPLATES` array inside
`lib/builder/templates.ts`. Applying a template replaces a page's sections,
themeId, and pageBg in one atomic call to `applyTemplate` (same file).

The v6 template format is validated at runtime by `lib/builder/validate.ts`
(exports `validateTemplate`, `validateSection`, `validatePageDoc`,
`coerceSection`). The validator checks every block type and variant against
`REGISTRY[type].fields`, so any drift between a template and the registry is
caught immediately.

--------------------------------------------------------------------------------
### Template TypeScript shape
--------------------------------------------------------------------------------

```ts
interface Template {
  id:           string;          // unique slug, e.g. 'saas-launch'
  name:         string;          // display name, e.g. 'SaaS Launch'
  category:     string;          // gallery grouping, e.g. 'SaaS', 'Agency'
  type?:        PageType;        // v6 page type (see below); omit = any type
  description?: string;          // one-line gallery blurb
  themeId:      string;          // one of the 13 theme ids (see below); required
  pageBg?:      PageBg;          // page background; defaults to 'none'
  tag:          'Free' | 'Pro';  // pricing tier shown in the gallery
  blocks:       TemplateTuple[]; // ordered list of block tuples
}
```

Field notes:

- `id` — machine-readable slug; must be unique across all entries in TEMPLATES.
- `name` — shown in the template gallery card.
- `category` — free-form string used for filtering (e.g. 'SaaS', 'Education').
- `type` — one of the eight v6 PageType values: `landing | vip | lead | event |
  booking | courses | opp | website`. Omit to make the template available to
  every page type. When present, the gallery can filter by page type.
- `description` — optional one-line summary shown in gallery cards.
- `themeId` — required, must be one of the 13 registered theme ids (see the
  Theme IDs section below). The validator rejects an unknown id.
- `pageBg` — optional animated background applied with the template. Valid
  values: `none | orbs | grid | aurora | mesh | dots`. Defaults to `'none'`
  when omitted (see `applyTemplate` in templates.ts).
- `tag` — `'Free'` (anyone can apply) or `'Pro'` (purchase wiring applied
  later). Must be exactly one of these two strings; the validator rejects
  anything else.
- `blocks` — ordered array of TemplateTuple (one per section on the page).

--------------------------------------------------------------------------------
### TemplateTuple
--------------------------------------------------------------------------------

```ts
type TemplateTuple = [BlockType, variant?, partialProps?]
```

A tuple of one to three elements:

1. `BlockType` (required) — the block type string, e.g. `'hero'`, `'pricing'`.
   Must be one of the 29 registered types (see Block Reference below).

2. `variant` (optional) — layout variant string. Defaults to the block's first
   registered variant when omitted. Must match one of the variant strings in
   `REGISTRY[type].variants`; the validator rejects unknown values.

3. `partialProps` (optional) — plain object with prop overrides. Shallow-merged
   over the block's registry defaults by `createSection`. Only include the keys
   you want to change; missing keys are filled from the registry defaults.

Example tuples:

```ts
['navbar']
// → navbar with all registry defaults (variant 'left', default logo/links)

['hero', 'center', { title: 'Ship faster', subtitle: 'No code required.', b1Label: 'Get started' }]
// → hero block, center variant, three prop overrides

['pricing']
// → pricing block, first variant ('cards'), all defaults
```

--------------------------------------------------------------------------------
### Theme IDs (13 total)
--------------------------------------------------------------------------------

These ids come directly from `lib/builder/themes.ts` (THEMES array). The
default theme is `violet`.

| id       | Name     | Brand     | Secondary | Accent  |
|----------|----------|-----------|-----------|---------|
| violet   | Violet   | #7C3AED   | #A855F7   | #06B6D4 |
| ocean    | Ocean    | #2563EB   | #3B82F6   | #06B6D4 |
| emerald  | Emerald  | #059669   | #10B981   | #84CC16 |
| sunset   | Sunset   | #F97316   | #FB923C   | #EF4444 |
| rose     | Rose     | #E11D48   | #F43F5E   | #FB7185 |
| midnight | Midnight | #1E293B   | #334155   | #38BDF8 |
| gold     | Gold     | #D97706   | #F59E0B   | #FCD34D |
| teal     | Teal     | #0D9488   | #14B8A6   | #2DD4BF |
| crimson  | Crimson  | #DC2626   | #EF4444   | #F87171 |
| indigo   | Indigo   | #4F46E5   | #6366F1   | #818CF8 |
| forest   | Forest   | #166534   | #16A34A   | #4ADE80 |
| slate    | Slate    | #475569   | #64748B   | #94A3B8 |
| magenta  | Magenta  | #C026D3   | #D946EF   | #F0ABFC |

--------------------------------------------------------------------------------
### Block Reference (29 blocks, generated from live registry)
--------------------------------------------------------------------------------

For repeater fields the row item fields are listed in parentheses after the
`repeater` kind annotation. Only override keys that actually exist here;
unknown keys produce a validator warning and are silently dropped by
`coerceSection`.

#### Structure

| Block type | Label  | Variants              | Fields (key:kind)                                                                                       |
|------------|--------|-----------------------|---------------------------------------------------------------------------------------------------------|
| navbar     | Navbar | left, center, split   | logoText:text, logoImg:image, links:repeater (label:text, url:url), ctaLabel:text, ctaUrl:url, sticky:toggle |
| footer     | Footer | simple, columns, minimal | logoText:text, tagline:text, links:repeater (label:text, url:url), socials:repeater (icon:icon, url:url), copyright:text |

#### Header

| Block type | Label    | Variants                   | Fields (key:kind)                                                                                                    |
|------------|----------|----------------------------|----------------------------------------------------------------------------------------------------------------------|
| badgebar   | Badge bar | pills, ticker             | items:repeater (icon:icon, text:text)                                                                                |
| hero       | Hero     | center, left, right, split | eyebrow:text, title:text, subtitle:textarea, b1Label:text, b1Url:url, b2Label:text, b2Url:url, image:image, rating:number |
| flip3d     | 3D flip  | card, tilt                 | title:text, subtitle:textarea, image:image                                                                           |
| webinfo    | Info bar | bar, cards                 | items:repeater (label:text, value:text)                                                                              |

#### Social proof

| Block type   | Label        | Variants              | Fields (key:kind)                                                                                     |
|--------------|--------------|-----------------------|-------------------------------------------------------------------------------------------------------|
| logos        | Logo wall    | row, grid, marquee    | heading:text, logos:repeater (img:image, alt:text)                                                    |
| marquee      | Marquee      | single, double        | items:repeater (text:text)                                                                            |
| proof        | Social proof | stars, avatars, mixed | heading:text, rating:number, count:number, avatars:repeater (img:image)                               |
| testimonials | Testimonials | grid, slider, marquee | heading:text, items:repeater (quote:textarea, name:text, role:text, avatar:image)                     |

#### Content

| Block type | Label          | Variants                        | Fields (key:kind)                                                                                              |
|------------|----------------|---------------------------------|----------------------------------------------------------------------------------------------------------------|
| features   | Features       | grid, list, icon-cards          | heading:text, sub:textarea, items:repeater (icon:icon, title:text, text:textarea)                              |
| bento      | Bento grid     | 3x2, asym                       | heading:text, items:repeater (title:text, text:textarea, span:select)                                          |
| tabs       | Tabs           | top, side                       | heading:text, items:repeater (label:text, title:text, text:textarea, image:image)                              |
| orbital    | Orbital        | ring                            | heading:text, center:text, items:repeater (label:text)                                                         |
| alist      | Accordion list | accordion, checklist            | heading:text, items:repeater (title:text, text:textarea)                                                       |
| stats      | Stats          | row, cards                      | heading:text, items:repeater (value:text, label:text)                                                          |
| steps      | Steps          | horizontal, vertical, numbered  | heading:text, items:repeater (title:text, text:textarea)                                                       |
| video      | Video          | embed, lightbox                 | heading:text, url:url, poster:image                                                                            |
| faq        | FAQ            | accordion, two-col              | heading:text, items:repeater (q:text, a:textarea)                                                              |
| counters   | Counters       | row                             | heading:text, items:repeater (value:number, label:text, suffix:text)                                           |

#### Layout

| Block type | Label       | Variants               | Fields (key:kind)                                                              |
|------------|-------------|------------------------|--------------------------------------------------------------------------------|
| grid       | Card grid   | 2col, 3col, 4col       | heading:text, items:repeater (image:image, title:text, text:textarea)          |
| media      | Media + text | left, right, full     | title:text, text:textarea, image:image, b1Label:text, b1Url:url                |
| gallery    | Gallery     | grid, masonry, carousel | heading:text, images:repeater (img:image, caption:text)                        |

#### Commerce

| Block type | Label   | Variants              | Fields (key:kind)                                                                                                           |
|------------|---------|-----------------------|-----------------------------------------------------------------------------------------------------------------------------|
| pricing    | Pricing | cards, table, toggle  | heading:text, sub:textarea, plans:repeater (name:text, price:text, period:text, features:textarea, ctaLabel:text, ctaUrl:url, featured:toggle) |
| payment    | Payment | inline, button, card  | heading:text, amount:number, currency:select, label:text, productId:text                                                    |

#### Capture

| Block type | Label      | Variants               | Fields (key:kind)                                                                       |
|------------|------------|------------------------|-----------------------------------------------------------------------------------------|
| countdown  | Countdown  | bar, block             | heading:text, target:text, expiredText:text                                             |
| banner     | CTA banner | band, floating         | text:text, ctaLabel:text, ctaUrl:url                                                    |
| lead       | Lead form  | inline, stacked, card  | heading:text, sub:textarea, fields:repeater (label:text, key:text, type:select), submitLabel:text, action:url |
| popup      | Popup      | center, slidein        | title:text, text:textarea, ctaLabel:text, ctaUrl:url, delay:number                     |

--------------------------------------------------------------------------------
### Worked example
--------------------------------------------------------------------------------

The following is a complete, valid Template object. It uses real block types,
real variants, real prop keys, and a real theme id. Copy-paste it into the
`TEMPLATES` array in `lib/builder/templates.ts` and it will pass
`validateTemplate` without errors.

```ts
{
  id: 'coaching-pro',
  name: 'Coaching Pro',
  category: 'Education',
  type: 'landing',
  description: 'High-converting coaching or course page with social proof and FAQ.',
  themeId: 'indigo',
  pageBg: 'aurora',
  tag: 'Pro',
  blocks: [
    ['navbar'],
    ['badgebar', 'pills'],
    ['hero', 'center', {
      eyebrow: 'LIMITED SPOTS',
      title: 'Transform your career in 90 days',
      subtitle: 'A proven, hands-on programme built by practitioners — not theorists.',
      b1Label: 'Apply now',
      b1Url: '#apply',
      b2Label: 'See the curriculum',
      b2Url: '#curriculum',
    }],
    ['proof', 'mixed'],
    ['features', 'grid'],
    ['steps', 'numbered'],
    ['testimonials', 'marquee'],
    ['stats', 'row'],
    ['pricing', 'cards'],
    ['faq', 'accordion'],
    ['banner', 'band', { text: 'Cohort closes Friday.', ctaLabel: 'Reserve your seat', ctaUrl: '#apply' }],
    ['footer'],
  ],
}
```

Key points illustrated above:

- `blocks` entries without a variant or props use the block's first registered
  variant and all registry defaults (e.g. `['navbar']`, `['footer']`).
- `['hero', 'center', { ... }]` — the third element is a partial props object;
  only the listed keys are overridden. All other hero props (b2Label, image,
  rating, etc.) remain at their registry defaults.
- `['banner', 'band', { text: '...', ctaLabel: '...', ctaUrl: '...' }]` — the
  banner block's three prop keys are all set explicitly.
- `themeId: 'indigo'` and `pageBg: 'aurora'` are both from the valid sets
  documented above; swapping to any other valid id/value requires no other
  change.

Templates live in `lib/builder/templates.ts` as the `TEMPLATES` array and are
expanded into fresh Section objects (with new ids) via `applyTemplate`. The
helper `templateSections` is available if you only need the Section array
without overwriting the full PageDoc.

--------------------------------------------------------------------------------
### Validator
--------------------------------------------------------------------------------

`lib/builder/validate.ts` exports four functions:

- `validateTemplate(t)` — checks tag, themeId, pageBg, and every block tuple
  (type, variant, and each prop key/value) against the live registry. Returns
  `{ ok: boolean, errors: string[] }`. Errors prefixed `warning:` do not set
  `ok = false` (unknown prop keys are warnings, not hard errors).
- `validateSection(section)` — validates a single expanded Section.
- `validatePageDoc(doc)` — validates a full PageDoc (themeId, pageBg, all
  sections).
- `coerceSection(section)` — best-effort clean: starts from registry defaults,
  merges only known prop keys from the input, carries over section-level
  controls (bg, size, align, anim, …). Safe to call on untrusted input.
