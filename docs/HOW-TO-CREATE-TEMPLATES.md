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
