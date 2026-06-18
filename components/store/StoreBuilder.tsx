"use client";

import { useState, useRef, useEffect } from "react";
import StoreView from "./StoreView";
import {
  type StoreContent, type StoreBanner, ACCENTS, BTSHAPES, FONTS, WIDTHS,
  STORE_SECTIONS, STORE_LABELS, DISPLAYS, STORE_COLS,
} from "@/lib/store";
import { saveStore, publishStore } from "@/app/dashboard/store/actions";

async function upload(file: File): Promise<string | null> {
  const fd = new FormData(); fd.append("file", file);
  try { const res = await fetch("/api/upload", { method: "POST", body: fd }); const j = await res.json(); return res.ok ? (j.url as string) : null; } catch { return null; }
}
function Upload({ ico, label, value, onUrl, onRemove }: { ico: string; label: string; value?: string; onUrl: (u: string) => void; onRemove?: () => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); const u = await upload(f); setBusy(false); if (u) onUrl(u); };
  if (value) return (
    <div className="up up-has">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="up-prev" src={value} alt="" />
      <div className="up-actions"><span className="t">{busy ? "Uploading…" : label.replace(/^Upload /, "")}</span><div style={{ display: "flex", gap: 6 }}><label className="up-btn">Change<input type="file" accept="image/*" onChange={pick} /></label>{onRemove && <button type="button" className="up-btn danger" onClick={onRemove}>Remove</button>}</div></div>
    </div>
  );
  return <label className="up"><span className="ico">{busy ? "…" : ico}</span><span className="t">{label}</span><input type="file" accept="image/*" onChange={pick} /></label>;
}
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) { return <button type="button" className={`switch${on ? " on" : ""}`} onClick={onClick}><i /></button>; }

function ScaledFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: width, z: 1 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => { const cw = el.clientWidth; const W = Math.max(cw, width); setDims({ w: W, z: Math.min(1, cw / W) }); };
    update(); const ro = new ResizeObserver(update); ro.observe(el); return () => ro.disconnect();
  }, [width]);
  return <div ref={ref} style={{ width: "100%", overflow: "hidden" }}><div style={{ width: dims.w, zoom: dims.z, transformOrigin: "top left" } as React.CSSProperties}>{children}</div></div>;
}

