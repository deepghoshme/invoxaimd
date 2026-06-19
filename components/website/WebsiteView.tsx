"use client";

import { useState, useEffect, useRef } from "react";
import { type WebsiteContent, ACCENTS, FONT_FAMILY, FONT_GOOGLE, WIDTH_PX } from "@/lib/website";

type Track = { pageId: string; storeId?: string };
type Page = "home" | "about" | "contact" | string; // "legal:privacy" etc.

const NL: Record<string, string> = { home: "Home", about: "About", contact: "Contact" };

function ytId(u?: string): string {
  const m = (u || "").match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}

/** Renders a full website from content. Namespaced under .webview. Client
 * component (handles internal nav, FAQ, slider, cookie, video, hamburger). */
/** Full-bleed sections that get an alternating background tint when enabled. */
const TINTABLE = new Set(["features", "gallery", "pricing", "video", "about", "testimonials", "faq", "stats"]);

const hrefFor = (p: Page) => (p === "home" ? "/" : p.startsWith("legal:") ? `/${p.split(":")[1]}` : `/${p}`);

type WSProduct = { title: string; img?: string; price?: string; compareAt?: string; url: string };

export default function WebsiteView({
  content: cBase, showBrand = false, device = "web", stage = false, track, initialPage = "home", live = false, products,
}: { content: WebsiteContent; showBrand?: boolean; device?: "web" | "mobile"; stage?: boolean; track?: Track; initialPage?: Page; live?: boolean; products?: WSProduct[] }) {
  const [page, setPage] = useState<Page>(initialPage);
  // Apply the current custom page's content overrides (if any) over the base site.
  const cp0 = (cBase.pages ?? []).find((p) => p.slug === page);
  const c: WebsiteContent = cp0?.data ? { ...cBase, ...cp0.data } : cBase;
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkOn, setDarkOn] = useState(c.theme === "dark");
  const rootRef = useRef<HTMLDivElement>(null);

  // keep the runtime theme in sync with the builder control
  useEffect(() => { setDarkOn(c.theme === "dark"); }, [c.theme]);

  // load the chosen heading font on demand (Sora/Inter already loaded by the app)
  useEffect(() => {
    const g = c.font && FONT_GOOGLE[c.font];
    if (!g) return;
    const id = `wf-${c.font}`;
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${g}&display=swap`;
    document.head.appendChild(l);
  }, [c.font]);

  // Scroll-reveal: only on the live published site (avoids flicker while editing).
  const reveal = live && (c.anim ?? "rise") !== "none";
  useEffect(() => {
    if (!reveal) return;
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reveal, page]);
  const [openFaq, setOpenFaq] = useState<Record<number, boolean>>({});
  const [cookieGone, setCookieGone] = useState(false);
  const [video, setVideo] = useState(false);

  // cookie banner: remember dismissal so it shows only once (live site)
  useEffect(() => {
    if (!live) return;
    try { if (localStorage.getItem("inv_cookie_ok") || localStorage.getItem("inv_cookie_declined")) setCookieGone(true); } catch {}
  }, [live]);
  const dismissCookie = () => { setCookieGone(true); if (live) { try { localStorage.setItem("inv_cookie_ok", "1"); } catch {} } };
  // Decline: record a distinct "declined" choice (consent NOT given) rather than
  // writing the acceptance key — a meaningful difference from Accept.
  const declineCookie = () => { setCookieGone(true); if (live) { try { localStorage.setItem("inv_cookie_declined", "1"); } catch {} } };

  const head = (k: string, dt: string, ds = "") => ({ title: c.heads?.[k]?.title ?? dt, sub: c.heads?.[k]?.sub ?? ds });
  const grad = c.accentColor
    ? `linear-gradient(135deg, ${c.accentColor}, color-mix(in srgb, ${c.accentColor} 70%, #000))`
    : (ACCENTS[c.accent ?? 0]?.[1] ?? ACCENTS[0][1]);
  const bg = c.bg ?? "aurora";
  const nav = c.nav ?? "a";
  const bt = c.btshape ? `bt${c.btshape}` : "btsoft";
  const anim = c.anim ?? "rise";
  const btnAnim = c.btnAnim ?? "shine";
  const rev = reveal ? " reveal" : "";
  const m = device === "mobile" ? " m" : "";
  const fontFam = FONT_FAMILY[c.font ?? "sora"] ?? "'Sora'";
  const ww = WIDTH_PX[c.pageWidth ?? "standard"] ?? 1180;
  const order = c.order ?? [];
  const sections = c.sections ?? {};
  const legal = c.legal ?? ({} as NonNullable<WebsiteContent["legal"]>);

  // CTA href → through the click tracker when published, else the raw url.
  // Reject dangerous URL schemes (javascript:, data:, vbscript:, …) so a
  // seller-entered link can't inject script into their storefront. Allow only
  // same-origin relative paths/anchors and absolute http(s)/mailto/tel URLs.
  const safeUrl = (v: string | undefined) => {
    const raw = (v || "").trim();
    if (!raw) return "#";
    if (raw.startsWith("/") || raw.startsWith("#")) return raw;
    try {
      const parsed = new URL(raw);
      const ok = ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
      return ok ? parsed.toString() : "#";
    } catch {
      return "#";
    }
  };
  const cta = (url: string | undefined, label: string) => {
    const u = safeUrl(url);
    if (track && u !== "#") {
      return `/api/bio/go?p=${track.pageId}${track.storeId ? `&s=${track.storeId}` : ""}&u=${encodeURIComponent(u)}&t=${encodeURIComponent(label)}`;
    }
    return u;
  };
  // Navigate: instant client-side switch + (on the live site) update the URL so
  // /about, /contact, /privacy are real, shareable, deep-linkable addresses.
  const go = (p: Page, e?: React.MouseEvent) => {
    e?.preventDefault();
    setPage(p); setMenuOpen(false);
    if (track) { try { window.history.pushState({}, "", hrefFor(p)); } catch {} }
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const link = (p: Page, label: React.ReactNode, extra?: string) =>
    <a className={extra} href={hrefFor(p)} onClick={(e) => go(p, e)}>{label}</a>;

  const logo = c.logo
    ? // eslint-disable-next-line @next/next/no-img-element
      <img src={c.logo} alt={c.site || ""} style={{ height: c.logoSize ?? 28 }} />
    : <><span className="d" />{c.site || "Your brand"}</>;

  const menuItems = (["home", "about", "contact"] as const)
    .filter((k) => c.menu?.[k]?.on !== false)
    .map((k) => ({ key: k as Page, label: c.menu?.[k]?.label || NL[k] }));
  const extraLinks = (c.menuLinks ?? []).filter((l) => l.label);
  const customPages = (c.pages ?? []).filter((p) => p.inMenu !== false && p.slug && p.label);
  const makeLinks = (pfx: string) => (
    <>
      {menuItems.map((it) => <a key={pfx + it.key} className={page === it.key ? "on" : ""} href={hrefFor(it.key)} onClick={(e) => go(it.key, e)}>{it.label}</a>)}
      {customPages.map((p) => <a key={pfx + p.slug} className={page === p.slug ? "on" : ""} href={hrefFor(p.slug)} onClick={(e) => go(p.slug, e)}>{p.label}</a>)}
      {extraLinks.map((l, i) => <a key={pfx + "x" + i} href={l.url || "#"} target="_blank" rel="noreferrer">{l.label}</a>)}
    </>
  );

  const au = c.auth;
  const authBtns = (extra: string) => au?.on ? (
    <>
      <a className={`navauth ghost ${extra}`} href={au.loginUrl || "#"}>Log in</a>
      <a className={`navauth ${extra}`} href={au.signupUrl || "#"}>{au.accountUrl ? "My account" : "Sign up"}</a>
    </>
  ) : null;

  const Nav = () => {
    return (
      <div className={`snav nav-${nav}${menuOpen ? " open" : ""}${c.sticky === false ? " nostick" : ""}`}>
        <div className="slogo" style={{ cursor: "pointer" }} onClick={(e) => go("home", e)}>{logo}</div>
        <div className="smenu">{makeLinks("d")}</div>
        <div className="navtools">{authBtns("")}{c.themeToggle && <button className="themetog" title="Toggle theme" onClick={() => setDarkOn((v) => !v)}>{darkOn ? "☀️" : "🌙"}</button>}</div>
        <span className="ham" onClick={() => setMenuOpen((v) => !v)}>☰</span>
        <a className="ncta" href={cta(c.ctaurl, c.cta || "CTA")}>{c.cta || "Get started"}</a>
        <div className="mmenu">
          {makeLinks("m")}
          {c.themeToggle && <a className="mtool" onClick={() => setDarkOn((v) => !v)}>{darkOn ? "☀️ Light mode" : "🌙 Dark mode"}</a>}
          {au?.on && <a className="mtool" href={au.loginUrl || "#"}>Log in</a>}
          {au?.on && <a className="mtool" href={au.signupUrl || "#"}>{au.accountUrl ? "My account" : "Sign up"}</a>}
        </div>
      </div>
    );
  };

  const Hero = () => {
    const layout = c.heroLayout ?? "right";
    const hi: React.CSSProperties = {
      ...(c.himg ? { backgroundImage: `url('${c.himg}')` } : {}),
      ...(c.heroImgH ? { height: c.heroImgH } : {}),
    };
    const hasVid = !!c.heroVideo;
    const showImg = layout !== "none" && !hasVid;
    return (
      <div className={`hero hero-${layout}${c.heroBg ? " hero-bg" : ""}${hasVid ? " hero-vid" : ""}${rev}`} data-sec="hero">
        {hasVid && <><video className="herovid" src={c.heroVideo} autoPlay muted loop playsInline /><div className="herovid-ov" /></>}
        {layout === "left" && showImg && <div className={`himg${c.himg ? "" : " ph"}`} style={hi} />}
        <div>
          {c.heroTyping ? <Typewriter words={c.heroTyping} /> : c.heroEyebrow ? <div className="heyebrow">{c.heroEyebrow}</div> : null}
          <div className={`htitle${c.htitleGrad ? " gradtext" : ""}`}>{c.htitle}</div>
          <div className="hsub">{c.hsub}</div>
          <div className="hbtns">
            <a className="b1" href={cta(c.hb1url || c.ctaurl, c.hb1 || "")}>{c.hb1 || "Start"}</a>
            {c.hb2 && (c.hb2url ? <a className="b2" href={cta(c.hb2url, c.hb2)}>{c.hb2}</a> : <button className="b2">{c.hb2}</button>)}
          </div>
          {c.heroRating && <div className="hrating"><span className="rstars">★★★★★</span> {c.heroRating}</div>}
        </div>
        {layout !== "left" && showImg && <div className={`himg${c.himg ? "" : " ph"}`} style={hi} />}
      </div>
    );
  };

  const REN: Record<string, () => React.ReactNode> = {
    features: () => {
      const h = head("features", "Everything you need", "Built to help you start and stay consistent.");
      return (
        <div className="sect" key="features">
          <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
          <div className="feats">{(c.feats ?? []).map((f, i) => (
            <div className="fcard" key={i}><div className="fi">{f.ic}</div><h3>{f.t}</h3><p>{f.x}</p></div>
          ))}</div>
        </div>
      );
    },
    spotlight: () => {
      const h = head("spotlight", "Why choose us", "");
      return (
        <div className="sect" key="spotlight">
          {(h.title || h.sub) && <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>}
          <div className="spots">{(c.spots ?? []).map((s, i) => (
            <div className={`spot${i % 2 ? " flip" : ""}`} key={i}>
              <div className="spotimg" style={s.img ? { backgroundImage: `url('${s.img}')` } : undefined} />
              <div className="spottx"><h3>{s.title}</h3><p>{s.text}</p></div>
            </div>
          ))}</div>
        </div>
      );
    },
    banner: () => (
      <div className="bannerstrip" key="banner">
        <span>{c.banner?.text}</span>
        {c.banner?.cta && <a className="b1" href={cta(c.banner.url, c.banner.cta)}>{c.banner.cta}</a>}
      </div>
    ),
    map: () => {
      const h = head("map", "Find us", "");
      const addr = c.mapAddr || c.city || "";
      return (
        <div className="sect" key="map">
          {(h.title || h.sub) && <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>}
          {addr ? <div className="cmap"><iframe title="map" loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`} /></div> : <div className="galempty">Add an address in the builder.</div>}
        </div>
      );
    },
    steps: () => {
      const h = head("steps", "How it works", "Get started in three simple steps.");
      return (
        <div className="sect" key="steps">
          <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
          <div className={`steps steps-${c.stepStyle ?? "cards"}`}>{(c.steps ?? []).map((s, i) => (
            <div className="stepc" key={i}><div className="sn">{i + 1}</div><h3>{s.t}</h3><p>{s.x}</p></div>
          ))}</div>
        </div>
      );
    },
    stats: () => (
      <div className="statsec" key="stats">{(c.stats ?? []).map((s, i) => (
        <div className="stat" key={i}><div className="n"><StatNum value={s.n} on={live && c.statsCount !== false} /></div><div className="l">{s.l}</div></div>
      ))}</div>
    ),
    logos: () => {
      const h = head("logos", "Trusted by great teams", "");
      const imgs = c.logos?.length ? c.logos : null;
      return (
        <div className="sect" key="logos">
          <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
          <div className="logogrid">{imgs
            ? imgs.map((g, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img className="logoimg" key={i} src={g} alt="" />)
            : (c.brands ?? "").split(",").map((b, i) => <div className="logotext" key={i}>{b.trim()}</div>)}</div>
        </div>
      );
    },
    team: () => {
      const h = head("team", "Meet the team", "The people behind the work.");
      return (
        <div className="sect" key="team">
          <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
          <div className="teamgrid">{(c.team ?? []).map((mb, i) => (
            <div className="teamc" key={i}>
              <div className="tav2" style={mb.img ? { backgroundImage: `url('${mb.img}')` } : undefined}>{mb.img ? "" : (mb.name || "?").charAt(0)}</div>
              <div className="tn">{mb.name}</div><div className="tr">{mb.role}</div>
            </div>
          ))}</div>
        </div>
      );
    },
    shop: () => {
      const h = head("shop", "Shop our products", "Browse and buy in a tap.");
      const SAMPLE: WSProduct[] = [
        { title: "Product one", price: "₹999", compareAt: "₹1,499", url: "#" },
        { title: "Product two", price: "₹1,499", url: "#" },
        { title: "Product three", price: "₹499", url: "#" },
      ];
      const items = products === undefined ? SAMPLE : products; // builder → sample, live → real
      return (
        <div className="sect" key="shop">
          <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
          {items.length ? (
            <div className="shopgrid">{items.map((p, i) => (
              <a className="shopcard" key={i} href={p.url}>
                <div className="shopimg" style={p.img ? { backgroundImage: `url('${p.img}')` } : undefined} />
                <div className="shopb">
                  <div className="shopt">{p.title}</div>
                  {p.price && <div className="shopp">{p.price}{p.compareAt && <span className="was">{p.compareAt}</span>}</div>}
                  <span className="shopbtn">View</span>
                </div>
              </a>
            ))}</div>
          ) : <div className="galempty">Publish one-page products and they’ll appear here automatically.</div>}
        </div>
      );
    },
    countdown: () => (
      <div className="sect" key="countdown"><Countdown title={c.countdown?.title || "Hurry — offer ends soon"} sub={c.countdown?.sub} date={c.countdown?.date} variant={c.cdStyle ?? "cards"} /></div>
    ),
    gallery: () => {
      const h = head("gallery", "Gallery", "A look inside.");
      const imgs = c.gallery ?? [];
      return (
        <div className="sect" key="gallery">
          <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
          {imgs.length ? (
            (c.galStyle ?? "slider") === "grid"
              ? <div className="galgrid">{imgs.map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="galg" key={i} src={g} alt="" style={c.galH ? { height: c.galH } : undefined} />
                ))}</div>
              : <Slider images={imgs} h={c.galH} auto={c.galAuto !== false} />
          ) : <div className="galempty">Upload images in the builder to fill your gallery.</div>}
        </div>
      );
    },
    brands: () => {
      const imgs = c.brandLogos?.length ? c.brandLogos : null;
      const make = (pfx: string) => imgs
        ? imgs.map((g, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img className="bimg" key={pfx + i} src={g} alt="" />)
        : (c.brands ?? "").split(",").map((b, i) => <span className="brand" key={pfx + i}>{b.trim()}</span>);
      // render 6 identical copies so even 1–4 logos fill the marquee (no blanks)
      return (
        <div className="sect" style={{ padding: "34px 26px" }} key="brands">
          <div className="marquee"><div className="mtrack">{["a", "b", "c", "d", "e", "f"].map((p) => make(p))}</div></div>
        </div>
      );
    },
    pricing: () => {
      const h = head("pricing", "Simple pricing", "Pick a plan that grows with you.");
      return (
        <div className="sect" key="pricing">
          <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
          <Pricing plans={c.pricing ?? []} label={c.cta} ctaurl={c.ctaurl} yearly={!!c.pricingYearly} mk={cta} />
        </div>
      );
    },
    video: () => {
      const id = ytId(c.video?.url);
      const thumb: React.CSSProperties = { ...(id ? { backgroundImage: `url('https://img.youtube.com/vi/${id}/hqdefault.jpg')` } : {}), ...(c.vidW ? { maxWidth: c.vidW } : {}) };
      return (
        <div className="sect" key="video">
          <div className="sect-h"><h2>{c.video?.title || "Watch"}</h2></div>
          <div className="vid" style={thumb} onClick={() => id && setVideo(true)}>
            {video && id
              ? <iframe src={`https://www.youtube.com/embed/${id}?autoplay=1`} allow="autoplay" allowFullScreen title="video" />
              : <div className="play"><span>▶</span></div>}
          </div>
        </div>
      );
    },
    about: () => {
      const ai = c.about?.img ? { backgroundImage: `url('${c.about.img}')` } : undefined;
      return (
        <div className="about" key="about">
          <div className="aimg" style={ai} />
          <div><h2>{c.about?.title}</h2><p>{c.about?.text}</p></div>
        </div>
      );
    },
    testimonials: () => {
      const h = head("testimonials", "Loved by customers", "Real words from our community.");
      return (
      <div className="sect" key="testimonials">
        <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
        <div className={`tgrid${(c.testStyle ?? "grid") === "carousel" ? " tgrid-carousel" : ""}`}>{(c.tests ?? []).map((t, i) => (
          <div className="tcard" key={i}>
            <div className="st">★★★★★</div><p>“{t.q}”</p>
            <div className="who"><div className="tav">{(t.n || "?").charAt(0)}</div>
              <div><div className="nm">{t.n}</div><div className="rl">{t.r}</div></div></div>
          </div>
        ))}</div>
      </div>
      );
    },
    faq: () => {
      const h = head("faq", "Frequently asked", "");
      return (
      <div className="sect" key="faq">
        <div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
        <div className="faqwrap">{(c.faq ?? []).map((f, i) => (
          <div className={`faq-item${openFaq[i] ? " open" : ""}`} key={i}>
            <div className="faq-q" onClick={() => setOpenFaq((o) => ({ ...o, [i]: !o[i] }))}>{f.q}<span className="pm">+</span></div>
            <div className="faq-a">{f.a}</div>
          </div>
        ))}</div>
      </div>
      );
    },
    newsletter: () => (
      <div className="news" key="newsletter">
        <h2>{c.news?.title}</h2><p>{c.news?.sub}</p>
        <NewsletterForm c={c} track={track} />
      </div>
    ),
    cta: () => (
      <div className="ctaband" key="cta">
        <h2>{c.ctaBand?.title}</h2><p>{c.ctaBand?.sub}</p>
        <a className="b1" href={cta(c.ctaBand?.url ?? c.ctaurl, c.cta || "Get started")}>{c.cta || "Get started"}</a>
      </div>
    ),
  };

  const Foot = () => {
    const legalLinks = (Object.keys(legal) as (keyof typeof legal)[])
      .filter((k) => legal[k]?.on)
      .map((k) => <a key={String(k)} href={hrefFor(`legal:${String(k)}`)} onClick={(e) => go(`legal:${String(k)}`, e)}>{legal[k].title}</a>);
    const soc = [["ig", "IG"], ["yt", "YT"], ["x", "X"], ["tg", "TG"]] as const;
    return (
      <div className="sfoot">
        <div>
          <div className="fl" style={{ cursor: "pointer" }} onClick={(e) => go("home", e)}>{logo}</div>
          <div className="tg">{c.hsub}</div>
          <div className="fsoc">{soc.map(([k, lab]) => c.social?.[k] ? <span className="s" key={k} title={c.social[k]}>{lab}</span> : null)}</div>
        </div>
        <div><div className="fb">Explore</div>{link("home", "Home")}{link("about", "About")}{link("contact", "Contact")}</div>
        <div><div className="fb">Legal</div>{legalLinks.length ? legalLinks : <a>—</a>}</div>
        <div><div className="fb">Contact</div><a>{c.email}</a><a>{c.phone}</a><a>{c.city}</a></div>
        <div className="cop"><span>© 2026 {c.site}</span><span>{showBrand ? <>Powered by <a href="https://invoxai.io" target="_blank" rel="noreferrer">invoxai</a></> : null}</span></div>
        <div className="cop" style={{ justifyContent: "center", paddingTop: 0 }}><a href="https://invoxai.io/account" target="_blank" rel="noreferrer" style={{ fontSize: 12, opacity: .6 }}>My orders &amp; account ↗</a></div>
      </div>
    );
  };

  // render an ordered list of section keys with reveal + per-section background
  const renderSections = (keys: string[]) => {
    let t = 0;
    return keys.map((k) => {
      if (!REN[k]) return null;
      let cls = reveal ? "reveal" : "";
      const sty = c.secStyle?.[k] ?? "auto";
      if (sty === "auto") { if (c.tint && TINTABLE.has(k)) { if (t % 2 === 1) cls += " tintbg"; t++; } }
      else if (sty === "tint") cls += " tintbg";
      else if (sty === "grad") cls += " gradbg";
      else if (sty === "dark") cls += " darkbg";
      const pad = c.secPad?.[k];
      if (pad && pad !== "md") cls += ` pad-${pad}`;
      const cols = c.secCols?.[k];
      const bgimg = c.secBgImg?.[k];
      if (bgimg) cls += " sec-bgimg";
      const style: Record<string, string | number> = {};
      if (cols) style["--cols"] = cols;
      if (bgimg) style["--secbg"] = `url('${bgimg}')`;
      const node = REN[k]();
      const full = cls.trim();
      // always wrap with data-sec so the builder can map a preview click → its editor
      return <div className={full || undefined} style={Object.keys(style).length ? (style as React.CSSProperties) : undefined} data-sec={k} key={k}>{node}</div>;
    });
  };

  const Content = () => {
    if (typeof page === "string" && page.startsWith("legal:")) {
      const k = page.split(":")[1] as keyof typeof legal;
      const L = legal[k];
      if (!L) return null;
      return (
        <div className="legalpage"><h1>{L.title}</h1><div className="upd">Last updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
          {L.text.split("\n").map((p, i) => <p key={i}>{p}</p>)}</div>
      );
    }
    if (page === "about") {
      return <>
        <div className="sect"><div className="sect-h"><h2>{c.about?.title}</h2><p>Get to know {c.site}.</p></div></div>
        {REN.about()}{sections.testimonials && REN.testimonials()}{REN.cta()}
      </>;
    }
    if (page === "contact") {
      const h = head("contact", "Get in touch", "We usually reply within a day.");
      const cs = c.contactStyle ?? "split";
      const info = (
        <div className="cbox">
          <div className="ci"><span className="e">✉️</span>{c.email}</div>
          <div className="ci"><span className="e">📞</span>{c.phone}</div>
          <div className="ci"><span className="e">📍</span>{c.city}</div>
        </div>
      );
      return (
        <div className="sect"><div className="sect-h"><h2>{h.title}</h2>{h.sub && <p>{h.sub}</p>}</div>
          <div className={`cinfo cinfo-${cs}`}>
            {info}
            <ContactForm c={c} track={track} />
          </div>
          {cs === "map" && c.city && (
            <div className="cmap"><iframe title="map" loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(c.city)}&output=embed`} /></div>
          )}
        </div>
      );
    }
    // custom page — composes any sections (shared content), with its own order
    const cp = (c.pages ?? []).find((p) => p.slug === page);
    if (cp) {
      const intro = cp.intro;
      const hasIntro = intro && (intro.title || intro.sub || intro.text || intro.img);
      return <>
        {hasIntro && (
          <div className="sect pageintro">
            {intro!.img && <div className="pageintro-img" style={{ backgroundImage: `url('${intro!.img}')` }} />}
            {(intro!.title || intro!.sub) && <div className="sect-h">{intro!.title && <h2>{intro!.title}</h2>}{intro!.sub && <p>{intro!.sub}</p>}</div>}
            {intro!.text && <div className="pageintro-tx">{intro!.text.split("\n").map((p, i) => <p key={i}>{p}</p>)}</div>}
          </div>
        )}
        {renderSections((cp.order ?? []).filter((k) => REN[k]))}
      </>;
    }
    // home — hero + the enabled sections in order
    return <>{Hero()}{renderSections(order.filter((k) => sections[k]))}</>;
  };

  return (
    <div className={`webview${stage ? " stage" : ""}${darkOn ? " dark-site" : ""}`} ref={rootRef}>
      <div className={`site ${bt} banim-${btnAnim} anim-${anim} div-${c.divider ?? "none"}${m}`} style={{ ["--siteGrad" as string]: grad, ["--font-sora" as string]: fontFam, ["--ww" as string]: `${ww}px`, ...(c.accentColor ? { ["--primary" as string]: c.accentColor, ["--secondary" as string]: c.accentColor, ["--accent" as string]: c.accentColor } : {}) } as React.CSSProperties}>
        <div className={`sitebg sbg-${bg}`}>
          <span className="o o1" /><span className="o o2" /><span className="o o3" />
          <span className="o o4" /><span className="o o5" /><span className="o o6" />
        </div>
        <div className="sitewrap">
          {c.announce?.on && <div className="annbar">{c.announce.text} {c.announce.cta && <a href={cta(c.announce.url, c.announce.cta)}>{c.announce.cta} ›</a>}</div>}
          {Nav()}
          {Content()}
          {Foot()}
          {c.whatsapp?.on && (
            <div className="wa-wrap">
              <a className="wa" title={c.whatsapp.label || "Chat with us"} href={safeUrl(c.whatsapp.link || `https://wa.me/${(c.whatsapp.number || "").replace(/[^0-9]/g, "")}`)} target="_blank" rel="noreferrer">
                <span className="wa-ic">{c.whatsapp.icon || "💬"}</span>
                {c.whatsapp.label && <span className="wa-label">{c.whatsapp.label}</span>}
              </a>
            </div>
          )}
          {(c.scrollProgress || c.backTop) && <ScrollFx progress={!!c.scrollProgress} backTop={!!c.backTop} />}
          {c.cookie?.on && !cookieGone && (
            <div className="cookie">We use cookies to improve your experience.
              <div className="cbtns"><button className="acc" onClick={dismissCookie}>Accept</button><button className="dec" onClick={declineCookie}>Decline</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function submitMessage(track: Track | undefined, body: Record<string, unknown>): Promise<boolean> {
  if (!track) return true; // builder preview → pretend success, don't hit the API
  try {
    const res = await fetch("/api/site/contact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_id: track.storeId, page_id: track.pageId, ...body }),
    });
    return res.ok;
  } catch { return false; }
}

function ContactForm({ c, track }: { c: WebsiteContent; track?: Track }) {
  const [f, setF] = useState({ name: "", email: "", message: "" });
  const [st, setSt] = useState<"idle" | "sending" | "done" | "error">("idle");
  if (st === "done") return <div className="cbox" style={{ display: "grid", placeItems: "center", textAlign: "center", minHeight: 160 }}>✅<br />Thanks{f.name ? `, ${f.name}` : ""}! We’ll be in touch soon.</div>;
  return (
    <form className="cbox cform" onSubmit={async (e) => { e.preventDefault(); setSt("sending"); const ok = await submitMessage(track, { kind: "contact", ...f }); setSt(ok ? "done" : "error"); }}>
      <input placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input placeholder="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <textarea placeholder="Message" rows={3} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <button className="b1" style={{ width: "100%" }} disabled={st === "sending"}>{st === "sending" ? "Sending…" : "Send message"}</button>
      {st === "error" && <div style={{ color: "var(--secondary)", fontSize: 12, marginTop: 6 }}>Something went wrong — please try again.</div>}
    </form>
  );
}

function Pricing({ plans, label, ctaurl, yearly, mk }: { plans: import("@/lib/website").WSPlan[]; label?: string; ctaurl?: string; yearly?: boolean; mk: (u: string | undefined, l: string) => string }) {
  const [yr, setYr] = useState(false);
  return (
    <>
      {yearly && (
        <div className="billtoggle">
          <button className={!yr ? "on" : ""} onClick={() => setYr(false)}>Monthly</button>
          <button className={yr ? "on" : ""} onClick={() => setYr(true)}>Yearly</button>
        </div>
      )}
      <div className="pgrid">{plans.map((p, i) => (
        <div className={`pcardx${p.pop ? " pop" : ""}`} key={i}>
          {p.pop && <span className="popr">POPULAR</span>}
          <div className="pn">{p.n}</div>
          <div className="pp">{yearly && yr ? (p.py || p.p) : p.p}</div>
          <ul>{p.f.split(",").map((x, j) => <li key={j}>{x.trim()}</li>)}</ul>
          <a className="pb" href={mk(p.url || ctaurl, `${p.n} plan`)}>{label || "Choose"}</a>
        </div>
      ))}</div>
    </>
  );
}

function ScrollFx({ progress, backTop }: { progress: boolean; backTop: boolean }) {
  const [p, setP] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const sc = h.scrollTop || document.body.scrollTop || 0;
      setP(max > 0 ? (sc / max) * 100 : 0);
      setShow(sc > 400);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      {progress && <div className="scrollfx" style={{ width: `${p}%` }} />}
      {backTop && <button className={`backtop${show ? " show" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">↑</button>}
    </>
  );
}

function StatNum({ value, on }: { value: string; on?: boolean }) {
  const m = value.match(/^([^\d]*)([\d,.]+)(.*)$/);
  const [txt, setTxt] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!on || !m) { setTxt(value); return; }
    const el = ref.current; if (!el) return;
    const prefix = m[1], numStr = m[2], suffix = m[3];
    const decimals = (numStr.split(".")[1] || "").length;
    const target = parseFloat(numStr.replace(/,/g, ""));
    if (!isFinite(target)) return;
    const fmt = (n: number) => prefix + n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    setTxt(fmt(0));
    let started = false;
    const run = () => {
      let t0 = 0; const dur = 1200;
      const step = (t: number) => {
        if (!t0) t0 = t;
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setTxt(p < 1 ? fmt(target * eased) : value);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !started) { started = true; run(); io.disconnect(); } }), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [on, value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{txt}</span>;
}

function Slider({ images, h, auto }: { images: string[]; h?: number; auto?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!auto || images.length < 2) return;
    const el = ref.current; if (!el) return;
    const id = setInterval(() => {
      const max = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= max - 6) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: el.clientWidth * 0.8, behavior: "smooth" });
    }, 3500);
    return () => clearInterval(id);
  }, [auto, images.length]);
  const move = (d: number) => { const el = ref.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: "smooth" }); };
  return (
    <div className="slider">
      <button className="sbtn" onClick={() => move(-1)} aria-label="Previous">‹</button>
      <div className="strack" ref={ref}>{images.map((g, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="slide" key={i} style={h ? { height: h } : undefined}><img src={g} alt="" /></div>
      ))}</div>
      <button className="sbtn" onClick={() => move(1)} aria-label="Next">›</button>
    </div>
  );
}

function Typewriter({ words }: { words: string }) {
  const list = words.split(",").map((w) => w.trim()).filter(Boolean);
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState("");
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (!list.length) return;
    const cur = list[i % list.length];
    const to = setTimeout(() => {
      if (!del) {
        const n = cur.slice(0, txt.length + 1);
        setTxt(n);
        if (n === cur) setTimeout(() => setDel(true), 1100);
      } else {
        const n = cur.slice(0, txt.length - 1);
        setTxt(n);
        if (n === "") { setDel(false); setI((v) => v + 1); }
      }
    }, del ? 45 : 95);
    return () => clearTimeout(to);
  }, [txt, del, i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  return <div className="heyebrow tw">{txt}<span className="twcursor">|</span></div>;
}

function cdCalc(date?: string) {
  const tgt = date ? new Date(date).getTime() : Date.now() + 1000 * 60 * 60 * 47;
  let diff = Math.max(0, tgt - Date.now());
  const d = Math.floor(diff / 86400000); diff -= d * 86400000;
  const h = Math.floor(diff / 3600000); diff -= h * 3600000;
  const m = Math.floor(diff / 60000); diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  return { d, h, m, s };
}
function Countdown({ title, sub, date, variant = "cards" }: { title?: string; sub?: string; date?: string; variant?: string }) {
  const [t, setT] = useState(() => cdCalc(date));
  useEffect(() => { const id = setInterval(() => setT(cdCalc(date)), 1000); return () => clearInterval(id); }, [date]);
  return (
    <div className={`cdown cd-${variant}`}>
      {title && <div className="cdh">{title}</div>}
      {sub && <p>{sub}</p>}
      <div className="cdgrid">
        {([["Days", t.d], ["Hours", t.h], ["Min", t.m], ["Sec", t.s]] as const).map(([l, v]) => (
          <div className="cdc" key={l}><div className="cdn">{String(v).padStart(2, "0")}</div><div className="cdl">{l}</div></div>
        ))}
      </div>
    </div>
  );
}

function NewsletterForm({ c, track }: { c: WebsiteContent; track?: Track }) {
  const [email, setEmail] = useState("");
  const [st, setSt] = useState<"idle" | "sending" | "done" | "error">("idle");
  if (st === "done") return <div className="newsform" style={{ justifyContent: "center" }}>✅ You’re subscribed — thank you!</div>;
  return (
    <form className="newsform" onSubmit={async (e) => { e.preventDefault(); setSt("sending"); const ok = await submitMessage(track, { kind: "newsletter", email }); setSt(ok ? "done" : "error"); }}>
      <input placeholder="you@email.com" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <button disabled={st === "sending"}>{st === "sending" ? "…" : (c.news?.btn || "Subscribe")}</button>
    </form>
  );
}
