"use client";

import { useState, useEffect, useRef } from "react";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = localStorage.getItem("invox-theme") as "light" | "dark" | null;
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    setTheme(stored ?? prefers);
  }, []);
  const toggle = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("invox-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return { theme, toggle };
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add("revealed"), delay);
          io.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    const t = setTimeout(() => el.classList.add("revealed"), 1400 + delay);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, [delay]);
  return (
    <div ref={ref} className="mk-reveal">
      {children}
    </div>
  );
}

function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [fired, setFired] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setFired(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!fired) return;
    ref.current
      ?.querySelectorAll<HTMLElement>("[data-count]")
      .forEach((el) => {
        const target = parseInt(el.dataset.count ?? "0", 10);
        const suffix = el.dataset.suffix ?? "";
        let cur = 0;
        const step = Math.max(1, Math.round(target / 30));
        const tick = () => {
          cur = Math.min(cur + step, target);
          el.textContent = cur + suffix;
          if (cur < target) requestAnimationFrame(tick);
        };
        tick();
      });
    ref.current
      ?.querySelectorAll<HTMLElement>("[data-suffix]:not([data-count])")
      .forEach((el) => {
        const base = el.textContent?.trim() ?? "";
        el.textContent = base + " " + (el.dataset.suffix ?? "");
      });
  }, [fired]);

  return (
    <section className="mk-sec" ref={ref}>
      <div className="mk-wrap">
        <div className="mk-stats">
          <div className="mk-stat">
            <div className="mk-stat-n grad-text" data-count="10">10</div>
            <div className="mk-stat-l">Page types to sell with</div>
          </div>
          <div className="mk-stat">
            <div className="mk-stat-n grad-text" data-count="6">6</div>
            <div className="mk-stat-l">Revenue streams, one wallet</div>
          </div>
          <div className="mk-stat">
            <div className="mk-stat-n grad-text" data-count="5">5</div>
            <div className="mk-stat-l">Payment gateways supported</div>
          </div>
          <div className="mk-stat">
            <div className="mk-stat-n grad-text" data-suffix="min">2</div>
            <div className="mk-stat-l">From signup to live page</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── static data ─────────────────────────────────────────────────────────── */
const PAGE_TYPES = [
  { ico: "🔗", label: "Link-in-bio",      path: "/bio" },
  { ico: "🛍️", label: "Digital store",    path: "/store" },
  { ico: "📦", label: "One-page product", path: "/opp/{id}" },
  { ico: "🎓", label: "Courses",          path: "/courses" },
  { ico: "📅", label: "1-to-1 booking",  path: "/book/{id}" },
  { ico: "🎟️", label: "Event booking",   path: "/env/{id}" },
  { ico: "💳", label: "Payment page",     path: "/pay/{id}" },
  { ico: "📝", label: "Lead form",        path: "/ldf/{id}" },
  { ico: "⭐", label: "VIP channel",      path: "/vpc/{id}" },
  { ico: "🚀", label: "Landing page",     path: "/led/{id}" },
];

const TESTIMONIALS = [
  {
    quote:
      "I moved off three different tools. Store, course and checkout now live on one domain — and Razorpay payouts hit my account the same day.",
    name: "Aanya Sharma",
    handle: "Studio Aanya · D2C",
    initial: "A",
  },
  {
    quote:
      "The no-code Meta pixel alone paid for the plan. I run ads straight to a landing page and watch Purchase events fire live.",
    name: "Dev Mehta",
    handle: "FitWithDev · Coaching",
    initial: "D",
  },
  {
    quote:
      "Set up my link-in-bio in ten minutes, then added a paid community. The wallet commission is tiny compared to what I keep.",
    name: "Nisha Rao",
    handle: "NoteCraft · Creator",
    initial: "N",
  },
];

const FEAT1 = [
  { ic: "🔌", title: "Connect your own gateway", desc: "Razorpay, Cashfree, Stripe, PayU or PhonePe — payouts land in your account, not ours." },
  { ic: "👛", title: "Prepaid commission wallet", desc: "A small per-category commission is deducted from your wallet on each sale — fully auditable ledger, daily invoice." },
  { ic: "🧾", title: "Every order recorded", desc: "Orders, customers and total spend flow straight into your CRM and analytics." },
];

const FEAT2 = [
  { ic: "🎯", title: "No-code ad pixels", desc: "Drop in Meta & Google pixel IDs per page. View, click and Purchase events fire automatically — including on checkout." },
  { ic: "🔍", title: "SEO on every page", desc: "Meta title, description, slug, Open Graph, Twitter cards, canonical, robots and schema.org — all seller-editable." },
  { ic: "⚡", title: "SSR + CDN fast", desc: "Server-rendered for Core Web Vitals and clean, lowercase URLs that convert ad clicks." },
];

/* ── component ───────────────────────────────────────────────────────────── */
export default function MarketingLanding() {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [subVal, setSubVal] = useState("");

  return (
    <>
      <style>{MK_CSS}</style>

      {/* NAV */}
      <nav className="mk-nav">
        <div className="mk-wrap mk-nav-in">
          <a href="/" className="mk-brand">
            <span className="mk-logo" aria-hidden="true" />
            invoxai
          </a>
          <div className="mk-links">
            <a href="#surfaces">Platform</a>
            <a href="#types">Page types</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="mk-nav-r">
            <button
              className="mk-tgl"
              onClick={toggle}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <a href="/login" className="mk-btn mk-btn-ghost">
              Log in
            </a>
            <a href="/onboarding" className="mk-btn mk-btn-grad">
              Start free
              <span className="mk-shine" aria-hidden="true" />
            </a>
            <button
              className="mk-burger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE MENU */}
      <div
        className={`mk-mmenu${menuOpen ? " open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <a href="#surfaces" onClick={() => setMenuOpen(false)}>Platform</a>
        <a href="#types" onClick={() => setMenuOpen(false)}>Page types</a>
        <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
        <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
        <a href="/login" onClick={() => setMenuOpen(false)}>Log in</a>
      </div>

      {/* HERO */}
      <header className="mk-hero">
        <div className="mk-aurora" aria-hidden="true">
          <div className="mk-blob b1" />
          <div className="mk-blob b2" />
          <div className="mk-blob b3" />
        </div>
        <div className="mk-wrap mk-hero-in">
          <div>
            <span className="mk-eyebrow">
              <span className="mk-pin">India-first</span>
              All-in-one creator &amp; commerce platform
            </span>
            <h1 className="mk-h1">
              Sell anything.<br />
              On{" "}
              <span className="mk-grad-txt">your own domain.</span>
              <br />
              Keep more of every sale.
            </h1>
            <p className="mk-sub">
              Build stores, courses, bookings, paid communities and link-in-bio
              pages — host them on your subdomain or custom domain, add Meta &amp;
              Google pixels with no code, and connect your own payment gateway.
              SEO-ready and ad-ready from day one.
            </p>
            <div className="mk-cta-row">
              <a href="/onboarding" className="mk-btn mk-btn-grad mk-btn-lg">
                Start free — no card
                <span className="mk-shine" aria-hidden="true" />
              </a>
              <a href="#features" className="mk-btn mk-btn-ghost mk-btn-lg">
                ▷ See it in action
              </a>
            </div>
            <div className="mk-claim">
              <span>
                <span className="mk-tick">✓</span> Free subdomain included
              </span>
              <span>
                <span className="mk-tick">✓</span> Your gateway, your money
              </span>
              <span>
                <span className="mk-tick">✓</span> No-code ad pixels
              </span>
            </div>
          </div>

          {/* browser mockup */}
          <div className="mk-stage" aria-hidden="true">
            <div className="mk-browser">
              <div className="mk-bbar">
                <span className="mk-dot3" style={{ background: "#ff5f57" }} />
                <span className="mk-dot3" style={{ background: "#febc2e" }} />
                <span className="mk-dot3" style={{ background: "#28c840" }} />
                <span className="mk-url">aanya.invoxai.io/store</span>
              </div>
              <div className="mk-store">
                <div className="mk-store-hero" />
                <div className="mk-store-row">
                  {([499, 1299, 899] as const).map((p) => (
                    <div className="mk-pcard" key={p}>
                      <div className="mk-pcard-im" />
                      <div className="mk-pcard-tx">
                        <div
                          className="mk-pcard-l"
                          style={{ width: "75%" }}
                        />
                        <div className="mk-pcard-p">₹{p}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mk-fcard mk-fc1">
              <div className="mk-fc-row">
                <span
                  className="mk-fc-ic"
                  style={{ background: "var(--color-green)" }}
                >
                  ₹
                </span>
                <div className="mk-fc-t">
                  <b>Payment received</b>
                  <span>₹1,499 · Razorpay</span>
                </div>
              </div>
            </div>
            <div className="mk-fcard mk-fc2">
              <div className="mk-fc-t">
                <b style={{ display: "block", marginBottom: 2 }}>This week</b>
                <span>Visitors · Sales</span>
              </div>
              <div className="mk-spark">
                {[40, 62, 48, 78, 58, 92, 70].map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="mk-fcard mk-fc3">
              <div className="mk-fc-row">
                <span
                  className="mk-fc-ic"
                  style={{ background: "var(--color-accent)" }}
                >
                  ◎
                </span>
                <div className="mk-fc-t">
                  <b>Page published</b>
                  <span>SEO + pixels live</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* TRUST MARQUEE */}
      <section className="mk-trust" aria-label="Trusted by">
        <div className="mk-wrap">
          <div className="mk-trust-lbl">
            Trusted by independent sellers, coaches &amp; D2C brands
          </div>
        </div>
        <div className="mk-marq">
          <div className="mk-marq-tr" aria-hidden="true">
            {[...Array(2)].flatMap((_, pass) =>
              [
                "Studio Aanya",
                "FitWithDev",
                "NoteCraft",
                "The Spice Co.",
                "Lumen Courses",
                "Mehta Audio",
                "Bloom & Co",
                "CodeKaro",
              ].map((brand) => <b key={`${pass}-${brand}`}>{brand}</b>)
            )}
          </div>
        </div>
      </section>

      {/* SURFACES */}
      <section className="mk-sec" id="surfaces">
        <div className="mk-wrap">
          <Reveal>
            <div className="mk-sec-head">
              <div className="mk-kick">One account, three surfaces</div>
              <h2>Run the whole business in one place</h2>
              <p>
                Sellers build and grow. Buyers track every order. You stay in
                control. Each surface is isolated, fast, and server-rendered.
              </p>
            </div>
          </Reveal>
          <div className="mk-3">
            {[
              {
                ic: "◳",
                bg: "var(--brand-gradient)",
                title: "Seller dashboard",
                desc: "Page builders, products, wallet, CRM, analytics, gateways and email — everything to launch and scale.",
                url: "app.invoxai.io",
              },
              {
                ic: "◷",
                bg: "var(--color-accent)",
                title: "Buyer corner",
                desc: "One identity across every store. Buyers see purchase history, totals and downloads — login with Google or OTP.",
                url: "orders & downloads",
              },
              {
                ic: "⚙",
                bg: "var(--color-secondary)",
                title: "Admin control",
                desc: "Plans, per-category commission, branding, the 6 revenue streams, health monitoring and platform email.",
                url: "admin.invoxai.io",
              },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="mk-surface">
                  <div className="mk-sic" style={{ background: s.bg }}>
                    {s.ic}
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                  <div className="mk-surf-url">{s.url}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PAGE TYPES */}
      <section className="mk-sec mk-sec-alt" id="types">
        <div className="mk-wrap">
          <Reveal>
            <div className="mk-sec-head">
              <div className="mk-kick">Ten ways to sell</div>
              <h2>A page type for every offer</h2>
              <p>
                Launch flagship templates today, mix and match across your site,
                and add custom-slug links you can run ads straight to.
              </p>
            </div>
          </Reveal>
          <div className="mk-types">
            {PAGE_TYPES.map((t, i) => (
              <Reveal key={i} delay={i * 40}>
                <div className="mk-type">
                  <div className="mk-type-ico">{t.ico}</div>
                  <b>{t.label}</b>
                  <div className="mk-type-pth">{t.path}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE 1 */}
      <section className="mk-sec" id="features">
        <div className="mk-wrap">
          <div className="mk-feat">
            <Reveal>
              <div>
                <div className="mk-kick">Your money, your gateway</div>
                <h2 className="mk-feat-h2">
                  Buyers pay you directly. We only take a small cut.
                </h2>
                <div className="mk-feat-list">
                  {FEAT1.map((f, i) => (
                    <div className="mk-feat-li" key={i}>
                      <span className="mk-feat-fi">{f.ic}</span>
                      <div>
                        <b>{f.title}</b>
                        <p>{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="mk-panel">
                <div className="mk-wallet-top">
                  <div>
                    <div className="mk-wallet-sub">Commission wallet</div>
                    <div className="mk-wallet-bal">₹6,420.00</div>
                  </div>
                  <span className="mk-btn mk-btn-grad mk-btn-sm">
                    Recharge
                    <span className="mk-shine" aria-hidden="true" />
                  </span>
                </div>
                <div className="mk-ledger">
                  {[
                    {
                      dir: "↓",
                      bgv: "var(--color-greenbg)",
                      clr: "var(--color-green)",
                      title: "Sale · Mixing Masterclass",
                      sub: "Courses · 6% commission",
                      amt: "−₹90",
                      amtClr: "var(--color-green)",
                    },
                    {
                      dir: "↓",
                      bgv: "var(--color-greenbg)",
                      clr: "var(--color-green)",
                      title: "Sale · Notion Pack",
                      sub: "Digital · 4% commission",
                      amt: "−₹16",
                      amtClr: "var(--color-green)",
                    },
                    {
                      dir: "↑",
                      bgv:
                        "color-mix(in srgb,var(--color-primary) 16%,transparent)",
                      clr: "var(--color-primary)",
                      title: "Wallet recharge",
                      sub: "Razorpay · today",
                      amt: "+₹2,000",
                      amtClr: "var(--color-text)",
                    },
                  ].map((r, i) => (
                    <div className="mk-led-row" key={i}>
                      <span
                        className="mk-led-ic"
                        style={{ background: r.bgv, color: r.clr }}
                      >
                        {r.dir}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                        <div
                          style={{
                            color: "var(--color-muted)",
                            fontSize: 12,
                          }}
                        >
                          {r.sub}
                        </div>
                      </div>
                      <span
                        className="mk-led-am"
                        style={{ color: r.amtClr }}
                      >
                        {r.amt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FEATURE 2 */}
      <section className="mk-sec mk-sec-alt">
        <div className="mk-wrap">
          <div className="mk-feat mk-feat-rev">
            <Reveal>
              <div>
                <div className="mk-kick">Built for paid &amp; organic traffic</div>
                <h2 className="mk-feat-h2">
                  Run ads on day one. Rank on Google by month two.
                </h2>
                <div className="mk-feat-list">
                  {FEAT2.map((f, i) => (
                    <div className="mk-feat-li" key={i}>
                      <span className="mk-feat-fi">{f.ic}</span>
                      <div>
                        <b>{f.title}</b>
                        <p>{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="mk-panel">
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--color-muted)",
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  Live on this page
                </div>
                <div className="mk-chips">
                  {[
                    "Meta Pixel",
                    "Google Ads",
                    "Purchase event",
                    "OG image",
                    "schema.org Product",
                    "Canonical",
                    "sitemap.xml",
                  ].map((c) => (
                    <span className="mk-chip" key={c}>
                      <span className="mk-chip-d">●</span>
                      {c}
                    </span>
                  ))}
                </div>
                <div className="mk-google-preview">
                  <div className="mk-gp-bar">Google preview</div>
                  <div className="mk-gp-body">
                    <div className="mk-gp-url">
                      aanya.invoxai.io › store › mixing-masterclass
                    </div>
                    <div className="mk-gp-title">
                      Mixing Masterclass — Learn to Mix Like a Pro
                    </div>
                    <div className="mk-gp-desc">
                      Master EQ, compression and space in 12 lessons. Lifetime
                      access, instant download…
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STATS */}
      <StatsSection />

      {/* PRICING */}
      <section className="mk-sec mk-sec-alt" id="pricing">
        <div className="mk-wrap">
          <Reveal>
            <div className="mk-sec-head">
              <div className="mk-kick">Simple pricing</div>
              <h2>Start free. Pay less as you grow.</h2>
              <p>
                Lower commission on higher tiers. One subdomain and one custom
                domain included on every paid plan.
              </p>
            </div>
          </Reveal>
          <div className="mk-plans">
            <Reveal delay={0}>
              <div className="mk-plan">
                <div className="mk-plan-name">Starter</div>
                <div className="mk-plan-price">Free</div>
                <div className="mk-plan-desc">
                  Everything to launch your first page.
                </div>
                <ul>
                  <li>1 free subdomain</li>
                  <li>Bio + one-page product</li>
                  <li>Lead forms &amp; pixels</li>
                  <li>6% commission per sale</li>
                </ul>
                <a
                  href="/onboarding"
                  className="mk-btn mk-btn-ghost mk-btn-block"
                >
                  Get started
                </a>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="mk-plan mk-plan-feat">
                <span className="mk-plan-rib">Most popular</span>
                <div className="mk-plan-name">Growth</div>
                <div className="mk-plan-price">
                  ₹899<small> /mo</small>
                </div>
                <div className="mk-plan-desc">
                  For sellers running ads &amp; scaling.
                </div>
                <ul>
                  <li>Custom domain included</li>
                  <li>Store, courses &amp; events</li>
                  <li>Abandoned-cart recovery</li>
                  <li>Coupons &amp; discount links</li>
                  <li>3% commission per sale</li>
                </ul>
                <a
                  href="/onboarding"
                  className="mk-btn mk-btn-grad mk-btn-block"
                >
                  Start 14-day trial
                  <span className="mk-shine" aria-hidden="true" />
                </a>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <div className="mk-plan">
                <div className="mk-plan-name">Scale</div>
                <div className="mk-plan-price">
                  ₹2,499<small> /mo</small>
                </div>
                <div className="mk-plan-desc">For brands &amp; agencies.</div>
                <ul>
                  <li>5 custom domains</li>
                  <li>Premium templates</li>
                  <li>Seller brand email + automation</li>
                  <li>Priority support</li>
                  <li>1.5% commission per sale</li>
                </ul>
                <a
                  href="/onboarding"
                  className="mk-btn mk-btn-ghost mk-btn-block"
                >
                  Choose Scale
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <Reveal>
            <div className="mk-sec-head">
              <div className="mk-kick">Loved by sellers</div>
              <h2>From first sale to full-time</h2>
            </div>
          </Reveal>
          <div className="mk-tgrid">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="mk-quote">
                  <div className="mk-stars">★★★★★</div>
                  <p>&ldquo;{t.quote}&rdquo;</p>
                  <div className="mk-who">
                    <span className="mk-av">{t.initial}</span>
                    <div>
                      <b>{t.name}</b>
                      <span>{t.handle}</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="mk-sec" style={{ paddingTop: 20 }}>
        <div className="mk-wrap">
          <Reveal>
            <div className="mk-ctaband">
              <h2>Claim your subdomain in seconds</h2>
              <p>Your store could be live before this page finishes loading.</p>
              <div className="mk-cb-input">
                <input
                  value={subVal}
                  onChange={(e) =>
                    setSubVal(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    )
                  }
                  placeholder="yourname"
                  aria-label="Subdomain name"
                />
                <span className="mk-cb-sfx">.invoxai.io</span>
                <a
                  href={
                    subVal
                      ? `/onboarding?sub=${encodeURIComponent(subVal)}`
                      : "/onboarding"
                  }
                  className="mk-cb-go"
                >
                  Claim it →
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mk-foot">
        <div className="mk-wrap">
          <div className="mk-foot-top">
            <div className="mk-foot-col">
              <a href="/" className="mk-brand" style={{ fontSize: 18 }}>
                <span className="mk-logo" aria-hidden="true" />
                invoxai
              </a>
              <p className="mk-foot-desc">
                The all-in-one platform to sell on your own domain — India-first,
                built for the world.
              </p>
            </div>
            <div className="mk-foot-col">
              <h5>Product</h5>
              <a href="#surfaces">Page builders</a>
              <a href="#surfaces">Templates</a>
              <a href="#features">Wallet &amp; payments</a>
              <a href="#surfaces">Analytics</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="mk-foot-col">
              <h5>Sell with</h5>
              <a href="#types">Digital store</a>
              <a href="#types">Courses</a>
              <a href="#types">Bookings &amp; events</a>
              <a href="#types">Paid communities</a>
              <a href="#types">Lead forms</a>
            </div>
            <div className="mk-foot-col">
              <h5>Company</h5>
              <span className="mk-foot-nolink">About</span>
              <span className="mk-foot-nolink">Help center</span>
              <span className="mk-foot-nolink">Status</span>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/refund">Refund policy</a>
            </div>
          </div>
          <div className="mk-foot-bot">
            <span>© 2026 invoxai.io · Made in India 🇮🇳</span>
            <span>SSR + CDN · Supabase · Hosted on a VPS with auto-SSL</span>
          </div>
        </div>
      </footer>
    </>
  );
}

/* ── scoped CSS ──────────────────────────────────────────────────────────── */
const MK_CSS = `
@keyframes mk-aurora1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(7vw,5vh) scale(1.18)}}
@keyframes mk-aurora2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-6vw,6vh) scale(1.12)}}
@keyframes mk-aurora3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(5vw,-5vh) scale(1.2)}}
@keyframes mk-float{0%,100%{transform:translateY(0) rotate(var(--rot,0deg))}50%{transform:translateY(-14px) rotate(var(--rot,0deg))}}
@keyframes mk-shine{0%{left:-60%}55%,100%{left:130%}}
@keyframes mk-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes mk-bargrow{from{height:8%}}

