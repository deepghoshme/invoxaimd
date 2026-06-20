# Paste-This Prompt for ANY AI Platform (ChatGPT / Claude / Gemini / etc.)

Copy EVERYTHING between the lines below into the AI. Fill the [brackets] with your design idea.
The AI returns ONE .json file. Save it, then upload it in /admin/templates -> auto preview -> publish.

================================ COPY FROM HERE ================================

You are generating a website template as ONE strict JSON object (a "Template Manifest")
for the invoxai platform. Output ONLY the JSON object. No markdown, no code fences, no
comments, no trailing commas, no extra keys. It must be valid JSON.

TOP-LEVEL: exactly these 9 keys and NO others:
  name          string, 2-40 chars
  type          MUST be "website"
  tier          "free" or "premium"
  price_paise   integer. If tier="free" it MUST be 0. If "premium", price in paise (Rs.99 = 9900).
  description   one sentence
  tags          array of lowercase strings
  thumbnail_url ""  (empty string)
  theme         {}  (empty object)
  content       the design object (rules below)

INSIDE "content" — THEME TOKENS (use only these exact values):
  theme        "light" or "dark"
  accent       integer 0-15  (0 Sunset,1 Coral,2 Violet,3 Gold,4 Berry,5 Ocean,6 Forest,
               7 Mono,8 Peach,9 Mint,10 Sky,11 Rose,12 Aqua,13 Ember,14 Grape,15 Night)
  accentColor  optional "#RRGGBB" exact brand color (overrides accent)
  font         one of: sora poppins montserrat playfair dmsans space inter
  bg           one of: none aurora mesh blobs waves dots grid rays glow auroraflow
               silk meshblobs flowfield flowfield starfield shapes
  btshape      soft pill sq
  btnAnim      none shine pulse glow lift
  anim         none fade rise zoom slide
  htitleGrad   true or false

INSIDE "content" — STRUCTURE:
  site         brand name (string)
  cta, ctaurl  header button text + url
  heroEyebrow  small tag above the hero
  htitle, hsub hero headline + subtext
  hb1, hb1url  primary hero button text + url
  hb2, hb2url  secondary hero button text + url
  order        ARRAY of section keys in display order (choose from the SECTION KEYS below)
  sections     OBJECT: each key in order set to true, e.g. {"features":true,"faq":true}
  heads        OBJECT: per-section heading, e.g. {"features":{"title":"...","sub":"..."}}

SECTION KEYS allowed in order/sections:
  features steps spotlight stats banner logos gallery brands team pricing shop
  countdown video about map testimonials faq newsletter cta ticker kpi gauges badge

SECTION DATA — put these arrays/objects in content using EXACTLY these field names:
  feats:   [{"ic":"emoji","t":"Title","x":"description"}]
  stats:   [{"n":"10,000+","l":"label"}]                 (also add "statsCount": true)
  pricing: [{"n":"Plan","p":"Rs.999","py":"/mo","f":"features","pop":true,"url":"#","btn":"Choose"}]
  tests:   [{"n":"Name, City","r":"role","q":"quote","img":""}]   (also add "testStyle":"marquee" for scrolling)
  faq:     [{"q":"question","a":"answer"}]
  badge:   [{"text":"SEBI Reg No: INH...","icon":"emoji"}]
  kpi:     [{"label":"Net Profit","value":"75","suffix":"L"}]
  gauges:  [{"label":"Accuracy","percent":78}]
  ticker:  [{"label":"NIFTY","value":"24,812","change":"+0.84%","up":true}]
  countdown: {"title":"Closes in","sub":"date line","date":"2026-06-27T05:30:00.000Z"}
  ctaBand:   {"title":"Enroll now","sub":"detail","btn":"Enroll Rs.99","url":"#"}

RULES:
- Every key inside content MUST be from the lists above. Unknown keys are rejected.
- Write real, on-brand copy (no "lorem ipsum"). Match the brief below.
- Every section in order[] must have sections[key]=true AND its data array filled.
- Leave image URLs as "" unless you have a real https URL.

THE BRIEF (what to design):
  Vibe / industry: [e.g. trading masterclass, royal violet dark, finance, premium]
  Free or premium + price: [e.g. premium, Rs.99]
  Sections I want (in order): [e.g. badge, kpi, gauges, features, testimonials (marquee), stats, faq, countdown, cta]
  Anything specific: [e.g. SEBI Reg No INH000015871, headline "Two strategies...", 78% & 82% accuracy]

Now output ONLY the JSON manifest.

================================ COPY TO HERE =================================

AFTER THE AI REPLIES:
1. Copy the JSON it produced. Save as my-template.json (or just copy it).
2. Go to /admin/templates -> Import manifest.
3. Drag the file in (or paste the JSON). It validates + shows a LIVE PREVIEW automatically.
   - Green = valid. Red = it lists what to fix; paste the error back to the AI and ask it to fix.
4. Tick "Publish immediately" then click Import & publish (or import as draft, then Publish).
