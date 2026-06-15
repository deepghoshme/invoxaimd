# FINAL MASTER PROMPT — invoxai.io

> The complete, consolidated build spec. Single source of truth for building with Claude Code.
> **Build phase by phase.** Companions: `FULL-PLAN-CHECKLIST.md` (track progress) · `URL-STRUCTURE.md` (full routing).

---

## 0. Paste-to-start summary (give to Claude Code first)

"I'm building invoxai.io — an all-in-one creator/business platform (India-first + global). Sellers build pages, stores, courses, bookings, paid communities hosted on a subdomain or their own custom domain; add Meta/Google ad pixels with no code; connect their own payment gateway; and run ads to SEO-friendly, sunset-themed pages. Buyers get an account to track orders. I (admin) control plans, per-category commission, branding, revenue, coupons and email. A prepaid wallet collects my commission. Stack: Supabase (DB + auth + storage), Hostinger KVM2 VPS (Next.js + Caddy SSL). Start with the Supabase schema + auth + RLS."

---

## 1. Tech stack
- **DB / Auth / Storage:** Supabase (Postgres, Auth = Google + Email OTP, Storage, Row Level Security, Edge Functions, cron)
- **App + hosting:** Next.js on Hostinger KVM2 VPS, **server-side rendered** (speed + SEO)
- **SSL / domains:** Caddy (auto SSL for wildcard subdomains + seller custom domains)
- **CDN** in front of pages
- **Platform billing:** Razorpay + Cashfree · **Seller gateways:** Razorpay, Cashfree, Stripe, PayU, PhonePe
- **Email:** SMTP or Gmail App Password (configurable both sides) — see §7

---

## 2. Architecture: 3 surfaces · 2 payment layers · 2 email layers
- **Surfaces:** Seller dashboard (`app.invoxai.io`) · Buyer corner · Admin panel (`admin.invoxai.io`). One account system, roles via Supabase RLS.
- **Payment layers:** Platform billing (you charge sellers, Razorpay+Cashfree) vs Seller payments (sellers receive from buyers via own gateway; your checkout records the order + deducts commission from the seller's wallet). Keep fully separate in code.
- **Email layers:** Platform → users (OTP, verify, welcome, payment confirm, invoice, daily wallet invoice, weekly report) vs Seller → buyers (brand marketing, automation, abandoned-cart).

---

## 3. Revenue model (6 streams)
1. Subscription plans · 2. Per-sale commission (prepaid wallet, per-category) · 3. Contact overage (limit + ₹10/extra — *confirm*) · 4. Premium template sales · 5. Extra subdomains (1 free, extras paid) · 6. Extra custom domains (1 free, extras paid). Prices set in admin.

---

## 4. Domains & URL structure (full detail in `URL-STRUCTURE.md`)
- Marketing site `invoxai.io` · Seller dashboard `app.invoxai.io` · Admin `admin.invoxai.io`
- Seller pages on `name.invoxai.io` (same paths carry to custom domain): `/store`, `/bio`, `/courses`, `/opp/{id}`, `/pay/{id}`, `/book/{id}`, `/ldf/{id}`, `/vpc/{id}`, `/led/{id}`, `/env/{id}`
- Page-type-aware checkout: `name.invoxai.io/{page_type}/checkout/{order_id}`
- Rules: reserve system subdomains (app, admin, www, api…); lowercase paths; short random non-sequential `{id}`s; validate order belongs to its page type.

---

## 5. New-user onboarding (required after signup)
1. Email OTP verification → 2. Store name → 3. Subdomain (live availability check) → 4. Business category (also sets commission rate) → 5. Billing details → land in dashboard with a guided "create first page" prompt. Block dashboard until complete; allow resume.

---

## 6. Custom-domain connect behavior
On verify: all subdomain pages **auto-shift** to the custom domain · dashboard URLs **update** · old subdomain URLs **301-redirect** to the custom domain · canonical tags point to custom domain. Flow: add domain → CNAME instructions → verify DNS → Caddy issues SSL → set as primary domain.

---

## 7. Email configuration (both admin & seller)

Each side can connect sending via **either** method:

**A) Google Mail (Gmail)** — Google email (User ID) + **App Password** (16-char; requires 2-Step Verification). System uses `smtp.gmail.com` (587 TLS / 465 SSL).

**B) Custom SMTP** — host, port, username, password, encryption (TLS/SSL), from name + from email.

Shared: store all credentials **encrypted**; "Send test email" button; **Admin** config powers platform transactional mail; **seller** config powers brand marketing mail. *Volume:* free Gmail ≈ 500/day — for OTP/invoices at scale use SES / SendGrid / Postmark.

---

## 8. Feature breakdown (what it does → key functions)

