# InvoxAI Page Builder v6 — Build & Agent Plan

Source of truth: the user's "Production Build Prompt" (spec) + prototype `invoxai-builder-v6.html` (pending).
Decision: **Path B** — the new one-engine `Section[]` model becomes the real builder; reuse the `pages` table,
rewrite the public renderer. De-risk by shipping one page type end-to-end first, then rolling + migrating.

## Architecture (reconciled with the live codebase)
- **Storage:** reuse `public.pages`. Store the v6 `Section[]` + page meta in `pages.content` jsonb under a
  versioned key (`content.v = 6`, `content.sections`, `content.themeId`, `content.pageBg`). Legacy rows
  (`content.v` absent) keep rendering via the OLD renderer until migrated → **no break on day one.**
  Add columns: `theme_id text`, `page_bg text`.
- **Templates:** reuse the existing `templates` table (already has `content/theme/tags/license_model`).
  v6 `Template.blocks` → store in `templates.content`. `tag Free|Pro` ↔ existing `tier free|premium`.
- **Themes:** NEW `themes` table (id,name,brand,b2,acc), seed the 13. Default `violet` (brand).
- **Renderer:** ONE component renders `Section[]` — used by editor preview, Preview overlay, and public SSR.
  A discriminator picks v6-renderer vs legacy-renderer per `content.v`.
- **Uploads:** reuse the existing Supabase Storage upload server action (bucket `page-assets`, owner-scoped).
- **Security:** all writes/uploads/Razorpay via server actions with the user session; no client secrets.

## Phase → agent map (sequential; I verify + gate deploy between phases)
| Phase | Deliverable | Agent | DB? | Deploy? |
|------|-------------|-------|-----|---------|
| **1 Foundation** | `lib/builder/{types,registry,themes,backgrounds}.ts` + `RenderEngine` that renders `Section[]`; all blocks (§3) registered with fields+defaults | feature-dev/builder-studio | no | no |
| **2 Editor shell** | top bar, left rail (drag/reorder/dup/hide/delete), center web/mobile frame, schema-driven inspector (§4–5), sticky-rails + natural scroll | builder-studio (+frontend) | no | no |
| **3 Theme/bg/responsive** | 13 themes re-tint page root; page-bg layer behind sections; mobile column collapse + bottom CTA | frontend-ui | no | no |
| **4 Blocks data-driven** | section-library popup; every list block add/edit/remove via repeaters; per-section controls wired | 1–2 agents (split blocks) | no | no |
| **5 Persistence** | migration (pages.theme_id/page_bg + `themes` table seed 13); save/load `PageDoc`; image upload to Storage | supabase-migration + api-route | **yes** | gate |
| **6 Templates + Apply** | port 25 templates into `templates`; gallery + Direct Apply (replace sections+theme+bg); Direct Buy reuses existing wallet/Razorpay | checkout-commerce | seed | gate |
| **7 Publish + public SSR** | publish → `status=published`; public route renders via the SAME engine; theme+bg applied; v6/legacy discriminator | api-route + perf-seo | no | gate |
| **8 Format guide + validator** | extend existing template docs with the v6 `Template` format; validator reuses registry `fields` | frontend-ui | no | no |

## Order of delivery (de-risk Path B)
1. Phases 1–4 build the engine + editor with **in-memory** state (no DB, no deploy) → fully demoable.
2. Phase 5 adds persistence (first DB + deploy gate).
3. Phase 6–7 add templates + public render for **ONE page type** (Landing/OPP) end-to-end → verify.
4. Roll the engine to remaining page types; migrate legacy rows last.

## Defaults (locked)
Brand `#7C3AED`/`#A855F7`/`#06B6D4`; default theme `violet`; display Space Grotesk, body Inter; default page bg `none`;
new pages brand-themed with InvoxAI logo in navbar/footer.

## Policy
Agents build + `tsc` + commit only — **never restart prod**. The main session runs every prod deploy through the gate.
