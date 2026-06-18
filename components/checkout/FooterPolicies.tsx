"use client";

import { useState } from "react";

type Item = { key: string; label: string; body?: string };

/** Website-style footer policy links; clicking one reveals its text below. */
export default function FooterPolicies({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (items.length === 0) return null;
  const active = items.find((i) => i.key === open);

  return (
    <div className="foot-policies">
      <div className="foot-policy-links">
        {items.map((p, i) => (
          <span key={p.key}>
            {i > 0 && <span className="foot-sep">·</span>}
            <button
              className={`foot-policy-link${open === p.key ? " on" : ""}`}
              onClick={() => setOpen(open === p.key ? null : p.key)}
            >
              {p.label}
            </button>
          </span>
        ))}
      </div>
      {active?.body && <div className="foot-policy-body">{active.body}</div>}
    </div>
  );
}
