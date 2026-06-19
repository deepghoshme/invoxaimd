"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "@/lib/products";

type Order = {
  id: string;
  product_title: string | null;
  amount: number;
  currency: string;
  status: string;
};

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

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

/** Fire purchase conversion events to whatever pixels are loaded on the page. */
function firePurchase(valueMajor: number, currency: string, orderId: string) {
  const w = window as unknown as {
    fbq?: (...a: unknown[]) => void;
    gtag?: (...a: unknown[]) => void;
  };
  try {
    w.fbq?.("track", "Purchase", { value: valueMajor, currency });
  } catch {}
  try {
    w.gtag?.("event", "purchase", {
      transaction_id: orderId,
      value: valueMajor,
      currency,
    });
  } catch {}
}

export default function CheckoutForm({
  order,
  storeName,
}: {
  order: Order;
  storeName: string;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(order.status === "paid");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const valueMajor = order.amount / 100;

  async function pay() {
    if (!email.trim()) {
      setErr("Please enter your email.");
      return;
    }
    setLoading(true);
    setErr(null);

    const ok = await loadRazorpay();
    if (!ok) {
      setErr("Couldn’t load the payment library. Check your connection.");
      setLoading(false);
      return;
    }

    let start;
    try {
      const res = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          buyer_email: email,
          buyer_name: name,
          buyer_phone: phone,
        }),
      });
      start = await res.json();
      if (!res.ok) throw new Error(start.error || "Could not start payment");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start payment");
      setLoading(false);
      return;
    }

    const rzp = new window.Razorpay!({
      key: start.key_id,
      order_id: start.razorpay_order_id,
      amount: start.amount,
      currency: start.currency,
      name: storeName,
      description: order.product_title ?? "Order",
      prefill: { email, name, contact: phone },
      theme: { color: "#FF6A3D" },
      modal: { ondismiss: () => setLoading(false) },
      handler: async (resp: Record<string, string>) => {
        try {
          const res = await fetch("/api/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: order.id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || "Verification failed");
          firePurchase(valueMajor, order.currency, order.id);
          setDone(true);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Verification failed");
        } finally {
          setLoading(false);
        }
      },
    });
    rzp.open();
  }

  if (done) {
    return (
      <div className="card" style={{ textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
        <div style={{ fontSize: "2.4rem" }}>✅</div>
        <h1 style={{ margin: "0.4rem 0 0.2rem" }}>Payment successful</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Thanks{name ? `, ${name}` : ""}! A confirmation has been recorded for{" "}
          <strong>{order.product_title}</strong>.
        </p>
        <p style={{ fontWeight: 700, fontSize: "1.2rem" }}>
          {formatMoney(order.amount, order.currency)}
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 460, margin: "0 auto" }}>
      <p className="eyebrow">Checkout</p>
      <h1 style={{ margin: "0.15rem 0 0.2rem" }}>{order.product_title}</h1>
      <p style={{ fontWeight: 800, fontSize: "1.6rem", margin: "0 0 var(--space-2)" }}>
        {formatMoney(order.amount, order.currency)}
      </p>

      <div className="field">
        <label className="label">Email *</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
        />
      </div>
      <div className="field">
        <label className="label">Name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="field">
        <label className="label">Phone</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91…"
        />
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      {/* Inline pay button — hidden on mobile (≤640px) via .co-inline-pay */}
      <button className="btn btn-gradient btn-block btn-shimmer co-inline-pay" onClick={pay} disabled={loading}>
        <span
          className="btn-shine"
          style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }}
        />
        {loading ? "Processing…" : `Pay ${formatMoney(order.amount, order.currency)}`}
      </button>
      <p className="muted" style={{ fontSize: "0.78rem", textAlign: "center", marginTop: 10 }}>
        🔒 Secure payment via Razorpay
      </p>

      {/* Mobile-pinned pay bar — portals to body so it escapes the card's stacking
          context and sits fixed at the viewport bottom. Only visible on ≤640px via CSS. */}
      {mounted && createPortal(
        <div className="co-pay-bar">
          <button
            className="btn btn-gradient btn-block btn-shimmer"
            onClick={pay}
            disabled={loading}
            style={{ fontSize: "1rem", padding: "0.85rem 1rem" }}
          >
            <span
              className="btn-shine"
              style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }}
            />
            {loading ? "Processing…" : `Pay ${formatMoney(order.amount, order.currency)}`}
          </button>
          <p className="muted" style={{ fontSize: "0.72rem", textAlign: "center", margin: "4px 0 0" }}>
            🔒 Secure payment via Razorpay
          </p>
        </div>,
        document.body,
      )}
    </div>
  );
}

