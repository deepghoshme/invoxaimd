"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPlan, updatePlan, deletePlan, savePlatformFeeDefaults, type PlanInput } from "./actions";
import { FEATURE_CATALOG, type FeatureKey } from "@/lib/plan-features";

export type Plan = {
  id: string;
  name: string;
  price: number;
  page_limit: number | null;
  contact_limit: number | null;
  features: string[];
  is_popular: boolean;
  interval: "monthly" | "annual";
  is_recommended: boolean;
  commission_pct: number | null;
  flat_fee_paise: number | null;
  feature_keys: string[] | null;
};

export type PlatformFeeDefaults = {
  default_commission_pct: number;
  default_flat_fee_paise: number;
  plan_flat_fee_paise: number;
};

/* Feature groups, in catalog order. */
const FEATURE_GROUPS: { group: string; items: { key: FeatureKey; label: string }[] }[] = (() => {
  const order: string[] = [];
  const byGroup = new Map<string, { key: FeatureKey; label: string }[]>();
  for (const f of FEATURE_CATALOG) {
    if (!byGroup.has(f.group)) { byGroup.set(f.group, []); order.push(f.group); }
    byGroup.get(f.group)!.push({ key: f.key, label: f.label });
  }
  return order.map((group) => ({ group, items: byGroup.get(group)! }));
})();

/* ── Feature list editor: add/remove individual lines (display copy) ───────── */
function FeaturesEditor({
  features,
  onChange,
}: {
  features: string[];
  onChange: (f: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addFeature() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...features, trimmed]);
    setDraft("");
  }
  function removeFeature(idx: number) { onChange(features.filter((_, i) => i !== idx)); }
  function updateFeature(idx: number, val: string) {
    const next = [...features]; next[idx] = val; onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {features.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={f}
            onChange={(e) => updateFeature(i, e.target.value)}
            style={{
              flex: 1, padding: "7px 10px", border: "1px solid var(--border)",
              borderRadius: 8, background: "var(--bg)", color: "var(--text)",
              font: "inherit", fontSize: 13,
            }}
          />
          <button
            type="button" onClick={() => removeFeature(i)} title="Remove feature"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)",
              background: "var(--bg)", color: "var(--text)", cursor: "pointer",
              display: "grid", placeItems: "center", fontSize: 14, flexShrink: 0,
            }}
          >&times;</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: features.length ? 4 : 0 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
          placeholder="New feature line..."
          style={{
            flex: 1, padding: "7px 10px", border: "1px dashed var(--border)",
            borderRadius: 8, background: "var(--bg)", color: "var(--text)",
            font: "inherit", fontSize: 13,
          }}
        />
        <button
          type="button" onClick={addFeature}
          style={{
            padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--bg)", color: "var(--text)", cursor: "pointer",
            fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}
        >+ Add</button>
      </div>
      {features.length === 0 && (
        <span style={{ fontSize: 12, color: "var(--muted, #888)" }}>
          No display features yet — type above and press Add or Enter.
        </span>
      )}
    </div>
  );
}

