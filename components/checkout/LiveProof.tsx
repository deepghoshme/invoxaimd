"use client";

import { useEffect, useState } from "react";

const POOL = [
  { name: "Rahul", location: "Delhi" },
  { name: "Priya", location: "Mumbai" },
  { name: "Aarav", location: "Bengaluru" },
  { name: "Sneha", location: "Pune" },
  { name: "Vikram", location: "Hyderabad" },
  { name: "Ananya", location: "Kolkata" },
];
const AGO = ["just now", "2 min ago", "5 min ago", "9 min ago", "13 min ago"];

/**
 * Rotating "X from Y just purchased" social-proof popups. Uses the seller's list
 * when provided, else a built-in pool. No real buyer data is exposed.
 */
export default function LiveProof({
  items,
  intervalSec = 8,
  product,
}: {
  items?: { name: string; location?: string }[];
  intervalSec?: number;
  product: string;
}) {
  const list = items && items.length ? items : POOL;
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (list.length === 0) return;
    let idx = 0;
    const cycle = () => {
      setI(idx % list.length);
      setShow(true);
      idx++;
      window.setTimeout(() => setShow(false), 4200);
    };
    const first = window.setTimeout(cycle, 3000);
    const id = window.setInterval(cycle, Math.max(5, intervalSec) * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [list.length, intervalSec]);

  const cur = list[i];
  if (!cur) return null;

  return (
    <div className={`liveproof${show ? " show" : ""}`} aria-live="polite">
      <span className="lp-dot" />
      <div className="lp-text">
        <strong>
          {cur.name}
          {cur.location ? ` from ${cur.location}` : ""}
        </strong>
        <span className="lp-sub">
          purchased {product} · {AGO[i % AGO.length]}
        </span>
      </div>
    </div>
  );
}
