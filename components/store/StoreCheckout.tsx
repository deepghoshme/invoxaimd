"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/products";
import type { StoreProduct } from "@/lib/store";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

const CODES = ["+91", "+1", "+44", "+971", "+61", "+65", "+880", "+92"];

type BumpOfferView = {
  offer_id: string;
  name: string;
  product_name: string;
  original_paise: number;
  bump_paise: number;
  currency: string;
};

type OrderState = {
  orderId: string;
  discountPaise: number;
  bumpPaise: number;
  bumpTitle: string | null;
};

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function firePurchase(valueMajor: number, currency: string, orderId: string) {
  const w = window as unknown as { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void };
  try { w.fbq?.("track", "Purchase", { value: valueMajor, currency }); } catch {}
  try { w.gtag?.("event", "purchase", { transaction_id: orderId, value: valueMajor, currency }); } catch {}
}

/** Storefront inline checkout popup for a single catalog product. Reuses the
 * order → start → verify flow, keyed on product_id (no landing page needed).
 * Coupons and order-bump upsells both re-create the order server-side so the
 * charged amount is always DB-computed, never client-trusted. */
export default function StoreCheckout({
  product, storeName, payEnabled, onClose, qty = 1, variantLabel,
}: { product: StoreProduct; storeName: string; payEnabled: boolean; onClose: () => void; qty?: number; variantLabel?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [offers, setOffers] = useState<BumpOfferView[]>([]);
  const [bumpId, setBumpId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderState | null>(null);

  const currency = product.currency || "INR";
  const q = Math.max(1, Math.min(99, Math.round(qty)));
  const amount = Math.round((product.priceNum ?? 0) * 100) * q; // minor units × qty

  // Load applicable order-bump offers for this product.
  useEffect(() => {
    if (!product.id) return;
    let alive = true;
    fetch("/api/checkout/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id }),
    })
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d.offers)) setOffers(d.offers); })
      .catch(() => {});
    return () => { alive = false; };
  }, [product.id]);

  const discountPaise = order?.discountPaise ?? 0;
  const bumpPaise = order?.bumpPaise ?? 0;
  const finalAmount = Math.max(1, amount - discountPaise) + bumpPaise;
  const valueMajor = finalAmount / 100;

  async function syncOrder(coupon: string | null, nextBump: string | null): Promise<string | null> {
    setSyncing(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { product_id: product.id, qty: q, variant: variantLabel || undefined };
      if (coupon) body.coupon_code = coupon;
      if (nextBump) body.bump_offer_id = nextBump;
      const res = await fetch("/api/checkout/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update your order");

      if (coupon) {
        if (data.coupon_error || !data.discount_paise) {
          setCouponErr(data.coupon_error || "This coupon isn’t valid for this purchase.");
          setAppliedCode(null);
        } else {
          setCouponErr(null);
          setAppliedCode(coupon);
        }
      } else {
        setCouponErr(null);
        setAppliedCode(null);
      }

      setBumpId(data.bump_offer_id ?? null);
      setOrder({
        orderId: data.order_id,
        discountPaise: data.discount_paise || 0,
        bumpPaise: data.bump_paise || 0,
        bumpTitle: data.bump_title || null,
      });
      return data.order_id as string;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      return null;
    } finally {
      setSyncing(false);
    }
  }

  async function applyCoupon() {
    const codeStr = couponInput.trim();
    if (!codeStr) return;
    await syncOrder(codeStr, bumpId);
  }

  async function removeCoupon() {
    setCouponInput("");
    setCouponErr(null);
    if (bumpId) await syncOrder(null, bumpId);
    else { setAppliedCode(null); setOrder(null); }
  }

  async function toggleBump(id: string) {
    const next = bumpId === id ? null : id;
    if (!next && !appliedCode) { setBumpId(null); setOrder(null); return; }
    await syncOrder(appliedCode, next);
  }

  async function buyNow() {
    if (!email.trim()) return setErr("Please enter your email.");
    if (!name.trim()) return setErr("Please enter your name.");
    setLoading(true); setErr(null);

    if (!(await loadRazorpay())) {
      setErr("Couldn’t load the payment library. Check your connection.");
      return setLoading(false);
    }
    try {
      // Reuse the coupon/bump order if present, else create a full-price one.
      let orderId = order?.orderId;
      if (!orderId) {
        const cRes = await fetch("/api/checkout/create", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: product.id, qty: q, variant: variantLabel || undefined }),
        });
        const cData = await cRes.json();
        if (!cRes.ok) throw new Error(cData.error || "Could not start checkout");
        orderId = cData.order_id;
      }

      const sRes = await fetch("/api/checkout/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, buyer_email: email, buyer_name: name, buyer_phone: phone ? `${code} ${phone}` : "" }),
      });
      const start = await sRes.json();
      if (!sRes.ok) throw new Error(start.error || "Could not start payment");

      const rzp = new window.Razorpay!({
        key: start.key_id,
        order_id: start.razorpay_order_id,
        amount: start.amount,
        currency: start.currency,
        name: storeName,
        description: product.name,
        prefill: { email, name, contact: `${code}${phone}` },
        theme: { color: "#FF6A3D" },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (resp: Record<string, string>) => {
          try {
            const vRes = await fetch("/api/checkout/verify", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order_id: orderId, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature }),
            });
            const v = await vRes.json();
            if (!vRes.ok || !v.ok) throw new Error(v.error || "Verification failed");
            firePurchase(valueMajor, currency, orderId!);
            setDone(true);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Verification failed");
          } finally { setLoading(false); }
        },
      });
      rzp.open();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="sco-overlay" onClick={onClose}>
      <div className="sco-modal" onClick={(e) => e.stopPropagation()}>
        <button className="sco-x" onClick={onClose}>✕</button>
        {done ? (
          <div className="co-card co-success" style={{ boxShadow: "none", border: 0 }}>
            <div style={{ fontSize: "2.2rem" }}>✅</div>
            <h3 style={{ margin: "0.3rem 0" }}>Payment successful</h3>
            <p className="muted" style={{ margin: 0 }}>
              Access for <strong>{product.name}</strong>
              {order?.bumpTitle ? <> and <strong>{order.bumpTitle}</strong></> : null} will be sent to {email}.
            </p>
          </div>
        ) : (
          <div className="co-card" style={{ boxShadow: "none", border: 0 }}>
            <div className="sco-prod">
              <div className="sco-pimg" style={product.img ? { backgroundImage: `url('${product.img}')` } : undefined}>{!product.img && "📦"}</div>
              <div><div className="sco-pname">{product.name}</div>{variantLabel && <div style={{ fontSize: 12, opacity: .7 }}>{variantLabel}</div>}<div className="sco-pprice">{formatMoney(amount, currency)}{q > 1 ? ` · ${q} × ${formatMoney(amount / q, currency)}` : ""}</div></div>
            </div>
            <label className="co-label">Email Address</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            <label className="co-label">Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <label className="co-label">Phone number</label>
            <div className="co-phone">
              <select className="select" value={code} onChange={(e) => setCode(e.target.value)}>{CODES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))} placeholder="98XXXXXXXX" />
            </div>

            {/* Order-bump offers */}
            {offers.length > 0 && (
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                {offers.map((o) => {
                  const on = bumpId === o.offer_id;
                  return (
                    <label
                      key={o.offer_id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        border: `1.5px solid ${on ? "var(--primary, #FF6A3D)" : "var(--border, #e7ddd3)"}`,
                        borderRadius: 12, cursor: syncing ? "wait" : "pointer",
                        background: on ? "color-mix(in srgb, var(--primary, #FF6A3D) 8%, transparent)" : "transparent",
                      }}
                    >
                      <input type="checkbox" checked={on} disabled={syncing} onChange={() => toggleBump(o.offer_id)} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{o.name}</span>
                        <span style={{ display: "block", fontSize: 12, color: "var(--muted, #7a6770)" }}>Add {o.product_name}</span>
                      </span>
                      <span style={{ whiteSpace: "nowrap", fontWeight: 700, fontSize: 13 }}>
                        + {formatMoney(o.bump_paise, o.currency)}
                        {o.bump_paise < o.original_paise && (
                          <s style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted, #7a6770)" }}>{formatMoney(o.original_paise, o.currency)}</s>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="co-coupon">
              {appliedCode ? (
                <div className="co-row" style={{ alignItems: "center" }}>
                  <span style={{ color: "var(--ok, #16a34a)", fontWeight: 600 }}>✓ Coupon applied</span>
                  <button type="button" onClick={removeCoupon} style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>Remove</button>
                </div>
              ) : (
                <div className="co-phone" style={{ marginTop: 4 }}>
                  <input className="input" value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(null); }} placeholder="Have a coupon?" />
                  <button type="button" className="btn" onClick={applyCoupon} disabled={syncing || !couponInput.trim()} style={{ whiteSpace: "nowrap" }}>{syncing ? "…" : "Apply"}</button>
                </div>
              )}
              {couponErr && <div className="alert alert-error" style={{ marginTop: 8 }}>{couponErr}</div>}
            </div>
            <div className="co-summary">
              <div className="co-row"><span>Sub Total</span><span>{formatMoney(amount, currency)}</span></div>
              {discountPaise > 0 && <div className="co-row" style={{ color: "var(--ok, #16a34a)" }}><span>Discount</span><span>− {formatMoney(discountPaise, currency)}</span></div>}
              {bumpPaise > 0 && <div className="co-row"><span>{order?.bumpTitle || "Add-on"}</span><span>+ {formatMoney(bumpPaise, currency)}</span></div>}
              <div className="co-row co-total"><span>Total</span><span>{formatMoney(finalAmount, currency)}</span></div>
            </div>
            {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
            {!payEnabled && <div className="alert alert-error" style={{ marginTop: 10 }}>This store hasn’t finished setting up payments yet.</div>}
            <button className="btn co-buy btn-shimmer" onClick={buyNow} disabled={loading || syncing || !payEnabled}>
              <span className="btn-shine" style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }} />
              {loading ? "Processing…" : "Pay now"} <span aria-hidden>→</span>
            </button>
            <p className="co-secure">🔒 Secure payment via Razorpay</p>
          </div>
        )}
      </div>
    </div>
  );
}
