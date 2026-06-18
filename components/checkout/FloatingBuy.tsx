"use client";

import { useEffect, useState } from "react";

/**
 * Floating Buy button shown on web AND mobile. Reveals after the page is
 * scrolled and smooth-scrolls to the checkout panel (#prod-checkout).
 */
export default function FloatingBuy({ label = "Buy now" }: { label?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 360);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function go() {
    const el = document.getElementById("prod-checkout");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      const focusable = el.querySelector<HTMLInputElement>("input");
      window.setTimeout(() => focusable?.focus(), 450);
    }
  }

  return (
    <button className={`floating-buy${show ? " show" : ""}`} onClick={go}>
      <span className="btn-shine" style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }} />
      {label} <span aria-hidden>↓</span>
    </button>
  );
}
