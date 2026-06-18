# invoxai.io — WEBSITE BUILDER · Full Build Prompt (start → end)

> Single source of truth for the multi-section, Wix-style **Website** page type.
> Mirrors the Bio page-type architecture. Use this to rebuild, extend, or brief
> an agent on the whole feature. Pairs with `docs/WEBSITE-PAGE-SPEC.md`.

---

## 0. Goal (one line)
A premium, animated, fully-customisable multi-page website builder where a seller
edits everything in a live two-pane builder and publishes to the **store root**
(`<subdomain>.invoxai.io`), with real per-page URLs, analytics, and working forms.

## 1. Rules (always honour)
1. Match the `.dx` dashboard theme; builder adapts to light/dark.
2. Live preview updates in real time on every change.
3. Every feature actually works (persists to DB, renders on the public site).
4. Analytics on the overview page (real `page_events`, clean empty states).
5. Proactively add + suggest more premium options; never ship the bare minimum.
6. Deploy = `npm run build` → `sudo systemctl restart invoxai-web`.

## 2. Files (the whole feature)
```
lib/website.ts                              model + constants + DEFAULT_WEBSITE
app/website.css                             scoped styles  .webview (public) / .webbuild (builder)
components/website/WebsiteView.tsx          public renderer (client) — sections, animations, forms
components/website/WebsiteTracker.tsx       view beacon → /api/bio/track
app/dashboard/website/page.tsx              overview + real analytics + leads
app/dashboard/website/edit/page.tsx         loads/seeds content → <WebsiteBuilder>
app/dashboard/website/actions.ts            saveWebsite / publishWebsite (server actions)
app/api/site/contact/route.ts               public contact + newsletter submit (service role)
app/sites/[domain]/[[...path]]/page.tsx     public route: website branch + custom-page resolve
lib/sites.ts                                pageTypeForPath / websiteSubPage / WEBSITE_SUBPATHS
supabase/migrations/20260617120000_site_messages.sql   leads table (applied)
```
Storage: one JSONB blob on `pages.content` where `page_type = "website"`,
`template_id = "website"`. Status `draft|published`. Analytics reuse the generic
`page_events` table (no website-specific migration). Uploads via `/api/upload`.

## 3. Data model — `WebsiteContent` (lib/website.ts)
Everything is one optional-field blob (`DEFAULT_WEBSITE` seeds a full demo site).

- **Brand:** `site, logo, logoSize, favicon, theme('light'|'dark'), themeToggle,
  font, accent(index into ACCENTS), bg(BGS), btshape('soft'|'pill'|'sq')`
- **Motion:** `anim(REVEALS), btnAnim(BTN_ANIMS), htitleGrad(bool)`
- **Header/menu:** `nav('a'|'b'|'c'|'d'), sticky, cta, ctaurl,
  menu{home,about,contact:{label,on}}, menuLinks[{label,url}]`
- **Custom pages:** `pages[{slug,label,inMenu,order[]}]`
- **Hero:** `heroLayout('right'|'left'|'center'|'none'), heroEyebrow, heroRating,
  heroBg(bool), heroTyping(csv), himg, htitle, hsub, hb1, hb1url, hb2, hb2url`
- **SEO:** `seo{title,description,ogImage}` (favicon from brand)
- **Sections:** `order[], sections{key:bool}, tint(bool),
  heads{key:{title,sub}}, secStyle{key:'auto'|'plain'|'tint'|'grad'|'dark'}`
- **Section content:** `feats[{ic,t,x}], steps[{t,x}] + stepStyle(STEP_STYLES),
  team[{img,name,role}], logos[url], countdown{title,sub,date} + cdStyle(CD_STYLES),
  stats[{n,l}], pricing[{n,p,f,pop}], tests[{n,r,q}], faq[{q,a}],
  gallery[url], brands(csv), brandLogos[url], video{url,title},
  about{img,title,text}, ctaBand{title,sub}, news{title,sub,btn}`
- **Contact + add-ons:** `email, phone, city, announce{on,text,cta},
  whatsapp{on,number,label,link,icon}, cookie{on}, social{ig,yt,x,tg},
  legal{privacy,terms,refund:{on,title,text}}`

