"use client";

import { useMemo, useState, useTransition } from "react";
import ImageInput from "@/components/ImageInput";
import { Card } from "@/components/dx/ui";
import { saveBillingPdfBranding, saveSellerSendFrom } from "./actions";

type Feedback = { msg: string; ok: boolean } | null;

const DEFAULT_GRADIENT = "linear-gradient(135deg, #ffb23e, #ff6a3d 40%, #ff4d7d 72%, #7b3fe4)";

function isHex(v: string): boolean {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v.trim());
}

function rupees(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0 });
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && (
        <small style={{ display: "block", fontSize: 11.5, color: "var(--dx-muted, #8a8088)", marginTop: 4 }}>
          {hint}
        </small>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid var(--dx-border, #2a2530)",
  borderRadius: 10,
  background: "var(--dx-bg, #18121f)",
  color: "var(--dx-text, #fff)",
  font: "inherit",
  outline: "none",
};

function Fb({ fb }: { fb: Feedback }) {
  if (!fb) return null;
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        marginTop: 8,
        background: fb.ok
          ? "color-mix(in srgb, #22c55e 14%, transparent)"
          : "color-mix(in srgb, #e5476f 14%, transparent)",
        color: fb.ok ? "#22c55e" : "#e5476f",
      }}
    >
      {fb.msg}
    </div>
  );
}