.mk-reveal{opacity:0;transform:translateY(22px);transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1)}
.mk-reveal.revealed{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.mk-reveal{opacity:1;transform:none;transition:none}}

.mk-wrap{max-width:1200px;margin:0 auto;padding:0 28px}

.mk-nav{position:sticky;top:0;z-index:60;backdrop-filter:blur(14px);background:color-mix(in srgb,var(--color-bg) 78%,transparent);border-bottom:1px solid color-mix(in srgb,var(--color-border) 70%,transparent)}
.mk-nav-in{display:flex;align-items:center;gap:14px;height:68px}
.mk-brand{display:flex;align-items:center;gap:10px;font-family:var(--font-heading);font-weight:800;font-size:20px;letter-spacing:-.03em;color:var(--color-text);text-decoration:none}
.mk-logo{width:30px;height:30px;border-radius:9px;background:var(--brand-gradient);box-shadow:0 6px 16px -6px rgba(255,77,125,.6);flex:none;display:inline-block}
.mk-links{display:flex;gap:4px;margin-left:22px}
.mk-links a{padding:8px 13px;border-radius:9px;font-size:14px;font-weight:500;color:var(--color-muted);transition:color .15s,background .15s;text-decoration:none}
.mk-links a:hover{color:var(--color-text);background:var(--color-surface2)}
.mk-nav-r{margin-left:auto;display:flex;align-items:center;gap:10px}
.mk-tgl{width:38px;height:38px;border-radius:999px;border:1px solid var(--color-border);background:var(--color-card);color:var(--color-text);cursor:pointer;font-size:15px;display:grid;place-items:center}
.mk-tgl:hover{border-color:var(--color-muted)}
.mk-burger{display:none;width:40px;height:40px;border-radius:10px;border:1px solid var(--color-border);background:var(--color-card);color:var(--color-text);cursor:pointer;font-size:17px;align-items:center;justify-content:center}

