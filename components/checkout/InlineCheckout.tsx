"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/products";

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

// Order breakdown returned by /api/checkout/create. Display only — the server
// independently computes the authoritative charged amount on the order row.
type OrderState = {
  orderId: string;
  discountPaise: number;
  bumpPaise: number;
  bumpTitle: string | null;
  couponApplied: boolean;
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

/**
 * On-page checkout panel (SuperProfile-style). Collects email/name/phone, then
 * creates the order, opens Razorpay with the seller's keys, verifies the
 * signature and fires purchase pixels — all without leaving the product page.
 *
 * Coupons and order-bump upsells both re-create the order server-side (so the
 * amount is always DB-computed, never client-trusted) and reuse it for payment.
 */
export default function InlineCheckout({
  pageId,
  amount,
  currency,
  storeName,
  productTitle,
  ctaLabel,
  payEnabled,
  preview = false,
  planIndex,
}: {
  pageId: string;
  amount: number; // smallest unit
  currency: string;
  storeName: string;
  productTitle: string;
  ctaLabel: string;
  payEnabled: boolean;
  preview?: boolean;
  // Selected plan index for multi-plan PDP pages. Sent to the server so the
  // order is priced from the chosen plan (matching the displayed `amount`).
  planIndex?: number;
}) {
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

  // The current server order (created when a coupon or bump is applied). Reused
  // by buyNow so only the final selection is ever charged.
  const [order, setOrder] = useState<OrderState | null>(null);

  // Load applicable order-bump offers for this checkout.
  useEffect(() => {
    if (preview || !pageId) return;
    let alive = true;
    fetch("/api/checkout/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: pageId }),
    })
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d.offers)) setOffers(d.offers); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pageId, preview]);

  const discountPaise = order?.discountPaise ?? 0;
  const bumpPaise = order?.bumpPaise ?? 0;
  const finalAmount = Math.max(1, amount - discountPaise) + bumpPaise;
  const valueMajor = finalAmount / 100;

  /**
   * Re-create the order with the given coupon + bump selection and capture the
   * server's breakdown. Returns the new order id (or null on hard failure).
   */
  async function syncOrder(coupon: string | null, nextBump: string | null): Promise<string | null> {
    if (preview) return null;
    setSyncing(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { page_id: pageId };
      if (typeof planIndex === "number") body.plan_index = planIndex;
      if (coupon) body.coupon_code = coupon;
      if (nextBump) body.bump_offer_id = nextBump;
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update your order");

      // Coupon outcome
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

      // Bump outcome — only trust it if the server actually applied the bump.
      const serverBump: string | null = data.bump_offer_id ?? null;
      setBumpId(serverBump);

      setOrder({
        orderId: data.order_id,
        discountPaise: data.discount_paise || 0,
        bumpPaise: data.bump_paise || 0,
        bumpTitle: data.bump_title || null,
        couponApplied: !!data.discount_paise,
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
    if (preview) return;
    if (!email.trim()) return setErr("Please enter your email.");
    if (!name.trim()) return setErr("Please enter your name.");
    setLoading(true);
    setErr(null);

    if (!(await loadRazorpay())) {
      setErr("Couldn’t load the payment library. Check your connection.");
      return setLoading(false);
    }

    try {
      // Reuse the order built by coupon/bump if present; otherwise create a fresh
      // full-price order now.
      let orderId = order?.orderId;
      if (!orderId) {
        const cRes = await fetch("/api/checkout/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            typeof planIndex === "number" ? { page_id: pageId, plan_index: planIndex } : { page_id: pageId },
          ),
        });
        const cData = await cRes.json();
        if (!cRes.ok) throw new Error(cData.error || "Could not start checkout");
        orderId = cData.order_id;
      }

      const sRes = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          buyer_email: email,
          buyer_name: name,
          buyer_phone: phone ? `${code} ${phone}` : "",
        }),
      });
      const start = await sRes.json();
      if (!sRes.ok) throw new Error(start.error || "Could not start payment");

      const rzp = new window.Razorpay!({
        key: start.key_id,
        order_id: start.razorpay_order_id,
        amount: start.amount,
        currency: start.currency,
        name: storeName,
        description: productTitle,
        prefill: { email, name, contact: `${code}${phone}` },
        theme: { color: "#FF6A3D" },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (resp: Record<string, string>) => {
          try {
            const vRes = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: orderId,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            const v = await vRes.json();
            if (!vRes.ok || !v.ok) throw new Error(v.error || "Verification failed");
            firePurchase(valueMajor, currency, orderId!);
            setDone(true);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Verification failed");
          } finally {
            setLoading(false);
          }
        },
      });
      rzp.open();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="co-card co-success">
        <div style={{ fontSize: "2.2rem" }}>✅</div>
        <h3 style={{ margin: "0.3rem 0" }}>Payment successful</h3>
        <p className="muted" style={{ margin: 0 }}>
          Access for <strong>{productTitle}</strong>
          {order?.bumpTitle ? <> and <strong>{order.bumpTitle}</strong></> : null} will be sent to {email}.
        </p>
      </div>
    );
  }

  return (
    <div className="co-card">
      <p className="co-hint">Access to this purchase will be sent to this email</p>

      <label className="co-label">Email Address</label>
      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />

      <label className="co-label">Name *</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />

      <label className="co-label">Phone number</label>
      <div className="co-phone">
        <select className="select" value={code} onChange={(e) => setCode(e.target.value)}>
          {CODES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
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
                  <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>
                    {o.name}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--muted, #7a6770)" }}>
                    Add {o.product_name}
                  </span>
                </span>
                <span style={{ whiteSpace: "nowrap", fontWeight: 700, fontSize: 13 }}>
                  + {formatMoney(o.bump_paise, o.currency)}
                  {o.bump_paise < o.original_paise && (
                    <s style={{ marginLeft: 6, fontWeight: 400, color: "var(--muted, #7a6770)" }}>
                      {formatMoney(o.original_paise, o.currency)}
                    </s>
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
            <button type="button" className="co-coupon-remove" onClick={removeCoupon} style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>Remove</button>
          </div>
        ) : (
          <div className="co-phone" style={{ marginTop: 4 }}>
            <input className="input" value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(null); }} placeholder="Have a coupon?" disabled={preview} />
            <button type="button" className="btn" onClick={applyCoupon} disabled={syncing || preview || !couponInput.trim()} style={{ whiteSpace: "nowrap" }}>{syncing ? "…" : "Apply"}</button>
          </div>
        )}
        {couponErr && <div className="alert alert-error" style={{ marginTop: 8 }}>{couponErr}</div>}
      </div>

      <div className="co-summary">
        <div className="co-row"><span>Sub Total</span><span>{formatMoney(amount, currency)}</span></div>
        {discountPaise > 0 && (
          <div className="co-row" style={{ color: "var(--ok, #16a34a)" }}><span>Discount</span><span>− {formatMoney(discountPaise, currency)}</span></div>
        )}
        {bumpPaise > 0 && (
          <div className="co-row"><span>{order?.bumpTitle || "Add-on"}</span><span>+ {formatMoney(bumpPaise, currency)}</span></div>
        )}
        <div className="co-row co-total"><span>Total</span><span>{formatMoney(finalAmount, currency)}</span></div>
      </div>

      {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
      {!payEnabled && !preview && (
        <div className="alert alert-error" style={{ marginTop: 10 }}>Payments aren’t set up yet.</div>
      )}

      <button className="btn co-buy btn-shimmer" onClick={buyNow} disabled={loading || syncing || (!payEnabled && !preview)}>
        <span className="btn-shine" style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }} />
        {loading ? "Processing…" : ctaLabel} <span aria-hidden>→</span>
      </button>
      <p className="co-secure">🔒 Secure payment via Razorpay</p>
    </div>
  );
}
