"use client";

import { useMemo, useState } from "react";
import ImageInput from "@/components/ImageInput";
import SocialIcon, { SOCIAL_PLATFORMS } from "@/components/SocialIcon";
import BioTemplate from "@/components/templates/BioTemplate";
import {
  BIO_THEMES,
  ANIMATIONS,
  BG_MOTIONS,
  type BioContent,
  type BioLink,
  type SocialLink,
} from "@/lib/bioThemes";
import { saveBioPage, setBioStatus } from "../actions";

type PageData = {
  id: string;
  title: string | null;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  pixels: Record<string, unknown>;
  status: string;
};

export default function BioEditor({ page, publicUrl }: { page: PageData; publicUrl: string | null }) {
  const c = page.content as BioContent;
  const s = page.seo as Record<string, string>;
  const px = page.pixels as Record<string, string>;

  // --- profile ---
  const [displayName, setDisplayName] = useState(c.display_name ?? "");
  const [headline, setHeadline] = useState(c.headline ?? "");
  const [avatarUrl, setAvatarUrl] = useState(c.avatar_url ?? "");
  const [bio, setBio] = useState(c.bio ?? "");
  // --- socials + links ---
  const [socials, setSocials] = useState<SocialLink[]>(c.socials ?? []);
  const [links, setLinks] = useState<BioLink[]>(c.links ?? [{ label: "", url: "" }]);
  // --- design ---
  const [theme, setTheme] = useState(c.theme ?? "sunset");
  const [bgType, setBgType] = useState(c.background?.type ?? "theme");
  const [bgColor, setBgColor] = useState(c.background?.color ?? "#FF6A3D");
  const [bgColor2, setBgColor2] = useState(c.background?.color2 ?? "#7B3FE4");
  const [bgImage, setBgImage] = useState(c.background?.image_url ?? "");
  const [bgMotion, setBgMotion] = useState(c.bg_motion ?? "none");
  const [animation, setAnimation] = useState(c.animation ?? "rise");
  const [buttonStyle, setButtonStyle] = useState(c.button_style ?? "rounded");
  const [iconPos, setIconPos] = useState(c.icon_position ?? "left");
  const [highlightColor, setHighlightColor] = useState(c.highlight_color ?? "#FF6A3D");
  const [stripeColor, setStripeColor] = useState(c.stripe_color ?? "#FFFFFF");
  // --- SEO + pixels ---
  const [seoTitle, setSeoTitle] = useState(s.title ?? "");
  const [seoDesc, setSeoDesc] = useState(s.description ?? "");
  const [ogImage, setOgImage] = useState(s.og_image ?? "");
  const [noindex, setNoindex] = useState(s.robots === "noindex");
  const [metaPixel, setMetaPixel] = useState(px.meta_pixel_id ?? "");
  const [googleId, setGoogleId] = useState(px.google_id ?? "");

  const [status, setStatus] = useState(page.status);
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const liveContent: BioContent = useMemo(
    () => ({
      display_name: displayName,
      headline,
      avatar_url: avatarUrl,
      bio,
      socials: socials.filter((x) => x.url.trim()),
      links: links.filter((x) => x.url.trim()),
      theme,
      background: { type: bgType, color: bgColor, color2: bgColor2, image_url: bgImage },
      bg_motion: bgMotion as BioContent["bg_motion"],
      animation: animation as BioContent["animation"],
      button_style: buttonStyle as BioContent["button_style"],
      icon_position: iconPos as BioContent["icon_position"],
      highlight_color: highlightColor,
      stripe_color: stripeColor,
    }),
    [displayName, headline, avatarUrl, bio, socials, links, theme, bgType, bgColor, bgColor2, bgImage, bgMotion, animation, buttonStyle, iconPos, highlightColor, stripeColor],
  );

  // --- minimum requirements before publish ---
  const missing: string[] = [];
  if (!displayName.trim()) missing.push("a display name");
  if (liveContent.links!.length === 0 && liveContent.socials!.length === 0)
    missing.push("at least one link or social");
  const canPublish = missing.length === 0;

  function buildPayload() {
    return {
      title: displayName || "My bio",
      content: liveContent as Record<string, unknown>,
      seo: { title: seoTitle, description: seoDesc, og_image: ogImage, robots: noindex ? "noindex" : "index" },
      pixels: { meta_pixel_id: metaPixel, google_id: googleId },
    };
  }

  async function save(publish?: boolean) {
    setErr(null);
    setMsg(null);
    if (publish && !canPublish) {
      setErr(`Add ${missing.join(" and ")} before publishing.`);
      return;
    }
    setBusy(true);
    const res = await saveBioPage(page.id, buildPayload());
    if (!res.ok) {
      setBusy(false);
      return setErr(res.error ?? "Save failed.");
    }
    if (publish) {
      const p = await setBioStatus(page.id, "published");
      setBusy(false);
      if (!p.ok) return setErr(p.error ?? "Publish failed.");
      setStatus("published");
      return setMsg("Published! Your bio is live.");
    }
    setBusy(false);
    setMsg("Saved.");
  }

  async function unpublish() {
    setBusy(true);
    const p = await setBioStatus(page.id, "draft");
    setBusy(false);
    if (p.ok) {
      setStatus("draft");
      setMsg("Unpublished.");
    }
  }

  // helpers
  const setLink = (i: number, k: keyof BioLink, v: string) =>
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const setSocial = (i: number, k: keyof SocialLink, v: string) =>
    setSocials((ss) => ss.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const toggleHighlight = (i: number) =>
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, highlight: !l.highlight } : l)));

  return (
    <div className="wide-wrap">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <div>
          <a href="/dashboard" className="muted" style={{ fontSize: "0.8rem" }}>← Dashboard</a>
          <h1 style={{ margin: "0.1rem 0 0" }}>Bio page builder</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, padding: "0.25rem 0.7rem", borderRadius: 999, background: status === "published" ? "rgba(46,174,122,0.15)" : "var(--color-bg)", border: "1px solid var(--color-border)", color: status === "published" ? "#1c7d57" : "var(--color-muted)" }}>
            {status === "published" ? "● Live" : "Draft"}
          </span>
          <button className="btn btn-ghost" disabled={busy} onClick={() => save(false)}>{busy ? "…" : "Save draft"}</button>
          <button className="btn btn-gradient" disabled={busy || !canPublish} onClick={() => save(true)} title={canPublish ? "" : `Add ${missing.join(" and ")}`}>
            {busy ? "…" : status === "published" ? "Republish" : "Publish"}
          </button>
          {status === "published" && (
            <button className="btn btn-ghost" disabled={busy} onClick={unpublish}>Unpublish</button>
          )}
        </div>
      </header>

      {msg && <div className="alert alert-ok">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}
      {!canPublish && (
        <div className="alert" style={{ background: "rgba(255,178,62,0.14)", border: "1px solid rgba(255,178,62,0.4)", color: "#8a5a00" }}>
          To publish, add {missing.join(" and ")}.
        </div>
      )}
      {status === "published" && publicUrl && (
        <p className="muted" style={{ marginTop: 0 }}>
          Live at <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl.replace("https://", "")}</a>
        </p>
      )}

      <div className="editor">
        {/* ---------------- FORM ---------------- */}
        <div>
          <section className="card" style={{ marginBottom: "var(--space-2)" }}>
            <h2 style={{ marginTop: 0 }}>Profile</h2>
            <Field label="Display name *"><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" /></Field>
            <Field label="Headline"><input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Creator · Coach · Founder" /></Field>
            <Field label="Avatar (upload or URL)"><ImageInput value={avatarUrl} onChange={setAvatarUrl} placeholder="https://…/photo.jpg" /></Field>
            <Field label="Short bio"><textarea className="input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
          </section>

          <section className="card" style={{ marginBottom: "var(--space-2)" }}>
            <h2 style={{ marginTop: 0 }}>Social icons</h2>
            {socials.map((sc, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "var(--space-1)", alignItems: "center" }}>
                <SocialIcon platform={sc.platform} size={34} />
                <select className="select" value={sc.platform} onChange={(e) => setSocial(i, "platform", e.target.value)} style={{ flex: "0 0 130px" }}>
                  {SOCIAL_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="input" placeholder="https://…" value={sc.url} onChange={(e) => setSocial(i, "url", e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-ghost" type="button" onClick={() => setSocials((ss) => ss.filter((_, idx) => idx !== i))} style={{ padding: "0 0.7rem" }}>✕</button>
              </div>
            ))}
            <button className="btn btn-ghost" type="button" onClick={() => setSocials((ss) => [...ss, { platform: "instagram", url: "" }])}>+ Add social</button>
          </section>

          <section className="card" style={{ marginBottom: "var(--space-2)" }}>
            <h2 style={{ marginTop: 0 }}>Link buttons</h2>
            <Field label="Icon position">
              <div className="chiprow">
                {(["left", "center", "right"] as const).map((p) => (
                  <div key={p} className={`chip-toggle${iconPos === p ? " on" : ""}`} onClick={() => setIconPos(p)} style={{ textTransform: "capitalize", justifyContent: "center" }}>{p}</div>
                ))}
              </div>
            </Field>
            {links.map((l, i) => (
              <div key={i} style={{ border: `1.5px solid ${l.highlight ? "var(--color-primary)" : "var(--color-border)"}`, borderRadius: "var(--radius-sm)", padding: "0.7rem", marginBottom: "var(--space-1)" }}>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input className="input" placeholder="Label" value={l.label} onChange={(e) => setLink(i, "label", e.target.value)} style={{ flex: 1 }} />
                  <input className="input" placeholder="https://…" value={l.url} onChange={(e) => setLink(i, "url", e.target.value)} style={{ flex: 2 }} />
                  <button className="btn btn-ghost" type="button" onClick={() => setLinks((ls) => ls.filter((_, idx) => idx !== i))} style={{ padding: "0 0.7rem" }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span className={`chip-toggle${l.highlight ? " on" : ""}`} onClick={() => toggleHighlight(i)}>
                    {l.highlight ? "★ Featured" : "☆ Highlight"}
                  </span>
                  <span className="hint" style={{ flex: 1 }}>Custom icon (optional):</span>
                </div>
                <ImageInput value={l.icon_url ?? ""} onChange={(v) => setLink(i, "icon_url", v)} placeholder="icon image URL" />
              </div>
            ))}
            <button className="btn btn-ghost" type="button" onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}>+ Add link</button>
            <p className="hint" style={{ marginTop: "0.5rem" }}>A featured link is highlighted with a shine, and on mobile it sticks to the bottom of the screen.</p>
          </section>

          <section className="card" style={{ marginBottom: "var(--space-2)" }}>
            <h2 style={{ marginTop: 0 }}>Theme</h2>
            <div className="themes">
              {BIO_THEMES.map((t) => (
                <div key={t.id} className={`theme-swatch${theme === t.id ? " on" : ""}`} onClick={() => setTheme(t.id)}>
                  <div className="theme-dot" style={{ background: `linear-gradient(135deg, ${t.bg} 40%, ${t.primary})` }} />
                  {t.name}
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ marginBottom: "var(--space-2)" }}>
            <h2 style={{ marginTop: 0 }}>Background</h2>
            <Segment value={bgType} onChange={setBgType} options={[["theme", "Theme"], ["solid", "Solid"], ["gradient", "Gradient"], ["image", "Image"]]} />
            <div style={{ marginTop: "var(--space-2)" }}>
              {bgType === "solid" && <ColorRow label="Color" value={bgColor} onChange={setBgColor} />}
              {bgType === "gradient" && (<><ColorRow label="From" value={bgColor} onChange={setBgColor} /><ColorRow label="To" value={bgColor2} onChange={setBgColor2} /></>)}
              {bgType === "image" && <Field label="Background image (upload or URL)"><ImageInput value={bgImage} onChange={setBgImage} /></Field>}
              {bgType === "theme" && <span className="hint">Uses the selected theme&apos;s background.</span>}
            </div>
            <div className="field" style={{ marginTop: "var(--space-2)" }}>
              <label className="label">Animated background (loops)</label>
              <div className="chiprow">
                {BG_MOTIONS.map((m) => (
                  <div key={m.id} className={`chip-toggle${bgMotion === m.id ? " on" : ""}`} onClick={() => setBgMotion(m.id)}>{m.name}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: "var(--space-2)" }}>
            <h2 style={{ marginTop: 0 }}>Motion &amp; buttons</h2>
            <Field label="Entrance animation">
              <div className="chiprow">
                {ANIMATIONS.map((a) => (
                  <div key={a.id} className={`chip-toggle${animation === a.id ? " on" : ""}`} onClick={() => setAnimation(a.id)}>{a.name}</div>
                ))}
              </div>
            </Field>
            <Field label="Button style">
              <div className="chiprow">
                {(["rounded", "pill", "outline"] as const).map((id) => (
                  <div key={id} className={`chip-toggle${buttonStyle === id ? " on" : ""}`} onClick={() => setButtonStyle(id)} style={{ textTransform: "capitalize" }}>{id}</div>
                ))}
              </div>
            </Field>
            <div className="field">
              <label className="label">Featured button &amp; shine colors</label>
              <ColorRow label="Button" value={highlightColor} onChange={setHighlightColor} />
              <ColorRow label="Shine stripe" value={stripeColor} onChange={setStripeColor} />
            </div>
          </section>

          <section className="card" style={{ marginBottom: "var(--space-2)" }}>
            <h2 style={{ marginTop: 0 }}>SEO</h2>
            <Field label="Meta title"><input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} /></Field>
            <Field label="Meta description"><textarea className="input" rows={2} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} /></Field>
            <Field label="Share / OG image (upload or URL)"><ImageInput value={ogImage} onChange={setOgImage} /></Field>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} /> Hide from search engines
            </label>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Ad pixels</h2>
            <Field label="Meta (Facebook) Pixel ID"><input className="input" value={metaPixel} onChange={(e) => setMetaPixel(e.target.value)} placeholder="123456789012345" /></Field>
            <Field label="Google tag ID (GA4 / Ads)"><input className="input" value={googleId} onChange={(e) => setGoogleId(e.target.value)} placeholder="G-XXXXXXX" /></Field>
          </section>
        </div>

        {/* ---------------- LIVE PREVIEW ---------------- */}
        <div className="editor-preview">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-2)" }}>
            <div className="segment">
              <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>🖥 Web</button>
              <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>📱 Mobile</button>
            </div>
          </div>
          <div className={`device device-${device}`}>
            <div className="device-scroll" key={`${theme}-${animation}-${device}`}>
              <BioTemplate content={liveContent} fallbackName={displayName || "Your name"} forceMobile={device === "mobile"} />
            </div>
          </div>
          <p className="muted" style={{ textAlign: "center", fontSize: "0.78rem", marginTop: "var(--space-1)" }}>
            Live preview — updates as you edit
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "var(--space-1)" }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 44, height: 38, border: "1px solid var(--color-border)", borderRadius: 8, background: "none" }} />
      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
    </div>
  );
}

function Segment<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="segment">
      {options.map(([v, label]) => (
        <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)} type="button">{label}</button>
      ))}
    </div>
  );
}
