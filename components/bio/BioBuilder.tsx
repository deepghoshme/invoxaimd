"use client";

import { useState } from "react";
import BioView from "./BioView";
import { type BioContent, type BioLink, ACCENTS, STYLES, SHAPES, BGS, ICONS, TEMPLATES } from "@/lib/bio";
import { SOCIALS } from "./SocialIcon";
import { saveBio, publishBio } from "@/app/dashboard/pages/bio/actions";

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

export default function BioBuilder({
  initial, publicUrl, initialStatus,
}: { initial: BioContent; publicUrl: string | null; initialStatus: string }) {
  const [c, setC] = useState<BioContent>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "public">("edit");

  const set = (patch: Partial<BioContent>) => setC((p) => ({ ...p, ...patch }));
  const setFeat = (patch: Partial<NonNullable<BioContent["featured"]>>) => setC((p) => ({ ...p, featured: { ...p.featured, ...patch } }));
  const links = c.links ?? [];
  const setLink = (i: number, patch: Partial<BioLink>) => set({ links: links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const moveLink = (i: number, dir: number) => {
    const a = [...links]; const j = i + dir; if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; set({ links: a });
  };
  const socials = c.socials ?? [];
  const setSocial = (i: number, patch: Partial<{ platform: string; label: string; url: string }>) =>
    set({ socials: socials.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  async function save(publish?: boolean) {
    setBusy(true); setMsg(null);
    const res = publish === undefined ? await saveBio(c as Record<string, unknown>) : await publishBio(c as Record<string, unknown>, publish);
    setBusy(false);
    if (!res.ok) { setMsg(res.error ?? "Failed"); return; }
    if (publish !== undefined) setStatus(publish ? "published" : "draft");
    setMsg(publish === true ? "Published ✓" : publish === false ? "Unpublished" : "Saved ✓");
    setTimeout(() => setMsg(null), 1800);
  }

  return (
    <>
      <div className="dx-phead">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard/pages/bio" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>← Bio</a>
          <div className="bio-seg">
            <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>Builder</button>
            <button className={view === "public" ? "on" : ""} onClick={() => setView("public")}>Public page</button>
          </div>
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
        <div className="bio-public-view">
          {publicUrl && <div className="urlbar"><span className="u">🔒 {publicUrl.replace("https://", "")}</span></div>}
          <div className="publiccol"><BioView content={c} showBrand stage /></div>
        </div>
      )}

      <div className="biobuild" style={view === "public" ? { display: "none" } : undefined}>
        <div>
          <div className="sec">
            <h3>Cover &amp; profile</h3>
            <Upload ico="🖼️" label="Upload cover image" sub="1200×400 recommended" value={c.cover_url} onUrl={(u) => set({ cover_url: u })} onRemove={() => set({ cover_url: undefined })} />
            <Upload ico="👤" label="Upload profile image" sub="square, 400×400" value={c.profile_url} onUrl={(u) => set({ profile_url: u })} onRemove={() => set({ profile_url: undefined })} />
            <div className="field"><label>Display name</label><input value={c.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="Your name" /></div>
            <div className="field"><label>Headline</label><input value={c.handle ?? ""} onChange={(e) => set({ handle: e.target.value })} placeholder="What you do" /></div>
            <div className="field"><label>Bio</label><textarea rows={2} value={c.bio ?? ""} onChange={(e) => set({ bio: e.target.value })} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 0 }}>
              <input type="checkbox" checked={!!c.verified} onChange={(e) => set({ verified: e.target.checked })} /> Verified badge
            </label>
          </div>

          <div className="sec">
            <h3>Theme &amp; effects</h3>
            <div className="field"><label>Templates</label><div className="chips">{TEMPLATES.map((t) => <div key={t.name} className="chip" onClick={() => set({ accent: t.accent, button_style: t.style, bg: t.bg })}>{t.name}</div>)}</div></div>
            <div className="field"><label>Accent</label><div className="swatches">{ACCENTS.map((a, i) => <div key={i} className={`sw${(c.accent ?? 0) === i ? " on" : ""}`} style={{ background: a[1] }} title={a[0]} onClick={() => set({ accent: i })} />)}</div></div>
            <div className="field"><label>Button style</label><div className="chips">{STYLES.map((s) => <div key={s[0]} className={`chip${(c.button_style ?? "soft") === s[0] ? " on" : ""}`} onClick={() => set({ button_style: s[0] })}>{s[1]}</div>)}</div></div>
            <div className="field"><label>Button shape</label><div className="chips">{SHAPES.map((s) => <div key={s[0]} className={`chip${(c.button_shape ?? "rounded") === s[0] ? " on" : ""}`} onClick={() => set({ button_shape: s[0] })}>{s[1]}</div>)}</div></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Background animation</label><div className="chips">{BGS.map((b) => <div key={b[0]} className={`chip${(c.bg ?? "aurora") === b[0] ? " on" : ""}`} onClick={() => set({ bg: b[0] })}>{b[1]}</div>)}</div></div>
          </div>

          <div className="sec">
            <h3>Links</h3>
            <div>
              {links.map((l, i) => (
                <div className="lrow" key={i}>
                  {l.type === "header" ? (
                    <input className="ti" style={{ flex: 1, fontWeight: 700 }} value={l.t} onChange={(e) => setLink(i, { t: e.target.value })} placeholder="Section title" />
                  ) : (
                    <>
                      {l.img
                        ? <button className="mv" title="Remove thumbnail" style={{ backgroundImage: `url(${l.img})`, backgroundSize: "cover" }} onClick={() => setLink(i, { img: undefined })} />
                        : <select value={l.ic} onChange={(e) => setLink(i, { ic: e.target.value })}>{ICONS.map((ic) => <option key={ic}>{ic}</option>)}</select>}
                      <input className="ti" value={l.t} onChange={(e) => setLink(i, { t: e.target.value })} placeholder="Link title" />
                      <input className="ur" value={l.u} onChange={(e) => setLink(i, { u: e.target.value })} placeholder="URL" />
                      <label className="mv" title="Upload thumbnail" style={{ display: "grid", placeItems: "center" }}>📷
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const u = await upload(f); if (u) setLink(i, { img: u }); }} />
                      </label>
                      <button className={`mv${l.highlight ? " on" : ""}`} title="Highlight" onClick={() => setLink(i, { highlight: !l.highlight })}>★</button>
                    </>
                  )}
                  <button className="mv" title="Move up" onClick={() => moveLink(i, -1)}>↑</button>
                  <button className="mv" title="Move down" onClick={() => moveLink(i, 1)}>↓</button>
                  <button className="del" onClick={() => set({ links: links.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="addlink" onClick={() => set({ links: [...links, { ic: "🔗", t: "New link", u: "", type: "link" }] })}>+ Add link</button>
              <button className="addlink" style={{ flex: "0 0 130px" }} onClick={() => set({ links: [...links, { ic: "", t: "Section", u: "", type: "header" }] })}>+ Header</button>
            </div>
          </div>

          <div className="sec">
            <h3>Social icons</h3>
            <div>
              {socials.map((s, i) => (
                <div className="lrow" key={i}>
                  <select value={s.platform ?? "instagram"} onChange={(e) => setSocial(i, { platform: e.target.value })} style={{ width: 130, fontSize: 13 }}>
                    {SOCIALS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                  <input className="ur" value={s.url ?? ""} onChange={(e) => setSocial(i, { url: e.target.value })} placeholder="https://…" />
                  <button className="del" onClick={() => set({ socials: socials.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
            </div>
            <button className="addlink" onClick={() => set({ socials: [...socials, { platform: "instagram", url: "" }] })}>+ Add social</button>
          </div>

          <div className="sec" style={{ marginBottom: 0 }}>
            <h3>Featured product</h3>
            <Upload ico="📦" label="Upload product image" value={c.featured?.image_url} onUrl={(u) => setFeat({ image_url: u })} onRemove={() => setFeat({ image_url: undefined })} />
            <div className="field"><label>Title</label><input value={c.featured?.title ?? ""} onChange={(e) => setFeat({ title: e.target.value })} /></div>
            <div className="ff"><div className="field"><label>Real price</label><input value={c.featured?.real ?? ""} onChange={(e) => setFeat({ real: e.target.value })} placeholder="₹1,499" /></div><div className="field"><label>Offer price</label><input value={c.featured?.off ?? ""} onChange={(e) => setFeat({ off: e.target.value })} placeholder="₹999" /></div></div>
            <div className="ff"><div className="field"><label>Button text</label><input value={c.featured?.cta ?? ""} onChange={(e) => setFeat({ cta: e.target.value })} placeholder="Enroll now" /></div><div className="field"><label>Button URL</label><input value={c.featured?.url ?? ""} onChange={(e) => setFeat({ url: e.target.value })} placeholder="/opp/..." /></div></div>
          </div>

          {/* Suggest more */}
          <div style={{ margin: "18px 0 0", padding: "14px 16px", background: "var(--surface2, rgba(255,255,255,0.06))", border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 10 }}>Ideas to grow your Bio page</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "📧", label: "Add a newsletter signup link", hint: "Link to a Beehiiv / ConvertKit / Mailchimp form to capture emails.", action: () => set({ links: [...(c.links ?? []), { ic: "📧", t: "Subscribe to my newsletter", u: "https://", type: "link" as const }] }) },
                { icon: "🛒", label: "Sell a product from your Bio", hint: "Feature a paid product or course right on your link page.", action: () => {} },
                { icon: "💬", label: "Add a WhatsApp / Telegram link", hint: "Let visitors reach you on chat in one tap.", action: () => set({ links: [...(c.links ?? []), { ic: "💬", t: "Chat on WhatsApp", u: "https://wa.me/", type: "link" as const }] }) },
                { icon: "📅", label: "Add a booking / calendar link", hint: "Let fans book a call or session directly (Cal.com, Calendly…).", action: () => set({ links: [...(c.links ?? []), { ic: "📅", t: "Book a call", u: "https://cal.com/", type: "link" as const }] }) },
                { icon: "🎁", label: "Add a freebie / lead magnet link", hint: "Offer a free PDF, checklist, or mini-course to grow your list.", action: () => set({ links: [...(c.links ?? []), { ic: "🎁", t: "Free download", u: "https://", type: "link" as const }] }) },
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

        <div className="previewwrap">
          <div className="plabel">Live preview</div>
          <div className="phone"><div className="scr"><BioView key={`${c.accent}-${c.bg}-${c.button_style}`} content={c} /></div></div>
        </div>
      </div>
    </>
  );
}
