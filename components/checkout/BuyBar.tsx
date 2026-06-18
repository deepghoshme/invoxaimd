"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Fixed bottom buy bar — same design on web + mobile, both layouts. Shows the
 * offer price, struck-through compare price and % off, plus a Buy button.
 *  - mode "scroll": smooth-scroll to the on-page checkout (targetId) and focus it.
 *  - mode "order":  create the order and open the page-type checkout (mobile, no inline form).
 */
export default function BuyBar({
  label, priceText, compareText, off, mode, pageId, targetId = "prod-checkout", reveal = false,
}: {
  label: string;
  priceText: string;
  compareText?: string;
  off?: number;
  mode: "scroll" | "order";
  pageId?: string;
  targetId?: string;
  reveal?: boolean; // true → hidden until the page is scrolled (web); false → always shown (mobile)
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(!reveal);

  useEffect(() => {
    if (!reveal) return;
    const f = () => setShow(window.scrollY > 320);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [reveal]);

  async function go() {
    if (mode === "scroll") {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => el.querySelector<HTMLInputElement>("input")?.focus(), 450);
      }
      return;
    }
    if (!pageId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      router.push(`/${data.page_type}/checkout/${data.order_id}`);
    } catch (e) {
      setLoading(false);
      alert(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <div className={`buybar${show ? " show" : ""}`}>
      <div className="buybar-price">
        <div className="bb-row">
          <span className="bb-now">{priceText}</span>
          {compareText && <span className="bb-was">{compareText}</span>}
          {off && off > 0 ? <span className="bb-off">{off}% OFF</span> : null}
        </div>
        <span className="bb-cap">incl. all taxes</span>
      </div>
      <button className="buybar-btn" onClick={go} disabled={loading}>
        <span className="btn-shine" style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }} />
        {loading ? "Starting…" : label} <span className="bb-arrow" aria-hidden>→</span>
      </button>
    </div>
  );
}