.mk-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 18px;font-family:var(--font-heading);font-weight:600;font-size:14px;border-radius:10px;border:1.5px solid transparent;cursor:pointer;transition:filter .15s,background .15s,border-color .15s,transform .12s;text-decoration:none;white-space:nowrap;position:relative;overflow:hidden}
.mk-btn:active{transform:translateY(1px)}
.mk-btn-ghost{background:transparent;border-color:var(--color-border);color:var(--color-text)}
.mk-btn-ghost:hover{border-color:var(--color-muted);color:var(--color-text)}
.mk-btn-grad{background:var(--brand-gradient);color:#fff;box-shadow:0 10px 26px -10px rgba(255,77,125,.6)}
.mk-btn-grad:hover{filter:brightness(1.05);color:#fff}
.mk-btn-lg{padding:14px 24px;font-size:15.5px}
.mk-btn-sm{padding:9px 15px;font-size:13px}
.mk-btn-block{width:100%}
.mk-shine{position:absolute;top:0;left:-60%;width:34%;height:100%;transform:skewX(-18deg);background:#fff;opacity:.45;filter:blur(3px);animation:mk-shine 3.4s ease-in-out infinite;pointer-events:none}

.mk-hero{position:relative;overflow:hidden;padding:70px 0 90px}
.mk-aurora{position:absolute;inset:-10% -5% 0;z-index:0;pointer-events:none}
.mk-blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.5}
.mk-blob.b1{width:42vmax;height:42vmax;background:var(--color-highlight);top:-16vmax;left:-8vmax;animation:mk-aurora1 26s ease-in-out infinite}
.mk-blob.b2{width:38vmax;height:38vmax;background:var(--color-secondary);top:-10vmax;right:-10vmax;animation:mk-aurora2 30s ease-in-out infinite}
.mk-blob.b3{width:40vmax;height:40vmax;background:var(--color-accent);bottom:-22vmax;left:18vmax;opacity:.38;animation:mk-aurora3 24s ease-in-out infinite}
.mk-hero-in{position:relative;z-index:1;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
.mk-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 8px;border-radius:999px;background:var(--color-card);border:1px solid var(--color-border);font-size:12.5px;font-weight:600;color:var(--color-muted);box-shadow:var(--shadow)}
.mk-pin{font-size:10px;font-weight:800;color:#fff;background:var(--brand-gradient);padding:3px 8px;border-radius:999px;letter-spacing:.03em;white-space:nowrap}
.mk-h1{font-size:clamp(38px,5.2vw,62px);font-weight:800;font-family:var(--font-heading);margin:22px 0 0;line-height:1.08;letter-spacing:-.03em}
.mk-grad-txt{background:linear-gradient(115deg,var(--color-primary),var(--color-secondary) 50%,var(--color-accent));-webkit-background-clip:text;background-clip:text;color:transparent}
.mk-sub{font-size:18px;color:var(--color-muted);margin-top:20px;max-width:30em}
.mk-cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px;align-items:center}
.mk-claim{display:flex;flex-wrap:wrap;gap:18px;margin-top:26px;font-size:13.5px;color:var(--color-muted)}
.mk-claim span{display:inline-flex;align-items:center;gap:7px}
.mk-tick{color:var(--color-green);font-weight:800}

.mk-stage{position:relative;height:460px}
.mk-browser{position:absolute;inset:18px 0 18px 24px;border-radius:18px;background:var(--color-card);border:1px solid var(--color-border);box-shadow:0 40px 90px -40px rgba(43,27,46,.45);overflow:hidden}
.mk-bbar{display:flex;align-items:center;gap:7px;padding:11px 14px;border-bottom:1px solid var(--color-border)}
.mk-dot3{width:10px;height:10px;border-radius:50%;display:inline-block}
.mk-url{margin-left:10px;flex:1;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--color-muted);background:var(--color-surface2);padding:5px 11px;border-radius:999px}
.mk-store{padding:16px}
.mk-store-hero{height:92px;border-radius:12px;background:var(--brand-gradient)}
.mk-store-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:13px}
.mk-pcard{border:1px solid var(--color-border);border-radius:11px;overflow:hidden}
.mk-pcard-im{height:56px;background:var(--color-surface2)}
.mk-pcard-tx{padding:8px 9px}
.mk-pcard-l{height:7px;border-radius:4px;background:var(--color-border)}
.mk-pcard-p{margin-top:7px;font-size:11px;font-weight:800;color:var(--color-primary);font-family:var(--font-heading)}

