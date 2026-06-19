"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/dx/ui";
import { sendTestEmail } from "./actions";
import { EMAIL_ALIASES } from "@/lib/emailRoutes";

export default function TestMailPanel() {
  const [to, setTo] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyAddr, setBusyAddr] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  function sendTest(from: string) {
    if (!to.trim()) {
      setResults((r) => ({ ...r, [from]: { ok: false, msg: "Enter a recipient first." } }));
      return;
    }
    setBusyAddr(from);
    startTransition(async () => {
      const res = await sendTestEmail({ from, to });
      setResults((r) => ({ ...r, [from]: { ok: res.ok, msg: res.ok ? "Sent ✓" : res.error ?? "Failed" } }));
      setBusyAddr(null);
    });
  }

  return (
    <Card title="Test mail">
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
        Send a test from any alias to confirm delivery — and that the sending account is authorised to
        send <i>as</i> that alias. (Aliases that aren’t authorised may be rewritten by the provider to the
        login address.)
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          className="input"
          type="email"
          placeholder="Send test to…  e.g. you@email.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {EMAIL_ALIASES.map((a) => {
          const r = results[a.address];
          const isBusy = pending && busyAddr === a.address;
          return (
            <div
              key={a.address}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 10 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.address}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.purpose}</div>
              </div>
              {r && (
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", color: r.ok ? "var(--ok, #16a34a)" : "var(--danger, #ef4444)" }}>
                  {r.msg}
                </span>
              )}
              <button className="btn" type="button" disabled={isBusy} onClick={() => sendTest(a.address)} style={{ whiteSpace: "nowrap" }}>
                {isBusy ? "…" : "Send test"}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
