"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/dx/ui";
import { saveDomainPricing } from "./actions";

export default function DomainPricingForm({
  subRupees,
  domRupees,
  migrationPending,
}: {
  subRupees: number;
  domRupees: number;
  migrationPending?: boolean;
}) {
  const [sub, setSub] = useState(String(subRupees));
  const [dom, setDom] = useState(String(domRupees));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const showMsg = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveDomainPricing({
        extra_subdomain_rupees: Number(sub) || 0,
        extra_domain_rupees: Number(dom) || 0,
      });
      showMsg(res.ok, res.ok ? "Domain pricing saved." : res.error ?? "Save failed.");
    });
  };

  const numInput = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "6px 12px" }}>
      <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 15 }}>₹</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={placeholder}
        inputMode="decimal"
        style={{ width: 72, border: 0, background: "transparent", fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--text)", outline: "none", textAlign: "right" }}
      />
      <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>/mo</span>
    </div>
  );

  return (
    <Card title="Domain pricing">
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
        Prices charged for extras beyond the plan allowance.
      </p>

      {migrationPending && (
        <div style={{
          background: "color-mix(in srgb, var(--gold) 14%, transparent)",
          border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
          borderRadius: 10,
          padding: "10px 13px",
          marginBottom: 14,
          fontSize: 12.5,
          fontWeight: 600,
        }}>
          Migration pending — showing defaults. Apply <code style={{ fontFamily: "ui-monospace,monospace", fontSize: 11 }}>20260618280000_admin_comms.sql</code> to persist changes.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderTop: "1px solid var(--border)" }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Extra subdomain</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>1 included free · charged per extra</div>
        </div>
        {numInput(sub, setSub, "49")}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderTop: "1px solid var(--border)" }}>
        <span style={{ fontSize: 18 }}>🔗</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Extra custom domain</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>1 included free · charged per extra</div>
        </div>
        {numInput(dom, setDom, "199")}
      </div>

      {msg && (
        <div style={{
          padding: "10px 14px",
          borderRadius: 9,
          marginTop: 12,
          fontSize: 13,
          fontWeight: 600,
          background: msg.ok ? "var(--greenbg)" : "var(--redbg)",
          color: msg.ok ? "var(--green)" : "var(--red)",
        }}>
          {msg.text}
        </div>
      )}

      <button
        type="button"
        className="btn grad"
        style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
        onClick={handleSave}
        disabled={pending}
      >
        {pending ? "Saving…" : "Save pricing"}
      </button>
    </Card>
  );
}