.mk-fcard{position:absolute;background:var(--color-card);border:1px solid var(--color-border);border-radius:15px;box-shadow:0 20px 50px -20px rgba(43,27,46,.45);padding:13px 15px}
.mk-fc1{top:6px;right:-6px;--rot:2deg;animation:mk-float 6.5s ease-in-out infinite}
.mk-fc2{bottom:22px;left:-16px;--rot:-3deg;animation:mk-float 7.8s ease-in-out infinite .6s}
.mk-fc3{bottom:-10px;right:26px;--rot:2deg;animation:mk-float 7.1s ease-in-out infinite .3s}
.mk-fc-row{display:flex;align-items:center;gap:10px}
.mk-fc-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-size:16px;flex:none}
.mk-fc-t b{font-size:13.5px;font-family:var(--font-heading);display:block}
.mk-fc-t span{font-size:11.5px;color:var(--color-muted)}
.mk-spark{display:flex;align-items:flex-end;gap:4px;height:38px;margin-top:4px}
.mk-spark i{width:7px;border-radius:3px;background:var(--brand-gradient);animation:mk-bargrow 1s ease both;display:block}

.mk-trust{padding:30px 0 8px}
.mk-trust-lbl{text-align:center;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted);margin-bottom:18px}
.mk-marq{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.mk-marq-tr{display:flex;gap:56px;width:max-content;animation:mk-marquee 28s linear infinite}
.mk-marq-tr b{font-family:var(--font-heading);font-weight:700;font-size:21px;color:var(--color-muted);opacity:.65;white-space:nowrap}

.mk-sec{padding:84px 0}
.mk-sec-alt{background:var(--color-surface2)}
.mk-sec-head{text-align:center;max-width:660px;margin:0 auto 50px}
.mk-kick{font-size:12.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--color-primary);margin-bottom:12px}
.mk-sec-head h2{font-size:clamp(28px,3.6vw,42px);font-weight:800;font-family:var(--font-heading)}
.mk-sec-head p{color:var(--color-muted);font-size:17px;margin-top:14px}