### Constants
`ACCENTS`(16, reused from bio) · `BGS`(none/aurora/mesh/blobs/waves/dots/grid/rays/glow)
· `REVEALS`(none/fade/rise/zoom/slide) · `BTN_ANIMS`(none/shine/pulse/glow/lift)
· `FONTS`+`FONT_FAMILY`+`FONT_GOOGLE`(7 fonts, Google-loaded on demand)
· `SEC_STYLES`(auto/plain/tint/grad/dark) · `STEP_STYLES`(cards/numbers/timeline)
· `CD_STYLES`(cards/solid/minimal) · `NAVS` · `BTSHAPES` · `HERO_LAYOUTS`
· `SECTIONS`+`LABELS`+`ORDER` (15 sections) · `TEMPLATES`(6 one-click presets) · `ICONS`.

### Sections (15, reorderable + toggleable)
features · steps(How it works) · stats · logos(grid) · gallery(slider) ·
brands(marquee) · team · pricing · countdown · video(YouTube) · about ·
testimonials · faq · newsletter · cta(band). Plus the always-on **Hero** and the
implicit pages **About / Contact / legal:(privacy|terms|refund)**.

## 4. Public renderer — `WebsiteView.tsx` (`"use client"`)
Props `{ content, showBrand, device('web'|'mobile'), stage, track{pageId,storeId},
initialPage, live }`. Scoped under `.webview` (+ `.dark-site` when dark).

- **Structure:** `.site` → `.sitebg`(animated bg orbs/pseudo per `bg`) +
  `.sitewrap`(z-1 content) → announce bar · Nav · Content · Footer · floating
  chat · cookie. `--siteGrad` + `--font-sora` set inline; font `<link>` injected
  on demand.
- **Nav:** logo (click→home) · menu (editable labels + custom pages + custom
  links) · optional theme toggle · hamburger (mobile) · CTA. Layouts a/b/c/d.
- **Content router (by `page` state):** `home` = Hero + enabled sections in
  `order`; `about`/`contact` = built-in layouts; `legal:*` = policy text;
  `<custom slug>` = that page's section list. `renderSections()` applies
  scroll-reveal + per-section background (`secStyle`/`tint`).
- **Navigation:** internal links switch `page` instantly **and** `history.pushState`
  the real URL (so /about, /services are shareable + deep-linkable).
- **Premium behaviours:** scroll-reveal via IntersectionObserver (**`live` only**
  to avoid builder flicker); Typewriter + Countdown + ContactForm + NewsletterForm
  are stable top-level components (Nav/Content/Foot are called as functions — NOT
  `<Comp/>` — so state changes never remount/hide content).
- **Forms:** ContactForm + NewsletterForm POST `/api/site/contact` (no-op in
  builder preview); success states inline.
- **Analytics:** CTAs route through `/api/bio/go` (click + redirect);
  `WebsiteTracker` fires a view beacon.

## 5. Builder — `WebsiteBuilder.tsx` (`"use client"`)
Two-pane: left editor (panels below), right **sticky live preview** with
🖥 Web / 📱 Mobile toggle + Builder/Public tabs + Save draft / Publish.
- Web preview renders at a fixed **1280px** inside a `ScaledFrame` (ResizeObserver
  zoom-to-fit, flex-centered) so it shows true desktop layout without squish;
  mobile preview renders natively. Public tab renders responsively (centered).
- **Panels:** Quick-start templates · Brand (logo+size, favicon, name, accent,
  bg motion, button shape, font, theme, visitor toggle) · Header/menu (style,
  CTA, sticky, menu labels/visibility, custom links) · **Pages** (add/rename,
  auto-unique slug, show-in-menu, per-page section chips) · Animations & effects
  (reveal, button anim, gradient headline) · Hero (layout, eyebrow, typewriter,
  heading/sub, btn1/2 text+link, rating, gradient bg, image) · Sections (reorder
  ▲▼, per-section bg dropdown, on/off) · Announcement & add-ons (announce,
  floating chat icon/number/label/link, cookie, socials) · Features · How it works
  (+design) · Stats · Pricing · Video · Image slider · Logos grid · Brand slider
  (names + logo uploads) · Team · Countdown (+design) · Testimonials · FAQ ·
  Newsletter · About · CTA band · Contact · SEO & sharing · Legal.
