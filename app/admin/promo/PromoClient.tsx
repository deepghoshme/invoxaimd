"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phead, Card } from "@/components/dx/ui";
import {
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
  type PromoCode,
  type PromoInput,
} from "./actions";

const SCOPES = [
  { value: "all", label: "All plans" },
  { value: "starter", label: "Starter only" },
  { value: "pro", label: "Pro only" },
  { value: "growth", label: "Growth only" },
];

const EMPTY_FORM: PromoInput = {
  code: "",
  discount_type: "percent",
  discount_value: 0,
  scope: "all",
  usage_limit: null,
  expires_at: null,
};

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function discountLabel(code: PromoCode) {
  if (code.discount_type === "percent") return `${code.discount_value}% off`;
  return `₹${code.discount_value} off`;
}

function usageLabel(code: PromoCode) {
  if (!code.usage_limit) return `${code.used_count} used`;
  return `${code.used_count} / ${code.usage_limit}`;
}

// ---- Create form ----
function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<PromoInput>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function set<K extends keyof PromoInput>(k: K, v: PromoInput[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setOk(false);
    const res = await createPromoCode(form);
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Failed."); return; }
    setOk(true);
    setForm(EMPTY_FORM);
    setTimeout(() => { setOk(false); onCreated(); }, 800);
  }

  const previewCode = (form.code || "CODE").toUpperCase().replace(/[^A-Z0-9]/g, "") || "CODE";
  const previewOff = form.discount_type === "percent"
    ? `${form.discount_value || 0}% OFF`
    : `₹${form.discount_value || 0} OFF`;

  return (
    <form className="pr-form" onSubmit={submit} autoComplete="off">
      <div className="dx-field">
        <label>Code</label>
        <input
          className="pr-code-input"
          value={form.code}
          placeholder="SUMMER25"
          maxLength={24}
          onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          required
        />
      </div>

      <div className="pr-seg-wrap">
        <label className="pr-seg-label">Discount type</label>
        <div className="pr-seg">
          <button type="button" className={form.discount_type === "percent" ? "on" : ""} onClick={() => set("discount_type", "percent")}>Percent %</button>
          <button type="button" className={form.discount_type === "flat" ? "on" : ""} onClick={() => set("discount_type", "flat")}>Flat ₹</button>
        </div>
      </div>

      <div className="dx-ff">
        <div className="dx-field">
          <label>{form.discount_type === "percent" ? "Percent %" : "Amount ₹"}</label>
          <input
            inputMode="numeric"
            value={form.discount_value || ""}
            placeholder={form.discount_type === "percent" ? "20" : "100"}
            onChange={(e) => set("discount_value", parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0)}
            required
          />
        </div>
        <div className="dx-field">
          <label>Applies to</label>
          <select value={form.scope} onChange={(e) => set("scope", e.target.value)}>
            {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="dx-ff">
        <div className="dx-field">
          <label>Usage limit</label>
          <input
            inputMode="numeric"
            value={form.usage_limit ?? ""}
            placeholder="Unlimited"
            onChange={(e) => set("usage_limit", e.target.value ? parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) : null)}
          />
        </div>
        <div className="dx-field">
          <label>Expires</label>
          <input
            type="date"
            value={form.expires_at ?? ""}
            onChange={(e) => set("expires_at", e.target.value || null)}
          />
        </div>
      </div>

      {/* ticket preview */}
      <div className="pr-ticket">
        <div className="pr-ticket-label">Coupon</div>
        <div className="pr-ticket-code">{previewCode}</div>
        <div className="pr-ticket-off">{previewOff}</div>
        <div className="pr-ticket-scope">{SCOPES.find((s) => s.value === form.scope)?.label}</div>
      </div>

      {err && <div className="pr-alert-err">{err}</div>}
      {ok && <div className="pr-alert-ok">Code created.</div>}

      <button type="submit" className="btn grad pr-create-btn" disabled={busy}>
        {busy ? "Creating…" : "Create promo code"}
      </button>
    </form>
  );
}

