"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/products";
import type { StoreProduct } from "@/lib/store";

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

/** Storefront inline checkout popup for a single catalog product. Reuses the
 * order → start → verify flow, keyed on product_id (no landing page needed). */
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

  const currency = product.currency || "INR";
  const q = Math.max(1, Math.min(99, Math.round(qty)));
  const amount = Math.round((product.priceNum ?? 0) * 100) * q; // minor units × qty
  const valueMajor = amount / 100;

  async function buyNow() {
    if (!email.trim()) return setErr("Please enter your email.");
    if (!name.trim()) return setErr("Please enter your name.");
    setLoading(true); setErr(null);

    if (!(await loadRazorpay())) {
      setErr("Couldn’t load the payment library. Check your connection.");
      return setLoading(false);
    }
    try {
      const cRes = await fetch("/api/checkout/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, qty: q, variant: variantLabel || undefined }),
      });
      const cData = await cRes.json();
      if (!cRes.ok) throw new Error(cData.error || "Could not start checkout");

      const sRes = await fetch("/api/checkout/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: cData.order_id, buyer_email: email, buyer_name: name, buyer_phone: phone ? `${code} ${phone}` : "" }),
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
              body: JSON.stringify({ order_id: cData.order_id, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature }),
            });
            const v = await vRes.json();
            if (!vRes.ok || !v.ok) throw new Error(v.error || "Verification failed");
            firePurchase(valueMajor, currency, cData.order_id);
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
            <p className="muted" style={{ margin: 0 }}>Access for <strong>{product.name}</strong> will be sent to {email}.</p>
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
            <div className="co-summary">
              <div className="co-row co-total"><span>Total</span><span>{formatMoney(amount, currency)}</span></div>
            </div>
            {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
            {!payEnabled && <div className="alert alert-error" style={{ marginTop: 10 }}>This store hasn’t finished setting up payments yet.</div>}
            <button className="btn co-buy btn-shimmer" onClick={buyNow} disabled={loading || !payEnabled}>
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
