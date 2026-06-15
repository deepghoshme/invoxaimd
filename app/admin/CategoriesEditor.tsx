"use client";

import { useState } from "react";
import { updateCommission } from "./actions";

type Category = {
  id: string;
  name: string;
  commission_rate: number;
  is_active: boolean;
};

function Row({ cat }: { cat: Category }) {
  const [pct, setPct] = useState((cat.commission_rate * 100).toFixed(2));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setMsg(null);
    const res = await updateCommission(cat.id, parseFloat(pct));
    if (res.ok) {
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("error");
      setMsg(res.error ?? "Failed");
    }
  }

  return (
    <tr style={{ borderTop: "1px solid var(--color-border)" }}>
      <td style={{ padding: "0.6rem 0.5rem" }}>{cat.name}</td>
      <td style={{ padding: "0.6rem 0.5rem", width: 140 }}>
        <div className="input-suffix" style={{ maxWidth: 120 }}>
          <input
            inputMode="decimal"
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <span className="suffix">%</span>
        </div>
      </td>
      <td style={{ padding: "0.6rem 0.5rem", width: 130 }}>
        <button
          className="btn btn-primary"
          style={{ padding: "0.45rem 0.9rem", fontSize: "0.85rem" }}
          onClick={save}
          disabled={state === "saving"}
        >
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save"}
        </button>
        {state === "error" && (
          <div style={{ color: "#b3214e", fontSize: "0.75rem" }}>{msg}</div>
        )}
      </td>
    </tr>
  );
}

export default function CategoriesEditor({ categories }: { categories: Category[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" }}>
      <thead>
        <tr style={{ textAlign: "left", color: "var(--color-muted)", fontSize: "0.8rem" }}>
          <th style={{ padding: "0.4rem 0.5rem" }}>Category</th>
          <th style={{ padding: "0.4rem 0.5rem" }}>Commission</th>
          <th style={{ padding: "0.4rem 0.5rem" }}></th>
        </tr>
      </thead>
      <tbody>
        {categories.map((c) => (
          <Row key={c.id} cat={c} />
        ))}
      </tbody>
    </table>
  );
}
