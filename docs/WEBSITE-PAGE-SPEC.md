# WEBSITE page type — build spec & plan

> Multi-page **Website** builder (the seller's homepage at the store root).
> Mirrors the **Bio** page type architecture 1:1. Source design: the provided
> `invoxai.io — Website builder` mockup. Follow [[builder-page-rules]].

## 0. Why / where it lives
- Menu item already exists: **Website** → `/dashboard/website`
  (`app/dashboard/layout.tsx:14`).
- The store **root** already maps to this type: `pageTypeForPath([])` returns
  `"website"` (`lib/sites.ts:228`). So a published website renders at
  `subdomain.invoxai.io/` (no `/bio` suffix). Currently the root falls back to
  bio because no website page exists yet — once published, website wins.
- `page_events` table is generic (`page_id, store_id, kind, link_label, device`)
  → **no migration needed**; reuse it for views + CTA clicks like bio.

## 1. Data model — `lib/website.ts` (no server-only imports)
Mirror `lib/bio.ts`. One `WebsiteContent` JSONB blob stored on `pages.content`
where `page_type = "website"`.

```ts
export type WSFeature   = { ic: string; t: string; x: string };
export type WSStat      = { n: string; l: string };
export type WSPlan      = { n: string; p: string; f: string; pop?: boolean };
export type WSTest      = { n: string; r: string; q: string };
export type WSFaq       = { q: string; a: string };
export type WSLegalDoc  = { on: boolean; title: string; text: string };

export type WebsiteContent = {
  // brand
  site?: string; logo?: string; favicon?: string;
  accent?: number; bg?: "none" | "aurora" | "glow"; btshape?: "soft" | "pill" | "sq";
  // header
  nav?: "a" | "b" | "c" | "d"; cta?: string; ctaurl?: string;
  // hero
  himg?: string; htitle?: string; hsub?: string; hb1?: string; hb2?: string;
  // section order + visibility
  order?: string[];                      // ["features","stats",...]
  sections?: Record<string, boolean>;
  // section content
  feats?: WSFeature[]; stats?: WSStat[]; pricing?: WSPlan[];
  tests?: WSTest[]; faq?: WSFaq[];
  gallery?: string[]; brands?: string;
  video?: { url: string; title: string };
  about?: { img?: string; title: string; text: string };
  ctaBand?: { title: string; sub: string };
  news?: { title: string; sub: string; btn: string };
  // contact + add-ons
  email?: string; phone?: string; city?: string;
  announce?: { on: boolean; text: string; cta: string };
  whatsapp?: { on: boolean; number: string };
  cookie?: { on: boolean };
  social?: { ig?: string; yt?: string; x?: string; tg?: string };
  legal?: { privacy: WSLegalDoc; terms: WSLegalDoc; refund: WSLegalDoc };
};
```
Constants (export, reused by builder + view): `ACCENTS` (reuse bio's 16 — superset
of the mockup's 8), `BGS`, `NAVS`, `BTSHAPES`, `ICONS`, `SECTIONS` (+`LABELS`),
and `DEFAULT_WEBSITE` (the mockup's starter `state`, so a new site previews full,
not blank — same trick as bio's edit seeding).

## 2. Public renderer — `components/website/WebsiteView.tsx`
Port the mockup's render functions (`heroSec`, `featSec`, `pricingSec`, …) to JSX.
- Props: `{ content, showBrand, page?, device?, stage?, track? }`.
- `page` = `"home" | "about" | "contact" | "legal:privacy" | …`; internal menu &
  footer links switch it (client state) so one published page serves all sub-pages
  (mockup behaviour). `device` toggles the `.m` mobile class.
- Interactivity (client `"use client"`): FAQ accordion, gallery slider buttons,
  cookie accept/decline, mobile hamburger, YouTube click-to-load, WhatsApp float.
- `stage` = public full-bleed wrapper (like `BioView stage`).
- CTA / nav / newsletter clicks fire a click beacon (analytics §6).

## 3. CSS — `app/website.css`
Port the mockup `<style>` **scoped** under `.webview` (public) / `.webbuild`
(builder preview), same convention as `app/bio.css` (`.bioview` / `.biobuild`).
Keep the `.site.m …` mobile-preview rules (class-driven, viewport-independent) so
the builder's 📱 Mobile toggle works inside the desktop two-pane.

## 4. Builder — `components/website/WebsiteBuilder.tsx`  (`"use client"`)
Two-pane live preview, mirroring `BioBuilder`:
- Left editor sections: **Brand** (logo/favicon upload via `/api/upload`, site
  name, accent swatches, bg chips), **Header/menu** (nav-style chips, CTA, button
  shape), **Hero** (image + heading/sub/buttons), **Sections** (reorder ▲▼ +
  on/off switches), **Announcement & add-ons** (WhatsApp/cookie/announce toggles,
  socials), **Features / Stats / Pricing / Testimonials / FAQ** (repeatable row
  editors w/ add+remove), **Video**, **Image slider** (multi-upload + brand
  names), **Newsletter**, **About**, **CTA band**, **Contact**, **Legal**.
- Right pane: `<WebsiteView>` live preview + **🖥 Web / 📱 Mobile** device toggle +
  **Builder / Public** view toggle (reuse the `.devbar`/`.seg` chrome).
- Top bar: **Save** (draft) + **Publish** buttons, public URL, status pill.
- Every input is controlled → state → preview re-renders instantly (rule #2).
- Reuse `Upload` helper pattern from `BioBuilder` (Change/Remove buttons).

## 5. Routes (dedicated folder, mirrors `app/dashboard/pages/bio/`)
- `app/dashboard/website/page.tsx` — **overview/menu page**: `Phead` + KPIs
  (Views / CTA clicks / CTR / Status) + real `page_events` analytics (top CTAs,
  device donut) + "Open builder" / "View ↗". Mirrors `pages/bio/page.tsx`.
  (A dedicated `page.tsx` here overrides the `[...slug]` catch-all placeholder, so
  also delete the `website:` stub in `components/dx/sellerPages.tsx:212`.)
- `app/dashboard/website/edit/page.tsx` — loads/creates the website page, seeds
  `DEFAULT_WEBSITE` for new, renders `<WebsiteBuilder>`. Mirrors `pages/bio/edit`.
- `app/dashboard/website/actions.ts` — `saveWebsite` / `publishWebsite`
  (`page_type:"website"`, `template_id:"website"`). Copy of `pages/bio/actions.ts`.

## 6. Public wiring + analytics
- `app/sites/[domain]/[[...path]]/page.tsx`: add a `page.page_type === "website"`
  branch → `<PixelInjector/>` + `<WebsiteView content={...} stage showBrand .../>`
  + `<WebsiteTracker pageId storeId />` (copy `BioTracker`). Import `app/website.css`.
- `lib/sites.ts pageTypeForPath`: also map website sub-paths
  (`about`, `contact`, `privacy`, `terms`, `refund`) → `"website"`, and pass the
  matched segment to `WebsiteView page=` so deep links + SEO work (enhancement;
  v1 can ship root-only with client nav).
- **Analytics**: reuse `page_events` + the existing `/api/bio/track` (view beacon)
  and `/api/bio/go` (click redirect) — or rename them to neutral `/api/track`,
  `/api/go` shared by both. Records views on load, CTA/nav/newsletter as clicks
  with `link_label`. Overview page reads the same way `pages/bio/page.tsx` does.

## 7. Build order (one commit per step)
1. `lib/website.ts` (model + constants + default).
2. `app/website.css` (scoped port).
3. `components/website/WebsiteView.tsx` (+ `WebsiteTracker`).
4. `components/website/WebsiteBuilder.tsx`.
5. `app/dashboard/website/{page,edit/page,actions}.tsx` + remove sellerPages stub.
6. Public renderer branch + `pageTypeForPath` sub-paths.
7. `npm run build` → `sudo systemctl restart invoxai-web` (see [[deploy-workflow]]),
   verify: create → live preview updates → save → publish → root URL renders.

## 8. Acceptance (builder-page-rules checklist)
- [ ] Matches `.dx` theme, adapts light/dark.
- [ ] Live preview updates in real time on every field.
- [ ] Save + Publish persist to `pages` (verified in DB).
- [ ] Overview page shows real `page_events` analytics + clean empty states.
- [ ] Extras shipped beyond the mockup where cheap (e.g. add/remove rows, SEO
      fields, more accents) and next ideas suggested.
</content>
</invoke>