.mk-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.mk-surface{background:var(--color-card);border:1px solid var(--color-border);border-radius:18px;padding:24px;box-shadow:var(--shadow);transition:transform .25s,box-shadow .25s;height:100%;box-sizing:border-box}
.mk-surface:hover{transform:translateY(-6px);box-shadow:var(--shadow-pop)}
.mk-sic{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;color:#fff;font-size:20px;margin-bottom:16px}
.mk-surface h3{font-size:19px;font-family:var(--font-heading);margin:0}
.mk-surface p{color:var(--color-muted);font-size:14px;margin-top:8px}
.mk-surf-url{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--color-primary);margin-top:12px}

.mk-types{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.mk-type{background:var(--color-card);border:1px solid var(--color-border);border-radius:15px;padding:18px 16px;transition:transform .2s,border-color .2s;height:100%;box-sizing:border-box}
.mk-type:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--color-primary) 45%,var(--color-border))}
.mk-type-ico{font-size:22px}
.mk-type b{display:block;font-family:var(--font-heading);font-size:14.5px;margin-top:11px}
.mk-type-pth{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--color-muted);margin-top:4px}

.mk-feat{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:center}
.mk-feat-rev{direction:rtl}
.mk-feat-rev>*{direction:ltr}
.mk-feat-h2{font-size:clamp(26px,3.4vw,38px);font-weight:800;margin-top:14px;font-family:var(--font-heading);line-height:1.1;letter-spacing:-.02em}
.mk-feat-list{display:flex;flex-direction:column;gap:18px;margin-top:28px}
.mk-feat-li{display:flex;gap:14px}
.mk-feat-fi{width:40px;height:40px;border-radius:11px;background:var(--color-surface2);display:grid;place-items:center;font-size:18px;flex:none}
.mk-feat-li b{font-family:var(--font-heading);font-size:15px;display:block}
.mk-feat-li p{color:var(--color-muted);font-size:13.5px;margin-top:3px}
.mk-panel{background:var(--color-card);border:1px solid var(--color-border);border-radius:20px;padding:22px;box-shadow:var(--shadow-pop)}

