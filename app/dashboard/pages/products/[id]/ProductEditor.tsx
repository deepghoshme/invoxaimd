"use client";

import { useState, useRef, useEffect } from "react";
import ImageInput from "@/components/ImageInput";
import RichText from "@/components/RichText";
import ProductTemplate from "@/components/templates/ProductTemplate";
import { type OppContent, type Testimonial, type Faq, BADGE_PRESETS, PRODUCT_TYPES, PLAN_PERIODS, OPP_THEMES } from "@/lib/products";
import { ACCENTS, FONTS, BTSHAPES, WIDTHS, BGS } from "@/lib/website";
import { saveProduct, setProductStatus } from "../actions";

/** ISO → value for <input type="datetime-local"> (local time). */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Builder primitives (match Store/Website builder) ──────────────────────────
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button type="button" className={`switch${on ? " on" : ""}`} onClick={onClick}><i /></button>;
}

function Sec({ title, children, open: openDefault = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(openDefault);
  return (
    <div className={`sec${open ? "" : " collapsed"}`}>
      <h3 onClick={() => setOpen((o) => !o)}>{title}</h3>
      {children}
    </div>
  );
}

/** Scales a fixed-width desktop render down to fit the preview column. */
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

type PageData = {
  id: string;
  title: string | null;
  public_id: string | null;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  pixels: Record<string, unknown>;
  status: string;
};

export default function ProductEditor({
  page,
  publicUrl,
  payEnabled,
}: {
  page: PageData;
  publicUrl: string | null;
  payEnabled: boolean;
}) {
  const c = page.content as OppContent;
  const s = page.seo as Record<string, string>;
  const px = page.pixels as Record<string, string>;

  const [layout, setLayout] = useState<"landing" | "pdp">(c.layout ?? "landing");
  const [theme, setTheme] = useState<NonNullable<OppContent["theme"]>>(c.theme ?? {});
  const setTh = (patch: Partial<NonNullable<OppContent["theme"]>>) => setTheme((t) => ({ ...t, ...patch }));
  const [category, setCategory] = useState(c.category ?? "");
  const [productType, setProductType] = useState<"digital" | "physical" | "service" | "subscription">(c.productType ?? "digital");
  const [plans, setPlans] = useState<{ label: string; price: number; period?: string }[]>(c.plans ?? []);
  const [digitalKind, setDigitalKind] = useState<"file" | "url">(c.digital?.kind ?? "url");
  const [digitalFile, setDigitalFile] = useState(c.digital?.file ?? "");
  const [digitalUrl, setDigitalUrl] = useState(c.digital?.url ?? "");
  const [deliveryDays, setDeliveryDays] = useState(String(c.deliveryDays ?? 4));
  const [dfBusy, setDfBusy] = useState(false);
  const [headline, setHeadline] = useState(c.headline ?? "");
  const [subheadline, setSubheadline] = useState(c.subheadline ?? "");
  const [descHtml, setDescHtml] = useState(
    c.description_html ?? (c.description ? `<p>${c.description}</p>` : ""),
  );
  const [imageUrl, setImageUrl] = useState(c.image_url ?? "");
  const [price, setPrice] = useState(c.price != null ? String(c.price) : "");
  const [compareAt, setCompareAt] = useState(c.compare_at_price != null ? String(c.compare_at_price) : "");
  const [currency, setCurrency] = useState((c.currency || "INR").toUpperCase());
  const [ctaLabel, setCtaLabel] = useState(c.cta_label ?? "");
  const [ctaIcon, setCtaIcon] = useState(c.cta_icon ?? "");
  const [ctaAnim, setCtaAnim] = useState<"none" | "shine" | "pulse">(c.cta_animation ?? "shine");
  const [stickyBuy, setStickyBuy] = useState(c.sticky_buy !== false);
  const [featureItems, setFeatureItems] = useState<{ text: string; icon?: string }[]>(
    c.feature_items?.length ? c.feature_items : (c.features ?? []).map((t) => ({ text: t })),
  );
  const [gallery, setGallery] = useState<string[]>(c.gallery ?? []);
  const [badges, setBadges] = useState<string[]>(c.badges ?? []);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(c.testimonials ?? []);
  const [faqs, setFaqs] = useState<Faq[]>(c.faqs ?? []);
  const [privacy, setPrivacy] = useState(c.policies?.privacy ?? "");
  const [terms, setTerms] = useState(c.policies?.terms ?? "");
  const [refund, setRefund] = useState(c.policies?.refund ?? "");
  const [showLogos, setShowLogos] = useState(c.show_payment_logos !== false);
  const [payIcons, setPayIcons] = useState<string[]>(c.payment_icons ?? []);
  const [sellerEmail, setSellerEmail] = useState(c.seller_email ?? "");
  const [sellerPhone, setSellerPhone] = useState(c.seller_phone ?? "");
  const [customBadge, setCustomBadge] = useState("");
  const [titleAlign, setTitleAlign] = useState<"left" | "center" | "right">(c.title_align ?? "left");
  const [titleIcon, setTitleIcon] = useState(c.title_icon ?? "");
  const [autoplay, setAutoplay] = useState(!!c.gallery_autoplay);
  const [interval, setIntervalSec] = useState(String(c.gallery_interval ?? 4));
  const [cdEnabled, setCdEnabled] = useState(!!c.countdown_enabled);
  const [cdEnd, setCdEnd] = useState(toLocalInput(c.countdown_end));
  const [cdMsg, setCdMsg] = useState(c.countdown_expire_msg ?? "");
  const [cdDisable, setCdDisable] = useState(!!c.countdown_disable_buy);
  const [cdAlign, setCdAlign] = useState<"left" | "center" | "right">(c.countdown_align ?? "left");
  const [seatsEnabled, setSeatsEnabled] = useState(!!c.seats_enabled);
  const [seatsTotal, setSeatsTotal] = useState(c.seats_total != null ? String(c.seats_total) : "");
  const [contactWa, setContactWa] = useState(c.contact_whatsapp ?? "");
  const [contactEmail, setContactEmail] = useState(c.contact_email ?? "");
  const [contactUrl, setContactUrl] = useState(c.contact_url ?? "");
  const [contactLabel, setContactLabel] = useState(c.contact_label ?? "");
  const [contactIcon, setContactIcon] = useState(c.contact_icon ?? "");
  const [lpEnabled, setLpEnabled] = useState(!!c.liveproof_enabled);
  const [lpInterval, setLpInterval] = useState(String(c.liveproof_interval ?? 8));
  const [lpItems, setLpItems] = useState<{ name: string; location?: string }[]>(c.liveproof_items ?? []);

  function toggleBadge(b: string) {
    setBadges((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  }

  const [seoTitle, setSeoTitle] = useState(s.title ?? "");
  const [seoDesc, setSeoDesc] = useState(s.description ?? "");
  const [ogImage, setOgImage] = useState(s.og_image ?? "");
  const [metaPixel, setMetaPixel] = useState(px.meta_pixel_id ?? "");
  const [googleId, setGoogleId] = useState(px.google_id ?? "");

  const [view, setView] = useState<"edit" | "public">("edit");
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState(page.status);

  const liveContent: OppContent = {
    layout,
    theme,
    category: category || undefined,
    productType,
    plans: plans.filter((p) => p.label),
    digital: productType === "digital" ? { kind: digitalKind, file: digitalFile || undefined, url: digitalUrl || undefined } : undefined,
    deliveryDays: productType === "physical" ? (parseInt(deliveryDays) || 4) : undefined,
    headline,
    subheadline,
    image_url: imageUrl || undefined,
    gallery: gallery.filter(Boolean),
    price: price ? parseFloat(price) : undefined,
    compare_at_price: compareAt ? parseFloat(compareAt) : undefined,
    currency,
    cta_label: ctaLabel || undefined,
    cta_icon: ctaIcon.trim() || undefined,
    cta_animation: ctaAnim,
    sticky_buy: stickyBuy,
    description_html: descHtml || undefined,
    feature_items: featureItems.filter((f) => f.text.trim()),
    badges: badges.filter((b) => b.trim()),
    testimonials: testimonials.filter((t) => t.text.trim()),
    faqs: faqs.filter((f) => f.q.trim()),
    policies: { privacy, terms, refund },
    show_payment_logos: showLogos,
    payment_icons: payIcons.filter(Boolean),
    seller_email: sellerEmail.trim(),
    seller_phone: sellerPhone.trim(),
    title_align: titleAlign,
    title_icon: titleIcon.trim(),
    gallery_autoplay: autoplay,
    gallery_interval: parseFloat(interval) || 4,
    countdown_enabled: cdEnabled,
    countdown_end: cdEnd ? new Date(cdEnd).toISOString() : undefined,
    countdown_expire_msg: cdMsg,
    countdown_disable_buy: cdDisable,
    countdown_align: cdAlign,
    seats_enabled: seatsEnabled,
    seats_total: seatsTotal ? parseInt(seatsTotal) : undefined,
    contact_whatsapp: contactWa.trim() || undefined,
    contact_email: contactEmail.trim() || undefined,
    contact_url: contactUrl.trim() || undefined,
    contact_label: contactLabel.trim() || undefined,
    contact_icon: contactIcon.trim() || undefined,
    liveproof_enabled: lpEnabled,
    liveproof_interval: parseFloat(lpInterval) || 8,
    liveproof_items: lpItems.filter((x) => x.name.trim()),
  };

  function payload() {
    return {
      title: headline || "Product",
      content: liveContent as Record<string, unknown>,
      seo: { title: seoTitle, description: seoDesc, og_image: ogImage },
      pixels: { meta_pixel_id: metaPixel, google_id: googleId },
    };
  }

  async function save(): Promise<boolean> {
    setState("saving");
    setMsg(null);
    const res = await saveProduct(page.id, payload());
    setState("idle");
    if (!res.ok) {
      setMsg(res.error ?? "Save failed");
      return false;
    }
    setMsg("Saved ✓");
    setTimeout(() => setMsg(null), 1500);
    return true;
  }

  async function publish() {
    setErr(null);
    if (!liveContent.price || (liveContent.price ?? 0) <= 0) {
      setErr("Set a price above 0 before publishing.");
      return;
    }
    if (!sellerEmail.trim()) {
      setErr("⚠️ Add a seller contact email (in “Seller contact”) before publishing — it’s required.");
      return;
    }
    const saved = await save();
    if (!saved) return;
    const res = await setProductStatus(page.id, "published");
    if (res.ok) {
      setStatus("published");
      setMsg("Published ✓");
    } else {
      setErr(res.error ?? "Publish failed");
    }
  }

  async function unpublish() {
    const res = await setProductStatus(page.id, "draft");
    if (res.ok) setStatus("draft");
  }

  const themeKey = `${layout}-${theme.mode ?? "light"}-${theme.bg ?? "aurora"}-${theme.accent ?? 0}-${theme.color ?? ""}-${theme.font ?? "sora"}`;
  const previewProduct = (
    <ProductTemplate
      content={liveContent}
      pageId={page.id}
      payEnabled={payEnabled}
      showBrand={false}
      preview
      forceMobile={device === "mobile"}
    />
  );

  const Preview = () => (
    <div className="previewwrap">
      <div className={`browser${device === "mobile" ? " mob" : ""}`}>
        <div className="bchrome">
          <span className="bdot" /><span className="bdot" /><span className="bdot" />
          <span className="fav" style={{ background: "var(--primary)" }} />
          <span className="burl">{publicUrl ? publicUrl.replace("https://", "") : "yourstore.invoxai.io/opp/…"}</span>
          <div className="seg pvseg">
            <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>🖥</button>
            <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>📱</button>
          </div>
        </div>
        <div className="scr">{device === "web"
          ? <ScaledFrame width={1280}><div key={themeKey}>{previewProduct}</div></ScaledFrame>
          : <div key={`m-${themeKey}`}>{previewProduct}</div>}</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="dx-phead">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a href="/dashboard/store" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>← Products</a>
          <div className="web-seg">
            <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>Builder</button>
            <button className={view === "public" ? "on" : ""} onClick={() => setView("public")}>Full preview</button>
          </div>
          <span className={`badge-pill ${status === "published" ? "is-live" : "is-draft"}`}>{status === "published" ? "Live" : "Draft"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          {publicUrl && status === "published" && <a className="dx-editbtn" href={publicUrl} target="_blank" rel="noreferrer">View ↗</a>}
          <button className="dx-editbtn" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save draft"}</button>
          {status === "published" ? <button className="dx-editbtn" onClick={unpublish}>Unpublish</button> : <button className="btn grad" onClick={publish}>Publish</button>}
        </div>
      </div>

      {!payEnabled && (
        <div className="alert alert-error" style={{ marginBottom: 14 }}>
          Payments aren’t connected yet — buyers can’t pay until you <a href="/dashboard/settings/payments">connect Razorpay</a>.
        </div>
      )}
      {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>{err}</div>}

      {view === "public" && (
        <div className="web-public-view">
          <div style={{ maxHeight: "calc(100vh - 170px)", overflowY: "auto" }}>
            <ProductTemplate content={liveContent} pageId={page.id} payEnabled={payEnabled} showBrand={false} preview />
          </div>
        </div>
      )}

      <div className="webbuild" style={view === "public" ? { display: "none" } : undefined}>
        <div className="webacc">

          {/* Brand & theme */}
          <Sec title="Brand & theme">
            <div className="field">
              <label>Quick templates</label>
              <div className="chips">{OPP_THEMES.map((t) => <div key={t.name} className="chip" onClick={() => setTheme({ ...theme, ...t.patch })}>{t.name}</div>)}</div>
            </div>
            <div className="field">
              <label>Accent</label>
              <div className="swatches">{ACCENTS.map((a, i) => <div key={i} className={`sw${!theme.color && (theme.accent ?? 0) === i ? " on" : ""}`} style={{ background: a[1] }} title={a[0]} onClick={() => setTh({ accent: i, color: undefined })} />)}</div>
            </div>
            <div className="field">
              <label>Custom brand color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" value={theme.color || "#ff6a3d"} onChange={(e) => setTh({ color: e.target.value })} style={{ width: 44, height: 34, padding: 2, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }} />
                {theme.color && <button className="dx-editbtn" onClick={() => setTh({ color: undefined })}>Use preset</button>}
              </div>
            </div>
            <div className="field"><label>Color theme</label><div className="chips">{[["light", "Light"], ["dark", "Dark"]].map(([k, l]) => <div key={k} className={`chip${(theme.mode ?? "light") === k ? " on" : ""}`} onClick={() => setTh({ mode: k as "light" | "dark" })}>{l}</div>)}</div></div>
            <div className="field"><label>Heading font</label><div className="chips">{FONTS.map((f) => <div key={f[0]} className={`chip${(theme.font ?? "sora") === f[0] ? " on" : ""}`} onClick={() => setTh({ font: f[0] })}>{f[1]}</div>)}</div></div>
            <div className="field"><label>Button shape</label><div className="chips">{BTSHAPES.map((b) => <div key={b[0]} className={`chip${(theme.btshape ?? "soft") === b[0] ? " on" : ""}`} onClick={() => setTh({ btshape: b[0] })}>{b[1]}</div>)}</div></div>
            <div className="field"><label>Content width</label><div className="chips">{WIDTHS.map((w) => <div key={w[0]} className={`chip${(theme.width ?? "standard") === w[0] ? " on" : ""}`} onClick={() => setTh({ width: w[0] })}>{w[1]}</div>)}</div></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Background (landing page)</label><div className="chips">{BGS.map((b) => <div key={b[0]} className={`chip${(theme.bg ?? "aurora") === b[0] ? " on" : ""}`} onClick={() => setTh({ bg: b[0] })}>{b[1]}</div>)}</div></div>
          </Sec>

          {/* Layout & details */}
          <Sec title="Layout & details">
            <div className="field">
              <label>Page layout</label>
              <div className="chips">{([["landing", "Landing page"], ["pdp", "Catalog (PDP)"]] as const).map(([k, l]) => <div key={k} className={`chip${layout === k ? " on" : ""}`} onClick={() => setLayout(k)}>{l}</div>)}</div>
            </div>
            <div className="field"><label>Headline</label><input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Product name" /></div>
            <div className="field"><label>Category (store filter / PDP)</label><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Courses" /></div>
            <div className="field">
              <label>Product type</label>
              <div className="chips">{PRODUCT_TYPES.map(([k, lbl]) => <div key={k} className={`chip${productType === k ? " on" : ""}`} onClick={() => setProductType(k as typeof productType)}>{lbl}</div>)}</div>
            </div>

            {(productType === "service" || productType === "subscription") && (
              <div className="field">
                <label>Plans (buyer picks one)</label>
                {plans.map((p, i) => (
                  <div className="frow" key={i}>
                    <input style={{ flex: 2 }} value={p.label} onChange={(e) => setPlans(plans.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Plan name" />
                    <select style={{ width: 90 }} value={p.period ?? "monthly"} onChange={(e) => setPlans(plans.map((x, j) => (j === i ? { ...x, period: e.target.value } : x)))}>{PLAN_PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <input style={{ width: 70 }} type="number" value={p.price || ""} onChange={(e) => setPlans(plans.map((x, j) => (j === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x)))} placeholder="₹" />
                    <button className="del" type="button" onClick={() => setPlans(plans.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <button type="button" className="addrow" onClick={() => setPlans([...plans, { label: "Monthly", period: "monthly", price: 0 }])}>+ Add plan</button>
              </div>
            )}

            {productType === "digital" && (
              <div className="field">
                <label>Digital delivery (buyer gets this after purchase)</label>
                <div className="chips" style={{ marginBottom: 8 }}>{([["url", "Link / URL"], ["file", "File / PDF"]] as const).map(([k, lbl]) => <div key={k} className={`chip${digitalKind === k ? " on" : ""}`} onClick={() => setDigitalKind(k)}>{lbl}</div>)}</div>
                {digitalKind === "url"
                  ? <input value={digitalUrl} onChange={(e) => setDigitalUrl(e.target.value)} placeholder="https://… (download / access link)" />
                  : <label className="up"><span className="ico">{dfBusy ? "…" : "📄"}</span><span className="t">{dfBusy ? "Uploading…" : digitalFile ? "Replace file ✓" : "Upload file / PDF"}</span><input type="file" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setDfBusy(true); const fd = new FormData(); fd.append("file", f); try { const res = await fetch("/api/upload", { method: "POST", body: fd }); const j = await res.json(); if (res.ok) setDigitalFile(j.url); } catch {} setDfBusy(false); }} /></label>}
                {digitalKind === "file" && digitalFile && <div className="dx-muted" style={{ fontSize: 11, marginTop: 6, wordBreak: "break-all" }}>{digitalFile}</div>}
              </div>
            )}
            {productType === "physical" && (
              <div className="field"><label>Delivery estimate (days)</label><input type="number" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} placeholder="4" /></div>
            )}

            <div className="ff">
              <div className="field" style={{ flex: "0 0 90px" }}><label>Title icon</label><input value={titleIcon} onChange={(e) => setTitleIcon(e.target.value)} placeholder="🔥" /></div>
              <div className="field"><label>Title align</label><div className="chips">{(["left", "center", "right"] as const).map((a) => <div key={a} className={`chip${titleAlign === a ? " on" : ""}`} style={{ textTransform: "capitalize" }} onClick={() => setTitleAlign(a)}>{a}</div>)}</div></div>
            </div>
            <div className="field"><label>Subheadline</label><input value={subheadline} onChange={(e) => setSubheadline(e.target.value)} placeholder="A short tagline" /></div>
            <div className="field"><label>Description</label><RichText value={descHtml} onChange={setDescHtml} placeholder="Describe your page…" /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Main image</label><ImageInput value={imageUrl} onChange={setImageUrl} /></div>
          </Sec>

          {/* Pricing */}
          <Sec title="Pricing & buy button">
            <div className="ff">
              <div className="field"><label>Price</label><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="499" /></div>
              <div className="field"><label>Compare-at</label><input inputMode="decimal" value={compareAt} onChange={(e) => setCompareAt(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="999" /></div>
              <div className="field"><label>Currency</label><select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="INR">INR ₹</option><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="GBP">GBP £</option></select></div>
            </div>
            <div className="ff">
              <div className="field"><label>Button label</label><input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Buy now" /></div>
              <div className="field" style={{ flex: "0 0 90px" }}><label>Button icon</label><input value={ctaIcon} onChange={(e) => setCtaIcon(e.target.value)} placeholder="🛒" /></div>
            </div>
            <div className="field"><label>Button animation</label><div className="chips">{(["none", "shine", "pulse"] as const).map((a) => <div key={a} className={`chip${ctaAnim === a ? " on" : ""}`} style={{ textTransform: "capitalize" }} onClick={() => setCtaAnim(a)}>{a}</div>)}</div></div>
            <div className="swrow" style={{ borderTop: 0, paddingTop: 0 }}><span className="nm">Floating Buy button (sticky on scroll)</span><Switch on={stickyBuy} onClick={() => setStickyBuy((v) => !v)} /></div>
          </Sec>

          {/* Features */}
          <Sec title="Features">
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 0 }}>Add a custom icon (emoji) per feature, or leave blank for a ✓.</p>
            {featureItems.map((f, i) => {
              const upd = (patch: Partial<{ text: string; icon: string }>) => setFeatureItems(featureItems.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div className="frow" key={i}>
                  <input style={{ flex: "0 0 48px", textAlign: "center" }} value={f.icon ?? ""} onChange={(e) => upd({ icon: e.target.value })} placeholder="✓" />
                  <input value={f.text} onChange={(e) => upd({ text: e.target.value })} placeholder={`Feature ${i + 1}`} />
                  <button className="del" type="button" onClick={() => setFeatureItems(featureItems.filter((_, j) => j !== i))}>✕</button>
                </div>
              );
            })}
            <button className="addrow" type="button" onClick={() => setFeatureItems([...featureItems, { text: "", icon: "" }])}>+ Add feature</button>
          </Sec>

          {/* Urgency & scarcity */}
          <Sec title="Urgency & scarcity" open={false}>
            <div className="swrow" style={{ borderTop: 0, paddingTop: 0 }}><span className="nm">Offer countdown</span><Switch on={cdEnabled} onClick={() => setCdEnabled((v) => !v)} /></div>
            {cdEnabled && (
              <div>
                <div className="field"><label>Ends at</label><input type="datetime-local" value={cdEnd} onChange={(e) => setCdEnd(e.target.value)} /></div>
                <div className="field"><label>Expiry message</label><input value={cdMsg} onChange={(e) => setCdMsg(e.target.value)} placeholder="This offer has ended." /></div>
                <div className="field"><label>Countdown alignment</label><div className="chips">{(["left", "center", "right"] as const).map((a) => <div key={a} className={`chip${cdAlign === a ? " on" : ""}`} style={{ textTransform: "capitalize" }} onClick={() => setCdAlign(a)}>{a}</div>)}</div></div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}><input type="checkbox" style={{ width: "auto" }} checked={cdDisable} onChange={(e) => setCdDisable(e.target.checked)} />Disable the Buy button after it expires</label>
              </div>
            )}
            <div className="swrow"><span className="nm">Limited seats</span><Switch on={seatsEnabled} onClick={() => setSeatsEnabled((v) => !v)} /></div>
            {seatsEnabled && (
              <div className="field"><label>Total seats</label><input inputMode="numeric" value={seatsTotal} onChange={(e) => setSeatsTotal(e.target.value.replace(/[^0-9]/g, ""))} placeholder="50" /><p className="dx-muted" style={{ fontSize: 11 }}>“Only X left” updates as paid orders come in. 0 left → Sold out.</p></div>
            )}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 10 }}>
              <strong style={{ fontSize: 13 }}>When sold out → Contact seller</strong>
              <p className="dx-muted" style={{ fontSize: 11, marginTop: 2 }}>The Buy button becomes a contact button. WhatsApp first, else email.</p>
              <div className="field"><label>WhatsApp number</label><input value={contactWa} onChange={(e) => setContactWa(e.target.value)} placeholder="9198XXXXXXXX (with country code)" /></div>
              <div className="field"><label>Contact email</label><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="sales@email.com" /></div>
              <div className="field"><label>Custom URL (overrides WhatsApp/email)</label><input value={contactUrl} onChange={(e) => setContactUrl(e.target.value)} placeholder="https://t.me/yourchannel" /></div>
              <div className="ff">
                <div className="field"><label>Button text</label><input value={contactLabel} onChange={(e) => setContactLabel(e.target.value)} placeholder="Contact us" /></div>
                <div className="field" style={{ flex: "0 0 80px" }}><label>Icon</label><input value={contactIcon} onChange={(e) => setContactIcon(e.target.value)} placeholder="💬" /></div>
              </div>
            </div>
            <div className="swrow"><span className="nm">Live purchase popups</span><Switch on={lpEnabled} onClick={() => setLpEnabled((v) => !v)} /></div>
            {lpEnabled && (
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 8 }}>Show every<input style={{ width: 64 }} inputMode="numeric" value={lpInterval} onChange={(e) => setLpInterval(e.target.value.replace(/[^0-9]/g, ""))} />sec</label>
                <p className="dx-muted" style={{ fontSize: 11, marginTop: 0 }}>Leave empty to use built-in sample names, or add your own:</p>
                {lpItems.map((it, i) => {
                  const upd = (patch: Partial<{ name: string; location: string }>) => setLpItems(lpItems.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <div className="frow" key={i}>
                      <input value={it.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Name" />
                      <input value={it.location ?? ""} onChange={(e) => upd({ location: e.target.value })} placeholder="City" />
                      <button className="del" type="button" onClick={() => setLpItems(lpItems.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  );
                })}
                <button className="addrow" type="button" onClick={() => setLpItems([...lpItems, { name: "", location: "" }])}>+ Add person</button>
              </div>
            )}
          </Sec>

          {/* Trust badges */}
          <Sec title="Trust badges" open={false}>
            <div className="chips" style={{ marginBottom: 8 }}>{BADGE_PRESETS.map((b) => <div key={b} className={`chip${badges.includes(b) ? " on" : ""}`} onClick={() => toggleBadge(b)}>{b}</div>)}</div>
            {badges.filter((b) => !BADGE_PRESETS.includes(b as (typeof BADGE_PRESETS)[number])).length > 0 && (
              <div className="chips" style={{ marginBottom: 8 }}>{badges.filter((b) => !BADGE_PRESETS.includes(b as (typeof BADGE_PRESETS)[number])).map((b) => <div key={b} className="chip on" onClick={() => toggleBadge(b)}>{b} ✕</div>)}</div>
            )}
            <div className="frow"><input value={customBadge} onChange={(e) => setCustomBadge(e.target.value)} placeholder="Custom badge (e.g. Free updates)" /><button className="up-btn" type="button" onClick={() => { const v = customBadge.trim(); if (v && !badges.includes(v)) setBadges([...badges, v]); setCustomBadge(""); }}>Add</button></div>
          </Sec>

          {/* Image gallery */}
          <Sec title="Image gallery (slider)" open={false}>
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 0 }}>Buyers swipe through these. Images auto-fit (never cropped).</p>
            {gallery.map((g, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}><ImageInput value={g} onChange={(url) => setGallery(gallery.map((x, j) => (j === i ? url : x)))} /></div>
                <button className="del" type="button" onClick={() => setGallery(gallery.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="addrow" type="button" onClick={() => setGallery([...gallery, ""])}>+ Add image</button>
            <div className="swrow"><span className="nm">Auto-scroll{autoplay ? "" : ""}</span><Switch on={autoplay} onClick={() => setAutoplay((v) => !v)} /></div>
            {autoplay && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>every<input style={{ width: 64 }} inputMode="decimal" value={interval} onChange={(e) => setIntervalSec(e.target.value.replace(/[^0-9.]/g, ""))} />sec</label>}
          </Sec>

          {/* Testimonials */}
          <Sec title="Testimonials" open={false}>
            {testimonials.map((t, i) => {
              const upd = (patch: Partial<Testimonial>) => setTestimonials(testimonials.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 9, marginBottom: 9 }}>
                  <div className="ff">
                    <div className="field" style={{ marginBottom: 8 }}><input value={t.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Name" /></div>
                    <div className="field" style={{ flex: "0 0 90px", marginBottom: 8 }}><select value={t.rating ?? 5} onChange={(e) => upd({ rating: parseInt(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></div>
                  </div>
                  <textarea className="rowfull" rows={2} value={t.text} onChange={(e) => upd({ text: e.target.value })} placeholder="What they said…" />
                  <ImageInput value={t.avatar_url ?? ""} onChange={(url) => upd({ avatar_url: url })} placeholder="Avatar (optional)" />
                  <button className="addrow" type="button" style={{ marginTop: 8, color: "var(--secondary)" }} onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))}>Remove</button>
                </div>
              );
            })}
            <button className="addrow" type="button" onClick={() => setTestimonials([...testimonials, { name: "", text: "", rating: 5 }])}>+ Add testimonial</button>
          </Sec>

          {/* FAQ */}
          <Sec title="FAQ" open={false}>
            {faqs.map((f, i) => {
              const upd = (patch: Partial<Faq>) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <input className="rowfull" value={f.q} onChange={(e) => upd({ q: e.target.value })} placeholder="Question" />
                  <div className="frow"><textarea rows={2} value={f.a} onChange={(e) => upd({ a: e.target.value })} placeholder="Answer" /><button className="del" type="button" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}>✕</button></div>
                </div>
              );
            })}
            <button className="addrow" type="button" onClick={() => setFaqs([...faqs, { q: "", a: "" }])}>+ Add question</button>
          </Sec>

          {/* Policies */}
          <Sec title="Footer policies (optional)" open={false}>
            <p className="dx-muted" style={{ fontSize: 11, marginTop: 0 }}>Shown as expandable sections at the bottom. Leave blank to hide.</p>
            <div className="field"><label>Privacy Policy</label><textarea rows={2} value={privacy} onChange={(e) => setPrivacy(e.target.value)} /></div>
            <div className="field"><label>Terms &amp; Conditions</label><textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Refund Policy</label><textarea rows={2} value={refund} onChange={(e) => setRefund(e.target.value)} /></div>
          </Sec>

          {/* Seller contact */}
          <Sec title="Seller contact">
            <div className="field"><label>Contact email * (required to publish)</label><input type="email" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} placeholder="you@email.com" /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Mobile number (optional)</label><input value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} placeholder="+91…" /></div>
          </Sec>

          {/* Payment logos */}
          <Sec title="Payment logos in footer" open={false}>
            <div className="swrow" style={{ borderTop: 0, paddingTop: 0 }}><span className="nm">Show Visa / Mastercard / UPI / RuPay</span><Switch on={showLogos} onClick={() => setShowLogos((v) => !v)} /></div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, margin: "6px 0 5px" }}>Your own payment icons (optional)</label>
            {payIcons.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}><ImageInput value={p} onChange={(url) => setPayIcons(payIcons.map((x, j) => (j === i ? url : x)))} /></div>
                <button className="del" type="button" onClick={() => setPayIcons(payIcons.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="addrow" type="button" onClick={() => setPayIcons([...payIcons, ""])}>+ Add payment icon</button>
          </Sec>

          {/* SEO & pixels */}
          <Sec title="SEO & pixels" open={false}>
            <div className="field"><label>SEO title</label><input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} /></div>
            <div className="field"><label>SEO description</label><textarea rows={2} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} /></div>
            <div className="field"><label>Social share image (OG)</label><ImageInput value={ogImage} onChange={setOgImage} /></div>
            <div className="ff">
              <div className="field" style={{ marginBottom: 0 }}><label>Meta Pixel ID</label><input value={metaPixel} onChange={(e) => setMetaPixel(e.target.value)} placeholder="1234567890" /></div>
              <div className="field" style={{ marginBottom: 0 }}><label>Google tag ID</label><input value={googleId} onChange={(e) => setGoogleId(e.target.value)} placeholder="G-XXXX / AW-XXXX" /></div>
            </div>
          </Sec>

          {publicUrl && <p className="dx-muted" style={{ fontSize: 11 }}>Public link: <strong>{publicUrl}</strong></p>}
        </div>

        {Preview()}
      </div>
    </>
  );
}