/* ── Enforced feature-key toggles ──────────────────────────────────────────── */
function FeatureKeysEditor({
  selected,
  onChange,
}: {
  selected: Set<FeatureKey>;
  onChange: (next: Set<FeatureKey>) => void;
}) {
  function toggle(key: FeatureKey, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(key); else next.delete(key);
    onChange(next);
  }
  return (
    <div className="pa-fk">
      {FEATURE_GROUPS.map((g) => (
        <div className="pa-fk-group" key={g.group}>
          <div className="pa-fk-grouplbl">{g.group}</div>
          {g.items.map((it) => (
            <label className="pa-fk-row" key={it.key}>
              <input
                type="checkbox"
                checked={selected.has(it.key)}
                onChange={(e) => toggle(it.key, e.target.checked)}
              />
              <span>{it.label}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Individual plan card ──────────────────────────────────────────────────── */
function PlanCard({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [p, setP] = useState<PlanInput>({
    name: plan.name,
    price: plan.price,
    page_limit: plan.page_limit,
    contact_limit: plan.contact_limit,
    features: plan.features,
    is_popular: plan.is_popular,
    interval: plan.interval ?? "monthly",
    is_recommended: plan.is_recommended ?? false,
    commission_pct: plan.commission_pct,
    flat_fee_paise: plan.flat_fee_paise,
    feature_keys: (plan.feature_keys ?? []) as FeatureKey[],
  });
  const [featureKeys, setFeatureKeys] = useState<Set<FeatureKey>>(
    new Set((plan.feature_keys ?? []) as FeatureKey[]),
  );
  // Fee inputs as strings so the field can be cleared (= inherit global default).
  const [commissionStr, setCommissionStr] = useState<string>(
    plan.commission_pct != null ? (plan.commission_pct * 100).toString() : "",
  );
  const [flatStr, setFlatStr] = useState<string>(
    plan.flat_fee_paise != null ? (plan.flat_fee_paise / 100).toString() : "",
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const commission_pct = commissionStr.trim() === "" ? null : Math.min(1, Math.max(0, (parseFloat(commissionStr) || 0) / 100));
    const flat_fee_paise = flatStr.trim() === "" ? null : Math.max(0, Math.round((parseFloat(flatStr) || 0) * 100));
    const res = await updatePlan(plan.id, {
      ...p,
      commission_pct,
      flat_fee_paise,
      feature_keys: Array.from(featureKeys),
    });
    setBusy(false);
    setMsg(res.ok ? "Saved" : res.error ?? "Failed");
    if (res.ok) { router.refresh(); setTimeout(() => setMsg(null), 1500); }
  }
  async function remove() {
    if (!confirm(`Delete "${plan.name}"?`)) return;
    await deletePlan(plan.id);
    router.refresh();
  }

  const intervalLabel = p.interval === "annual" ? "/yr" : "/mo";

  return (
    <div className={`dx-plan${p.is_popular ? " feat" : ""}${p.is_recommended ? " recommended" : ""}`}>
      {p.is_popular && <span className="dx-ribbon">Popular</span>}
      {p.is_recommended && !p.is_popular && <span className="dx-ribbon" style={{ background: "var(--green, #22c55e)" }}>Recommended</span>}
      <div className="dx-field"><label>Name</label><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
      <div className="dx-ff">
        <div className="dx-field">
          <label>Price &#8377;{intervalLabel}</label>
          <input inputMode="numeric" value={p.price} onChange={(e) => setP({ ...p, price: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 })} />
        </div>
        <div className="dx-field"><label>Contacts</label><input inputMode="numeric" value={p.contact_limit ?? ""} onChange={(e) => setP({ ...p, contact_limit: e.target.value ? parseInt(e.target.value.replace(/[^0-9]/g, "")) : null })} /></div>
      </div>
      <div className="dx-field">
        <label>Billing interval</label>
        <select
          value={p.interval}
          onChange={(e) => setP({ ...p, interval: e.target.value as "monthly" | "annual" })}
          style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)", color: "var(--text)", font: "inherit", width: "100%" }}
        >
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
      </div>

      {/* ── Platform fee overrides for this plan ───────────────────────────── */}
      <div className="pa-fee-box">
        <div className="pa-fee-title">Platform fee for this plan</div>
        <div className="dx-ff">
          <div className="dx-field">
            <label>Commission %</label>
            <input
              inputMode="decimal"
              placeholder="global"
              value={commissionStr}
              onChange={(e) => setCommissionStr(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <div className="dx-field">
            <label>Flat fee &#8377;/sale</label>
            <input
              inputMode="decimal"
              placeholder="global"
              value={flatStr}
              onChange={(e) => setFlatStr(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        </div>
        <span className="pa-hint">Leave blank to inherit the global default.</span>
      </div>

      {/* ── Enforced feature toggles ───────────────────────────────────────── */}
      <div className="dx-field">
        <label style={{ marginBottom: 6, display: "block" }}>Unlocked features (enforced)</label>
        <FeatureKeysEditor selected={featureKeys} onChange={setFeatureKeys} />
      </div>

      {/* ── Display-only marketing copy ────────────────────────────────────── */}
      <div className="dx-field">
        <label style={{ marginBottom: 6, display: "block" }}>Display features (marketing copy)</label>
        <FeaturesEditor features={p.features} onChange={(f) => setP({ ...p, features: f })} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "4px 0 6px" }}>
        <input type="checkbox" checked={p.is_popular} onChange={(e) => setP({ ...p, is_popular: e.target.checked })} /> Mark as popular
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "4px 0 12px" }}>
        <input type="checkbox" checked={p.is_recommended} onChange={(e) => setP({ ...p, is_recommended: e.target.checked })} /> Mark as recommended
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn grad" onClick={save} disabled={busy}>{busy ? "..." : "Save"}</button>
        <button className="dx-editbtn" onClick={remove}>Delete</button>
        {msg && <span className="dx-muted" style={{ fontSize: 12 }}>{msg}</span>}
      </div>
    </div>
  );
}

/* ── Global platform-fee defaults card ─────────────────────────────────────── */
function FeeDefaultsCard({ defaults }: { defaults: PlatformFeeDefaults }) {
  const router = useRouter();
  const [commissionStr, setCommissionStr] = useState((defaults.default_commission_pct * 100).toString());
  const [flatStr, setFlatStr] = useState((defaults.default_flat_fee_paise / 100).toString());
  const [planFlatStr, setPlanFlatStr] = useState((defaults.plan_flat_fee_paise / 100).toString());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const res = await savePlatformFeeDefaults({
      default_commission_pct: Math.min(1, Math.max(0, (parseFloat(commissionStr) || 0) / 100)),
      default_flat_fee_paise: Math.max(0, Math.round((parseFloat(flatStr) || 0) * 100)),
      plan_flat_fee_paise: Math.max(0, Math.round((parseFloat(planFlatStr) || 0) * 100)),
    });
    setBusy(false);
    setMsg(res.ok ? "Saved" : res.error ?? "Failed");
    if (res.ok) { router.refresh(); setTimeout(() => setMsg(null), 2000); }
  }

  return (
    <div className="pa-fees-card">
      <div className="pa-fees-head">
        <div>
          <h2>Platform fees — global defaults</h2>
          <p>Applied when a plan / seller has no override. Commission is a % of each sale; the sale flat fee is added per sale. The plan flat fee is charged on top of the plan price at checkout.</p>
        </div>
      </div>
      <div className="pa-fees-grid">
        <label className="pa-fees-field">
          <span>Default commission %</span>
          <input inputMode="decimal" value={commissionStr} onChange={(e) => setCommissionStr(e.target.value.replace(/[^0-9.]/g, ""))} />
        </label>
        <label className="pa-fees-field">
          <span>Default flat fee &#8377;/sale</span>
          <input inputMode="decimal" value={flatStr} onChange={(e) => setFlatStr(e.target.value.replace(/[^0-9.]/g, ""))} />
        </label>
        <label className="pa-fees-field">
          <span>Plan checkout flat fee &#8377;</span>
          <input inputMode="decimal" value={planFlatStr} onChange={(e) => setPlanFlatStr(e.target.value.replace(/[^0-9.]/g, ""))} />
        </label>
        <div className="pa-fees-actions">
          <button className="btn grad" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save defaults"}</button>
          {msg && <span className="dx-muted" style={{ fontSize: 12 }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Top-level admin page ──────────────────────────────────────────────────── */
export default function PlansAdmin({ plans, feeDefaults }: { plans: Plan[]; feeDefaults: PlatformFeeDefaults }) {
  const router = useRouter();
  const [intervalFilter, setIntervalFilter] = useState<"all" | "monthly" | "annual">("all");

  async function add() { await createPlan(); router.refresh(); }

  const hasMonthly = plans.some((p) => p.interval === "monthly");
  const hasAnnual = plans.some((p) => p.interval === "annual");
  const showToggle = hasMonthly || hasAnnual;

  const filtered =
    intervalFilter === "all" ? plans : plans.filter((p) => p.interval === intervalFilter);

  return (
    <>
      <style>{`
        .pa-toggle-wrap { display: flex; align-items: center; gap: 12px; margin: 14px 0 18px; flex-wrap: wrap; }
        .pa-toggle { display: inline-flex; background: var(--surface2, var(--bg)); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
        .pa-toggle button { padding: 6px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; background: transparent; color: var(--muted, #888); transition: background .15s, color .15s; }
        .pa-toggle button.active { background: var(--surface, var(--card)); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.12); }
        .pa-interval-badge { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 2px 8px; border-radius: 20px; margin-bottom: 6px; background: color-mix(in srgb, var(--primary, #FF6A3D) 14%, transparent); color: var(--primary, #FF6A3D); }

        .pa-fees-card { border: 1px solid var(--border); border-radius: 14px; background: var(--card, var(--bg)); padding: 16px 18px; margin: 6px 0 22px; }
        .pa-fees-head h2 { font-size: 15px; margin: 0 0 2px; }
        .pa-fees-head p { font-size: 12.5px; color: var(--muted, #888); margin: 0 0 12px; max-width: 760px; }
        .pa-fees-grid { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; }
        .pa-fees-field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 600; color: var(--muted, #888); }
        .pa-fees-field input { width: 150px; padding: 8px 11px; border: 1.5px solid var(--border); border-radius: 9px; background: var(--bg); color: var(--text); font: inherit; font-weight: 700; }
        .pa-fees-actions { display: flex; align-items: center; gap: 10px; }

        .pa-fee-box { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin: 8px 0 12px; background: color-mix(in srgb, var(--primary, #FF6A3D) 5%, transparent); }
        .pa-fee-title { font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
        .pa-hint { font-size: 11px; color: var(--muted, #888); }

        .pa-fk { display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; max-height: 320px; overflow-y: auto; background: var(--bg); }
        .pa-fk-group { display: flex; flex-direction: column; gap: 3px; }
        .pa-fk-grouplbl { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted, #888); margin-bottom: 2px; }
        .pa-fk-row { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; padding: 2px 0; }
      `}</style>

      <div className="dx-phead">
        <div>
          <h1>Plans &amp; Features</h1>
          <p>Pricing, limits, platform fees, and enforced feature access. Create separate Monthly and Annual rows; annual rows have interval=Annual.</p>
        </div>
        <button className="btn grad" onClick={add}>+ New plan</button>
      </div>

      <FeeDefaultsCard defaults={feeDefaults} />

      {showToggle && (
        <div className="pa-toggle-wrap">
          <div className="pa-toggle">
            <button className={intervalFilter === "all" ? "active" : ""} onClick={() => setIntervalFilter("all")}>
              All ({plans.length})
            </button>
            {hasMonthly && (
              <button className={intervalFilter === "monthly" ? "active" : ""} onClick={() => setIntervalFilter("monthly")}>
                Monthly ({plans.filter((p) => p.interval === "monthly").length})
              </button>
            )}
            {hasAnnual && (
              <button className={intervalFilter === "annual" ? "active" : ""} onClick={() => setIntervalFilter("annual")}>
                Annual ({plans.filter((p) => p.interval === "annual").length})
              </button>
            )}
          </div>
          <span style={{ fontSize: 12, color: "var(--muted, #888)" }}>
            Tip: pair each monthly plan with an annual counterpart at a discounted yearly price.
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="dx-card"><div className="dx-empty">No plans yet — add one.</div></div>
      ) : (
        <div className="dx-grid dx-g3">
          {filtered.map((pl) => (
            <div key={pl.id}>
              <span className="pa-interval-badge">{pl.interval}</span>
              <PlanCard plan={pl} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