- Inline-input rule: helper render-functions (e.g. `headFields(k)`) are CALLED,
  never used as `<Comp/>`, so inputs don't lose focus on each keystroke.

## 6. Persistence & routing
- **Save/publish:** `actions.ts` upserts the singleton `website` page for the
  owner's store; `revalidatePath`. Edit page seeds `DEFAULT_WEBSITE` for new sites
  and backfills `order`/`sections` so existing sites gain newly-added sections.
- **Public route** `app/sites/[domain]/[[...path]]`: resolves store by host →
  `pageTypeForPath` (root + about/contact/privacy/terms/refund → `website`) →
  single unknown segment matched against `content.pages[].slug` → renders
  `WebsiteView … stage live` + `PixelInjector` + `WebsiteTracker`.
  `generateMetadata` emits title/description/OG + **favicon icons** from content.

## 7. Styling — `app/website.css`
`.webview` carries self-contained light tokens (+ `.dark-site` overrides); content
centered at `--ww:1180px` via `padding-inline: max(26px, calc((100% - 1180px)/2))`
with full-bleed bands. Animated bg keyframes (`wb-*`), reveal, button anims,
gradient headline, per-section bg (`.tintbg/.gradbg/.darkbg`), all section styles,
and class-driven `.site.m` mobile preview + real `@media(max-width:760)` rules
(stacked hero buttons, working hamburger, bigger gallery). Builder layout under
`.webbuild` (border-box + min-width:0 guards against overlap).

## 8. Analytics & leads
- Views/clicks → `page_events` (`/api/bio/track`, `/api/bio/go`). Overview shows
  Views / CTA clicks / CTR / device donut / top CTAs.
- Form submissions → `site_messages` (RLS owner-read, service-role insert) via
  `/api/site/contact`; shown as "Recent messages" on the overview.

## 9. Acceptance checklist
- [ ] Builder matches `.dx`, light/dark; live preview instant.
- [ ] Save + Publish persist; root + sub-page URLs render; favicon in tab.
- [ ] All 15 sections + hero customisable (heading/sub editable everywhere).
- [ ] Animations (bg motion, reveal, buttons, gradient headline) work on the
      live site; no flicker in builder.
- [ ] Mobile: hamburger opens, hero buttons stack, gallery swipes, no overlap.
- [ ] Forms submit → leads visible; CTAs tracked.
- [ ] Cookie/menu/theme clicks never hide content.

## 10. Known follow-ups (not yet built)
Per-page **unique** section content (v1 shares content across pages) · image+text
spotlight / map / banner / pricing monthly-yearly toggle sections · per-section
padding & column-count · hero video background.

---

## 11. Copy-paste master prompt
> Build a premium, Wix-style **Website** page type for invoxai mirroring the Bio
> architecture. One `WebsiteContent` JSONB blob on `pages.content`
> (`page_type:"website"`) renders at the store root. Create `lib/website.ts`
> (model + constants in §3 + `DEFAULT_WEBSITE` full demo seed), `app/website.css`
> (scoped `.webview`/`.webbuild`, 1180px centered container, animated backgrounds,
> reveal, button animations, dark theme, all section styles, mobile rules),
> `components/website/WebsiteView.tsx` (client; `.sitebg` motion layer + `.sitewrap`;
> Nav with editable menu + custom pages + logo→home; section router for
> home/about/contact/legal/custom-slug via `renderSections` with reveal+secStyle;
> Hero with eyebrow/typewriter/rating/gradient-bg/2 linked buttons; 15 sections;
> Typewriter/Countdown/ContactForm/NewsletterForm as stable components, Nav/Content/
> Foot CALLED as functions; scroll-reveal via IntersectionObserver gated on `live`;
> fonts loaded on demand) + `WebsiteTracker`; the two-pane `WebsiteBuilder` with a
> ScaledFrame desktop preview, device + Builder/Public toggles, and every panel in
> §5; server actions; `/api/site/contact` + `site_messages` table; overview page
> with real `page_events` analytics + leads; wire the public renderer branch +
> custom-page slug resolution + favicon metadata. Honour the 6 rules in §1 and the
> §9 acceptance checklist. Build green, deploy, verify.
</content>
