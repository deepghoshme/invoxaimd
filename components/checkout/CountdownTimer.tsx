"use client";

import { useEffect, useState } from "react";

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** Live ticking countdown to `endIso`. Shows the expiry message once it hits 0. */
export default function CountdownTimer({ endIso, expireMsg }: { endIso: string; expireMsg?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(endIso).getTime();
  if (!Number.isFinite(end)) return null;
  // Pre-hydration: render nothing rather than a flash of wrong time.
  if (now === null) return null;

  const left = end - now;
  if (left <= 0) {
    return <div className="cd-expired">⏳ {expireMsg || "This offer has ended."}</div>;
  }

  const p = split(left);
  const box = (v: number, l: string) => (
    <div className="cd-box">
      <span className="cd-num">{String(v).padStart(2, "0")}</span>
      <span className="cd-lbl">{l}</span>
    </div>
  );

  return (
    <div className="cd">
      <span className="cd-title">⏰ Offer ends in</span>
      <div className="cd-row">
        {p.d > 0 && box(p.d, "days")}
        {box(p.h, "hrs")}
        {box(p.m, "min")}
        {box(p.s, "sec")}
      </div>
    </div>
  );
}
