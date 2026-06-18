"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type BuyAnim = "none" | "shine" | "pulse";

/**
 * Creates an internal order for a product page, then navigates to the
 * page-type-aware checkout (`/{page_type}/checkout/{order_id}`).
 */
export default function BuyButton({
  pageId,
  label,
  disabled,
  disabledReason,
  icon,
  animation = "shine",
}: {
  pageId: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  icon?: string;
  animation?: BuyAnim;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buy() {
    setLoading(true);
    setErr(null);
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
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (disabled) {
    return (
      <div>
        <button className="btn btn-block btn-soldout" disabled>
          {icon && <span className="btn-ico">{icon}</span>}
          {label}
        </button>
        {disabledReason && (
          <p className="muted" style={{ fontSize: "0.8rem", marginTop: 8, textAlign: "center" }}>
            {disabledReason}
          </p>
        )}
      </div>
    );
  }

  const cls = `btn btn-gradient btn-block${animation === "shine" ? " btn-shimmer" : ""}${animation === "pulse" ? " btn-pulse" : ""}`;

  return (
    <div>
      <button className={cls} onClick={buy} disabled={loading}>
        {animation === "shine" && (
          <span className="btn-shine" style={{ background: "linear-gradient(90deg, transparent, #ffffff, transparent)" }} />
        )}
        {icon && <span className="btn-ico">{icon}</span>}
        {loading ? "Starting…" : label}
      </button>
      {err && (
        <p style={{ color: "#b3214e", fontSize: "0.82rem", marginTop: 8, textAlign: "center" }}>
          {err}
        </p>
      )}
    </div>
  );
}
