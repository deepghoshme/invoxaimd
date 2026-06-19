"use client";

import { useState, useEffect, useRef } from "react";
import { type StoreContent, type StoreProduct, ACCENTS, FONT_FAMILY, WIDTH_PX } from "@/lib/store";
import { type CatalogProduct, formatPrice } from "@/lib/catalog";
import StoreCheckout from "./StoreCheckout";
import ReviewsSection, { type ProductReview, type ReviewStats } from "@/components/templates/ReviewsSection";

export type RelatedProduct = { id: string; name: string; image: string; price: string };

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span className="pdpx-stars" style={{ fontSize: size }} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? "on" : ""}>★</span>)}
    </span>
  );
}

/** Full Shopify-style product detail page for a catalog product. */
export default function ProductPage({
  product, store: c, storeName, storeUrl, payEnabled, related = [],
  realReviews, realReviewStats,
}: {
  product: CatalogProduct; store: StoreContent; storeName: string; storeUrl: string; payEnabled: boolean; related?: RelatedProduct[];
  /** Real product_reviews rows (approved + visible), fetched server-side. */
  realReviews?: ProductReview[];
  /** Aggregate: avg (1 decimal) + count. */
  realReviewStats?: ReviewStats;
}) {
  const images = [product.image, ...(product.gallery ?? [])].filter(Boolean) as string[];
  const [main, setMain] = useState(0);
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<Record<string, string>>(
    Object.fromEntries((product.options ?? []).map((o) => [o.name, o.values[0] ?? ""])),
  );
  const [buy, setBuy] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [open, setOpen] = useState<string | null>("desc");
  const [copied, setCopied] = useState(false);
  const buyboxRef = useRef<HTMLDivElement>(null);

  // Sticky buy bar appears once the main buy box scrolls out of view.
  useEffect(() => {
    const el = buyboxRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el); return () => io.disconnect();
  }, []);

  const grad = c.accentColor
    ? `linear-gradient(135deg, ${c.accentColor}, color-mix(in srgb, ${c.accentColor} 70%, #000))`
    : (ACCENTS[c.accent ?? 0]?.[1] ?? ACCENTS[0][1]);
  const fontFam = FONT_FAMILY[c.font ?? "sora"] ?? "'Sora'";
  const ww = WIDTH_PX[c.pageWidth ?? "wide"] ?? 1400;
  const bt = c.btshape ? `bt${c.btshape}` : "btsoft";

  const price = product.price != null ? formatPrice(product.price, product.currency) : "";
  const compareAt = product.compare_at_price != null ? formatPrice(product.compare_at_price, product.currency) : "";
  const off = product.price != null && product.compare_at_price != null && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;

  // Use real product_reviews (server-fetched) if provided; fall back to seller-
  // curated static reviews from the products table JSONB only when real ones
  // are absent (e.g. no real review rows yet and static ones exist as legacy).
  const hasRealReviews = !!(realReviews && realReviews.length > 0);
  const displayReviews = hasRealReviews ? realReviews! : [];
  const ratingVal = hasRealReviews
    ? (realReviewStats?.avg ?? 0)
    : 0;
  const reviewCount = hasRealReviews ? (realReviewStats?.count ?? 0) : 0;
  const soldOut = product.stock != null && product.stock <= 0;
  const lowStock = product.stock != null && product.stock > 0 && product.stock <= 5;
  const trust = (product.trust_badges ?? []).length ? product.trust_badges : ["Secure checkout", "Money-back guarantee", "Fast delivery"];

  const variantLabel = (product.options ?? []).map((o) => `${o.name}: ${sel[o.name]}`).filter((s) => !s.endsWith(": ")).join(", ");
  const sp: StoreProduct = {
    id: product.id, name: product.name, cat: product.category || "", price, img: images[0],
    priceNum: product.price ?? undefined, currency: product.currency, buyable: true, url: "#",
  };

  const openBuy = () => { if (!soldOut) setBuy(true); };
  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };
  const scrollToReviews = () => document.getElementById("pdpx-reviews")?.scrollIntoView({ behavior: "smooth" });

  const logo = c.logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={c.logo} alt={storeName} />
    : <><span className="d" />{storeName}</>;

  const Acc = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className={`pdpx-acc${open === id ? " open" : ""}`}>
      <button className="pdpx-acch" onClick={() => setOpen(open === id ? null : id)}>{title}<span>{open === id ? "−" : "+"}</span></button>
      {open === id && <div className="pdpx-accb">{children}</div>}
    </div>
  );

  return (
    <div className={`storeview${c.theme === "dark" ? " dark-store" : ""}`}>
      <div className={`site ${bt}`} style={{ ["--sGrad" as string]: grad, ["--font-sora" as string]: fontFam, ["--ww" as string]: `${ww}px` } as React.CSSProperties}>
        {c.announce?.on && <div className="annbar">{c.announce.text}</div>}
        <div className="stopbar">
          <a className="slogo" href={storeUrl} style={{ textDecoration: "none" }}>{logo}</a>
          <div className="smenu">{(c.menu ?? []).map((mm, i) => <a key={i} href={storeUrl}>{mm}</a>)}</div>
          <a className="acctbtn" href={storeUrl} style={{ textDecoration: "none" }}>← Store</a>
        </div>

        <nav className="pdpx-crumb"><a href={storeUrl}>Store</a><span>›</span>{product.category && <><a href={storeUrl}>{product.category}</a><span>›</span></>}<b>{product.name}</b></nav>

        <div className="pdpx">
          <div className="pdpx-gallery">
            <div className="pdpx-main" style={images[main] ? { backgroundImage: `url('${images[main]}')` } : undefined}>
              {!images.length && <span className="pdpx-ph">📦</span>}
              {off > 0 && <span className="pdpx-flag">{off}% OFF</span>}
            </div>
            {images.length > 1 && (
              <div className="pdpx-thumbs">
                {images.map((im, i) => <button key={i} className={`pdpx-thumb${main === i ? " on" : ""}`} style={{ backgroundImage: `url('${im}')` }} onClick={() => setMain(i)} />)}
              </div>
            )}
          </div>

          <div className="pdpx-info">
            {product.vendor && <div className="pdpx-vendor">{product.vendor}</div>}
            {product.category && !product.vendor && <div className="pdpx-cat">{product.category}</div>}
            <h1 className="pdpx-name">{product.name}</h1>

            {(ratingVal > 0 || reviewCount > 0) && (
              <button className="pdpx-rsnip" onClick={scrollToReviews}><Stars value={ratingVal} /><b>{ratingVal.toFixed(1)}</b><span>({reviewCount} review{reviewCount === 1 ? "" : "s"})</span></button>
            )}

            <div className="pdpx-price" ref={buyboxRef}>
              {price && <span className="pdpx-po">{price}</span>}
              {compareAt && <span className="pdpx-pr">{compareAt}</span>}
              {off > 0 && <span className="pdpx-off">Save {off}%</span>}
            </div>

            <div className="pdpx-stock">
              {soldOut ? <span className="so">● Sold out</span>
                : lowStock ? <span className="low">● Only {product.stock} left</span>
                : <span className="in">● In stock</span>}
              {product.sku && <span className="pdpx-sku">SKU: {product.sku}</span>}
            </div>

            {(product.options ?? []).map((o) => (
              <div className="pdpx-opt" key={o.name}>
                <div className="pdpx-optl">{o.name}: <b>{sel[o.name]}</b></div>
                <div className="pdpx-optv">{o.values.map((v) => <button key={v} className={`pdpx-vbtn${sel[o.name] === v ? " on" : ""}`} onClick={() => setSel((s) => ({ ...s, [o.name]: v }))}>{v}</button>)}</div>
              </div>
            ))}

            <div className="pdpx-buyrow">
              <div className="pdpx-qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>−</button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
              </div>
              <button className="pdpx-atc" onClick={openBuy} disabled={soldOut}>{soldOut ? "Sold out" : "Add to cart"}</button>
            </div>
            <button className="pdpx-buy" onClick={openBuy} disabled={soldOut}>{soldOut ? "Sold out" : "Buy it now"}</button>
            {!payEnabled && <p className="pdpx-note">Payments aren’t set up for this store yet.</p>}

            <div className="pdpx-trust">{trust.map((t, i) => <span key={i}>✓ {t}</span>)}</div>

            {(product.highlights ?? []).length > 0 && (
              <ul className="pdpx-hl">{product.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
            )}

            <div className="pdpx-accs">
              {product.description && <Acc id="desc" title="Description"><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{product.description}</p></Acc>}
              {(product.details ?? []).length > 0 && (
                <Acc id="specs" title="Product details">
                  <table className="pdpx-spectable"><tbody>{product.details.map((d, i) => <tr key={i}><td>{d.label}</td><td>{d.value}</td></tr>)}</tbody></table>
                </Acc>
              )}
              {(product.shipping_info || (product.product_type === "physical" && product.delivery_days != null)) && (
                <Acc id="ship" title="Shipping">
                  {product.product_type === "physical" && product.delivery_days != null && <p style={{ margin: "0 0 6px" }}>🚚 Delivery in about {product.delivery_days} days.</p>}
                  {product.shipping_info && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{product.shipping_info}</p>}
                </Acc>
              )}
              {product.returns_info && <Acc id="ret" title="Returns & refunds"><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{product.returns_info}</p></Acc>}
            </div>

            <button className="pdpx-share" onClick={share}>{copied ? "Link copied ✓" : "🔗 Share"}</button>
          </div>
        </div>

        <div className="pdpx-reviews" id="pdpx-reviews">
          <h2>Customer reviews</h2>
          <ReviewsSection reviews={displayReviews} stats={realReviewStats} />
        </div>

        {related.length > 0 && (
          <div className="pdpx-related">
            <h2>You may also like</h2>
            <div className="pdpx-reltrack">
              {related.map((r) => (
                <a className="pdpx-relcard" key={r.id} href={`/p/${r.id}`}>
                  <span className="pdpx-relimg" style={r.image ? { backgroundImage: `url('${r.image}')` } : undefined}>{!r.image && "📦"}</span>
                  <span className="pdpx-relname">{r.name}</span>
                  <span className="pdpx-relprice">{r.price}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="sfoot">
          <div className="b">{storeName}</div>
          <div style={{ marginTop: 6 }}>© 2026 {storeName} · Powered by invoxai</div>
        </div>

        {sticky && !soldOut && (
          <div className="pdpx-sticky">
            <div className="pdpx-simg" style={images[0] ? { backgroundImage: `url('${images[0]}')` } : undefined} />
            <div className="pdpx-sinfo"><div className="pdpx-sname">{product.name}</div><div className="pdpx-sprice">{price}{variantLabel ? ` · ${sel[(product.options ?? [])[0]?.name]}` : ""}</div></div>
            <button className="pdpx-satc" onClick={openBuy}>Add to cart</button>
          </div>
        )}

        {buy && <StoreCheckout product={sp} storeName={storeName} payEnabled={payEnabled} qty={qty} variantLabel={variantLabel || undefined} onClose={() => setBuy(false)} />}
      </div>
    </div>
  );
}
