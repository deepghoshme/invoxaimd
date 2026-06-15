# Full Plan — Complete Checklist

Track items as you build. Pairs with `FINAL-master-prompt.md`. (✓ = scaffolded in DB schema)

## A. Tech stack
- [ ] Supabase — Postgres DB, Auth (Google + Email OTP), Storage, RLS, Edge Functions, cron
- [ ] Next.js app on Hostinger KVM2 VPS
- [ ] Caddy reverse proxy — auto SSL for wildcard subdomains + custom domains
- [ ] SSR + CDN for page speed
- [ ] Platform gateways: Razorpay + Cashfree
- [ ] Seller gateways: Razorpay, Cashfree, Stripe, PayU, PhonePe
- [ ] Transactional email service (e.g. SES) + seller brand email

## B. Architecture (lock in first)
- [ ] 3 surfaces: Seller dashboard, Buyer corner, Admin panel (one account system)
- [ ] 2 payment layers: platform billing vs seller payments (fully separate in code)
- [ ] 2 email layers: platform transactional vs seller marketing
- [✓] Supabase RLS isolating all three surfaces

## C. Auth & onboarding
- [ ] Google login · [ ] Email OTP login
- [ ] Onboarding: OTP verify → store name → subdomain (live check) → category (sets commission) → billing
- [ ] Resume onboarding if incomplete; block dashboard until done
- [✓] Roles (admin/seller/buyer), reserved subdomains, subdomain availability fn, onboarding state columns

## D. Domains & subdomains
- [ ] Subdomain hosting — wildcard routing
- [ ] 1 subdomain included; extra subdomains paid (admin price)
- [ ] Custom domain connect (CNAME + verify + Caddy SSL)
- [ ] 1 custom domain included; extra domains paid
- [ ] On connect: pages auto-shift, dashboard URLs update, subdomain 301s to custom domain
- [✓] stores: subdomain, custom_domain, custom_domain_verified, primary_domain

## E. Seller — page building & blocks
- [ ] Template renderer + page builder · single + multi-page website
- [ ] Bio · One-page product · Digital store · Courses · 1-to-1 booking · Event booking
- [ ] Payment page · Lead form · VIP channel · Checkout (own template type)
- [✓] pages table w/ all page types, content/seo/pixels JSONB, draft/publish

## F. Seller — growth & data tools
- [ ] Abandoned cart · Upsell · Coupons (%/fixed, limits, expiry, scope) · Discount links (`?coupon=`)
- [ ] Coupon auto-apply across payment pages + checkout · usage in CRM/analytics
- [ ] Per-page SEO (meta, slug, OG/Twitter, canonical, index/noindex, schema.org)
- [ ] Platform SEO: sitemap.xml, robots.txt, SSR, mobile-fast, lowercase URLs
- [ ] CRM (customers, pending-payment, transactions, spend, categories, export)
- [ ] Analytics dashboard · Meta + Google pixels on every page · content editing on all pages

## G. Seller — payments & wallet
- [ ] Connect own gateway · platform checkout uses seller keys + records orders
- [ ] Prepaid wallet (balance + recharge) · per-sale commission (per-category)
- [ ] Auditable ledger · low-balance restriction · daily wallet-cut invoice (cron + email)

## H. Seller — email marketing
- [ ] Email config: Custom SMTP OR Gmail App Password · send-test · encrypted
- [ ] Brand email · marketing templates · automation · abandoned-cart emails

## I. Buyer corner
- [ ] Google + Email OTP login · purchase/order history · total spend · date · category
- [✓] Global identity keyed by email (profiles, 1:1 auth.users)

## J. Admin panel
- [ ] Users + new-joined trend · buyer details · revenue dashboard (6 streams)
- [ ] Plan & feature editor · contact limit + overage · per-category commission
- [ ] Premium template pricing · plan promo codes · extra subdomain/domain pricing
- [ ] Branding (logo/favicon/invoice) · monitoring · activity · maintenance mode
- [ ] Platform gateway (Razorpay+Cashfree) · email config + automation control
- [✓] Admin role + RLS; categories + commission rates editable; reserved names

## K. Platform emails (transactional)
- [ ] OTP · Verification · Welcome · Payment confirmation · Invoice · Daily wallet invoice · Weekly report

## L. Revenue model (6 streams)
- [ ] Subscriptions · [✓] per-sale commission (per-category) · [ ] contact overage
- [ ] Premium templates · [ ] extra subdomains · [ ] extra custom domains

## M. Themes & templates
- [ ] Shared design system (tokens + components) — build first
- [ ] Responsive, fast, ultra-premium · template sets per feature · checkout template
- [ ] Ad-pixel fields on all templates · launch 3–5 flagship/feature · grow to 25+ · premium pricing

## N. Critical rules & risks
- [ ] Scope discipline · [ ] payment layers separate · [ ] auditable wallet ledger
- [✓] RLS correct from start · [ ] encrypt keys + webhooks, no card storage · [ ] email deliverability · [ ] SSR+CDN speed

## O. Build order (phases)
- [ ] Foundation → Phase 1 (Core MVP) → Phase 2 (Selling depth/wallet/billing)
      → Phase 3 (Services/admin) → Phase 4 (Community/seller email) → Phase 5 (Growth)
