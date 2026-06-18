"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phead, Card } from "@/components/dx/ui";
import { savePlanLimits, type PlanWithLimits } from "./actions";

/** Display a paise value as a rupee string, e.g. 1000 paise → "10" */
function paiseToRupee(p: number | null): string {
  if (p === null || p === undefined) return "";
  return String(Math.round(p / 100));
}

/** Convert rupee string input to paise integer */
function rupeeToPaise(r: string): number | null {
  const n = parseInt(r.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n * 100;
}

type LocalPlan = {
  id: string;
  name: string;
  price: number;
  contactLimit: string;    // display string (number of contacts)
  overageRupees: string;   // display string (₹ per extra contact)
};

function priceLabel(price: number) {
  if (price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}/mo`;
}

export default function LimitsClient({ plans }: { plans: PlanWithLimits[] | null }) {
  const router = useRouter();

  const [local, setLocal] = useState<LocalPlan[]>(() => {
    if (!plans) return [];
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      contactLimit: p.contact_limit !== null ? String(p.contact_limit) : "",
      overageRupees: paiseToRupee(p.overage_paise),
    }));
  });

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function update(id: string, field: "contactLimit" | "overageRupees", value: string) {
    setLocal((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value.replace(/[^0-9]/g, "") } : p))
    );
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const updates = local.map((p) => ({
      id: p.id,
      contact_limit: p.contactLimit ? parseInt(p.contactLimit, 10) : null,
      overage_paise: p.overageRupees ? rupeeToPaise(p.overageRupees) : null,
    }));
    const res = await savePlanLimits(updates);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Limits saved." } : { ok: false, text: res.error ?? "Failed." });
    if (res.ok) {
      router.refresh();
      setTimeout(() => setMsg(null), 2500);
    }
  }

  const missingColumn = plans !== null && plans.length > 0 && !("overage_paise" in plans[0]);

  return (
    <>
      <style>{`
        .lm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .lm-table th { text-align: left; color: var(--muted); font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; padding: 0 10px 11px; }
        .lm-table td { padding: 12px 10px; border-top: 1px solid var(--border); vertical-align: middle; }
        .lm-plan-name { font-weight: 600; font-size: 13.5px; }
        .lm-plan-price { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .lm-input-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg);
          border: 1.5px solid var(--border);
          border-radius: 9px;
          padding: 5px 10px 5px 12px;
          transition: border-color .14s;
          width: 140px;
        }
        .lm-input-wrap:focus-within { border-color: var(--primary); }
        .lm-input-wrap .pfx { color: var(--muted); font-weight: 700; font-size: 13px; flex: none; }
        .lm-input-wrap input {
          flex: 1;
          border: 0;
          background: transparent;
          font: inherit;
          font-weight: 700;
          color: var(--text);
          outline: none;
          min-width: 0;
          width: 60px;
        }
        .lm-notice {
          padding: 16px;
          background: color-mix(in srgb, var(--gold, #ffb23e) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--gold, #ffb23e) 40%, transparent);
          border-radius: 12px;
          font-size: 13px;
          color: var(--text);
        }
        .lm-alert-ok { color: var(--green); font-size: 13px; font-weight: 600; }
        .lm-alert-err { color: var(--red, #e5476f); font-size: 13px; font-weight: 600; }
        .lm-hint { font-size: 12px; color: var(--muted); margin-top: 12px; line-height: 1.6; }
      `}</style>

      <Phead
        title="Contact limits & overage"
        sub="Per-plan contact limits and per-contact overage pricing charged to sellers."
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {msg && (
              <span className={msg.ok ? "lm-alert-ok" : "lm-alert-err"}>
                {msg.text}
              </span>
            )}
            <button
              className="btn grad"
              onClick={save}
              disabled={busy || !plans || plans.length === 0}
            >
              {busy ? "Saving…" : "Save limits"}
            </button>
          </div>
        }
      />

      {plans === null ? (
        <Card>
          <div className="lm-notice">
            Migration not applied yet — run <code>supabase/migrations/20260618270000_admin_monetization.sql</code> to add the <strong>overage_paise</strong> column to <strong>plans</strong>.
          </div>
        </Card>
      ) : missingColumn ? (
        <Card>
          <div className="lm-notice">
            The <strong>overage_paise</strong> column is missing. Apply the monetization migration to enable editing.
          </div>
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          <div className="dx-empty">No plans found. Create plans at Plans &amp; Features first.</div>
        </Card>
      ) : (
        <Card title="Per-plan limits">
          <table className="lm-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Contact limit</th>
                <th>Overage rate</th>
              </tr>
            </thead>
            <tbody>
              {local.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="lm-plan-name">{p.name}</div>
                    <div className="lm-plan-price">{priceLabel(p.price)}</div>
                  </td>
                  <td>
                    <div className="lm-input-wrap">
                      <input
                        inputMode="numeric"
                        value={p.contactLimit}
                        placeholder="Unlimited"
                        onChange={(e) => update(p.id, "contactLimit", e.target.value)}
                        aria-label={`Contact limit for ${p.name}`}
                      />
                      <span className="pfx">contacts</span>
                    </div>
                  </td>
                  <td>
                    <div className="lm-input-wrap">
                      <span className="pfx">₹</span>
                      <input
                        inputMode="numeric"
                        value={p.overageRupees}
                        placeholder="—"
                        onChange={(e) => update(p.id, "overageRupees", e.target.value)}
                        aria-label={`Overage rate for ${p.name}`}
                      />
                      <span className="pfx">/ extra</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lm-hint">
            Contact limit: max contacts a seller on this plan can store. Leave blank for unlimited.
            Overage rate: charged in rupees per contact over the limit (billed from wallet).
          </p>
        </Card>
      )}
    </>
  );
}
