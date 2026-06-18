"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPlan, updatePlan, deletePlan, type PlanInput } from "./actions";

export type Plan = {
  id: string;
  name: string;
  price: number;
  page_limit: number | null;
  contact_limit: number | null;
  features: string[];
  is_popular: boolean;
};

function PlanCard({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [p, setP] = useState<PlanInput>({
    name: plan.name, price: plan.price, page_limit: plan.page_limit, contact_limit: plan.contact_limit, features: plan.features, is_popular: plan.is_popular,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    const res = await updatePlan(plan.id, p);
    setBusy(false);
    setMsg(res.ok ? "Saved ✓" : res.error ?? "Failed");
    if (res.ok) { router.refresh(); setTimeout(() => setMsg(null), 1500); }
  }
  async function remove() {
    if (!confirm(`Delete “${plan.name}”?`)) return;
    await deletePlan(plan.id);
    router.refresh();
  }

  return (
    <div className={`dx-plan${p.is_popular ? " feat" : ""}`}>
      {p.is_popular && <span className="dx-ribbon">Popular</span>}
      <div className="dx-field"><label>Name</label><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
      <div className="dx-ff">
        <div className="dx-field"><label>Price ₹/mo</label><input inputMode="numeric" value={p.price} onChange={(e) => setP({ ...p, price: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 })} /></div>
        <div className="dx-field"><label>Contacts</label><input inputMode="numeric" value={p.contact_limit ?? ""} onChange={(e) => setP({ ...p, contact_limit: e.target.value ? parseInt(e.target.value.replace(/[^0-9]/g, "")) : null })} /></div>
      </div>
      <div className="dx-field"><label>Features (one per line)</label>
        <textarea className="dx-plan-feat" rows={3} value={p.features.join("\n")} onChange={(e) => setP({ ...p, features: e.target.value.split("\n") })} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)", color: "var(--text)", font: "inherit" }} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "4px 0 12px" }}>
        <input type="checkbox" checked={p.is_popular} onChange={(e) => setP({ ...p, is_popular: e.target.checked })} /> Mark as popular
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn grad" onClick={save} disabled={busy}>{busy ? "…" : "Save"}</button>
        <button className="dx-editbtn" onClick={remove}>Delete</button>
        {msg && <span className="dx-muted" style={{ fontSize: 12 }}>{msg}</span>}
      </div>
    </div>
  );
}

export default function PlansAdmin({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  async function add() { await createPlan(); router.refresh(); }
  return (
    <>
      <div className="dx-phead">
        <div><h1>Plans &amp; Features</h1><p>Pricing, limits, and access.</p></div>
        <button className="btn grad" onClick={add}>+ New plan</button>
      </div>
      {plans.length === 0 ? (
        <div className="dx-card"><div className="dx-empty">No plans yet — add one.</div></div>
      ) : (
        <div className="dx-grid dx-g3">{plans.map((pl) => <PlanCard key={pl.id} plan={pl} />)}</div>
      )}
    </>
  );
}
