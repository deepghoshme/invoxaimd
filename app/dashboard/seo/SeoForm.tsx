"use client";

import { useState } from "react";
import ImageInput from "@/components/ImageInput";
import { saveStoreSeo, type SeoFormData } from "./actions";

type Props = {
  initial: SeoFormData;
  storeName: string;
  activeBase: string | null;
  impersonating: boolean;
};

export default function SeoForm({ initial, storeName, activeBase, impersonating }: Props) {
  const [metaTitle, setMetaTitle] = useState(initial.default_meta_title);
  const [metaDesc, setMetaDesc] = useState(initial.default_meta_description);
  const [ogImage, setOgImage] = useState(initial.og_image_url);
  const [metaPixel, setMetaPixel] = useState(initial.meta_pixel_id);
  const [gaId, setGaId] = useState(initial.google_analytics_id);
  const [adsId, setAdsId] = useState(initial.google_ads_id);
  const [indexable, setIndexable] = useState(initial.seo_indexable);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (impersonating) { setErr("Read-only while impersonating."); return; }
    setSaving(true); setMsg(null); setErr(null);
    const res = await saveStoreSeo({
      default_meta_title: metaTitle,
      default_meta_description: metaDesc,
      og_image_url: ogImage,
      meta_pixel_id: metaPixel,
      google_analytics_id: gaId,
      google_ads_id: adsId,
      seo_indexable: indexable,
    });
    setSaving(false);
    if (res.ok) { setMsg("Saved"); setTimeout(() => setMsg(null), 2200); }
    else setErr(res.error ?? "Save failed");
  }

  // Live Google SERP preview.
  const previewTitle = metaTitle || storeName || "My store";
  const previewDesc = metaDesc || "Powered by invoxai.io";
  const previewUrl = activeBase
    ? activeBase.replace("https://", "")
    : "yourstore.invoxai.io";

  return (
    <>
      <style>{`
        .seo-section { margin-bottom: 20px; }
        .seo-label {
          display: block; font-size: 12.5px; font-weight: 600;
          color: var(--muted); margin-bottom: 6px;
        }
        .seo-input {
          width: 100%; padding: 10px 12px;
          border: 1px solid var(--border); border-radius: 10px;
          background: var(--bg); color: var(--text);
          font: inherit; font-size: 13.5px; outline: none;
          transition: border-color .15s;
        }
        .seo-input:focus { border-color: var(--primary); }
        .seo-textarea {
          resize: vertical; min-height: 72px;
        }
        .seo-toggle-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 0;
        }
        .seo-toggle {
          position: relative; display: inline-block;
          width: 40px; height: 22px;
        }
        .seo-toggle input { opacity: 0; width: 0; height: 0; }
        .seo-slider {
          position: absolute; cursor: pointer; inset: 0;
          background: var(--border); border-radius: 22px;
          transition: background .2s;
        }
        .seo-slider::before {
          content: ""; position: absolute;
          width: 16px; height: 16px; left: 3px; bottom: 3px;
          background: #fff; border-radius: 50%;
          transition: transform .2s;
        }
        .seo-toggle input:checked + .seo-slider { background: var(--green); }
        .seo-toggle input:checked + .seo-slider::before { transform: translateX(18px); }

        /* SERP preview */
        .serp-card {
          border: 1px solid var(--border); border-radius: 12px;
          padding: 16px; background: var(--bg);
          font-family: Arial, sans-serif;
        }
        .serp-url { font-size: 12px; color: var(--muted); margin-bottom: 2px; }
        .serp-title {
          font-size: 18px; color: #1a0dab; font-weight: 400;
          line-height: 1.3; margin: 0 0 4px;
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
          max-width: 520px;
        }
        .serp-desc {
          font-size: 13px; color: #545454; line-height: 1.4;
          overflow: hidden; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          max-width: 520px;
        }

        /* Social OG preview */
        .og-card {
          border: 1px solid var(--border); border-radius: 12px;
          overflow: hidden; background: var(--bg);
          max-width: 480px;
        }
        .og-card-img {
          width: 100%; aspect-ratio: 1200/630;
          object-fit: cover; display: block;
          background: var(--surface2);
        }
        .og-card-img-placeholder {
          width: 100%; aspect-ratio: 1200/630;
          background: var(--surface2);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: var(--muted);
        }
        .og-card-body { padding: 12px 14px; border-top: 1px solid var(--border); }
        .og-card-domain { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
        .og-card-title { font-size: 14px; font-weight: 700; margin: 3px 0 2px; }
        .og-card-desc { font-size: 12px; color: var(--muted); }

        .seo-pixel-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11.5px; font-weight: 700; letter-spacing: .03em;
          padding: 3px 8px; border-radius: 6px;
          background: color-mix(in srgb, var(--primary) 10%, var(--surface));
          color: var(--primary);
        }
        .seo-err { color: var(--secondary); font-size: 12.5px; margin-top: 6px; }
        .seo-ok { color: var(--green); font-size: 12.5px; margin-left: 10px; }
      `}</style>

      <div className="dx-grid dx-cols">
        {/* Left: settings */}
        <div>
          {/* Meta / SEO defaults */}
          <div className="dx-card" style={{ marginBottom: 14 }}>
            <div className="dx-ctitle"><h3>Default meta tags</h3></div>
            <div className="seo-section">
              <label className="seo-label">Default page title</label>
              <input
                className="seo-input"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder={storeName || "My store — great products"}
                maxLength={70}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                {metaTitle.length}/70 chars — used when a page doesn&apos;t set its own title
              </div>
            </div>

            <div className="seo-section">
              <label className="seo-label">Default meta description</label>
              <textarea
                className="seo-input seo-textarea"
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                placeholder="A short sentence about your store (up to 160 chars)."
                maxLength={160}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                {metaDesc.length}/160 chars
              </div>
            </div>

            <div className="seo-section">
              <label className="seo-label">Default OG / social share image</label>
              <ImageInput
                value={ogImage}
                onChange={setOgImage}
                placeholder="https://…/social-card.jpg (1200×630 recommended)"
              />
            </div>

            <div className="seo-toggle-row">
              <label className="seo-toggle">
                <input
                  type="checkbox"
                  checked={indexable}
                  onChange={(e) => setIndexable(e.target.checked)}
                />
                <span className="seo-slider" />
              </label>
              <span style={{ fontSize: 13.5 }}>
                Allow Google to index this store
              </span>
              {!indexable && (
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, color: "var(--secondary)",
                    background: "color-mix(in srgb, var(--secondary) 10%, var(--surface))",
                    padding: "2px 8px", borderRadius: 6,
                  }}
                >
                  noindex active
                </span>
              )}
            </div>
          </div>

          {/* Pixel IDs */}
          <div className="dx-card" style={{ marginBottom: 14 }}>
            <div className="dx-ctitle"><h3>Pixel IDs (store-wide defaults)</h3></div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, marginBottom: 14 }}>
              These fire on <strong>every public page</strong> of your store — bio, website, store, product pages, and checkout.
              Per-page overrides (set inside each builder) take priority.
            </p>

            <div className="seo-section">
              <label className="seo-label">Meta Pixel ID</label>
              <input
                className="seo-input"
                value={metaPixel}
                onChange={(e) => setMetaPixel(e.target.value)}
                placeholder="123456789012345"
              />
              {metaPixel.trim() && (
                <span className="seo-pixel-badge" style={{ marginTop: 6 }}>Meta Pixel active</span>
              )}
            </div>

            <div className="seo-section">
              <label className="seo-label">Google Analytics 4 Measurement ID</label>
              <input
                className="seo-input"
                value={gaId}
                onChange={(e) => setGaId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
              />
              {gaId.trim() && (
                <span className="seo-pixel-badge" style={{ marginTop: 6 }}>GA4 active</span>
              )}
            </div>

            <div className="seo-section">
              <label className="seo-label">Google Ads conversion tag</label>
              <input
                className="seo-input"
                value={adsId}
                onChange={(e) => setAdsId(e.target.value)}
                placeholder="AW-XXXXXXXXXX"
              />
              {adsId.trim() && (
                <span className="seo-pixel-badge" style={{ marginTop: 6 }}>Google Ads active</span>
              )}
            </div>

            {err && <div className="seo-err">{err}</div>}

            <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
              <button className="btn grad" onClick={save} disabled={saving || impersonating}>
                {saving ? "Saving…" : "Save SEO & pixels"}
              </button>
              {msg && <span className="seo-ok">{msg} ✓</span>}
            </div>
            {impersonating && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                Read-only while impersonating another seller.
              </div>
            )}
          </div>
        </div>

        {/* Right: live previews */}
        <div>
          <div className="dx-card" style={{ marginBottom: 14 }}>
            <div className="dx-ctitle"><h3>Google search preview</h3></div>
            <div className="serp-card">
              <div className="serp-url">{previewUrl}</div>
              <div className="serp-title">{previewTitle}</div>
              <div className="serp-desc">{previewDesc || " "}</div>
            </div>
          </div>

          <div className="dx-card" style={{ marginBottom: 14 }}>
            <div className="dx-ctitle"><h3>Social share (OG) preview</h3></div>
            <div className="og-card">
              {ogImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="og-card-img" src={ogImage} alt="" />
              ) : (
                <div className="og-card-img-placeholder">1200 × 630 — upload an image above</div>
              )}
              <div className="og-card-body">
                <div className="og-card-domain">{previewUrl}</div>
                <div className="og-card-title">{previewTitle}</div>
                {previewDesc && <div className="og-card-desc">{previewDesc}</div>}
              </div>
            </div>
          </div>

          {/* Status summary */}
          <div className="dx-card">
            <div className="dx-ctitle"><h3>Pixel status</h3></div>
            {[
              { label: "Meta Pixel", active: !!metaPixel.trim(), value: metaPixel.trim() },
              { label: "Google Analytics 4", active: !!gaId.trim(), value: gaId.trim() },
              { label: "Google Ads", active: !!adsId.trim(), value: adsId.trim() },
            ].map((px) => (
              <div
                key={px.label}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 0", borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 8, height: 8, borderRadius: "50%", flex: "none",
                    background: px.active ? "var(--green)" : "var(--border)",
                  }}
                />
                <span style={{ flex: 1 }}>{px.label}</span>
                {px.active ? (
                  <code style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface2)", padding: "1px 6px", borderRadius: 5 }}>
                    {px.value}
                  </code>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Not set</span>
                )}
              </div>
            ))}
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "10px 0 0" }}>
              Pixels fire on all public pages after you save. Per-page overrides (set inside each builder) take priority.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
