# lcdesign Build Roadmap

Source: `lcdesign/Invoxai.zip` (42 HTML design mockups, `.dc.html`) — the full visual design plan for the platform.
Design language: **Sunset (light, default) + Twilight (dark)** theme. Build on our current architecture; match this design.

## Design System (the master spec — build FIRST)

**Tokens — Sunset (light):** bg `#fff9f4`, card `#ffffff`, surface2 `#fff3ec`, primary `#ff6a3d` (hover `#f0532a`), secondary `#ff4d7d`, accent `#7b3fe4`, gold `#ffb23e`, text `#2b1b2e`, muted `#7a6770`, border `#f0e1d6`, green `#1fb57a`/bg `#e5f7ef`, red `#e5476f`/bg `#fde9ee`.
**Tokens — Twilight (dark):** bg `#16101f`, card `#221833`, surface2 `#2a2040`, primary `#ff7e55` (hover `#ff8e69`), secondary `#ff6aa0`, accent `#a06bff`, gold `#ffc773`, text `#f6eef2`, muted `#b9a8bc`, border `#34264a`, green `#36c98e`, red `#ff6f93`.
**Gradient:** `linear-gradient(135deg,#ffb23e 0%,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4 100%)` (dark variant brightens stops).
**Type:** Sora (headings, 400–800; display 44/H1 30/H2 22/H3 17), Inter (body 15/1.55, caption 12.5).
**Spacing:** 8/16/24/40/64. **Radius:** cards 16, inputs/buttons 10, pills 999. **Shadows:** flat / card / popover (warmer in dark).
**Animations:** shine (btn shimmer), pulse, aurora (blob morph), liveproof pulse, slide/reveal.

**Components to standardize (gaps vs current):** Switch/toggle (50×28 gradient), segmented control (pill), chip-toggle, badges/pills (live/draft/paid/pend/category/off/trust), alerts (ok/error), KPI card (icon+delta), plan card (ribbon/featured), data table, countdown, seat-scarcity bar, liveproof widget, sticky buy bar, brand badge, progress steps, button shimmer, aurora blobs, reveal-on-scroll. Current dx.css/globals.css/ui.tsx are ~40% covered — tokens mostly aligned; most components missing.

## Page inventory — status vs design (gap)

### Global / auth (cluster A)
- Design System hub · Index — reference
- **Login** — split-screen brand panel + 3-step OTP — current `/login` basic → rebuild
- **Onboarding Wizard** — 5-step modal (store/subdomain-check/category grid/billing) — partial → rebuild
- **Marketing Landing** (invoxai.io) — full hero/marquee/features/pricing/testimonials/CTA/footer — NOT built
- **System Pages** 404 + Maintenance — NOT built
- **Notifications** feed — NOT built

### Seller dashboard (cluster B)
- **Seller Dashboard home** — KPIs+delta, revenue bars, category donut, recent orders — partial (Medium gap)
- **Analytics** — page selector, funnel, top pages, traffic sources, pixel events — partial (High)
- **Wallet Recharge** — quick-pick amounts, custom, auto-recharge, Razorpay — NOT built (High)
- **CRM Detail** — two-pane customer profile, order history, timeline — NOT built (Very High)
- **Team & Roles** — invite, members, role mgmt, permissions matrix — NOT built (Very High)
- **Domain Connect** — Add→DNS→Verify→Live wizard, CNAME/TXT, SSL — stub (Very High)
- **Gateway Connect** — gateway grid, test/live, test-connection — partial (High)
- **A/B Test** — variants, traffic split, results, declare winner — NOT built (Critical-new)

### Builders + public pages (cluster C)
- **Page Builder** — 6-tab panel (Content/Design/Sections/Themes/SEO/Pixels) + live preview — NOT built
- **Website Builder / WebsiteView** — section toggles — partial
- **Block Canvas** — palette/canvas/inspector, 8 block types — NOT built
- **Bio Page** — builder design refinements — live
- **Store Page** — banner/announcement/marquee/cart drawer — partial
- **Product Page** — urgency countdown, seats bar, social proof, checkout card — partial
- **Landing Page** — hero/benefits/outcomes/offer/sticky CTA — NOT built
- **Courses Page** (landing + player) + **Curriculum Builder** — NOT built
- **Booking Public** — calendar + slots + confirm — NOT built
- **Event Ticket** — ticket card + QR — NOT built
- **VIP Channel** — locked preview + join flow — NOT built
- **Pitch Deck** — 10-slide framework — NOT built

### Commerce / buyer / admin / templates (cluster D)
- **Checkout** (single) — partial; **Multi-Step Checkout** — NOT built
- **Coupon Builder** — NOT built (High)
- **Cart Email Composer** (abandoned-cart) — NOT built (High)
- **Buyer Corner** (buyer dashboard) — NOT built (Critical, needs buyer auth)
- **Buyer Order Detail** — NOT built (Critical)
- **Reviews** (mgmt + replies) — NOT built (High)
- **Email Templates** (6 transactional) — NOT built (High)
- **Template Gallery** (public) / **Template Marketplace** (seller) / **Public Templates** (booking/event/lead/payment) — NOT built
- **Admin Panel** — partial; many sections (commission/promo/gateways/email/health/maintenance) incomplete
- **Mobile App** — design concept, OUT OF SCOPE for web
- **Legal Pages** — NOT built (Low, mostly static)

## Build order (CEO plan)
1. **Foundation** — Design System: align tokens exactly + add all missing shared components to globals.css/dx.css/ui.tsx. (Everything depends on this.)
2. **Auth & entry** — Login, Onboarding, System pages, Notifications, theme toggle.
3. **Seller dashboard suite** — home/analytics/wallet/CRM/team/domain/gateway/AB.
4. **Builders & public pages** — Block Canvas → Page Builder → Landing/Courses/Booking/Event/VIP/Pitch.
5. **Commerce & buyer** — multi-step checkout, coupons, cart email, buyer auth+corner+order, reviews.
6. **Templates & admin & legal** — gallery/marketplace/public templates, admin sections, legal, email templates.

Each page must keep the builder-page rules (themed, live preview, real features, analytics, suggest-more) where applicable, and the deploy rule (build + restart) before "done".
