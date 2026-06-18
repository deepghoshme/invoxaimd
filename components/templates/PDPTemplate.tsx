"use client";

import { useState } from "react";
import { type OppContent, formatPrice, toMinorUnit, DEFAULT_CURRENCY } from "@/lib/products";
import { resolveOppTheme } from "@/lib/oppTheme";
import InlineCheckout from "@/components/checkout/InlineCheckout";
import BuyBar from "@/components/checkout/BuyBar";

/** Catalog-style Product Detail Page (opp layout = "pdp"). Reuses the existing
 * checkout (InlineCheckout) for the buy flow. */
export default function PDPTemplate({
  content, pageId, fallbackTitle, payEnabled, showBrand = true, preview = false, storeName = "Store", sold = 0,
}: {
  content: OppContent; pageId: string; fallbackTitle?: string; payEnabled: boolean; showBrand?: boolean; preview?: boolean; storeName?: string; sold?: number;
}) {
  const currency = (content.currency || DEFAULT_CURRENCY).toUpperCase();
  const title = content.headline || fallbackTitle || "Product";
  const price = content.price ?? 0;
  const compareAt = content.compare_at_price ?? 0;
  const off = compareAt > price && price > 0 ? Math.round((1 - price / compareAt) * 100) : 0;
  const amount = toMinorUnit(price, currency);

  const gallery = (content.gallery ?? []).filter(Boolean);
  const imgs = gallery.length ? gallery : (content.image_url ? [content.image_url] : []);
  const [gi, setGi] = useState(0);
  const variants = (content.variants ?? []).filter((v) => v.options?.length);
  const [vsel, setVsel] = useState<Record<number, number>>({});
  const featTexts = (content.feature_items?.length ? content.feature_items.map((f) => f.text) : (content.features ?? [])).filter(Boolean);
  const highlights = (content.highlights?.length ? content.highlights : featTexts).filter(Boolean).slice(0, 5);
  const includes = featTexts;
  const offers = (content.offers ?? []).filter(Boolean);
  const specs = (content.specs ?? []).filter((s) => s[0]);
  const reviews = (content.testimonials ?? []).filter((t) => t?.text);
  const related = (content.related ?? []).filter((r) => r.name);
  const descHtml = content.description_html || (content.description ? content.description.split("\n").filter(Boolean).map((p) => `<p>${p}</p>`).join("") : "");
  const ptype = content.productType ?? "digital";
  const plans = (content.plans ?? []).filter((p) => p.label);
  const [plan, setPlan] = useState(0);
  const selPlan = plans[plan];
  const buyPrice = selPlan ? selPlan.price : price;
  const buyAmount = selPlan ? toMinorUnit(selPlan.price, currency) : amount;
  const rating = content.rating || "4.9";
  const rcount = content.reviews_count || "";
  const [tab, setTab] = useState("desc");
  const [pin, setPin] = useState(""); const [pinRes, setPinRes] = useState("");

  // Stock / urgency (from seats) + trust badges + sticky buy bar.
  const seatsTotal = content.seats_enabled ? content.seats_total ?? 0 : 0;
  const seatsLeft = Math.max(0, seatsTotal - sold);
  const soldOut = content.seats_enabled && seatsTotal > 0 && seatsLeft <= 0;
  const lowStock = seatsTotal > 0 && seatsLeft > 0 && seatsLeft <= 5;
  const trust = (content.badges ?? []).filter(Boolean);

  const th = resolveOppTheme(content.theme);
  const rootStyle: React.CSSProperties = {
    ["--p" as string]: th.solid,
    ["--brand-gradient" as string]: th.gradient,
    ...(th.fontFam ? { ["--font-sora" as string]: th.fontFam } : {}),
    ...(th.widthPx ? { ["--pdpw" as string]: `${th.widthPx}px` } : {}),
  };
  const rootClass = `pdp-site pdp-bt-${th.btshape}${th.dark ? " pdp-dark" : ""}`;

  const TABS: [string, string, boolean][] = [
    ["desc", "Description", !!descHtml],
    ["inc", "What's included", includes.length > 0],
    ["spec", "Specifications", specs.length > 0],
    ["rev", `Reviews${reviews.length ? ` (${reviews.length})` : ""}`, reviews.length > 0],
  ];
  const tabs = TABS.filter((t) => t[2]);
  const activeTab = tabs.some((t) => t[0] === tab) ? tab : tabs[0]?.[0];

  return (
    <div className={rootClass} style={rootStyle}>
      {th.googleHref && <link rel="stylesheet" href={th.googleHref} />}
      <div className="pdp-top">
        <div className="pdp-lg">{storeName}</div>
        <div className="pdp-tp">{formatPrice(price, currency)}{off > 0 && <s>{formatPrice(compareAt, currency)}</s>}</div>
      </div>
      <div className="pdp-wrap">
        <div className="pdp-gallery">
          <div className="pdp-main" style={imgs[gi] ? { backgroundImage: `url('${imgs[gi]}')` } : undefined} />
          {imgs.length > 1 && <div className="pdp-thumbs">{imgs.map((g, i) => <div key={i} className={`pdp-th${i === gi ? " on" : ""}`} style={{ backgroundImage: `url('${g}')` }} onClick={() => setGi(i)} />)}</div>}
        </div>
        <div className="pdp-info">
          <nav className="pdp-crumb"><span>Store</span>{content.category && <><span className="sep">›</span><span>{content.category}</span></>}<span className="sep">›</span><b>{title}</b></nav>
          {content.category && <div className="pdp-cat">{content.category}</div>}
          <h1 className="pdp-title">{title}</h1>
          <div className="pdp-rate"><span className="st">★★★★★</span> <b>{rating}</b>{rcount && ` · ${rcount} reviews`}</div>
          {seatsTotal > 0 && <div className={`pdp-stock${soldOut ? " out" : lowStock ? " low" : ""}`}>{soldOut ? "● Sold out" : lowStock ? `● Hurry — only ${seatsLeft} left` : "● In stock"}</div>}
          {highlights.length > 0 && <ul className="pdp-hl">{highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
          {plans.length > 0 && (
            <div className="pdp-vg"><div className="vl">Choose a plan</div><div className="vchips">{plans.map((p, i) => (
              <div key={i} className={`vchip${plan === i ? " on" : ""}`} onClick={() => setPlan(i)}>{p.label} · {formatPrice(p.price, currency)}{p.period && p.period !== "lifetime" && p.period !== "custom" ? <span style={{ opacity: .7 }}>/{p.period === "monthly" ? "mo" : "yr"}</span> : null}</div>
            ))}</div></div>
          )}
          <div className="pdp-price"><span className="po">{formatPrice(buyPrice, currency)}</span>{!selPlan && off > 0 && <><span className="pr">{formatPrice(compareAt, currency)}</span><span className="ps">{off}% OFF</span></>}{ptype === "subscription" && selPlan && selPlan.period !== "lifetime" && <span className="pr" style={{ textDecoration: "none" }}>per {selPlan.period === "yearly" ? "year" : "month"}</span>}</div>
          {offers.length > 0 && <div className="pdp-offers"><div className="oh">🏷️ Available offers</div>{offers.map((o, i) => <div className="orow" key={i}><span className="tg">●</span> {o}</div>)}</div>}
          {variants.map((v, g) => (
            <div className="pdp-vg" key={g}><div className="vl">{v.name}: <span className="vsel">{v.options[vsel[g] ?? 0]}</span></div><div className="vchips">{v.options.map((o, oi) => <div key={oi} className={`vchip${(vsel[g] ?? 0) === oi ? " on" : ""}`} onClick={() => setVsel((s) => ({ ...s, [g]: oi }))}>{o}</div>)}</div></div>
          ))}
          {ptype === "physical" && (
            <div className="pdp-deliv">
              <div className="dl">Check delivery</div>
              <div className="pinrow"><input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter pincode" maxLength={6} /><button onClick={() => { const d = new Date(Date.now() + (content.deliveryDays ?? 4) * 86400000); setPinRes(pin.length >= 5 ? `✓ Delivery by ${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}` : "Enter a valid 6-digit pincode"); }}>Check</button></div>
              <div className="pinres">{pinRes}</div>
            </div>
          )}
          {ptype === "digital" && (content.digital?.file || content.digital?.url) && <div className="pdp-deliv" style={{ marginBottom: 0 }}><div className="dl">⚡ Instant digital delivery — access {content.digital?.kind === "url" ? "link" : "file"} after purchase</div></div>}
          <div className="pdp-buy" id="pdp-buy"><InlineCheckout key={plan} pageId={pageId} amount={buyAmount} currency={currency} storeName={storeName} productTitle={selPlan ? `${title} — ${selPlan.label}` : title} ctaLabel={content.cta_label || (ptype === "subscription" ? "Subscribe" : "Buy now")} payEnabled={payEnabled} preview={preview} /></div>
          {trust.length > 0 && <div className="pdp-trust">{trust.map((b, i) => <span key={i}>✓ {b}</span>)}</div>}
        </div>
      </div>

      {tabs.length > 0 && (
        <>
          <div className="pdp-tabs">{tabs.map((t) => <button key={t[0]} className={`pdp-tab${activeTab === t[0] ? " on" : ""}`} onClick={() => setTab(t[0])}>{t[1]}</button>)}</div>
          <div className="pdp-tabbody">
            {activeTab === "desc" && <div className="pdp-rt" dangerouslySetInnerHTML={{ __html: descHtml }} />}
            {activeTab === "inc" && <div className="pdp-inc">{includes.map((i, k) => <div className="pdp-inci" key={k}><span className="ck">✓</span><span>{i}</span></div>)}</div>}
            {activeTab === "spec" && <table className="pdp-spec"><tbody>{specs.map((s, k) => <tr key={k}><td>{s[0]}</td><td>{s[1]}</td></tr>)}</tbody></table>}
            {activeTab === "rev" && <div>{reviews.map((r, k) => <div className="pdp-rc" key={k}><div className="rh"><div className="rav">{(r.name || "?").charAt(0)}</div><div><div className="rn">{r.name}</div><div className="rst">★★★★★</div></div></div><p>{r.text}</p></div>)}</div>}
          </div>
        </>
      )}

      {related.length > 0 && (
        <div className="pdp-rel"><h2>You may also like</h2><div className="pdp-relrow">{related.map((r, i) => {
          const ro = off; void ro;
          return <a className="pdp-relc" key={i} href={r.url || "#"}><div className="ri" style={r.img ? { backgroundImage: `url('${r.img}')` } : undefined} /><div className="rb"><div className="rn2">{r.name}</div><div className="rp">{r.price ? <span className="ro">{formatPrice(r.price, currency)}</span> : null}{r.compareAt ? <span className="rr">{formatPrice(r.compareAt, currency)}</span> : null}</div></div></a>;
        })}</div></div>
      )}

      {showBrand && <div className="pdp-foot">Powered by <a href="https://invoxai.io" target="_blank" rel="noreferrer"><b>invoxai</b></a></div>}

      {!preview && !soldOut && price > 0 && (
        <BuyBar
          label={content.cta_label || (ptype === "subscription" ? "Subscribe" : "Buy now")}
          priceText={formatPrice(buyPrice, currency)}
          compareText={!selPlan && off > 0 ? formatPrice(compareAt, currency) : undefined}
          off={!selPlan ? off : 0}
          mode="scroll"
          targetId="pdp-buy"
          reveal
        />
      )}
    </div>
  );
}
