"use client";

import { useEffect, useState } from "react";

/**
 * Floating bottom Buy bar that slides up once the page is scrolled — on web and
 * mobile. Reveals after a small scroll threshold, or as soon as the top sentinel
 * (#prod-top-sentinel) scrolls above the viewport, whichever comes first.
 */
export default function StickyBuyBar({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const sentinel = document.getElementById("prod-top-sentinel");
      const past = sentinel ? sentinel.getBoundingClientRect().bottom < 0 : false;
      setShow(past || window.scrollY > 320);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return <div className={`prod-cta-bar${show ? " show" : ""}`}>{children}</div>;
}