// ---- Code row ----
function CodeRow({ code, onToggle, onDelete }: { code: PromoCode; onToggle: () => void; onDelete: () => void }) {
  const [togglePending, startToggle] = useTransition();
  const [deletePending, startDelete] = useTransition();

  function handleToggle() {
    startToggle(async () => {
      await togglePromoCode(code.id, !code.is_active);
      onToggle();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${code.code}"? This cannot be undone.`)) return;
    startDelete(async () => {
      await deletePromoCode(code.id);
      onDelete();
    });
  }

  return (
    <tr>
      <td>
        <span className="pr-code-badge">{code.code}</span>
      </td>
      <td>
        <span>{discountLabel(code)}</span>
        <div className="pr-meta">{SCOPES.find((s) => s.value === code.scope)?.label ?? code.scope}</div>
      </td>
      <td>
        <span>{usageLabel(code)}</span>
      </td>
      <td>
        <span className="pr-meta">{formatDate(code.expires_at)}</span>
      </td>
      <td>
        <span className={`dx-pilltag ${code.is_active ? "t-paid" : "t-neu"}`}>
          {code.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="dx-editbtn"
            onClick={handleToggle}
            disabled={togglePending}
          >
            {code.is_active ? "Disable" : "Enable"}
          </button>
          <button
            className="dx-editbtn"
            style={{ color: "var(--red, #e5476f)" }}
            onClick={handleDelete}
            disabled={deletePending}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---- Main page ----
export default function PromoClient({ codes }: { codes: PromoCode[] | null }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <style>{`
        .pr-form {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .pr-code-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--bg);
          color: var(--text);
          font: inherit;
          font-family: ui-monospace, Menlo, monospace;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 1.5px;
          outline: none;
          text-transform: uppercase;
        }
        .pr-code-input:focus { border-color: var(--primary); }
        .pr-seg-wrap { margin-bottom: 13px; }
        .pr-seg-label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 6px; }
        .pr-seg {
          display: flex;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 3px;
          gap: 3px;
        }
        .pr-seg button {
          flex: 1;
          border: 0;
          background: none;
          font: inherit;
          font-weight: 600;
          font-size: 13px;
          color: var(--muted);
          padding: 9px;
          border-radius: 8px;
          cursor: pointer;
          transition: all .14s;
        }
        .pr-seg button.on {
          background: var(--surface);
          color: var(--text);
          box-shadow: 0 1px 3px rgba(0,0,0,.14);
        }
        .pr-ticket {
          background: var(--grad);
          border-radius: 14px;
          padding: 20px 18px;
          text-align: center;
          color: #fff;
          margin: 4px 0 14px;
          position: relative;
        }
        .pr-ticket::before, .pr-ticket::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--bg);
          transform: translateY(-50%);
        }
        .pr-ticket::before { left: -10px; }
        .pr-ticket::after { right: -10px; }
        .pr-ticket-label { font-size: 11px; font-weight: 700; opacity: .9; text-transform: uppercase; letter-spacing: .06em; }
        .pr-ticket-code { font-family: ui-monospace, Menlo, monospace; font-weight: 800; font-size: 26px; letter-spacing: 2px; margin: 6px 0; border: 2px dashed rgba(255,255,255,.5); border-radius: 10px; padding: 8px; }
        .pr-ticket-off { font-weight: 800; font-size: 15px; }
        .pr-ticket-scope { font-size: 12px; opacity: .85; margin-top: 4px; }
        .pr-create-btn { width: 100%; justify-content: center; margin-top: 4px; }
        .pr-alert-err { color: var(--red, #e5476f); font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .pr-alert-ok { color: var(--green); font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .pr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .pr-table th { text-align: left; color: var(--muted); font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; padding: 0 10px 11px; }
        .pr-table td { padding: 12px 10px; border-top: 1px solid var(--border); vertical-align: middle; }
        .pr-code-badge {
          font-family: ui-monospace, Menlo, monospace;
          font-weight: 700;
          font-size: 13px;
          color: var(--primary);
          background: color-mix(in srgb, var(--primary) 12%, transparent);
          padding: 5px 10px;
          border-radius: 7px;
        }
        .pr-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
        .pr-notice {
          padding: 16px;
          background: color-mix(in srgb, var(--accent) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
          border-radius: 12px;
          font-size: 13px;
          color: var(--text);
        }
        .pr-grid { display: grid; grid-template-columns: 380px 1fr; gap: 18px; align-items: start; }
        @media (max-width: 860px) { .pr-grid { grid-template-columns: 1fr; } }
      `}</style>

      <Phead
        title="Promo codes"
        sub="Discount codes for plan purchases. Admin-controlled — not visible to sellers."
        action={
          <button className="btn grad" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close form" : "+ New code"}
          </button>
        }
      />

      {codes === null ? (
        <Card>
          <div className="pr-notice">
            Migration not applied yet — run <code>supabase/migrations/20260618270000_admin_monetization.sql</code> to create the <strong>promo_codes</strong> table.
          </div>
        </Card>
      ) : (
        <div className={showForm ? "pr-grid" : ""}>
          {showForm && (
            <Card title="Create promo code">
              <CreateForm onCreated={() => { setShowForm(false); router.refresh(); }} />
            </Card>
          )}

          <Card title={`Plan promo codes (${codes.length})`}>
            {codes.length === 0 ? (
              <div className="dx-empty">No promo codes yet. Create one with "+ New code".</div>
            ) : (
              <table className="pr-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Used</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <CodeRow
                      key={c.id}
                      code={c}
                      onToggle={() => router.refresh()}
                      onDelete={() => router.refresh()}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
