"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Mobile floating Buy pill — reveals on scroll, creates the order, opens the checkout page. */
export default function FloatingCheckout({ pageId, label = "Buy now" }: { pageId: string; label?: string }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const f = () => setShow(window.scrollY > 280);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <button className={`floating-buy${show ? " show" : ""}`} onClick={go} disabled={loading}>
      <span className="btn-shine" style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }} />
      {loading ? "Starting…" : label} <span aria-hidden>→</span>
    </button>
  );
}