export default function BillingPdfClient(props: {
  storeName: string;
  currency: string;
  logoUrl: string;
  invoiceBusinessName: string;
  legalName: string;
  gstin: string;
  gstRate: number | null;
  invoiceAccentColor: string;
  invoiceFooter: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  sendFromEmail: string;
  replyToEmail: string;
}) {
  // ── Billing-PDF design state ────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState(props.logoUrl);
  const [bizName, setBizName] = useState(props.invoiceBusinessName);
  const [legalName, setLegalName] = useState(props.legalName);
  const [gstin, setGstin] = useState(props.gstin);
  const [gstRate, setGstRate] = useState(props.gstRate != null ? String(props.gstRate) : "");
  const [accent, setAccent] = useState(props.invoiceAccentColor);
  const [footer, setFooter] = useState(props.invoiceFooter);
  const [address, setAddress] = useState(props.address);
  const [city, setCity] = useState(props.city);
  const [stateV, setStateV] = useState(props.state);
  const [postal, setPostal] = useState(props.postalCode);
  const [brandFb, setBrandFb] = useState<Feedback>(null);
  const [savingBrand, startBrand] = useTransition();

  // ── Send-from state ─────────────────────────────────────────────────────────
  const [sendFrom, setSendFrom] = useState(props.sendFromEmail);
  const [replyTo, setReplyTo] = useState(props.replyToEmail);
  const [mailFb, setMailFb] = useState<Feedback>(null);
  const [savingMail, startMail] = useTransition();

  // ── Custom invoice state ────────────────────────────────────────────────────
  const [ciBuyerName, setCiBuyerName] = useState("");
  const [ciBuyerEmail, setCiBuyerEmail] = useState("");
  const [ciTitle, setCiTitle] = useState("");
  const [ciTaxRate, setCiTaxRate] = useState(props.gstRate != null ? String(props.gstRate) : "");
  const [ciSameState, setCiSameState] = useState(true);
  const [ciSendEmail, setCiSendEmail] = useState(false);
  const [ciItems, setCiItems] = useState<{ description: string; amount: string }[]>([
    { description: "", amount: "" },
  ]);
  const [ciFb, setCiFb] = useState<Feedback>(null);
  const [ciResult, setCiResult] = useState<{ pdfUrl: string; number: string; emailed: boolean } | null>(null);
  const [ciBusy, setCiBusy] = useState(false);

  const accentValid = !accent || isHex(accent);
  const previewAccent = accentValid && accent ? accent : null;

  // Live custom-invoice totals (display only; the server recomputes on submit).
  const ciTotals = useMemo(() => {
    const gross = ciItems.reduce((s, it) => {
      const n = Number(it.amount);
      return s + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
    const rate = Number(ciTaxRate);
    const r = Number.isFinite(rate) && rate > 0 ? rate : 0;
    const subtotal = r > 0 ? gross / (1 + r / 100) : gross;
    const tax = gross - subtotal;
    return { gross, subtotal, tax, rate: r };
  }, [ciItems, ciTaxRate]);

  function saveBrand() {
    setBrandFb(null);
    startBrand(async () => {
      const res = await saveBillingPdfBranding({
        logo_url: logoUrl,
        invoice_business_name: bizName,
        legal_name: legalName,
        gstin,
        gst_rate: gstRate === "" ? null : gstRate,
        invoice_accent_color: accent,
        invoice_footer: footer,
        address,
        city,
        state: stateV,
        postal_code: postal,
      });
      setBrandFb(res.ok ? { msg: "Invoice design saved.", ok: true } : { msg: res.error ?? "Failed.", ok: false });
    });
  }

  function saveMail() {
    setMailFb(null);
    startMail(async () => {
      const res = await saveSellerSendFrom({ send_from_email: sendFrom, reply_to_email: replyTo });
      setMailFb(res.ok ? { msg: "Email settings saved.", ok: true } : { msg: res.error ?? "Failed.", ok: false });
    });
  }

  async function createInvoice() {
    setCiFb(null);
    setCiResult(null);
    const items = ciItems
      .map((it) => ({ description: it.description.trim(), amount: Number(it.amount) }))
      .filter((it) => it.description || it.amount);
    if (items.length === 0) {
      setCiFb({ msg: "Add at least one line item.", ok: false });
      return;
    }
    setCiBusy(true);
    try {
      const res = await fetch("/api/invoices/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_name: ciBuyerName,
          buyer_email: ciBuyerEmail,
          title: ciTitle,
          currency: props.currency,
          tax_rate: ciTaxRate === "" ? null : ciTaxRate,
          same_state: ciSameState,
          send_email: ciSendEmail,
          line_items: items,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setCiFb({ msg: json.error ?? "Could not create the invoice.", ok: false });
      } else {
        setCiResult({ pdfUrl: json.pdfUrl, number: json.invoiceNumber, emailed: json.emailed });
        setCiFb({
          msg: json.emailed
            ? `Invoice ${json.invoiceNumber} created and emailed to ${ciBuyerEmail}.`
            : `Invoice ${json.invoiceNumber} created.`,
          ok: true,
        });
      }
    } catch {
      setCiFb({ msg: "Network error creating the invoice.", ok: false });
    } finally {
      setCiBusy(false);
    }
  }

  const curSym = props.currency === "INR" ? "₹" : props.currency + " ";

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 920 }}>
      {/* ───────────────── 1. Billing-PDF design ───────────────── */}
      <Card title="Invoice / billing PDF design">
        <p style={{ fontSize: 12.5, color: "var(--dx-muted, #8a8088)", margin: "0 0 16px" }}>
          These details appear on the PDF invoices your buyers receive for orders, and on any custom
          bills you create below. Your logo and business identity replace the platform default.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
          {/* Left: fields */}
          <div>
            <Field label="Business logo" hint="Shown at the top of your invoices.">
              <ImageInput value={logoUrl} onChange={setLogoUrl} placeholder="https://…/logo.png" />
            </Field>
            <Field label="Business name" hint="Printed as the seller / issuer on your invoices.">
              <input style={inputStyle} value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder={props.storeName || "Your business"} />
            </Field>
            <Field label="Legal entity name" hint="Optional registered legal name (shown if set).">
              <input style={inputStyle} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Acme Pvt Ltd" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
              <Field label="GSTIN / Tax ID" hint="15-char GSTIN if registered.">
                <input style={inputStyle} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" maxLength={15} spellCheck={false} />
              </Field>
              <Field label="GST rate %" hint="Default 0">
                <input style={inputStyle} type="number" min={0} max={100} step={0.01} value={gstRate} onChange={(e) => setGstRate(e.target.value)} placeholder="18" />
              </Field>
            </div>
            <Field label="Address">
              <input style={inputStyle} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street / building" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="City">
                <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="State">
                <input style={inputStyle} value={stateV} onChange={(e) => setStateV(e.target.value)} />
              </Field>
              <Field label="PIN">
                <input style={inputStyle} value={postal} onChange={(e) => setPostal(e.target.value)} />
              </Field>
            </div>
            <Field label="Accent colour" hint="Hex like #ff6a3d. Blank = platform sunset gradient.">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="color"
                  value={accentValid && accent ? accent : "#ff6a3d"}
                  onChange={(e) => setAccent(e.target.value)}
                  style={{ width: 42, height: 38, border: "none", background: "none", padding: 0, cursor: "pointer" }}
                />
                <input
                  style={{ ...inputStyle, flex: 1, borderColor: accentValid ? undefined : "#e5476f" }}
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  placeholder="#ff6a3d"
                />
                {accent && (
                  <button type="button" onClick={() => setAccent("")} style={{ ...inputStyle, width: "auto", cursor: "pointer", padding: "9px 12px" }}>
                    Reset
                  </button>
                )}
              </div>
            </Field>
            <Field label="Footer note" hint="Up to 200 chars, shown at the bottom of the PDF.">
              <input style={inputStyle} value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={200} placeholder="Thank you for your business!" />
            </Field>
          </div>

          {/* Right: live mini preview */}
          <div style={{ position: "sticky", top: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--dx-muted, #8a8088)", marginBottom: 8 }}>
              Live preview
            </div>
            <div style={{ background: "#fff", color: "#1c1320", borderRadius: 12, padding: 18, boxShadow: "0 10px 30px -12px rgba(0,0,0,.5)" }}>
              <div style={{ height: 6, borderRadius: 99, background: previewAccent ?? DEFAULT_GRADIENT, marginBottom: 14 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="logo" style={{ maxHeight: 32, maxWidth: 120, objectFit: "contain", display: "block", marginBottom: 4 }} />
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{bizName || props.storeName || "Your business"}</div>
                  )}
                  <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 1, color: "#8a8088" }}>TAX INVOICE</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 10, color: "#4a3f47" }}>
                  <div style={{ fontWeight: 700, fontFamily: "monospace" }}>INV-0001</div>
                  <div>Date: today</div>
                </div>
              </div>
              <div style={{ background: "#f9f7fb", border: "1px solid #ede9f3", borderRadius: 8, padding: 12, margin: "12px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: previewAccent ?? "#7b3fe4" }}>SELLER</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{bizName || legalName || props.storeName || "Your business"}</div>
                  {gstin && <div style={{ fontSize: 9, fontFamily: "monospace", color: "#4a3f47" }}>GSTIN: {gstin}</div>}
                  {(address || city) && <div style={{ fontSize: 9, color: "#7a6770" }}>{[address, city, stateV, postal].filter(Boolean).join(", ")}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: previewAccent ?? "#7b3fe4" }}>BILL TO</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>Your customer</div>
                </div>
              </div>
              <div style={{ borderTop: "2px solid #1c1320", marginTop: 8, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                <span>Total</span>
                <span>{curSym}1,000</span>
              </div>
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #ede9f3", fontSize: 8.5, color: "#9a8898", textAlign: "center" }}>
                {footer || "This is a computer-generated tax invoice. No physical signature is required."}
              </div>
            </div>
          </div>
        </div>

        <Fb fb={brandFb} />
        <div style={{ marginTop: 12 }}>
          <button className="btn grad" onClick={saveBrand} disabled={savingBrand}>
            {savingBrand ? "Saving…" : "Save invoice design"}
          </button>
        </div>
      </Card>

      {/* ───────────────── 2. Send-from email ───────────────── */}
      <Card title="Custom send-from email">
        <div
          style={{
            background: "color-mix(in srgb, #ffb23e 12%, transparent)",
            border: "1px solid color-mix(in srgb, #ffb23e 35%, transparent)",
            borderRadius: 9,
            padding: "10px 13px",
            marginBottom: 16,
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          <strong>Deliverability note.</strong> Setting a send-from address here changes the{" "}
          <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>From:</code> on your
          buyer order &amp; invoice emails. For mail to actually deliver as your own address, your
          domain still needs DKIM/SPF aligned with the platform mailer. Until that is verified, providers
          may rewrite or filter a custom From — so leaving this blank (mail goes out from the platform
          alias with your address as Reply-To) is the most reliable option. This is an honest platform limit.
        </div>

        <Field label="Send-from email" hint="From: address on your order & invoice emails. Blank = platform default alias.">
          <input style={inputStyle} type="email" value={sendFrom} onChange={(e) => setSendFrom(e.target.value)} placeholder="billing@yourbrand.com" />
        </Field>
        <Field label="Reply-to email" hint="Where buyer replies land. Recommended even if send-from is blank.">
          <input style={inputStyle} type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="support@yourbrand.com" />
        </Field>

        <Fb fb={mailFb} />
        <div style={{ marginTop: 12 }}>
          <button className="btn grad" onClick={saveMail} disabled={savingMail}>
            {savingMail ? "Saving…" : "Save email settings"}
          </button>
        </div>
      </Card>

      {/* ───────────────── 3. Create custom invoice ───────────────── */}
      <Card title="Create a custom invoice">
        <p style={{ fontSize: 12.5, color: "var(--dx-muted, #8a8088)", margin: "0 0 16px" }}>
          Bill a customer for anything — services, deposits, off-platform sales. Amounts are totalled and
          taxed on the server, then rendered as a branded PDF (using your design above) you can download
          or email to the customer.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Customer name">
            <input style={inputStyle} value={ciBuyerName} onChange={(e) => setCiBuyerName(e.target.value)} placeholder="Jane Doe" />
          </Field>
          <Field label="Customer email" hint="Required only if you email the invoice.">
            <input style={inputStyle} type="email" value={ciBuyerEmail} onChange={(e) => setCiBuyerEmail(e.target.value)} placeholder="jane@example.com" />
          </Field>
        </div>
        <Field label="Invoice title / description">
          <input style={inputStyle} value={ciTitle} onChange={(e) => setCiTitle(e.target.value)} placeholder="Consulting — June 2026" />
        </Field>

        {/* Line items */}
        <div style={{ fontSize: 12.5, fontWeight: 600, margin: "6px 0 8px" }}>Line items</div>
        <div style={{ display: "grid", gap: 8 }}>
          {ciItems.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 36px", gap: 8 }}>
              <input
                style={inputStyle}
                value={it.description}
                placeholder="Description"
                onChange={(e) => {
                  const next = [...ciItems];
                  next[i] = { ...next[i], description: e.target.value };
                  setCiItems(next);
                }}
              />
              <input
                style={inputStyle}
                type="number"
                min={0}
                step={0.01}
                value={it.amount}
                placeholder={`Amount (${props.currency})`}
                onChange={(e) => {
                  const next = [...ciItems];
                  next[i] = { ...next[i], amount: e.target.value };
                  setCiItems(next);
                }}
              />
              <button
                type="button"
                onClick={() => setCiItems(ciItems.length > 1 ? ciItems.filter((_, j) => j !== i) : ciItems)}
                disabled={ciItems.length <= 1}
                style={{ ...inputStyle, width: 36, padding: 0, cursor: ciItems.length > 1 ? "pointer" : "not-allowed", opacity: ciItems.length > 1 ? 1 : 0.4 }}
                aria-label="Remove line item"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCiItems([...ciItems, { description: "", amount: "" }])}
          style={{ ...inputStyle, width: "auto", cursor: "pointer", marginTop: 8, padding: "8px 14px", fontSize: 13 }}
        >
          + Add line item
        </button>

        {/* Tax */}
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, marginTop: 14 }}>
          <Field label="GST rate %" hint="0 = no tax">
            <input style={inputStyle} type="number" min={0} max={100} step={0.01} value={ciTaxRate} onChange={(e) => setCiTaxRate(e.target.value)} placeholder="18" />
          </Field>
          <Field label="GST type" hint="Intra-state = CGST+SGST; inter-state = IGST.">
            <select
              style={inputStyle}
              value={ciSameState ? "intra" : "inter"}
              onChange={(e) => setCiSameState(e.target.value === "intra")}
            >
              <option value="intra">Intra-state (CGST + SGST)</option>
              <option value="inter">Inter-state (IGST)</option>
            </select>
          </Field>
        </div>

        {/* Live totals (display-only; server is source of truth) */}
        <div style={{ background: "var(--dx-surface, #1f1827)", borderRadius: 10, padding: "12px 14px", margin: "6px 0 14px", fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--dx-muted, #8a8088)" }}>
            <span>Taxable value</span>
            <span>{curSym}{rupees(Math.round(ciTotals.subtotal * 100) / 100)}</span>
          </div>
          {ciTotals.rate > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--dx-muted, #8a8088)", marginTop: 4 }}>
              <span>GST @ {ciTotals.rate}%</span>
              <span>{curSym}{rupees(Math.round(ciTotals.tax * 100) / 100)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--dx-border, #2a2530)" }}>
            <span>Total</span>
            <span>{curSym}{rupees(Math.round(ciTotals.gross * 100) / 100)}</span>
          </div>
          <small style={{ color: "var(--dx-muted, #8a8088)", fontSize: 11 }}>
            GST is computed on the entered amounts as a tax-inclusive total. Final figures are recomputed on the server.
          </small>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" checked={ciSendEmail} onChange={(e) => setCiSendEmail(e.target.checked)} />
          Email the invoice PDF to the customer
        </label>

        <Fb fb={ciFb} />
        {ciResult && (
          <div style={{ marginTop: 10 }}>
            <a className="btn" href={ciResult.pdfUrl} target="_blank" rel="noopener noreferrer">
              Download invoice {ciResult.number} (PDF)
            </a>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <button className="btn grad" onClick={createInvoice} disabled={ciBusy}>
            {ciBusy ? "Creating…" : ciSendEmail ? "Create & email invoice" : "Create invoice"}
          </button>
        </div>
      </Card>
    </div>
  );
}
