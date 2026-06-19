"use client";

import { useState, useRef } from "react";
import { Phead, Card, Switch } from "@/components/dx/ui";
import { saveBrandingSettings } from "./actions";

interface Props {
  platformName: string;
  logoUrl: string;
  faviconUrl: string;
  invoiceFooter: string;
  showBrandBadge: boolean;
  /** True once migration 20260618260000 has been applied and logo_url column exists. */
  newColsExist: boolean;
  /** GST / tax identity fields (from platform_settings GST migration). */
  gstin: string;
  legalName: string;
  registeredAddress: string;
  defaultTaxRate: number;
}

type Toast = { msg: string; kind: "ok" | "err" | "warn" };

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = (msg: string, kind: Toast["kind"] = "ok") => {
    setToast({ msg, kind });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 4000);
  };
  return { toast, fire };
}

async function uploadImage(file: File): Promise<{ url?: string; error?: string }> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok) return { error: json.error ?? "Upload failed." };
  return { url: json.url };
}

export default function BrandingClient({
  platformName: initName,
  logoUrl: initLogo,
  faviconUrl: initFavicon,
  invoiceFooter: initFooter,
  showBrandBadge: initBadge,
  newColsExist,
  gstin: initGstin,
  legalName: initLegalName,
  registeredAddress: initRegisteredAddress,
  defaultTaxRate: initDefaultTaxRate,
}: Props) {
  const { toast, fire } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);

  const [platformName, setPlatformName] = useState(initName);
  const [logoUrl, setLogoUrl] = useState(initLogo);
  const [faviconUrl, setFaviconUrl] = useState(initFavicon);
  const [invoiceFooter, setInvoiceFooter] = useState(initFooter);
  const [showBrandBadge, setShowBrandBadge] = useState(initBadge);

  // GST / tax identity state
  const [gstin, setGstin] = useState(initGstin);
  const [legalName, setLegalName] = useState(initLegalName);
  const [registeredAddress, setRegisteredAddress] = useState(initRegisteredAddress);
  const [defaultTaxRate, setDefaultTaxRate] = useState(String(initDefaultTaxRate));

  async function handleUpload(kind: "logo" | "favicon", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    const res = await uploadImage(file);
    setUploading(null);
    if (res.error) {
      fire(res.error, "err");
    } else if (res.url) {
      if (kind === "logo") setLogoUrl(res.url);
      else setFaviconUrl(res.url);
      fire(`${kind === "logo" ? "Logo" : "Favicon"} uploaded. Save to persist.`, "ok");
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    // Inject controlled values that aren't in hidden inputs.
    fd.set("logo_url", logoUrl);
    fd.set("favicon_url", faviconUrl);
    fd.set("show_brand_badge", String(showBrandBadge));
    fd.set("gstin", gstin);
    fd.set("legal_name", legalName);
    fd.set("registered_address", registeredAddress);
    fd.set("default_tax_rate", defaultTaxRate);
    const res = await saveBrandingSettings(fd);
    setSaving(false);
    if (res.ok) {
      fire(res.error ?? "Branding saved.", res.error ? "warn" : "ok");
    } else {
      fire(res.error ?? "Failed.", "err");
    }
  }

  return (
    <>
      <style>{`
        .bc-grid{display:grid;gap:16px;grid-template-columns:1.4fr 1fr;align-items:start}
        @media(max-width:700px){.bc-grid{grid-template-columns:1fr}}
        .bc-field{margin-bottom:14px}
        .bc-field label{display:block;font-size:12.5px;font-weight:600;margin-bottom:5px}
        .bc-field input[type=text],.bc-field input[type=email],.bc-field input[type=number],.bc-field textarea{width:100%;padding:9px 12px;border:1.5px solid var(--dx-border);border-radius:10px;background:var(--dx-bg);color:var(--dx-text);font:inherit;outline:none;resize:vertical}
        .bc-field input[type=text]:focus,.bc-field input[type=number]:focus,.bc-field textarea:focus{border-color:var(--dx-primary)}
        .bc-field small{font-size:11.5px;color:var(--dx-muted);display:block;margin-top:4px}
        .bc-img-row{display:flex;align-items:center;gap:13px;margin-bottom:14px}
        .bc-img-pre{width:54px;height:54px;border-radius:13px;background:var(--dx-grad);flex:none;overflow:hidden;box-shadow:0 6px 16px -6px rgba(255,77,125,.4)}
        .bc-img-pre img{width:100%;height:100%;object-fit:cover}
        .bc-img-pre.empty{background:var(--dx-grad)}
        .bc-upload-btn{font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border:1.5px solid var(--dx-border);background:var(--dx-surface);color:var(--dx-text);border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
        .bc-upload-btn:hover{border-color:var(--dx-muted)}
        .bc-upload-btn:disabled{opacity:.5;cursor:not-allowed}
        .bc-upload-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
        .bc-srow{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--dx-border)}
        .bc-srow:first-child{border-top:0}
        .bc-tx{flex:1}
        .bc-tx b{font-size:13.5px;display:block}
        .bc-tx p{font-size:12px;color:var(--dx-muted);margin:3px 0 0}
        .bc-btn{font:inherit;font-weight:600;font-size:13px;border:0;border-radius:10px;padding:10px 18px;cursor:pointer;color:#fff;background:var(--dx-grad);display:inline-flex;align-items:center;gap:6px}
        .bc-btn:disabled{opacity:.55;cursor:not-allowed}
        .bc-warn{background:color-mix(in srgb, var(--dx-gold,#ffb23e) 14%, transparent);border:1px solid color-mix(in srgb, var(--dx-gold,#ffb23e) 35%, transparent);border-radius:10px;padding:11px 14px;font-size:12.5px;margin-bottom:14px}
        .bc-warn b{color:var(--dx-gold,#ffb23e)}
        .bc-badge-preview{display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:99px;background:var(--dx-surface2,var(--dx-surface));border:1px solid var(--dx-border);font-size:12.5px;font-weight:600;margin-top:10px}
        .bc-badge-dot{width:8px;height:8px;border-radius:50%;background:var(--dx-grad);flex:none}
        .bc-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100;padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:0 20px 50px -20px rgba(0,0,0,.5);display:flex;align-items:center;gap:9px;white-space:nowrap;max-width:90vw}
        .bc-toast.ok{background:#18121f;color:#fff}
        .bc-toast.err{background:#3a1822;color:#e5476f}
        .bc-toast.warn{background:#2a1f10;color:#ffb23e}
        .bc-toast .dot{width:8px;height:8px;border-radius:50%;flex:none}
        .bc-toast.ok .dot{background:#36c98e}
        .bc-toast.err .dot{background:#e5476f}
        .bc-toast.warn .dot{background:#ffb23e}
        .bc-note{font-size:11.5px;color:var(--dx-muted);font-style:italic;margin-top:4px}
        .bc-gst-grid{display:grid;gap:14px;grid-template-columns:1fr 1fr;align-items:start}
        @media(max-width:700px){.bc-gst-grid{grid-template-columns:1fr}}
        .bc-gst-rate{width:120px!important}
      `}</style>

      <Phead
        title="Branding"
        sub="Logo, favicon, platform name, and invoice footer — applied across every seller surface."
        action={
          <button className="btn grad" type="submit" form="brand-form" disabled={saving || uploading !== null}>
            {saving ? "Saving…" : "Save branding"}
          </button>
        }
      />

      {!newColsExist && (
        <div className="bc-warn" style={{ marginBottom: 16 }}>
          <b>Migration pending:</b> logo_url, favicon_url, platform_name, and invoice_footer columns do not exist yet. The badge toggle will save normally. All other fields will persist once migration 20260618260000 is applied.
        </div>
      )}

      <form id="brand-form" onSubmit={handleSave}>
        <input type="hidden" name="logo_url" value={logoUrl} />
        <input type="hidden" name="favicon_url" value={faviconUrl} />

        <div className="bc-grid">
          {/* Left: Identity */}
          <Card title="Identity">
            {/* Logo upload */}
            <div className="bc-img-row">
              <div className={`bc-img-pre${!logoUrl ? " empty" : ""}`}>
                {logoUrl && <img src={logoUrl} alt="Logo preview" />}
              </div>
              <div>
                <label htmlFor="logo-upload" className="bc-upload-btn" style={{ cursor: uploading === "logo" ? "not-allowed" : "pointer" }}>
                  {uploading === "logo" ? "Uploading…" : "Replace logo"}
                </label>
                <input
                  id="logo-upload"
                  className="bc-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  disabled={uploading !== null}
                  onChange={(e) => handleUpload("logo", e)}
                />
                {!newColsExist && <div className="bc-note">Saved after migration.</div>}
              </div>
            </div>

            {/* Favicon upload */}
            <div className="bc-img-row">
              <div className={`bc-img-pre${!faviconUrl ? " empty" : ""}`} style={{ width: 40, height: 40, borderRadius: 9 }}>
                {faviconUrl && <img src={faviconUrl} alt="Favicon preview" />}
              </div>
              <div>
                <label htmlFor="favicon-upload" className="bc-upload-btn" style={{ cursor: uploading === "favicon" ? "not-allowed" : "pointer" }}>
                  {uploading === "favicon" ? "Uploading…" : "Replace favicon"}
                </label>
                <input
                  id="favicon-upload"
                  className="bc-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/x-icon,image/svg+xml"
                  disabled={uploading !== null}
                  onChange={(e) => handleUpload("favicon", e)}
                />
                {!newColsExist && <div className="bc-note">Saved after migration.</div>}
              </div>
            </div>

            <div className="bc-field">
              <label>Platform name</label>
              <input
                type="text"
                name="platform_name"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder="invoxai"
              />
              <small>Used in email subjects, footers, and admin headings.</small>
              {!newColsExist && <div className="bc-note">Saved after migration.</div>}
            </div>

            <div className="bc-field" style={{ marginBottom: 0 }}>
              <label>Invoice / billing footer</label>
              <input
                type="text"
                name="invoice_footer"
                value={invoiceFooter}
                onChange={(e) => setInvoiceFooter(e.target.value)}
                placeholder="invoxai.io · Made in India"
              />
              <small>Appears at the bottom of every seller invoice PDF.</small>
              {!newColsExist && <div className="bc-note">Saved after migration.</div>}
            </div>
          </Card>

          {/* Right: Global controls */}
          <Card title="Global controls">
            <div className="bc-srow">
              <div className="bc-tx">
                <b>&quot;Built with invoxai&quot; badge</b>
                <p>Show on all free-plan public seller pages.</p>
              </div>
              <Switch on={showBrandBadge} onChange={setShowBrandBadge} />
            </div>

            {showBrandBadge && (
              <div className="bc-badge-preview">
                <span className="bc-badge-dot" />
                Built with {platformName || "invoxai"}
              </div>
            )}
          </Card>
        </div>

        {/* GST / Tax identity — full-width section below the two-column grid */}
        <div style={{ marginTop: 16 }}>
          <Card title="Platform GST / Tax identity">
            <p style={{ fontSize: 12.5, color: "var(--dx-muted)", margin: "0 0 14px" }}>
              Used on GST tax invoices generated for plan payments. Leave GSTIN blank if GST is not applicable.
            </p>
            <div className="bc-gst-grid">
              <div className="bc-field">
                <label>GSTIN</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  autoComplete="off"
                  spellCheck={false}
                />
                <small>15-character GST identification number. Leave blank if not registered.</small>
              </div>
              <div className="bc-field">
                <label>Default tax rate (%)</label>
                <input
                  type="number"
                  className="bc-gst-rate"
                  value={defaultTaxRate}
                  onChange={(e) => setDefaultTaxRate(e.target.value)}
                  placeholder="18"
                  min={0}
                  max={100}
                  step={0.01}
                />
                <small>Platform-wide default tax rate applied to plan payments (0–100). Typical GST: 18.</small>
              </div>
              <div className="bc-field">
                <label>Legal name</label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Acme Technologies Private Limited"
                />
                <small>Registered legal entity name — printed on GST invoices.</small>
              </div>
              <div className="bc-field" style={{ gridColumn: "1 / -1" }}>
                <label>Registered address</label>
                <textarea
                  value={registeredAddress}
                  onChange={(e) => setRegisteredAddress(e.target.value)}
                  placeholder="123, Business Park, Suite 4, Mumbai, Maharashtra 400001"
                  rows={3}
                />
                <small>Full registered address including city, state, and PIN — printed on GST invoices.</small>
              </div>
            </div>
          </Card>
        </div>
      </form>

      {toast && (
        <div className={`bc-toast ${toast.kind}`}>
          <span className="dot" />
          {toast.msg}
        </div>
      )}
    </>
  );
}