export default function StoreBuilder({ initial, publicUrl, initialStatus }: { initial: StoreContent; publicUrl: string | null; initialStatus: string }) {
  const [c, setC] = useState<StoreContent>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "public">("edit");
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const set = (patch: Partial<StoreContent>) => setC((p) => ({ ...p, ...patch }));

  const order = c.order ?? [];
  const sections = c.sections ?? {};
  const banner = c.banner ?? [];
  const legal = c.legal ?? {};
  const setBanner = (i: number, p: Partial<StoreBanner>) => set({ banner: banner.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= order.length) return; const a = [...order]; [a[i], a[j]] = [a[j], a[i]]; set({ order: a }); };
  const setLegal = (k: string, p: Partial<{ on: boolean; title: string; text: string }>) => set({ legal: { ...legal, [k]: { ...legal[k], ...p } } });

  async function save(publish?: boolean) {
    setBusy(true); setMsg(null);
    const res = publish === undefined ? await saveStore(c as Record<string, unknown>) : await publishStore(c as Record<string, unknown>, publish);
    setBusy(false);
    if (!res.ok) { setMsg(res.error ?? "Failed"); return; }
    if (publish !== undefined) setStatus(publish ? "published" : "draft");
    setMsg(publish === true ? "Published ✓" : publish === false ? "Unpublished" : "Saved ✓");
    setTimeout(() => setMsg(null), 1800);
  }

  const Preview = () => (
    <div className="previewwrap">
      <div className={`browser${device === "mobile" ? " mob" : ""}`}>
        <div className="bchrome"><span className="bdot" /><span className="bdot" /><span className="bdot" /><span className="fav" style={{ background: ACCENTS[c.accent ?? 0]?.[1] }} /><span className="burl">{(publicUrl ? publicUrl.replace("https://", "") : "yourstore.invoxai.io") + "/store"}</span>
          <div className="seg pvseg"><button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>🖥</button><button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>📱</button></div>
        </div>
        <div className="scr">{device === "web"
          ? <ScaledFrame width={1280}><StoreView key={`${c.accent}-${c.btshape}`} content={c} device="web" /></ScaledFrame>
          : <StoreView key={`${c.accent}-${c.btshape}-m`} content={c} device="mobile" />}</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="dx-phead">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard/store" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>← Store</a>
          <div className="web-seg"><button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>Builder</button><button className={view === "public" ? "on" : ""} onClick={() => setView("public")}>Public store</button></div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          {publicUrl && status === "published" && <a className="dx-editbtn" href={`${publicUrl}/store`} target="_blank" rel="noreferrer">View ↗</a>}
          <button className="dx-editbtn" onClick={() => save()} disabled={busy}>Save draft</button>
          {status === "published" ? <button className="dx-editbtn" onClick={() => save(false)} disabled={busy}>Unpublish</button> : <button className="btn grad" onClick={() => save(true)} disabled={busy}>Publish</button>}
        </div>
      </div>

      {view === "public" && <div className="web-public-view"><StoreView content={c} stage /></div>}

      <div className="webbuild" style={view === "public" ? { display: "none" } : undefined}>
        <div className="webacc">
          {/* Brand */}
          <div className="sec">
            <h3>Brand &amp; theme</h3>
            <Upload ico="🅻" label="Upload logo" value={c.logo} onUrl={(u) => set({ logo: u })} onRemove={() => set({ logo: undefined })} />
            <div className="field"><label>Store name</label><input value={c.store ?? ""} onChange={(e) => set({ store: e.target.value })} /></div>
            <div className="field"><label>Tagline</label><input value={c.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value })} /></div>
            <div className="field"><label>Menu links (comma separated)</label><input value={(c.menu ?? []).join(", ")} onChange={(e) => set({ menu: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></div>
            <div className="field"><label>Accent</label><div className="swatches">{ACCENTS.map((a, i) => <div key={i} className={`sw${!c.accentColor && (c.accent ?? 0) === i ? " on" : ""}`} style={{ background: a[1] }} title={a[0]} onClick={() => set({ accent: i, accentColor: undefined })} />)}</div></div>
            <div className="field"><label>Custom brand color</label><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={c.accentColor || "#ff6a3d"} onChange={(e) => set({ accentColor: e.target.value })} style={{ width: 44, height: 34, padding: 2, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }} />{c.accentColor && <button className="dx-editbtn" onClick={() => set({ accentColor: undefined })}>Use preset</button>}</div></div>
            <div className="field"><label>Heading font</label><div className="chips">{FONTS.map((f) => <div key={f[0]} className={`chip${(c.font ?? "sora") === f[0] ? " on" : ""}`} onClick={() => set({ font: f[0] })}>{f[1]}</div>)}</div></div>
            <div className="field"><label>Color theme</label><div className="chips">{[["light", "Light"], ["dark", "Dark"]].map((t) => <div key={t[0]} className={`chip${(c.theme ?? "light") === t[0] ? " on" : ""}`} onClick={() => set({ theme: t[0] as "light" | "dark" })}>{t[1]}</div>)}</div></div>
            <div className="field"><label>Content width</label><div className="chips">{WIDTHS.map((w) => <div key={w[0]} className={`chip${(c.pageWidth ?? "wide") === w[0] ? " on" : ""}`} onClick={() => set({ pageWidth: w[0] })}>{w[1]}</div>)}</div></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Button shape</label><div className="chips">{BTSHAPES.map((b) => <div key={b[0]} className={`chip${(c.btshape ?? "soft") === b[0] ? " on" : ""}`} onClick={() => set({ btshape: b[0] })}>{b[1]}</div>)}</div></div>
          </div>

          {/* Sections */}
          <div className="sec">
            <h3>Sections (toggle &amp; reorder)</h3>
            {order.map((k, i) => (
              <div className="swrow" key={k}>
                <span style={{ display: "flex", flexDirection: "column", gap: 1, marginRight: 2 }}><button className="ord" disabled={i === 0} onClick={() => move(i, -1)}>▲</button><button className="ord" disabled={i === order.length - 1} onClick={() => move(i, 1)}>▼</button></span>
                <span className="nm">{STORE_LABELS[k]}</span>
                <Switch on={!!sections[k]} onClick={() => set({ sections: { ...sections, [k]: !sections[k] } })} />
              </div>
            ))}
          </div>

          {/* Banner slider */}
          <div className="sec">
            <h3>Top banner slider</h3>
            {banner.map((b, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 9, marginBottom: 9 }}>
                <Upload ico="🖼️" label="Slide image" value={b.img} onUrl={(u) => setBanner(i, { img: u })} onRemove={() => setBanner(i, { img: undefined })} />
                <input className="rowfull" value={b.heading} onChange={(e) => setBanner(i, { heading: e.target.value })} placeholder="Heading" />
                <input className="rowfull" value={b.sub} onChange={(e) => setBanner(i, { sub: e.target.value })} placeholder="Subtext" />
                <div className="ff"><input className="rowfull" style={{ marginBottom: 0 }} value={b.cta} onChange={(e) => setBanner(i, { cta: e.target.value })} placeholder="Button text" /><input className="rowfull" style={{ marginBottom: 0 }} value={b.url ?? ""} onChange={(e) => setBanner(i, { url: e.target.value })} placeholder="Button link" /></div>
                <button className="addrow" style={{ marginTop: 8, color: "var(--secondary)" }} onClick={() => set({ banner: banner.filter((_, j) => j !== i) })}>Remove slide</button>
              </div>
            ))}
            <button className="addrow" onClick={() => set({ banner: [...banner, { heading: "New banner", sub: "Add your message", cta: "Shop now", url: "#" }] })}>+ Add banner slide</button>
          </div>

          {/* Brand slider */}
          <div className="sec">
            <h3>Brand logo slider</h3>
            <div className="field"><label>Brand names</label><input value={c.brands ?? ""} onChange={(e) => set({ brands: e.target.value })} placeholder="Forbes, Mindful, …" /></div>
            <label className="up"><span className="ico">🏷️</span><span className="t">Add brand logo</span><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const u = await upload(f); if (u) set({ brandLogos: [...(c.brandLogos ?? []), u] }); }} /></label>
            {(c.brandLogos ?? []).length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(c.brandLogos ?? []).map((g, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <span key={i} style={{ position: "relative" }}><img src={g} alt="" style={{ width: 48, height: 30, objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)" }} /><button className="del" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, padding: 0, fontSize: 10 }} onClick={() => set({ brandLogos: (c.brandLogos ?? []).filter((_, j) => j !== i) })}>✕</button></span>
            ))}</div>}
          </div>

          {/* Catalog display */}
          <div className="sec">
            <h3>Catalog &amp; featured</h3>
            <div className="ff"><div className="field"><label>Top-selling heading</label><input value={c.heads?.topselling?.title ?? ""} onChange={(e) => set({ heads: { ...c.heads, topselling: { ...c.heads?.topselling, title: e.target.value } } })} placeholder="Top selling" /></div><div className="field"><label>Catalog heading</label><input value={c.heads?.catalog?.title ?? ""} onChange={(e) => set({ heads: { ...c.heads, catalog: { ...c.heads?.catalog, title: e.target.value } } })} placeholder="All products" /></div></div>
            <div className="field"><label>Layout</label><div className="chips">{DISPLAYS.map((d) => <div key={d[0]} className={`chip${(c.display ?? "grid") === d[0] ? " on" : ""}`} onClick={() => set({ display: d[0] as StoreContent["display"] })}>{d[1]}</div>)}</div></div>
            <div className="field"><label>Grid columns</label><div className="chips">{STORE_COLS.map((n) => <div key={n} className={`chip${(c.cols ?? 3) === n ? " on" : ""}`} onClick={() => set({ cols: n })}>{n}</div>)}</div></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Featured product position</label><input type="number" min={1} value={(c.featuredIdx ?? 0) + 1} onChange={(e) => set({ featuredIdx: Math.max(0, (parseInt(e.target.value) || 1) - 1) })} /></div>
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 6 }}>Products are pulled from your published one-page products automatically.</p>
          </div>

          {/* Add-ons */}
          <div className="sec">
            <h3>Announcement &amp; nav</h3>
            <div className="swrow" style={{ borderTop: 0, paddingTop: 0 }}><span className="nm">Announcement bar</span><Switch on={!!c.announce?.on} onClick={() => set({ announce: { on: !c.announce?.on, text: c.announce?.text ?? "" } })} /></div>
            <div className="field"><label>Announcement text</label><input value={c.announce?.text ?? ""} onChange={(e) => set({ announce: { on: c.announce?.on ?? true, text: e.target.value } })} /></div>
            <div className="swrow"><span className="nm">Mobile bottom app nav</span><Switch on={c.bottomNav !== false} onClick={() => set({ bottomNav: !(c.bottomNav !== false) })} /></div>
            <div className="swrow"><span className="nm">Footer payment logos</span><Switch on={c.footerPay !== false} onClick={() => set({ footerPay: !(c.footerPay !== false) })} /></div>
          </div>

          {/* Legal */}
          <div className="sec" style={{ marginBottom: 0 }}>
            <h3>Footer policies</h3>
            {Object.keys(legal).map((k) => (
              <div key={k}>
                <div className="swrow"><input value={legal[k].title} onChange={(e) => setLegal(k, { title: e.target.value })} /><Switch on={legal[k].on} onClick={() => setLegal(k, { on: !legal[k].on })} /></div>
                <textarea className="rowfull" rows={2} value={legal[k].text} onChange={(e) => setLegal(k, { text: e.target.value })} placeholder="Policy text…" />
              </div>
            ))}
          </div>

          {/* Suggest more */}
          <div style={{ margin: "18px 0 0", padding: "14px 16px", background: "var(--surface2, rgba(255,255,255,0.06))", border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 10 }}>Ideas to boost your store</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "📢", label: "Add a discount banner", hint: "Show a time-limited offer at the top to drive urgency.", action: () => set({ banner: [...banner, { heading: "Limited time offer — 20% off!", sub: "Use code SAVE20 at checkout", cta: "Shop now", url: "#" }] }) },
                { icon: "🏷️", label: "Add brand / press logos", hint: "Show logos from press mentions or brand partners to build trust.", action: () => set({ sections: { ...sections, logos: true } }) },
                { icon: "⭐", label: "Enable the top-selling section", hint: "Highlight your best-performing products automatically.", action: () => set({ sections: { ...sections, topselling: true } }) },
                { icon: "📱", label: "Turn on the mobile app nav bar", hint: "Gives mobile shoppers a permanent bottom navigation bar.", action: () => set({ bottomNav: true }) },
                { icon: "📣", label: "Add an announcement bar", hint: "Notify visitors of shipping deals, new arrivals, or events.", action: () => set({ announce: { on: true, text: "Free shipping on orders over ₹999" } }) },
              ].map(({ icon, label, hint, action }) => (
                <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "var(--secondary)", marginTop: 2 }}>{hint}</div>
                  </div>
                  <button
                    type="button"
                    onClick={action}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {Preview()}
      </div>
    </>
  );
}
