"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/products";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

const CODES = ["+91", "+1", "+44", "+971", "+61", "+65", "+880", "+92"];

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
}: {
  pageId: string;
  amount: number; // smallest unit
  currency: string;
  storeName: string;
  productTitle: string;
  ctaLabel: string;
  payEnabled: boolean;
  preview?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Coupon state. "Apply" creates the order WITH the coupon server-side and we
  // reuse that order in buyNow, so only one order/usage is ever created and the
  // discount shown is exactly what the server computed (never client-trusted).
  const [couponInput, setCouponInput] = useState("");
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [applied, setApplied] = useState<{ orderId: string; discountPaise: number; originalPaise: number } | null>(null);

  const finalAmount = applied ? Math.max(1, applied.originalPaise - applied.discountPaise) : amount;
  const valueMajor = finalAmount / 100;

  async function applyCoupon() {
    if (preview) return;
    const codeStr = couponInput.trim();
    if (!codeStr) return;
    setCouponBusy(true);
    setCouponErr(null);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, coupon_code: codeStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not apply coupon");
      if (data.coupon_error || !data.discount_paise) {
        setApplied(null);
        setCouponErr(data.coupon_error || "This coupon isn’t valid for this purchase.");
      } else {
        setApplied({ orderId: data.order_id, discountPaise: data.discount_paise, originalPaise: data.original_amount_paise });
      }
    } catch (e) {
      setApplied(null);
      setCouponErr(e instanceof Error ? e.message : "Could not apply coupon");
    } finally {
      setCouponBusy(false);
    }
  }

  function removeCoupon() {
    setApplied(null);
    setCouponErr(null);
    setCouponInput("");
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
      // Reuse the order created by "Apply coupon" if present; otherwise create
      // a fresh full-price order now.
      let orderId = applied?.orderId;
      if (!orderId) {
        const cRes = await fetch("/api/checkout/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: pageId }),
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
          Access for <strong>{productTitle}</strong> will be sent to {email}.
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

      <div className="co-coupon">
        {applied ? (
          <div className="co-row" style={{ alignItems: "center" }}>
            <span style={{ color: "var(--ok, #16a34a)", fontWeight: 600 }}>✓ Coupon applied</span>
            <button type="button" className="co-coupon-remove" onClick={removeCoupon} style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>Remove</button>
          </div>
        ) : (
          <div className="co-phone" style={{ marginTop: 4 }}>
            <input className="input" value={couponInput} onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponErr(null); }} placeholder="Have a coupon?" disabled={preview} />
            <button type="button" className="btn" onClick={applyCoupon} disabled={couponBusy || preview || !couponInput.trim()} style={{ whiteSpace: "nowrap" }}>{couponBusy ? "…" : "Apply"}</button>
          </div>
        )}
        {couponErr && <div className="alert alert-error" style={{ marginTop: 8 }}>{couponErr}</div>}
      </div>

      <div className="co-summary">
        <div className="co-row"><span>Sub Total</span><span>{formatMoney(applied ? applied.originalPaise : amount, currency)}</span></div>
        {applied && (
          <div className="co-row" style={{ color: "var(--ok, #16a34a)" }}><span>Discount</span><span>− {formatMoney(applied.discountPaise, currency)}</span></div>
        )}
        <div className="co-row co-total"><span>Total</span><span>{formatMoney(finalAmount, currency)}</span></div>
      </div>

      {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
      {!payEnabled && !preview && (
        <div className="alert alert-error" style={{ marginTop: 10 }}>Payments aren’t set up yet.</div>
      )}

      <button className="btn co-buy btn-shimmer" onClick={buyNow} disabled={loading || (!payEnabled && !preview)}>
        <span className="btn-shine" style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }} />
        {loading ? "Processing…" : ctaLabel} <span aria-hidden>→</span>
      </button>
      <p className="co-secure">🔒 Secure payment via Razorpay</p>
    </div>
  );
}
