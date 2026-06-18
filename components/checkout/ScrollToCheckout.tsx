"use client";

/** Web bottom-bar button: smooth-scrolls to the embedded checkout + focuses email. */
export default function ScrollToCheckout({ label = "Buy now" }: { label?: string }) {
  function go() {
    const el = document.getElementById("prod-checkout");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = el.querySelector<HTMLInputElement>("input");
    window.setTimeout(() => input?.focus(), 450);
  }
  return (
    <button className="btn btn-gradient btn-block btn-shimmer" onClick={go}>
      <span className="btn-shine" style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }} />
      {label} <span aria-hidden>→</span>
    </button>
  );
}
