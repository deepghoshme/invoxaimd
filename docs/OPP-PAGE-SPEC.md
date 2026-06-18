# InvoxAI — One-Page Product / Payment (OPP) Page · Build Spec

**Component:** Conversion-focused product + checkout page
**Route:** `name.invoxai.io/opp/{id}` (custom domain via Caddy)
**Stack:** Next.js (App Router) · Supabase (RLS) · Razorpay · server-side amount + publish enforcement
**Rendering:** Public pages render the **light** theme by default. A dark "Twilight" token set exists but is not used for public OPP pages.

This is the single source of truth for the page. It supersedes the original brief where they differ — the differences are the deliberate refinements listed in §11.

Implementation map:
- `components/templates/ProductTemplate.tsx` — layout, aurora, card, columns, strip, bars
- `components/checkout/InlineCheckout.tsx` — web embedded checkout
- `components/checkout/CheckoutForm.tsx` — mobile separate checkout page (`/opp/checkout/{id}`)
- `components/checkout/{StickyBuyBar,ScrollToCheckout,BuyButton,ImageSlider,CountdownTimer,LiveProof}.tsx`
- `components/RichText.tsx` — description editor (builder)
- `app/globals.css` — `.prod-page2`, `.aurora`, `.prod2-card`, `.prod2`, `.prod2-right`, `.prod2-strip`, `.cta-web/.cta-mobile`
- `lib/products.ts` — `OppContent` model

---

## 1. Design system (theme tokens — never hardcode colors)

| Token | Value |
|---|---|
| `--color-primary` | `#FF6A3D` |
| `--color-primary-hover` | `#F0532A` |
| `--color-secondary` | `#FF4D7D` |
| `--color-accent` | `#7B3FE4` |
| `--color-highlight` | `#FFB23E` |
| `--brand-gradient` | `linear-gradient(135deg,#FFB23E 0%,#FF6A3D 38%,#FF4D7D 70%,#7B3FE4 100%)` |
| `--color-bg` | `#FFF9F4` |
| `--color-surface` | `#FFFFFF` |
| `--color-text` | `#2B1B2E` |
| `--color-muted` | `#7A6770` |
| `--color-border` | `#F0E1D6` |

- **Type:** Headings **Sora** (700–800), body **Inter** (400–600). **Radius:** 12–20px. **Spacing:** generous.

---

## 2. Page shell (both breakpoints)
- **Background:** full-screen fixed **animated looping brand aurora** (4 blurred blobs drifting on 28–34s loops). `pointer-events:none`, behind all content.
- **Content:** centered white **floating card** (`--color-surface`), max width **1200px**, soft shadow, radius 18px. No `overflow` on the card or its ancestors (would break the sticky right panel).
- **Reduced motion:** disables aurora, shine, and transitions.
- Breakpoint boundary: **web ≥ 821px**, **mobile ≤ 820px**.

---

## 3. WEB / DESKTOP (≥ 821px)
- **Header** (in card): title (Sora bold, optional icon, align L/C/R) + bold subtitle.
- **Two-column grid — left ≈65%, right ≈35%.**
- **LEFT (white, scrolls):** hero banner image (contain) · Description (rich-text HTML) + features (custom icons) · Gallery slider (dots, optional auto-scroll) · Testimonials 2×2 · FAQ accordion · Policies accordions · Footer (payment icons + brand badges + contact + Powered-by InvoxAI).
- **RIGHT (sticky):** solid `--color-primary` + white hex pattern. Countdown (gradient boxes, tabular nums, align) + seats + trust badges + **embedded checkout card** (Email / Name* / Phone+code / Sub Total / Total / BUY NOW gradient+shine / secure note). On-page checkout: order → Razorpay → server verify → pixels, no nav. Sold-out → big Sold Out / Contact seller button.
- **Web bottom Buy bar:** hidden, auto-reveals after ~360px scroll, price + %OFF + gradient buy → smooth-scrolls to the embedded form + focuses email.
- **Live-purchase popups** (optional).

---

## 4. MOBILE (≤ 820px)
Single-column vertical. **No embedded/inline checkout on the page.**
1. **Sticky top announcement strip** — the offer **countdown** lives here ("⏳ Offer ends in …" on `--brand-gradient`).
2. Header (title + subtitle).
3. Hero → Description + features → Gallery → Testimonials → FAQ → Policies.
4. Urgency panel (orange + hex): **seats + trust badges only** (no countdown, no checkout card).
5. Footer.
- **Sticky bottom Buy bar** → navigates to **separate checkout page** `/{page_type}/checkout/{order_id}` (`CheckoutForm`: Email/Name/Phone → Pay → purchase pixels).
- Sold-out → Sold Out / Contact seller button.

---

## 5–11
See the canonical prompt this file was generated from. Key deltas vs the original brief (§11):
1. Mobile has **no on-page checkout** — only the bottom bar → separate checkout page.
2. Web floating CTA is a **bottom buy bar that auto-reveals after scroll** (not a round pill).
3. **Animated brand aurora** background behind a centered floating card.
4. **Right panel + checkout are sticky** on web; only the left column scrolls.
5. **Mobile countdown moved to a sticky top announcement strip.**
6. Countdown uses **tabular numerals**.

## Server logic (non-negotiable)
- Amount recomputed **server-side**; publish gate (price>0 + seller email) enforced server-side.
- Seats derived from **paid** orders server-side. Razorpay uses the **seller's** keys; order create + signature verify server-side.
- Pixels fire on view + purchase. Powered-by respects the admin global toggle.

## Suggested next (not v1)
Order bump · coupon field · pricing tiers/variants · UPI-first + EMI line · GST invoice toggle · WhatsApp delivery · exit-intent capture.
