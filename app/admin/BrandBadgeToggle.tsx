"use client";

import { useState } from "react";
import { setBrandBadge } from "./actions";

/** Admin switch: global on/off for the "Built with InvoxAI" badge. */
export default function BrandBadgeToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setOn(next); // optimistic
    setSaving(true);
    setErr(null);
    const res = await setBrandBadge(next);
    setSaving(false);
    if (!res.ok) {
      setOn(!next); // revert
      setErr(res.error ?? "Failed to save");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>
          “⚡ Built with InvoxAI” badge {on ? "is showing" : "is hidden"}
        </p>
        <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
          {on
            ? "The pill appears on every public seller page."
            : "The pill is hidden across all public seller pages."}
        </p>
        {err && <p style={{ margin: "0.3rem 0 0", color: "#b3214e", fontSize: "0.8rem" }}>{err}</p>}
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label="Toggle Built with InvoxAI badge"
        onClick={toggle}
        disabled={saving}
        className={`switch${on ? " on" : ""}`}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}
