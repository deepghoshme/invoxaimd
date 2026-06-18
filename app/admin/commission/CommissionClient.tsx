"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phead, Card } from "@/components/dx/ui";
import { saveCommissionRates } from "./actions";

type Category = {
  id: string;
  name: string;
  slug: string;
  commission_rate: number;
  is_active: boolean;
  sort_order: number;
};

const CATEGORY_ICONS: Record<string, string> = {
  "digital-products": "📦",
  "online-courses": "🎓",
  "coaching-consulting": "🧑‍💼",
  "events-ticketing": "🎟️",
  "services": "📅",
  "physical-goods": "🛍️",
  "memberships-community": "⭐",
  "other": "💡",
};

export default function CommissionClient({ categories }: { categories: Category[] | null }) {
  const router = useRouter();

  // Local rates keyed by category id; stored as 0–100 (display percent).
  const [rates, setRates] = useState<Record<string, string>>(() => {
    if (!categories) return {};
    return Object.fromEntries(
      categories.map((c) => [c.id, (Number(c.commission_rate) * 100).toFixed(1)])
    );
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    if (!categories) return;
    setBusy(true);
    setMsg(null);

    const updates = categories.map((c) => ({
      id: c.id,
      commission_rate: parseFloat(rates[c.id] ?? "0") || 0,
    }));

    const res = await saveCommissionRates(updates);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Rates saved." } : { ok: false, text: res.error ?? "Failed to save." });
    if (res.ok) {
      router.refresh();
      setTimeout(() => setMsg(null), 2500);
    }
  }

  return (
    <>
      <style>{`
        .cm-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 0;
          border-top: 1px solid var(--border);
        }
        .cm-row:first-child { border-top: 0; }
        .cm-emoji { font-size: 20px; flex: none; width: 28px; text-align: center; }
        .cm-name { flex: 1; font-weight: 600; font-size: 13.5px; }
        .cm-rate-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg);
          border: 1.5px solid var(--border);
          border-radius: 9px;
          padding: 5px 8px 5px 12px;
          transition: border-color .14s;
        }
        .cm-rate-wrap:focus-within { border-color: var(--primary); }
        .cm-rate-wrap input {
          width: 52px;
          border: 0;
          background: transparent;
          font: inherit;
          font-weight: 700;
          color: var(--text);
          outline: none;
          text-align: right;
        }
        .cm-rate-wrap .pct { color: var(--muted); font-weight: 700; font-size: 13px; }
        .cm-notice {
          padding: 16px;
          background: color-mix(in srgb, var(--primary) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
          border-radius: 12px;
          font-size: 13px;
          color: var(--text);
          margin-bottom: 4px;
        }
        .cm-alert-ok { color: var(--green); font-size: 13px; font-weight: 600; }
        .cm-alert-err { color: var(--red, #e5476f); font-size: 13px; font-weight: 600; }
      `}</style>

      <Phead
        title="Per-category commission"
        sub="The platform fee deducted from a seller's wallet on each sale, by business category."
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {msg && (
              <span className={msg.ok ? "cm-alert-ok" : "cm-alert-err"}>
                {msg.text}
              </span>
            )}
            <button className="btn grad" onClick={save} disabled={busy || !categories}>
              {busy ? "Saving…" : "Save rates"}
            </button>
          </div>
        }
      />

      {categories === null ? (
        <Card>
          <div className="cm-notice">
            Migration not applied yet. Run <code>supabase/migrations/20260618270000_admin_monetization.sql</code> to enable this page. The <strong>business_categories</strong> table needs to exist.
          </div>
        </Card>
      ) : categories.length === 0 ? (
        <Card>
          <div className="dx-empty">No business categories found. Seed data may be missing.</div>
        </Card>
      ) : (
        <Card title="Rates by category">
          {categories.map((c) => (
            <div className="cm-row" key={c.id}>
              <span className="cm-emoji">{CATEGORY_ICONS[c.slug] ?? "💼"}</span>
              <span className="cm-name">{c.name}</span>
              <div className="cm-rate-wrap">
                <input
                  inputMode="decimal"
                  value={rates[c.id] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    setRates((prev) => ({ ...prev, [c.id]: v }));
                  }}
                  onBlur={(e) => {
                    const n = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    setRates((prev) => ({ ...prev, [c.id]: n.toFixed(1) }));
                  }}
                  aria-label={`Commission rate for ${c.name}`}
                />
                <span className="pct">%</span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