.mk-wallet-top{display:flex;align-items:center;justify-content:space-between}
.mk-wallet-sub{font-size:12.5px;color:var(--color-muted);font-weight:600}
.mk-wallet-bal{font-family:var(--font-heading);font-weight:800;font-size:30px;letter-spacing:-.02em}
.mk-ledger{margin-top:16px;display:flex;flex-direction:column;gap:2px}
.mk-led-row{display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid var(--color-border);font-size:13px}
.mk-led-ic{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex:none;font-size:13px}
.mk-led-am{margin-left:auto;font-weight:700;font-family:var(--font-heading)}

.mk-chips{display:flex;flex-wrap:wrap;gap:9px}
.mk-chip{font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:999px;border:1px solid var(--color-border);background:var(--color-surface2)}
.mk-chip-d{color:var(--color-green);margin-right:5px}
.mk-google-preview{margin-top:18px;border:1px solid var(--color-border);border-radius:12px;overflow:hidden}
.mk-gp-bar{background:var(--color-surface2);padding:9px 12px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--color-muted)}
.mk-gp-body{padding:13px}
.mk-gp-url{color:var(--color-accent);font-size:13px}
.mk-gp-title{color:#1a0dab;font-size:16px;margin:3px 0 2px}
[data-theme="dark"] .mk-gp-title{color:#8ab4f8}
.mk-gp-desc{color:var(--color-muted);font-size:12.5px}

.mk-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;text-align:center}
.mk-stat-n{font-family:var(--font-heading);font-weight:800;font-size:clamp(30px,4vw,46px);letter-spacing:-.02em}
.mk-stat-l{color:var(--color-muted);font-size:13.5px;margin-top:4px}

.mk-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}
.mk-plan{position:relative;background:var(--color-card);border:1px solid var(--color-border);border-radius:20px;padding:26px;box-shadow:var(--shadow);display:flex;flex-direction:column;height:100%;box-sizing:border-box}
.mk-plan-feat{border-color:var(--color-primary);box-shadow:0 1px 2px rgba(43,27,46,.04),0 30px 60px -28px rgba(255,106,61,.5);transform:scale(1.03)}
.mk-plan-rib{position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:700;color:#fff;background:var(--brand-gradient);padding:5px 14px;border-radius:999px;white-space:nowrap}
.mk-plan-name{font-family:var(--font-heading);font-weight:700;font-size:17px}
.mk-plan-price{font-family:var(--font-heading);font-weight:800;font-size:38px;letter-spacing:-.02em;margin:12px 0 2px}
.mk-plan-price small{font-size:14px;color:var(--color-muted);font-weight:500}
.mk-plan-desc{color:var(--color-muted);font-size:13.5px}
.mk-plan ul{list-style:none;padding:0;margin:20px 0 24px;display:flex;flex-direction:column;gap:11px;font-size:14px;flex:1;color:var(--color-text)}
.mk-plan ul li{display:flex;gap:10px}
.mk-plan ul li::before{content:"✓";color:var(--color-green);font-weight:800;flex:none}

.mk-tgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.mk-quote{background:var(--color-card);border:1px solid var(--color-border);border-radius:18px;padding:22px;box-shadow:var(--shadow);height:100%;box-sizing:border-box}
.mk-stars{color:var(--color-highlight);letter-spacing:1px}
.mk-quote p{font-size:14.5px;margin:12px 0 16px;color:var(--color-text)}
.mk-who{display:flex;align-items:center;gap:11px}
.mk-av{width:38px;height:38px;border-radius:50%;background:var(--brand-gradient);color:#fff;display:grid;place-items:center;font-weight:800;font-family:var(--font-heading);flex:none;font-size:15px}
.mk-who b{font-size:13.5px;display:block;font-family:var(--font-heading)}
.mk-who span{font-size:12px;color:var(--color-muted)}

.mk-ctaband{position:relative;overflow:hidden;border-radius:28px;padding:64px 40px;text-align:center;background:var(--brand-gradient);color:#fff;box-shadow:var(--shadow-pop)}
.mk-ctaband::after{content:"";position:absolute;inset:0;background:radial-gradient(50% 120% at 80% 0%,rgba(255,255,255,.3),transparent 60%)}
.mk-ctaband>*{position:relative;z-index:1}
.mk-ctaband h2{font-size:clamp(30px,4vw,46px);font-weight:800;font-family:var(--font-heading)}
.mk-ctaband p{font-size:18px;opacity:.92;margin-top:14px}
.mk-cb-input{margin:28px auto 0;max-width:460px;display:flex;gap:9px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:7px;backdrop-filter:blur(8px);align-items:center}
.mk-cb-input input{flex:1;border:0;background:transparent;color:#fff;font:inherit;font-size:15px;padding:10px 14px;outline:none;min-width:0}
.mk-cb-input input::placeholder{color:rgba(255,255,255,.75)}
.mk-cb-sfx{color:rgba(255,255,255,.85);font-family:ui-monospace,Menlo,monospace;font-size:13px;padding-right:6px;white-space:nowrap;flex:none}
.mk-cb-go{background:#fff;color:var(--color-primary);border:0;border-radius:10px;padding:12px 20px;font-family:var(--font-heading);font-weight:700;font-size:14.5px;cursor:pointer;white-space:nowrap;text-decoration:none;flex:none}

.mk-foot{border-top:1px solid var(--color-border);padding:56px 0 36px}
.mk-foot-top{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:30px}
.mk-foot-col h5{font-family:var(--font-heading);font-size:13px;font-weight:700;margin:0 0 14px;color:var(--color-text)}
.mk-foot-col a{display:block;color:var(--color-muted);font-size:13.5px;padding:5px 0;transition:color .15s;text-decoration:none}
.mk-foot-col a:hover{color:var(--color-primary)}
.mk-foot-nolink{display:block;color:var(--color-muted);font-size:13.5px;padding:5px 0;opacity:.55;cursor:default}
.mk-foot-desc{color:var(--color-muted);font-size:13.5px;margin-top:14px;max-width:28em}
.mk-foot-bot{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-top:40px;padding-top:24px;border-top:1px solid var(--color-border);color:var(--color-muted);font-size:13px}

.mk-mmenu{display:none}

@media(max-width:920px){
  .mk-hero-in{grid-template-columns:1fr}
  .mk-stage{height:360px;margin-top:20px}
  .mk-3{grid-template-columns:1fr}
  .mk-types{grid-template-columns:repeat(2,1fr)}
  .mk-feat,.mk-feat-rev{grid-template-columns:1fr;direction:ltr;gap:30px}
  .mk-feat-rev>*{direction:ltr}
  .mk-plans{grid-template-columns:1fr}
  .mk-plan-feat{transform:none}
  .mk-tgrid{grid-template-columns:1fr}
  .mk-stats{grid-template-columns:1fr 1fr;gap:30px 18px}
  .mk-foot-top{grid-template-columns:1fr 1fr}
  .mk-links{display:none}
  .mk-burger{display:flex}
  .mk-nav-r .mk-btn-ghost{display:none}
  .mk-mmenu.open{display:block;position:fixed;inset:68px 0 auto;z-index:59;background:var(--color-bg);border-bottom:1px solid var(--color-border);padding:14px 28px 22px;box-shadow:var(--shadow-pop)}
  .mk-mmenu.open a{display:block;padding:12px 6px;font-weight:600;border-bottom:1px solid var(--color-border);color:var(--color-text);text-decoration:none}
}
@media(max-width:560px){
  .mk-types{grid-template-columns:1fr 1fr}
  .mk-stats{grid-template-columns:1fr 1fr}
  .mk-wrap{padding:0 18px}
  .mk-stage{height:280px}
  .mk-ctaband{padding:40px 22px}
  .mk-cb-input{flex-wrap:wrap}
  .mk-cb-go{width:100%;text-align:center;padding:12px}
}
`;
