"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "./actions";
import { formatPrice } from "@/lib/products";

type PickProduct = { id: string; name: string; price: number | null; image: string | null };

/**
 * "New one-page product" flow: pick a design, optionally start from an existing
 * store product (prefill), then open the full builder.
 */
export default function NewProductButton({ catalog = [] }: { catalog?: PickProduct[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<"landing" | "pdp">("landing");
  const [fromId, setFromId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setLoading(true); setErr(null);
    const res = await createProduct({ layout, fromProductId: fromId || undefined });
    if (res.ok && res.id) { router.push(`/studio/product/${res.id}`); return; }
    setLoading(false);
    setErr(res.error ?? "Could not create product");
  }

  return (
    <>
      <button className="btn grad" onClick={() => setOpen(true)}>+ Create</button>
      {open && (
        <div className="pm-overlay" onClick={() => !loading && setOpen(false)}>
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pm-head"><h3>New one-page product</h3><button className="pm-x" onClick={() => setOpen(false)}>✕</button></div>
            <div className="pm-body">
              <label className="label" style={{ marginTop: 0 }}>Choose a design</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([["landing", "Landing page", "Long-form sales page with story, features, testimonials, FAQ."], ["pdp", "Catalog (PDP)", "Compact product page: gallery, plans, delivery, reviews."]] as const).map(([k, t, d]) => (
                  <button key={k} type="button" onClick={() => setLayout(k)} style={{ textAlign: "left", padding: 13, borderRadius: 12, cursor: "pointer", border: layout === k ? "1.5px solid var(--primary)" : "1px solid var(--border)", background: layout === k ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--surface)", color: "var(--text)" }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div>
                    <div className="dx-muted" style={{ fontSize: 11.5, marginTop: 4 }}>{d}</div>
                  </button>
                ))}
              </div>

              <label className="label">Start from a store product <span className="dx-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
              {catalog.length === 0 ? (
                <p className="dx-muted" style={{ fontSize: 12, marginTop: 0 }}>No store products yet — you can add details after creating, or add products on the Store page first.</p>
              ) : (
                <select className="select" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                  <option value="">Blank — fill in details myself</option>
                  {catalog.map((p) => <option key={p.id} value={p.id}>{p.name}{p.price != null ? ` · ${formatPrice(p.price, "INR")}` : ""}</option>)}
                </select>
              )}

              {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
            </div>
            <div className="pm-foot">
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={loading}>Cancel</button>
              <button className="btn btn-gradient" onClick={create} disabled={loading}>{loading ? "Creating…" : "Create & open builder"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
