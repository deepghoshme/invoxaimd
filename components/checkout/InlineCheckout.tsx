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

  const valueMajor = amount / 100;

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
      const cRes = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId }),
      });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData.error || "Could not start checkout");

      const sRes = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: cData.order_id,
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
                order_id: cData.order_id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            const v = await vRes.json();
            if (!vRes.ok || !v.ok) throw new Error(v.error || "Verification failed");
            firePurchase(valueMajor, currency, cData.order_id);
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

      <div className="co-summary">
        <div className="co-row"><span>Sub Total</span><span>{formatMoney(amount, currency)}</span></div>
        <div className="co-row co-total"><span>Total</span><span>{formatMoney(amount, currency)}</span></div>
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