- **Page builder & hosting** → template renderer, content editor, draft/publish, SSR+CDN, per-page SEO + pixel settings.
- **Bio page** → link/social blocks, profile header, theme picker, click tracking.
- **One-page product** → product fields, checkout link, upsell hook, view/purchase pixel events.
- **Digital store** → catalog, categories, cart, checkout, orders, upsell + abandoned-cart hooks.
- **Courses** → course/module/lesson, external video host, purchase-gated access, progress.
- **1-to-1 booking** → availability, slots, time zones, payment, confirmations.
- **Event booking** → tickets/seats inventory, payment, attendee list, confirmations.
- **Payment page** → fixed/custom amount, payer details, order record.
- **Lead form** → field builder, submission → CRM, lead pixel event, seller notification.
- **VIP channel/group** → paid access, auto-grant after payment (Telegram bot / invite link), membership status.
- **Abandoned cart** → save attempts, detect abandonment, delayed recovery email via seller brand email.
- **Upsell** → add-on offers at/after checkout.
- **Discount / coupons** → codes (% or fixed, usage limit, expiry, scope by product/category); **discount links** that auto-apply (`?coupon=CODE`); auto-applies on all payment pages + checkout; usage tracked in CRM/analytics. Admin also has plan promo codes.
- **CRM** → customers, pending-payment users, all transactions, total spend, categories bought, filters/search/export.
- **Wallet + commission** → balance, recharge (via platform gateway), per-sale commission deduction (per-category), full auditable ledger, low-balance restriction, **daily wallet-cut invoice** (cron + email).
- **Buyer corner** → Google + Email OTP login, order/purchase history, total spend, purchase date, category; global identity keyed by email.
- **Admin panel** → users, buyer details, revenue dashboard (6 streams), plan/feature editor, contact limit + overage, per-category commission, premium template pricing, extra subdomain/domain pricing, plan promo codes, branding, monitoring, activity/satisfaction, maintenance mode, platform gateway, email config + automation control.
- **Platform billing** → plan catalog, checkout, activate, renewals/failures via webhooks, invoice PDF + email.
- **Pixels & analytics** → per-page Meta + Google pixel IDs in `<head>`; server + client events; per-page analytics.

---

## 9. SEO (every page SEO-friendly)
- **Per-page (seller-editable):** meta title, meta description, URL slug, Open Graph, Twitter card, canonical URL, robots (index/noindex), schema.org (Product / Course / Event).
- **Platform-level:** SSR, auto `sitemap.xml` per site, `robots.txt`, mobile-friendly + fast (Core Web Vitals), clean lowercase URLs, correct canonical on subdomain→custom-domain 301.

---

## 10. Design system & sunset theme

**Light — "Sunset" (default):** bg `#FFF9F4` · card `#FFFFFF` · primary `#FF6A3D` (hover `#F0532A`) · secondary `#FF4D7D` · accent `#7B3FE4` · highlight `#FFB23E` · text `#2B1B2E` · muted `#7A6770` · border `#F0E1D6` · brand gradient `135deg, #FFB23E → #FF6A3D → #FF4D7D → #7B3FE4`.

**Dark — "Twilight":** bg `#16101F` · surface `#221833` · primary `#FF7E55` · secondary `#FF6AA0` · accent `#A06BFF` · text `#F6EEF2` · muted `#B9A8BC`.

**Type:** headings `Sora` (or `Clash Display`); body `Inter`.
**Rules:** named CSS variables in the shared design system; gradient sparingly (hero + primary CTAs); flat warm color elsewhere; ~16px radius; generous spacing.

---

## 11. Theme & template plan
- Standards: modern, dynamic, ultra-premium; fully responsive; fast; on the shared design system; every template includes editable content + SEO fields + ad-pixel fields.
- Sets per feature: bio, one-page product, store, courses, booking, event, payment page, lead form, website; **checkout is its own template type**.
- 25+/feature is the goal — **launch with 3–5 flagship templates per core feature**; mark some **premium (paid)**, priced in admin.
- Seller editing on every page: text, media, buttons, sections (add/remove/reorder), colors; per-page SEO + pixels; draft/preview/publish.

---

## 12. Phased roadmap
- **Foundation:** Supabase schema + auth (Google+OTP) + RLS · email config + transactional (OTP) · thin admin · Caddy subdomain SSL · onboarding · design system + first sunset templates.
- **Phase 1 — Core MVP:** templates + subdomain + bio + one-page product + lead form + SEO + pixels + analytics · seller Razorpay checkout · buyer corner v1 · platform email v1 · thin admin.
- **Phase 2 — Selling depth, wallet & billing:** store · payment page · custom domains + auto-shift/redirect · wallet + per-category commission + daily invoice · coupons + discount links · more gateways · platform billing full + plan/feature editor + contact overage + domain/subdomain pricing · invoices · CRM v1.
- **Phase 3 — Services, growth, fuller admin:** courses · 1-to-1 · events · abandoned cart · upsell · premium template marketplace · admin branding/health/activity · weekly reports.
- **Phase 4 — Community + seller email:** VIP access · seller brand email + automation + marketing templates.
- **Phase 5 — Growth:** advanced analytics · A/B testing · 25+ templates · team/agency.

---

## 13. Critical rules & risks
1. Scope discipline — phase by phase, never two big modules at once.
2. Keep the two payment layers fully separate.
3. Wallet ledger exact + auditable (real money).
4. Supabase RLS correct from day one (multi-tenant isolation).
5. Encrypt gateway keys + email credentials; confirm via webhooks; never store card data.
6. Email deliverability — OTP/invoices must arrive (use a real provider at scale).
7. Page speed + SEO — SSR + CDN.

---

## 14. Using with Claude Code
- Work phase by phase; paste the relevant section as a focused task.
- **Order:** Supabase schema + auth + RLS → onboarding → email config → first sunset template + renderer → subdomain publish → Razorpay checkout + orders → buyer corner → custom domains → wallet/commission → coupons.
- Build the **shared design system before** mass-producing templates.
- Build and test one feature/template at a time. Keep a `PROGRESS.md` between sessions.
