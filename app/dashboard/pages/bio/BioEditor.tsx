"use client";

import { useState } from "react";
import { saveBioPage, setBioStatus } from "../actions";

type Link = { label: string; url: string };
type PageData = {
  id: string;
  title: string | null;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  pixels: Record<string, unknown>;
  status: string;
};

export default function BioEditor({
  page,
  publicUrl,
}: {
  page: PageData;
  publicUrl: string | null;
}) {
  const c = page.content as Record<string, string>;
  const s = page.seo as Record<string, string>;
  const px = page.pixels as Record<string, string>;

  const [displayName, setDisplayName] = useState(c.display_name ?? "");
  const [headline, setHeadline] = useState(c.headline ?? "");
  const [avatarUrl, setAvatarUrl] = useState(c.avatar_url ?? "");
  const [bio, setBio] = useState(c.bio ?? "");
  const [links, setLinks] = useState<Link[]>(
    Array.isArray(page.content.links) ? (page.content.links as Link[]) : [{ label: "", url: "" }],
  );

  const [seoTitle, setSeoTitle] = useState(s.title ?? "");
  const [seoDesc, setSeoDesc] = useState(s.description ?? "");
  const [ogImage, setOgImage] = useState(s.og_image ?? "");
  const [noindex, setNoindex] = useState(s.robots === "noindex");

  const [metaPixel, setMetaPixel] = useState(px.meta_pixel_id ?? "");
  const [googleId, setGoogleId] = useState(px.google_id ?? "");

  const [status, setStatus] = useState(page.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function payload() {
    return {
      title: displayName || "My bio",
      content: {
        display_name: displayName,
        headline,
        avatar_url: avatarUrl,
        bio,
        links: links.filter((l) => l.url.trim()),
      },
      seo: {
        title: seoTitle,
        description: seoDesc,
        og_image: ogImage,
        robots: noindex ? "noindex" : "index",
      },
      pixels: { meta_pixel_id: metaPixel, google_id: googleId },
    };
  }

  async function save(thenPublish?: boolean) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await saveBioPage(page.id, payload());
    if (!res.ok) {
      setBusy(false);
      return setErr(res.error ?? "Save failed.");
    }
    if (thenPublish) {
      const p = await setBioStatus(page.id, "published");
      if (!p.ok) {
        setBusy(false);
        return setErr(p.error ?? "Publish failed.");
      }
      setStatus("published");
      setMsg("Published! Your bio is live.");
    } else {
      setMsg("Saved.");
    }
    setBusy(false);
  }

  async function unpublish() {
    setBusy(true);
    const p = await setBioStatus(page.id, "draft");
    setBusy(false);
    if (p.ok) {
      setStatus("draft");
      setMsg("Unpublished (back to draft).");
    }
  }

  function setLink(i: number, key: keyof Link, val: string) {
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)));
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "var(--space-4) var(--space-3)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <a href="/dashboard" className="muted" style={{ fontSize: "0.8rem" }}>
            ← Dashboard
          </a>
          <h1 style={{ margin: "0.1rem 0 0" }}>Bio page</h1>
        </div>
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            padding: "0.25rem 0.7rem",
            borderRadius: 999,
            background: status === "published" ? "rgba(46,174,122,0.15)" : "var(--color-bg)",
            border: "1px solid var(--color-border)",
            color: status === "published" ? "#1c7d57" : "var(--color-muted)",
          }}
        >
          {status === "published" ? "● Live" : "Draft"}
        </span>
      </header>

      {msg && <div className="alert alert-ok">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}
      {status === "published" && publicUrl && (
        <p className="muted" style={{ marginTop: 0 }}>
          Live at{" "}
          <a href={publicUrl} target="_blank" rel="noreferrer">
            {publicUrl.replace("https://", "")}
          </a>
        </p>
      )}

      <section className="card" style={{ marginBottom: "var(--space-3)" }}>
        <h2 style={{ marginTop: 0 }}>Profile</h2>
        <Field label="Display name">
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
        </Field>
        <Field label="Headline">
          <input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Creator · Coach · Founder" />
        </Field>
        <Field label="Avatar image URL">
          <input className="input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…/photo.jpg" />
        </Field>
        <Field label="Short bio">
          <textarea className="input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line or two about you." />
        </Field>
      </section>

      <section className="card" style={{ marginBottom: "var(--space-3)" }}>
        <h2 style={{ marginTop: 0 }}>Links</h2>
        {links.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "var(--space-1)" }}>
            <input className="input" placeholder="Label" value={l.label} onChange={(e) => setLink(i, "label", e.target.value)} style={{ flex: 1 }} />
            <input className="input" placeholder="https://…" value={l.url} onChange={(e) => setLink(i, "url", e.target.value)} style={{ flex: 2 }} />
            <button className="btn btn-ghost" type="button" onClick={() => setLinks((ls) => ls.filter((_, idx) => idx !== i))} style={{ padding: "0 0.8rem" }}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn btn-ghost" type="button" onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}>
          + Add link
        </button>
      </section>

      <section className="card" style={{ marginBottom: "var(--space-3)" }}>
        <h2 style={{ marginTop: 0 }}>SEO</h2>
        <Field label="Meta title">
          <input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Jane Doe — links" />
        </Field>
        <Field label="Meta description">
          <textarea className="input" rows={2} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} />
        </Field>
        <Field label="Open Graph image URL">
          <input className="input" value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://…/share.jpg" />
        </Field>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem" }}>
          <input type="checkbox" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} />
          Hide from search engines (noindex)
        </label>
      </section>

      <section className="card" style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{ marginTop: 0 }}>Ad pixels</h2>
        <Field label="Meta (Facebook) Pixel ID">
          <input className="input" value={metaPixel} onChange={(e) => setMetaPixel(e.target.value)} placeholder="123456789012345" />
        </Field>
        <Field label="Google tag ID (GA4 / Ads)">
          <input className="input" value={googleId} onChange={(e) => setGoogleId(e.target.value)} placeholder="G-XXXXXXX or AW-XXXXXXX" />
        </Field>
      </section>

      <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", position: "sticky", bottom: "var(--space-2)" }}>
        <button className="btn btn-ghost" disabled={busy} onClick={() => save(false)}>
          {busy ? "Saving…" : "Save draft"}
        </button>
        <button className="btn btn-gradient" disabled={busy} onClick={() => save(true)}>
          {busy ? "Working…" : status === "published" ? "Save & republish" : "Save & publish"}
        </button>
        {status === "published" && (
          <button className="btn btn-ghost" disabled={busy} onClick={unpublish}>
            Unpublish
          </button>
        )}
      </div>
    </main>
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
