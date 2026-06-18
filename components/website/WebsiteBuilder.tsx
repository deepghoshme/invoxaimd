"use client";

import { useState, useRef, useEffect } from "react";
import WebsiteView from "./WebsiteView";
import {
  type WebsiteContent, type WSFeature, type WSStat, type WSPlan, type WSTest, type WSFaq, type WSSpot,
  ACCENTS, BGS, NAVS, BTSHAPES, HERO_LAYOUTS, REVEALS, BTN_ANIMS, DIVIDERS, FONTS, WIDTHS, SEC_STYLES, STEP_STYLES, CD_STYLES, CONTACT_STYLES, GAL_STYLES, TEST_STYLES, PADS, GRID_SECTIONS, LEGAL_DOCS, ICONS, SECTIONS, LABELS, TEMPLATES,
} from "@/lib/website";
import { saveWebsite, publishWebsite } from "@/app/dashboard/website/actions";

async function upload(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    return res.ok ? (j.url as string) : null;
  } catch {
    return null;
  }
}

function Upload({ ico, label, sub, value, onUrl, onRemove }: { ico: string; label: string; sub?: string; value?: string; onUrl: (u: string) => void; onRemove?: () => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; setBusy(true); const u = await upload(f); setBusy(false); if (u) onUrl(u);
  };
  if (value) {
    return (
      <div className="up up-has">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="up-prev" src={value} alt="" />
        <div className="up-actions">
          <span className="t">{busy ? "Uploading…" : label.replace(/^Upload /, "")}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <label className="up-btn">Change<input type="file" accept="image/*" onChange={pick} /></label>
            {onRemove && <button type="button" className="up-btn danger" onClick={onRemove}>Remove</button>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <label className="up">
      <span className="ico">{busy ? "…" : ico}</span>
      <span><span className="t">{label}</span>{sub && <><br /><span className="s">{sub}</span></>}</span>
      <input type="file" accept="image/*" onChange={pick} />
    </label>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button type="button" className={`switch${on ? " on" : ""}`} onClick={onClick}><i /></button>;
}

/** Renders children at a fixed desktop width, then zoom-scales to fit the pane —
 * so the web preview shows the TRUE desktop layout (no squish/overlap). */
function ScaledFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: width, z: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const cw = el.clientWidth;
      const W = Math.max(cw, width); // fill the pane; never render narrower than desktop
      setDims({ w: W, z: Math.min(1, cw / W) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} style={{ width: "100%", overflow: "hidden" }}>
      <div style={{ width: dims.w, zoom: dims.z, transformOrigin: "top left" } as React.CSSProperties}>{children}</div>
    </div>
  );
}

export default function WebsiteBuilder({
  initial, publicUrl, initialStatus,
}: { initial: WebsiteContent; publicUrl: string | null; initialStatus: string }) {
  const [cFull, setCFull] = useState<WebsiteContent>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "public">("edit");
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [editTarget, setEditTarget] = useState<string>("home"); // "home" or a page slug
  const editorRef = useRef<HTMLDivElement>(null);

  // Which content the SECTION editors read/write: home → the site itself; a page →
  // that page's overrides merged over the site. Save always writes the FULL site.
  const pages = cFull.pages ?? [];
  const targetIdx = editTarget === "home" ? -1 : pages.findIndex((p) => p.slug === editTarget);
  const onPage = targetIdx >= 0;
  const c: WebsiteContent = onPage ? { ...cFull, ...(pages[targetIdx]?.data ?? {}) } : cFull;
  const set = (patch: Partial<WebsiteContent>) => {
    if (!onPage) { setCFull((p) => ({ ...p, ...patch })); return; }
    setCFull((full) => ({
      ...full,
      pages: (full.pages ?? []).map((pg, j) => (j === targetIdx ? { ...pg, data: { ...(pg.data ?? {}), ...patch } } : pg)),
    }));
  };
  // Page structure (list/order/slug/intro) is always global — edit it on cFull.
  const setGlobal = (patch: Partial<WebsiteContent>) => setCFull((p) => ({ ...p, ...patch }));

  // Accordion: each panel collapses; opening one auto-closes the others.
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const secs = Array.from(root.querySelectorAll<HTMLElement>(":scope > .sec"));
    secs.forEach((s, i) => s.classList.toggle("collapsed", i !== 0)); // first open
    const cleanups: (() => void)[] = [];
    secs.forEach((s) => {
      const head = s.querySelector<HTMLElement>(":scope > h3");
      if (!head) return;
      const onClick = () => {
        const willOpen = s.classList.contains("collapsed");
        secs.forEach((o) => o.classList.add("collapsed"));
        if (willOpen) s.classList.remove("collapsed");
      };
      head.addEventListener("click", onClick);
      cleanups.push(() => head.removeEventListener("click", onClick));
    });
    return () => cleanups.forEach((f) => f());
  }, []);

  const feats = c.feats ?? [];
  const spots = c.spots ?? [];
  const steps = c.steps ?? [];
  const team = c.team ?? [];
  const stats = c.stats ?? [];
  const pricing = c.pricing ?? [];
  const tests = c.tests ?? [];
  const faq = c.faq ?? [];
  const order = c.order ?? [];
  const sections = c.sections ?? {};

  const setFeat = (i: number, p: Partial<WSFeature>) => set({ feats: feats.map((f, j) => (j === i ? { ...f, ...p } : f)) });
  const setStat = (i: number, p: Partial<WSStat>) => set({ stats: stats.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setPlan = (i: number, p: Partial<WSPlan>) => set({ pricing: pricing.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setTest = (i: number, p: Partial<WSTest>) => set({ tests: tests.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  const setFaq = (i: number, p: Partial<WSFaq>) => set({ faq: faq.map((f, j) => (j === i ? { ...f, ...p } : f)) });
  const setStep = (i: number, p: Partial<{ t: string; x: string }>) => set({ steps: steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setMember = (i: number, p: Partial<{ img?: string; name: string; role: string }>) => set({ team: team.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setSpot = (i: number, p: Partial<WSSpot>) => set({ spots: spots.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  // custom pages — structure is always global (use setGlobal, not the page-aware set)
  const setPg = (i: number, p: Partial<NonNullable<WebsiteContent["pages"]>[number]>) =>
    setGlobal({ pages: pages.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "page";
  const uniqueSlug = (base: string) => {
    const reserved = new Set(["about", "contact", "privacy", "terms", "refund", "home", "bio", "store", "courses", "opp", "pay"]);
    const taken = (x: string) => reserved.has(x) || pages.some((p) => p.slug === x);
    let s = base, n = 2;
    while (taken(s)) s = `${base}-${n++}`;
    return s;
  };
  const togglePgSection = (i: number, key: string) => {
    const ord = [...(pages[i].order ?? [])];
    const at = ord.indexOf(key);
    if (at >= 0) ord.splice(at, 1); else ord.push(key); // append → keeps custom order
    setPg(i, { order: ord });
  };
  const movePgSection = (i: number, idx: number, dir: number) => {
    const ord = [...(pages[i].order ?? [])];
    const j = idx + dir; if (j < 0 || j >= ord.length) return;
    [ord[idx], ord[j]] = [ord[j], ord[idx]];
    setPg(i, { order: ord });
  };
  // Quick section toggle — works for Home (visibility) or the page being edited (order).
  // map a section key → its editor panel heading, then open + scroll to that panel
  const PANEL_FOR: Record<string, string> = {
    hero: "Hero", features: "Features", steps: "How it works", spotlight: "Image + text",
    stats: "Stats / counters", banner: "Banner strip", logos: "Logos grid", gallery: "Image slider",
    brands: "Image slider", team: "Team", pricing: "Pricing plans", countdown: "Countdown",
    video: "Video", about: "About", map: "Contact", testimonials: "Testimonials", faq: "FAQ",
    newsletter: "Newsletter", cta: "CTA band", shop: "Products / Shop",
  };
  const openPanel = (key: string | null) => {
    if (!key) return;
    const title = PANEL_FOR[key];
    const root = editorRef.current;
    if (!title || !root) return;
    const secs = Array.from(root.querySelectorAll<HTMLElement>(":scope > .sec"));
    const target = secs.find((s) => s.querySelector(":scope > h3")?.textContent?.trim() === title);
    if (!target) return;
    secs.forEach((s) => s.classList.add("collapsed"));
    target.classList.remove("collapsed");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const onPreviewClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const a = t.closest("a[href]");
    if (a) { const href = a.getAttribute("href") || ""; if (/^https?:|^\//.test(href)) e.preventDefault(); } // don't leave the builder
    const sec = t.closest("[data-sec]");
    if (sec) openPanel(sec.getAttribute("data-sec"));
  };

  const quickOn = (k: string) => onPage ? (pages[targetIdx]?.order ?? []).includes(k) : !!(c.sections?.[k]);
  const quickToggle = (k: string) => {
    if (onPage) togglePgSection(targetIdx, k);
    else set({ sections: { ...(c.sections ?? {}), [k]: !(c.sections?.[k]) } });
  };
  const move = (i: number, dir: number) => {
    const j = i + dir; if (j < 0 || j >= order.length) return;
    const a = [...order]; [a[i], a[j]] = [a[j], a[i]]; set({ order: a });
  };
  const setLegal = (k: string, p: Partial<{ on: boolean; title: string; text: string }>) =>
    set({ legal: { ...c.legal, [k]: { on: false, title: k, text: "", ...c.legal?.[k], ...p } } });

  const setHead = (k: string, p: { title?: string; sub?: string }) =>
    set({ heads: { ...c.heads, [k]: { ...c.heads?.[k], ...p } } });
  // NB: plain function (not a component) so inlining it never remounts/blurs inputs.
  const headFields = (k: string, subLabel = "Subtitle") => (
    <div className="ff">
      <div className="field"><label>Heading</label><input value={c.heads?.[k]?.title ?? ""} onChange={(e) => setHead(k, { title: e.target.value })} /></div>
      <div className="field"><label>{subLabel}</label><input value={c.heads?.[k]?.sub ?? ""} onChange={(e) => setHead(k, { sub: e.target.value })} /></div>
    </div>
  );

  async function save(publish?: boolean) {
    setBusy(true); setMsg(null);
    const res = publish === undefined ? await saveWebsite(cFull as Record<string, unknown>) : await publishWebsite(cFull as Record<string, unknown>, publish);
    setBusy(false);
    if (!res.ok) { setMsg(res.error ?? "Failed"); return; }
    if (publish !== undefined) setStatus(publish ? "published" : "draft");
    setMsg(publish === true ? "Published ✓" : publish === false ? "Unpublished" : "Saved ✓");
    setTimeout(() => setMsg(null), 1800);
  }

  const previewUrl = (publicUrl ? publicUrl.replace("https://", "") : "yoursite.invoxai.io") + (onPage ? `/${editTarget}` : "");
  const Preview = () => (
    <div className="previewwrap">
      <div className={`browser${device === "mobile" ? " mob" : ""}`}>
        <div className="bchrome">
          <span className="bdot" /><span className="bdot" /><span className="bdot" />
          <span className="fav" style={{ background: c.favicon ? `url('${c.favicon}') center/cover` : (ACCENTS[c.accent ?? 0]?.[1]) }} />
          <span className="burl">🔒 {previewUrl}</span>
          <div className="seg pvseg">
            <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")} title="Desktop">🖥</button>
            <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")} title="Mobile">📱</button>
          </div>
        </div>
        <div className="scr" onClick={onPreviewClick} title="Tip: click a section to edit it">
          {device === "web"
            ? <ScaledFrame width={1280}><WebsiteView key={`${c.accent}-${c.bg}-${c.btshape}-${editTarget}`} content={c} device="web" initialPage={onPage ? editTarget : "home"} /></ScaledFrame>
            : <WebsiteView key={`${c.accent}-${c.bg}-${c.btshape}-m-${editTarget}`} content={c} device="mobile" initialPage={onPage ? editTarget : "home"} />}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="dx-phead">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard/website" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>← Website</a>
          <div className="web-seg">
            <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>Builder</button>
            <button className={view === "public" ? "on" : ""} onClick={() => setView("public")}>Public site</button>
          </div>
          {pages.length > 0 && (
            <label className="web-edittarget">Editing
              <select value={editTarget} onChange={(e) => setEditTarget(e.target.value)}>
                <option value="home">Home</option>
                {pages.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
              </select>
            </label>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          {publicUrl && status === "published" && <a className="dx-editbtn" href={publicUrl} target="_blank" rel="noreferrer">View ↗</a>}
          <button className="dx-editbtn" onClick={() => save()} disabled={busy}>Save draft</button>
          {status === "published"
            ? <button className="dx-editbtn" onClick={() => save(false)} disabled={busy}>Unpublish</button>
            : <button className="btn grad" onClick={() => save(true)} disabled={busy}>Publish</button>}
        </div>
      </div>

      {view === "public" && (
        <div className="web-public-view"><WebsiteView key={editTarget} content={c} showBrand stage initialPage={onPage ? editTarget : "home"} /></div>
      )}

      {onPage && view === "edit" && (
        <div className="web-pagebanner">✏️ Editing <b>{pages[targetIdx]?.label}</b> — section content here overrides the home page (just this page). <button onClick={() => setEditTarget("home")}>Back to Home</button></div>
      )}
      <div className="webbuild" style={view === "public" ? { display: "none" } : undefined}>
        <div ref={editorRef} className="webacc">
          {/* Quick sections */}
          <div className="sec">
            <h3>Quick sections</h3>
            <p className="dx-muted" style={{ fontSize: 11, marginBottom: 8 }}>Tap to show / hide sections on {onPage ? "this page" : "the home page"}.</p>
            <div className="chips quickchips">{SECTIONS.map(([k, label]) => (
              <div key={k} className={`chip${quickOn(k) ? " on" : ""}`} onClick={() => quickToggle(k)}>{quickOn(k) ? "✓ " : "+ "}{label}</div>
            ))}</div>
          </div>

          {/* Templates */}
          <div className="sec">
            <h3>Quick-start templates</h3>
            <div className="chips">{TEMPLATES.map((t) => <div key={t.name} className="chip" onClick={() => set(t.patch)}>{t.name}</div>)}</div>
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 8 }}>Applies a design preset — your text and images stay.</p>
          </div>

          {/* Brand */}
          <div className="sec">
            <h3>Brand</h3>
            <Upload ico="🅻" label="Upload logo" value={c.logo} onUrl={(u) => set({ logo: u })} onRemove={() => set({ logo: undefined })} />
            {c.logo && <div className="field"><label>Logo height — {c.logoSize ?? 28}px</label><input type="range" min={18} max={56} value={c.logoSize ?? 28} onChange={(e) => set({ logoSize: +e.target.value })} /></div>}
            <Upload ico="🔖" label="Upload favicon" sub="shown in the browser tab" value={c.favicon} onUrl={(u) => set({ favicon: u })} onRemove={() => set({ favicon: undefined })} />
            <div className="field"><label>Site name (if no logo)</label><input value={c.site ?? ""} onChange={(e) => set({ site: e.target.value })} /></div>
            <div className="field"><label>Accent</label><div className="swatches">{ACCENTS.map((a, i) => <div key={i} className={`sw${!c.accentColor && (c.accent ?? 0) === i ? " on" : ""}`} style={{ background: a[1] }} title={a[0]} onClick={() => set({ accent: i, accentColor: undefined })} />)}</div></div>
            <div className="field"><label>Custom brand color</label><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={c.accentColor || "#ff6a3d"} onChange={(e) => set({ accentColor: e.target.value })} style={{ width: 44, height: 34, padding: 2, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", cursor: "pointer" }} />{c.accentColor ? <button className="dx-editbtn" onClick={() => set({ accentColor: undefined })}>Use a preset</button> : <span className="dx-muted" style={{ fontSize: 12 }}>Pick to override presets</span>}</div></div>
            <div className="field"><label>Background motion</label><div className="chips">{BGS.map((b) => <div key={b[0]} className={`chip${(c.bg ?? "aurora") === b[0] ? " on" : ""}`} onClick={() => set({ bg: b[0] })}>{b[1]}</div>)}</div></div>
            <div className="field"><label>Button shape</label><div className="chips">{BTSHAPES.map((b) => <div key={b[0]} className={`chip${(c.btshape ?? "soft") === b[0] ? " on" : ""}`} onClick={() => set({ btshape: b[0] })}>{b[1]}</div>)}</div></div>
            <div className="field"><label>Heading font</label><div className="chips">{FONTS.map((f) => <div key={f[0]} className={`chip${(c.font ?? "sora") === f[0] ? " on" : ""}`} onClick={() => set({ font: f[0] })}>{f[1]}</div>)}</div></div>
            <div className="field"><label>Color theme</label><div className="chips">{[["light", "Light"], ["dark", "Dark"]].map((t) => <div key={t[0]} className={`chip${(c.theme ?? "light") === t[0] ? " on" : ""}`} onClick={() => set({ theme: t[0] as "light" | "dark" })}>{t[1]}</div>)}</div></div>
            <div className="field"><label>Content width</label><div className="chips">{WIDTHS.map((w) => <div key={w[0]} className={`chip${(c.pageWidth ?? "standard") === w[0] ? " on" : ""}`} onClick={() => set({ pageWidth: w[0] })}>{w[1]}</div>)}</div></div>
            <div className="swrow" style={{ borderTop: 0, paddingBottom: 0, marginBottom: 0 }}><span className="nm">Visitor light/dark toggle</span><Switch on={!!c.themeToggle} onClick={() => set({ themeToggle: !c.themeToggle })} /></div>
          </div>

          {/* Header */}
          <div className="sec">
            <h3>Header / menu</h3>
            <div className="field"><label>Menu style</label><div className="chips">{NAVS.map((n) => <div key={n[0]} className={`chip${(c.nav ?? "a") === n[0] ? " on" : ""}`} onClick={() => set({ nav: n[0] })}>{n[1]}</div>)}</div></div>
            <div className="ff"><div className="field"><label>CTA text</label><input value={c.cta ?? ""} onChange={(e) => set({ cta: e.target.value })} /></div><div className="field"><label>CTA URL</label><input value={c.ctaurl ?? ""} onChange={(e) => set({ ctaurl: e.target.value })} placeholder="/opp/..." /></div></div>
            <div className="swrow" style={{ borderTop: 0 }}><span className="nm">Sticky header on scroll</span><Switch on={c.sticky !== false} onClick={() => set({ sticky: c.sticky === false })} /></div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", margin: "4px 0 6px" }}>Menu items (label + show/hide)</label>
            {(["home", "about", "contact"] as const).map((k) => (
              <div className="frow" key={k}>
                <input value={c.menu?.[k]?.label ?? ""} onChange={(e) => set({ menu: { ...c.menu, [k]: { ...c.menu?.[k], label: e.target.value } } })} placeholder={k} />
                <Switch on={c.menu?.[k]?.on !== false} onClick={() => set({ menu: { ...c.menu, [k]: { ...c.menu?.[k], on: !(c.menu?.[k]?.on !== false) } } })} />
              </div>
            ))}
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", margin: "10px 0 6px" }}>Custom menu links</label>
            {(c.menuLinks ?? []).map((l, i) => (
              <div className="frow" key={i}>
                <input style={{ flex: ".7" }} value={l.label} onChange={(e) => set({ menuLinks: (c.menuLinks ?? []).map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" />
                <input value={l.url} onChange={(e) => set({ menuLinks: (c.menuLinks ?? []).map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} placeholder="https://" />
                <button className="del" onClick={() => set({ menuLinks: (c.menuLinks ?? []).filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="addrow" onClick={() => set({ menuLinks: [...(c.menuLinks ?? []), { label: "New link", url: "" }] })}>+ Add menu link</button>
          </div>

          {/* Custom pages */}
          <div className="sec">
            <h3>Pages</h3>
            <p className="dx-muted" style={{ fontSize: 11, marginBottom: 10 }}>Build extra pages (Services, Pricing…). Each gets its own URL + menu link and shows the sections you choose. Section content is shared with the home page.</p>
            {pages.map((pg, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <div className="frow"><input style={{ flex: ".7" }} value={pg.label} onChange={(e) => setPg(i, { label: e.target.value })} placeholder="Page name" /><button className="del" onClick={() => { setGlobal({ pages: pages.filter((_, j) => j !== i) }); if (editTarget === pg.slug) setEditTarget("home"); }}>✕</button></div>
                <div className="dx-muted" style={{ fontSize: 11, margin: "2px 0 8px" }}>/{pg.slug}</div>
                <div className="swrow" style={{ border: 0, padding: "0 0 8px" }}><span className="nm" style={{ fontSize: 12 }}>Show in menu</span><Switch on={pg.inMenu !== false} onClick={() => setPg(i, { inMenu: !(pg.inMenu !== false) })} /></div>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 6 }}>Page intro (unique to this page)</label>
                <input className="rowfull" value={pg.intro?.title ?? ""} onChange={(e) => setPg(i, { intro: { ...pg.intro, title: e.target.value } })} placeholder="Intro heading" />
                <input className="rowfull" value={pg.intro?.sub ?? ""} onChange={(e) => setPg(i, { intro: { ...pg.intro, sub: e.target.value } })} placeholder="Intro subtitle" />
                <textarea className="rowfull" rows={2} value={pg.intro?.text ?? ""} onChange={(e) => setPg(i, { intro: { ...pg.intro, text: e.target.value } })} placeholder="Intro paragraph (optional)" />
                <Upload ico="🖼️" label="Intro image" value={pg.intro?.img} onUrl={(u) => setPg(i, { intro: { ...pg.intro, img: u } })} onRemove={() => setPg(i, { intro: { ...pg.intro, img: undefined } })} />
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 6 }}>Sections on this page (reorder)</label>
                {(pg.order ?? []).map((k, idx) => (
                  <div className="swrow" key={k} style={{ padding: "6px 0" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 1, marginRight: 2 }}>
                      <button className="ord" disabled={idx === 0} onClick={() => movePgSection(i, idx, -1)}>▲</button>
                      <button className="ord" disabled={idx === (pg.order!.length - 1)} onClick={() => movePgSection(i, idx, 1)}>▼</button>
                    </span>
                    <span className="nm">{LABELS[k] ?? k}</span>
                    <button className="del" onClick={() => togglePgSection(i, k)}>✕</button>
                  </div>
                ))}
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", margin: "8px 0 6px" }}>Add a section</label>
                <div className="chips">{SECTIONS.filter((s) => !(pg.order ?? []).includes(s[0])).map((s) => (
                  <div key={s[0]} className="chip" onClick={() => togglePgSection(i, s[0])}>+ {s[1]}</div>
                ))}</div>
              </div>
            ))}
            <button className="addrow" onClick={() => { const n = pages.length + 1; setGlobal({ pages: [...pages, { slug: uniqueSlug(slugify(`page ${n}`)), label: `Page ${n}`, inMenu: true, order: ["cta"] }] }); }}>+ Add page</button>
          </div>

          {/* Animations & effects */}
          <div className="sec">
            <h3>Animations &amp; effects</h3>
            <div className="field"><label>Section reveal on scroll</label><div className="chips">{REVEALS.map((r) => <div key={r[0]} className={`chip${(c.anim ?? "rise") === r[0] ? " on" : ""}`} onClick={() => set({ anim: r[0] })}>{r[1]}</div>)}</div></div>
            <div className="field"><label>Button animation</label><div className="chips">{BTN_ANIMS.map((b) => <div key={b[0]} className={`chip${(c.btnAnim ?? "shine") === b[0] ? " on" : ""}`} onClick={() => set({ btnAnim: b[0] })}>{b[1]}</div>)}</div></div>
            <div className="field"><label>Section dividers</label><div className="chips">{DIVIDERS.map((d) => <div key={d[0]} className={`chip${(c.divider ?? "none") === d[0] ? " on" : ""}`} onClick={() => set({ divider: d[0] })}>{d[1]}</div>)}</div></div>
            <div className="swrow" style={{ borderTop: 0, paddingBottom: 0 }}><span className="nm">Animated gradient headline</span><Switch on={c.htitleGrad !== false} onClick={() => set({ htitleGrad: c.htitleGrad === false })} /></div>
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 8 }}>Scroll reveal shows on your live published site.</p>
          </div>

          {/* Hero */}
          <div className="sec">
            <h3>Hero</h3>
            <div className="field"><label>Image layout</label><div className="chips">{HERO_LAYOUTS.map((h) => <div key={h[0]} className={`chip${(c.heroLayout ?? "right") === h[0] ? " on" : ""}`} onClick={() => set({ heroLayout: h[0] })}>{h[1]}</div>)}</div></div>
            {(c.heroLayout ?? "right") !== "none" && <Upload ico="🖼️" label="Hero image" value={c.himg} onUrl={(u) => set({ himg: u })} onRemove={() => set({ himg: undefined })} />}
            {(c.heroLayout ?? "right") !== "none" && <div className="field"><label>Hero image height — {c.heroImgH ?? 280}px</label><input type="range" min={180} max={460} value={c.heroImgH ?? 280} onChange={(e) => set({ heroImgH: +e.target.value })} /></div>}
            <div className="field"><label>Background video URL (mp4/webm — overrides image)</label><input value={c.heroVideo ?? ""} onChange={(e) => set({ heroVideo: e.target.value })} placeholder="https://…/clip.mp4" /></div>
            <div className="field"><label>Eyebrow pill</label><input value={c.heroEyebrow ?? ""} onChange={(e) => set({ heroEyebrow: e.target.value })} placeholder="✨ New — limited offer" /></div>
            <div className="field"><label>Typewriter words (comma-separated, overrides eyebrow)</label><input value={c.heroTyping ?? ""} onChange={(e) => set({ heroTyping: e.target.value })} placeholder="Calm, Focus, Growth" /></div>
            <div className="field"><label>Heading</label><textarea rows={2} value={c.htitle ?? ""} onChange={(e) => set({ htitle: e.target.value })} /></div>
            <div className="field"><label>Subheading</label><textarea rows={2} value={c.hsub ?? ""} onChange={(e) => set({ hsub: e.target.value })} /></div>
            <div className="ff"><div className="field"><label>Button 1 text</label><input value={c.hb1 ?? ""} onChange={(e) => set({ hb1: e.target.value })} /></div><div className="field"><label>Button 1 link</label><input value={c.hb1url ?? ""} onChange={(e) => set({ hb1url: e.target.value })} placeholder="/opp/… or https://" /></div></div>
            <div className="ff"><div className="field"><label>Button 2 text</label><input value={c.hb2 ?? ""} onChange={(e) => set({ hb2: e.target.value })} /></div><div className="field"><label>Button 2 link</label><input value={c.hb2url ?? ""} onChange={(e) => set({ hb2url: e.target.value })} placeholder="blank = no link" /></div></div>
            <div className="field"><label>Rating / social-proof line</label><input value={c.heroRating ?? ""} onChange={(e) => set({ heroRating: e.target.value })} placeholder="Rated 4.9/5 by 2,000+ members" /></div>
            <div className="swrow" style={{ borderTop: 0, padding: 0 }}><span className="nm">Gradient hero background</span><Switch on={!!c.heroBg} onClick={() => set({ heroBg: !c.heroBg })} /></div>
          </div>

          {/* Sections reorder + toggle */}
          <div className="sec">
            <h3>Sections</h3>
            <div className="swrow"><span className="nm">Alternating section tint</span><Switch on={c.tint !== false} onClick={() => set({ tint: c.tint === false })} /></div>
            {order.map((k, i) => (
              <div className="swrow" key={k}>
                <span style={{ display: "flex", flexDirection: "column", gap: 1, marginRight: 2 }}>
                  <button className="ord" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                  <button className="ord" disabled={i === order.length - 1} onClick={() => move(i, 1)}>▼</button>
                </span>
                <span className="nm">{LABELS[k]}</span>
                <select value={c.secStyle?.[k] ?? "auto"} onChange={(e) => set({ secStyle: { ...c.secStyle, [k]: e.target.value } })} title="Background" style={{ width: 66, padding: "5px 3px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", color: "var(--text)", fontSize: 11, marginRight: 5 }}>
                  {SEC_STYLES.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
                </select>
                <select value={c.secPad?.[k] ?? "md"} onChange={(e) => set({ secPad: { ...c.secPad, [k]: e.target.value } })} title="Spacing" style={{ width: 72, padding: "5px 3px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", color: "var(--text)", fontSize: 11, marginRight: 5 }}>
                  {PADS.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
                </select>
                {GRID_SECTIONS.has(k) && <select value={c.secCols?.[k] ?? 0} onChange={(e) => set({ secCols: { ...c.secCols, [k]: +e.target.value } })} title="Columns" style={{ width: 50, padding: "5px 3px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", color: "var(--text)", fontSize: 11, marginRight: 5 }}>
                  <option value={0}>Cols</option>{[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>}
                {c.secBgImg?.[k]
                  ? <button className="ord" title="Remove background image" style={{ width: 24, height: 22, background: "var(--primary)", color: "#fff", marginRight: 5 }} onClick={() => { const mm = { ...c.secBgImg }; delete mm[k]; set({ secBgImg: mm }); }}>🖼</button>
                  : <label className="ord" title="Background image" style={{ width: 24, height: 22, display: "grid", placeItems: "center", cursor: "pointer", marginRight: 5 }}>🖼<input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const u = await upload(f); if (u) set({ secBgImg: { ...c.secBgImg, [k]: u } }); }} /></label>}
                <Switch on={!!sections[k]} onClick={() => set({ sections: { ...sections, [k]: !sections[k] } })} />
              </div>
            ))}
          </div>

          {/* Announcement & add-ons */}
          <div className="sec">
            <h3>Announcement &amp; add-ons</h3>
            <div className="swrow"><span className="nm">Announcement bar</span><Switch on={!!c.announce?.on} onClick={() => set({ announce: { ...c.announce!, on: !c.announce?.on } })} /></div>
            <div className="field"><label>Announcement text</label><input value={c.announce?.text ?? ""} onChange={(e) => set({ announce: { ...c.announce!, text: e.target.value } })} /></div>
            <div className="field"><label>Announcement link text</label><input value={c.announce?.cta ?? ""} onChange={(e) => set({ announce: { ...c.announce!, cta: e.target.value } })} /></div>
            <div className="swrow"><span className="nm">Floating chat button</span><Switch on={!!c.whatsapp?.on} onClick={() => set({ whatsapp: { ...c.whatsapp!, on: !c.whatsapp?.on } })} /></div>
            <div className="ff"><div className="field" style={{ flex: ".4" }}><label>Icon</label><input value={c.whatsapp?.icon ?? ""} onChange={(e) => set({ whatsapp: { ...c.whatsapp!, icon: e.target.value } })} placeholder="💬" /></div><div className="field"><label>WhatsApp number</label><input value={c.whatsapp?.number ?? ""} onChange={(e) => set({ whatsapp: { ...c.whatsapp!, number: e.target.value } })} placeholder="+91…" /></div></div>
            <div className="field"><label>Button label (optional)</label><input value={c.whatsapp?.label ?? ""} onChange={(e) => set({ whatsapp: { ...c.whatsapp!, label: e.target.value } })} placeholder="Chat with us" /></div>
            <div className="field"><label>Custom link (overrides number)</label><input value={c.whatsapp?.link ?? ""} onChange={(e) => set({ whatsapp: { ...c.whatsapp!, link: e.target.value } })} placeholder="https://t.me/… or any URL" /></div>
            <div className="swrow"><span className="nm">Cookie banner</span><Switch on={!!c.cookie?.on} onClick={() => set({ cookie: { on: !c.cookie?.on } })} /></div>
            <div className="swrow"><span className="nm">Back-to-top button</span><Switch on={c.backTop !== false} onClick={() => set({ backTop: !(c.backTop !== false) })} /></div>
            <div className="swrow"><span className="nm">Scroll progress bar</span><Switch on={!!c.scrollProgress} onClick={() => set({ scrollProgress: !c.scrollProgress })} /></div>
            <div className="swrow"><span className="nm">Login / Sign-up buttons</span><Switch on={!!c.auth?.on} onClick={() => set({ auth: { ...c.auth, on: !c.auth?.on } })} /></div>
            {c.auth?.on && <>
              <div className="field"><label>Log in link</label><input value={c.auth?.loginUrl ?? ""} onChange={(e) => set({ auth: { ...c.auth, loginUrl: e.target.value } })} placeholder="/login or https://" /></div>
              <div className="field"><label>Sign up link</label><input value={c.auth?.signupUrl ?? ""} onChange={(e) => set({ auth: { ...c.auth, signupUrl: e.target.value } })} placeholder="/signup or https://" /></div>
              <div className="field"><label>My-account link (shows “My account” when set)</label><input value={c.auth?.accountUrl ?? ""} onChange={(e) => set({ auth: { ...c.auth, accountUrl: e.target.value } })} placeholder="/account" /></div>
            </>}
            <div className="field" style={{ marginTop: 10 }}><label>Social handles</label><div className="ff"><input value={c.social?.ig ?? ""} onChange={(e) => set({ social: { ...c.social, ig: e.target.value } })} placeholder="Instagram" /><input value={c.social?.yt ?? ""} onChange={(e) => set({ social: { ...c.social, yt: e.target.value } })} placeholder="YouTube" /></div></div>
            <div className="ff" style={{ marginBottom: 0 }}><input className="rowfull" style={{ marginBottom: 0 }} value={c.social?.x ?? ""} onChange={(e) => set({ social: { ...c.social, x: e.target.value } })} placeholder="X" /><input className="rowfull" style={{ marginBottom: 0 }} value={c.social?.tg ?? ""} onChange={(e) => set({ social: { ...c.social, tg: e.target.value } })} placeholder="Telegram" /></div>
          </div>

          {/* Features */}
          <div className="sec">
            <h3>Features</h3>
            {headFields("features")}
            {feats.map((f, i) => (
              <div key={i}>
                <div className="frow">
                  <select value={f.ic} onChange={(e) => setFeat(i, { ic: e.target.value })}>{ICONS.map((ic) => <option key={ic}>{ic}</option>)}</select>
                  <input value={f.t} onChange={(e) => setFeat(i, { t: e.target.value })} placeholder="Title" />
                  <button className="del" onClick={() => set({ feats: feats.filter((_, j) => j !== i) })}>✕</button>
                </div>
                <input className="rowfull" value={f.x} onChange={(e) => setFeat(i, { x: e.target.value })} placeholder="Description" />
              </div>
            ))}
            <button className="addrow" onClick={() => set({ feats: [...feats, { ic: "⭐", t: "New feature", x: "Describe it." }] })}>+ Add feature</button>
          </div>

          {/* Image + text spotlight */}
          <div className="sec">
            <h3>Image + text</h3>
            {headFields("spotlight")}
            {spots.map((s, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 9, marginBottom: 9 }}>
                <div className="frow"><input value={s.title} onChange={(e) => setSpot(i, { title: e.target.value })} placeholder="Title" /><button className="del" onClick={() => set({ spots: spots.filter((_, j) => j !== i) })}>✕</button></div>
                <input className="rowfull" value={s.text} onChange={(e) => setSpot(i, { text: e.target.value })} placeholder="Text" />
                <Upload ico="🖼️" label="Image" value={s.img} onUrl={(u) => setSpot(i, { img: u })} onRemove={() => setSpot(i, { img: undefined })} />
              </div>
            ))}
            <button className="addrow" onClick={() => set({ spots: [...spots, { title: "New row", text: "Describe it." }] })}>+ Add row</button>
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 8 }}>Rows alternate image left / right automatically.</p>
          </div>

          {/* Banner strip */}
          <div className="sec">
            <h3>Banner strip</h3>
            <div className="field"><label>Text</label><input value={c.banner?.text ?? ""} onChange={(e) => set({ banner: { ...c.banner, text: e.target.value } })} /></div>
            <div className="ff"><div className="field"><label>Button text</label><input value={c.banner?.cta ?? ""} onChange={(e) => set({ banner: { ...c.banner, cta: e.target.value } })} /></div><div className="field"><label>Button link</label><input value={c.banner?.url ?? ""} onChange={(e) => set({ banner: { ...c.banner, url: e.target.value } })} placeholder="#" /></div></div>
          </div>

          {/* Steps / how it works */}
          <div className="sec">
            <h3>How it works</h3>
            {headFields("steps")}
            <div className="field"><label>Design</label><div className="chips">{STEP_STYLES.map((s) => <div key={s[0]} className={`chip${(c.stepStyle ?? "cards") === s[0] ? " on" : ""}`} onClick={() => set({ stepStyle: s[0] })}>{s[1]}</div>)}</div></div>
            {steps.map((s, i) => (
              <div key={i}>
                <div className="frow">
                  <span className="del" style={{ display: "grid", placeItems: "center", background: "var(--surface2)" }}>{i + 1}</span>
                  <input value={s.t} onChange={(e) => setStep(i, { t: e.target.value })} placeholder="Step title" />
                  <button className="del" onClick={() => set({ steps: steps.filter((_, j) => j !== i) })}>✕</button>
                </div>
                <input className="rowfull" value={s.x} onChange={(e) => setStep(i, { x: e.target.value })} placeholder="Step description" />
              </div>
            ))}
            <button className="addrow" onClick={() => set({ steps: [...steps, { t: "New step", x: "Describe it." }] })}>+ Add step</button>
          </div>

          {/* Stats */}
          <div className="sec">
            <h3>Stats / counters</h3>
            <div className="swrow" style={{ borderTop: 0, padding: "0 0 8px" }}><span className="nm">Count-up animation</span><Switch on={c.statsCount !== false} onClick={() => set({ statsCount: !(c.statsCount !== false) })} /></div>
            {stats.map((s, i) => (
              <div className="frow" key={i}>
                <input style={{ flex: ".5" }} value={s.n} onChange={(e) => setStat(i, { n: e.target.value })} placeholder="10,000+" />
                <input value={s.l} onChange={(e) => setStat(i, { l: e.target.value })} placeholder="Students" />
                <button className="del" onClick={() => set({ stats: stats.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="addrow" onClick={() => set({ stats: [...stats, { n: "0", l: "Label" }] })}>+ Add stat</button>
          </div>

          {/* Pricing */}
          <div className="sec">
            <h3>Pricing plans</h3>
            {headFields("pricing")}
            <div className="swrow" style={{ borderTop: 0, padding: "0 0 8px" }}><span className="nm">Monthly / yearly toggle</span><Switch on={!!c.pricingYearly} onClick={() => set({ pricingYearly: !c.pricingYearly })} /></div>
            {pricing.map((p, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 9, marginBottom: 9 }}>
                <div className="frow" style={{ marginBottom: 6 }}>
                  <input style={{ flex: ".6" }} value={p.n} onChange={(e) => setPlan(i, { n: e.target.value })} placeholder="Plan" />
                  <input value={p.p} onChange={(e) => setPlan(i, { p: e.target.value })} placeholder="₹499/mo" />
                  <button className="del" onClick={() => set({ pricing: pricing.filter((_, j) => j !== i) })}>✕</button>
                </div>
                {c.pricingYearly && <input className="rowfull" value={p.py ?? ""} onChange={(e) => setPlan(i, { py: e.target.value })} placeholder="Yearly price (e.g. ₹4,990/yr)" />}
                <input className="rowfull" value={p.f} onChange={(e) => setPlan(i, { f: e.target.value })} placeholder="Feature, Feature, ..." />
                <input className="rowfull" value={p.url ?? ""} onChange={(e) => setPlan(i, { url: e.target.value })} placeholder="Payment / checkout link (blank = uses CTA link)" />
                <div className="swrow" style={{ border: 0, padding: 0 }}><span className="nm" style={{ fontWeight: 500, fontSize: 12 }}>Mark as popular</span>
                  <Switch on={!!p.pop} onClick={() => set({ pricing: pricing.map((x, j) => ({ ...x, pop: j === i ? !x.pop : false })) })} /></div>
              </div>
            ))}
            <button className="addrow" onClick={() => set({ pricing: [...pricing, { n: "New plan", p: "₹0", f: "Feature", pop: false }] })}>+ Add plan</button>
          </div>

          {/* Shop / products */}
          <div className="sec">
            <h3>Products / Shop</h3>
            {headFields("shop")}
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 4 }}>This section automatically shows your <b>published one-page products</b> as cards linking to checkout. Create them under One-page products. The preview shows samples.</p>
          </div>

          {/* Video */}
          <div className="sec">
            <h3>Video</h3>
            <div className="field"><label>Section title</label><input value={c.video?.title ?? ""} onChange={(e) => set({ video: { url: c.video?.url ?? "", title: e.target.value } })} /></div>
            <div className="field"><label>YouTube URL</label><input value={c.video?.url ?? ""} onChange={(e) => set({ video: { title: c.video?.title ?? "", url: e.target.value } })} placeholder="https://youtube.com/watch?v=…" /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Video width — {c.vidW ?? 760}px</label><input type="range" min={420} max={1100} value={c.vidW ?? 760} onChange={(e) => set({ vidW: +e.target.value })} /></div>
          </div>

          {/* Image slider */}
          <div className="sec">
            <h3>Image slider</h3>
            {headFields("gallery")}
            <div className="field"><label>Layout</label><div className="chips">{GAL_STYLES.map((s) => <div key={s[0]} className={`chip${(c.galStyle ?? "slider") === s[0] ? " on" : ""}`} onClick={() => set({ galStyle: s[0] })}>{s[1]}</div>)}</div></div>
            <div className="swrow" style={{ borderTop: 0, padding: "0 0 8px" }}><span className="nm">Auto-play slider</span><Switch on={c.galAuto !== false} onClick={() => set({ galAuto: !(c.galAuto !== false) })} /></div>
            <div className="field"><label>Slide height — {c.galH ?? 280}px</label><input type="range" min={180} max={480} value={c.galH ?? 280} onChange={(e) => set({ galH: +e.target.value })} /></div>
            <label className="up"><span className="ico">➕</span><span className="t">Add slide image</span>
              <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const u = await upload(f); if (u) set({ gallery: [...(c.gallery ?? []), u] }); }} />
            </label>
            {(c.gallery ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 9 }}>
                {(c.gallery ?? []).map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <span key={i} style={{ position: "relative" }}><img src={g} alt="" style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                    <button className="del" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, padding: 0, fontSize: 10 }} onClick={() => set({ gallery: (c.gallery ?? []).filter((_, j) => j !== i) })}>✕</button></span>
                ))}
              </div>
            )}
            <div className="field"><label>Brand slider names</label><input value={c.brands ?? ""} onChange={(e) => set({ brands: e.target.value })} placeholder="Forbes, Mindful, …" /></div>
            <label className="up"><span className="ico">🏷️</span><span className="t">Add brand logo (image)</span>
              <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const u = await upload(f); if (u) set({ brandLogos: [...(c.brandLogos ?? []), u] }); }} />
            </label>
            {(c.brandLogos ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(c.brandLogos ?? []).map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <span key={i} style={{ position: "relative" }}><img src={g} alt="" style={{ width: 48, height: 30, objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)" }} />
                    <button className="del" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, padding: 0, fontSize: 10 }} onClick={() => set({ brandLogos: (c.brandLogos ?? []).filter((_, j) => j !== i) })}>✕</button></span>
                ))}
              </div>
            )}
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 8 }}>Logos uploaded → slider auto-loops images; else it scrolls the names above.</p>
          </div>

          {/* Logos grid */}
          <div className="sec">
            <h3>Logos grid</h3>
            {headFields("logos")}
            <label className="up"><span className="ico">➕</span><span className="t">Add logo image</span>
              <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const u = await upload(f); if (u) set({ logos: [...(c.logos ?? []), u] }); }} />
            </label>
            {(c.logos ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(c.logos ?? []).map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <span key={i} style={{ position: "relative" }}><img src={g} alt="" style={{ width: 48, height: 32, objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)" }} />
                    <button className="del" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, padding: 0, fontSize: 10 }} onClick={() => set({ logos: (c.logos ?? []).filter((_, j) => j !== i) })}>✕</button></span>
                ))}
              </div>
            )}
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 8 }}>No logos uploaded → falls back to your brand names.</p>
          </div>

          {/* Team */}
          <div className="sec">
            <h3>Team</h3>
            {headFields("team")}
            {team.map((mb, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 9, marginBottom: 9 }}>
                <div className="frow"><input style={{ flex: ".6" }} value={mb.name} onChange={(e) => setMember(i, { name: e.target.value })} placeholder="Name" /><input value={mb.role} onChange={(e) => setMember(i, { role: e.target.value })} placeholder="Role" /><button className="del" onClick={() => set({ team: team.filter((_, j) => j !== i) })}>✕</button></div>
                <Upload ico="👤" label="Photo" value={mb.img} onUrl={(u) => setMember(i, { img: u })} onRemove={() => setMember(i, { img: undefined })} />
              </div>
            ))}
            <button className="addrow" onClick={() => set({ team: [...team, { name: "New member", role: "Role" }] })}>+ Add member</button>
          </div>

          {/* Countdown */}
          <div className="sec">
            <h3>Countdown</h3>
            <div className="field"><label>Design</label><div className="chips">{CD_STYLES.map((s) => <div key={s[0]} className={`chip${(c.cdStyle ?? "cards") === s[0] ? " on" : ""}`} onClick={() => set({ cdStyle: s[0] })}>{s[1]}</div>)}</div></div>
            <div className="field"><label>Title</label><input value={c.countdown?.title ?? ""} onChange={(e) => set({ countdown: { ...c.countdown, title: e.target.value } })} /></div>
            <div className="field"><label>Subtitle</label><input value={c.countdown?.sub ?? ""} onChange={(e) => set({ countdown: { ...c.countdown, sub: e.target.value } })} /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>End date &amp; time (blank = rolling 47h)</label><input type="datetime-local" value={c.countdown?.date ?? ""} onChange={(e) => set({ countdown: { ...c.countdown, date: e.target.value } })} /></div>
          </div>

          {/* Testimonials */}
          <div className="sec">
            <h3>Testimonials</h3>
            {headFields("testimonials")}
            <div className="field"><label>Layout</label><div className="chips">{TEST_STYLES.map((s) => <div key={s[0]} className={`chip${(c.testStyle ?? "grid") === s[0] ? " on" : ""}`} onClick={() => set({ testStyle: s[0] })}>{s[1]}</div>)}</div></div>
            {tests.map((t, i) => (
              <div key={i}>
                <div className="frow">
                  <input style={{ flex: ".5" }} value={t.n} onChange={(e) => setTest(i, { n: e.target.value })} placeholder="Name" />
                  <input value={t.r} onChange={(e) => setTest(i, { r: e.target.value })} placeholder="Role" />
                  <button className="del" onClick={() => set({ tests: tests.filter((_, j) => j !== i) })}>✕</button>
                </div>
                <input className="rowfull" value={t.q} onChange={(e) => setTest(i, { q: e.target.value })} placeholder="Quote" />
              </div>
            ))}
            <button className="addrow" onClick={() => set({ tests: [...tests, { n: "Name", r: "Customer", q: "Great!" }] })}>+ Add testimonial</button>
          </div>

          {/* FAQ */}
          <div className="sec">
            <h3>FAQ</h3>
            {headFields("faq")}
            {faq.map((f, i) => (
              <div key={i}>
                <div className="frow"><input value={f.q} onChange={(e) => setFaq(i, { q: e.target.value })} placeholder="Question" /><button className="del" onClick={() => set({ faq: faq.filter((_, j) => j !== i) })}>✕</button></div>
                <input className="rowfull" value={f.a} onChange={(e) => setFaq(i, { a: e.target.value })} placeholder="Answer" />
              </div>
            ))}
            <button className="addrow" onClick={() => set({ faq: [...faq, { q: "Question?", a: "Answer." }] })}>+ Add question</button>
          </div>

          {/* Newsletter */}
          <div className="sec">
            <h3>Newsletter</h3>
            <div className="field"><label>Title</label><input value={c.news?.title ?? ""} onChange={(e) => set({ news: { ...c.news!, title: e.target.value } })} /></div>
            <div className="field"><label>Subtitle</label><input value={c.news?.sub ?? ""} onChange={(e) => set({ news: { ...c.news!, sub: e.target.value } })} /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Button</label><input value={c.news?.btn ?? ""} onChange={(e) => set({ news: { ...c.news!, btn: e.target.value } })} /></div>
          </div>

          {/* About */}
          <div className="sec">
            <h3>About</h3>
            <Upload ico="🖼️" label="About image" value={c.about?.img} onUrl={(u) => set({ about: { ...c.about!, img: u } })} onRemove={() => set({ about: { ...c.about!, img: undefined } })} />
            <div className="field"><label>Title</label><input value={c.about?.title ?? ""} onChange={(e) => set({ about: { ...c.about!, title: e.target.value } })} /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Text</label><textarea rows={3} value={c.about?.text ?? ""} onChange={(e) => set({ about: { ...c.about!, text: e.target.value } })} /></div>
          </div>

          {/* CTA band */}
          <div className="sec">
            <h3>CTA band</h3>
            <div className="field"><label>Title</label><input value={c.ctaBand?.title ?? ""} onChange={(e) => set({ ctaBand: { ...c.ctaBand!, title: e.target.value } })} /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Subtitle</label><input value={c.ctaBand?.sub ?? ""} onChange={(e) => set({ ctaBand: { ...c.ctaBand!, sub: e.target.value } })} /></div>
          </div>

          {/* Contact */}
          <div className="sec">
            <h3>Contact</h3>
            {headFields("contact")}
            <div className="field"><label>Page design</label><div className="chips">{CONTACT_STYLES.map((s) => <div key={s[0]} className={`chip${(c.contactStyle ?? "split") === s[0] ? " on" : ""}`} onClick={() => set({ contactStyle: s[0] })}>{s[1]}</div>)}</div></div>
            <div className="field"><label>Email</label><input value={c.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></div>
            <div className="ff"><div className="field"><label>Phone</label><input value={c.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} /></div><div className="field"><label>City</label><input value={c.city ?? ""} onChange={(e) => set({ city: e.target.value })} /></div></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Map address (for the Map section — blank uses City)</label><input value={c.mapAddr ?? ""} onChange={(e) => set({ mapAddr: e.target.value })} placeholder="123 Main St, Mumbai" /></div>
          </div>

          {/* SEO */}
          <div className="sec">
            <h3>SEO &amp; sharing</h3>
            <div className="field"><label>Meta title</label><input value={c.seo?.title ?? ""} onChange={(e) => set({ seo: { ...c.seo, title: e.target.value } })} placeholder={c.site || "Page title"} /></div>
            <div className="field"><label>Meta description</label><textarea rows={2} value={c.seo?.description ?? ""} onChange={(e) => set({ seo: { ...c.seo, description: e.target.value } })} placeholder="One line shown in Google results." /></div>
            <Upload ico="🔗" label="Share image (OG)" sub="1200×630 — used in link previews" value={c.seo?.ogImage} onUrl={(u) => set({ seo: { ...c.seo, ogImage: u } })} onRemove={() => set({ seo: { ...c.seo, ogImage: undefined } })} />
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", margin: "6px 0 6px" }}>Search result preview</label>
            <div className="seo-google">
              <div className="g-url">{previewUrl}</div>
              <div className="g-title">{c.seo?.title || c.site || "Page title"}</div>
              <div className="g-desc">{c.seo?.description || "Add a meta description to control the text shown here in Google."}</div>
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, display: "block", margin: "12px 0 6px" }}>Social share preview</label>
            <div className="seo-og">
              {c.seo?.ogImage
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.seo.ogImage} alt="" />
                : <div className="og-ph" style={{ background: c.accentColor ? `linear-gradient(135deg, ${c.accentColor}, #000)` : (ACCENTS[c.accent ?? 0]?.[1]) }}>1200×630</div>}
              <div className="og-meta"><span>{previewUrl.split("/")[0]}</span><b>{c.seo?.title || c.site || "Page title"}</b><span className="d">{c.seo?.description || "Description shown when shared on social."}</span></div>
            </div>
          </div>

          {/* Legal */}
          <div className="sec" style={{ marginBottom: 0 }}>
            <h3>Legal policies</h3>
            {LEGAL_DOCS.map(([k, deflabel]) => {
              const d = c.legal?.[k] ?? { on: false, title: deflabel, text: "" };
              return (
                <div key={k}>
                  <div className="swrow"><input value={d.title} onChange={(e) => setLegal(k, { title: e.target.value })} placeholder={deflabel} /><Switch on={d.on} onClick={() => setLegal(k, { on: !d.on })} /></div>
                  <textarea className="rowfull" rows={2} value={d.text} onChange={(e) => setLegal(k, { text: e.target.value })} placeholder="Policy text…" />
                </div>
              );
            })}
          </div>
        </div>

        {Preview()}
      </div>
    </>
  );
}
