"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageInput from "@/components/ImageInput";
import { type CatalogProduct, type CatalogInput, EMPTY_PRODUCT, PRODUCT_TYPES, PLAN_PERIODS, formatPrice } from "@/lib/catalog";
import { createCatalogProduct, updateCatalogProduct, deleteCatalogProduct, setProductVisible, reorderCatalogProducts } from "@/app/dashboard/store/products-actions";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button type="button" className={`switch${on ? " on" : ""}`} onClick={onClick}><span className="switch-knob" /></button>;
}

/** Add / edit popup. All store-product details live here. */
function ProductModal({ initial, onClose, onSaved }: { initial: CatalogProduct | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<CatalogInput>(initial ? { ...EMPTY_PRODUCT, ...initial } : { ...EMPTY_PRODUCT });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<CatalogInput>) => setF((p) => ({ ...p, ...patch }));
  const isPlanType = f.product_type === "service" || f.product_type === "subscription";

  async function save() {
    if (!f.name.trim()) return setErr("Give the product a name.");
    setBusy(true); setErr(null);
    const res = initial ? await updateCatalogProduct(initial.id, f) : await createCatalogProduct(f);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Could not save");
    onSaved();
  }

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <h3>{initial ? "Edit product" : "Add product"}</h3>
          <button className="pm-x" onClick={onClose}>✕</button>
        </div>

        <div className="pm-body">
          <label className="label">Main image</label>
          <ImageInput value={f.image ?? ""} onChange={(u) => set({ image: u })} />

          <label className="label">More product images (gallery)</label>
          {(f.gallery ?? []).map((g, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ flex: 1 }}><ImageInput value={g} onChange={(u) => set({ gallery: f.gallery.map((x, j) => (j === i ? u : x)) })} /></div>
              <button className="btn-ghost" type="button" onClick={() => set({ gallery: f.gallery.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button className="btn-ghost" type="button" onClick={() => set({ gallery: [...(f.gallery ?? []), ""] })}>+ Add image</button>

          <div className="field" style={{ marginTop: 12 }}><label className="label">Name *</label><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Product name" /></div>
          <div className="field"><label className="label">Category</label><input className="input" value={f.category ?? ""} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Courses" /></div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div className="field"><label className="label">Price</label><input className="input" inputMode="decimal" value={f.price ?? ""} onChange={(e) => set({ price: e.target.value === "" ? undefined : Number(e.target.value.replace(/[^0-9.]/g, "")) })} placeholder="499" /></div>
            <div className="field"><label className="label">Compare-at</label><input className="input" inputMode="decimal" value={f.compare_at_price ?? ""} onChange={(e) => set({ compare_at_price: e.target.value === "" ? undefined : Number(e.target.value.replace(/[^0-9.]/g, "")) })} placeholder="999" /></div>
            <div className="field"><label className="label">Currency</label><select className="select" value={f.currency} onChange={(e) => set({ currency: e.target.value })}><option value="INR">INR ₹</option><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="GBP">GBP £</option></select></div>
          </div>

          <div className="field">
            <label className="label">Product type</label>
            <div className="chiprow">{PRODUCT_TYPES.map(([k, lbl]) => <div key={k} className={`chip-toggle${f.product_type === k ? " on" : ""}`} onClick={() => set({ product_type: k as CatalogInput["product_type"] })}>{lbl}</div>)}</div>
          </div>

          {f.product_type === "digital" && (
            <div className="field">
              <label className="label">Digital delivery (buyer gets this after purchase)</label>
              <div className="chiprow" style={{ marginBottom: 8 }}>{([["url", "Link / URL"], ["file", "File / PDF"]] as const).map(([k, lbl]) => <div key={k} className={`chip-toggle${(f.digital?.kind ?? "url") === k ? " on" : ""}`} onClick={() => set({ digital: { ...f.digital, kind: k } })}>{lbl}</div>)}</div>
              {(f.digital?.kind ?? "url") === "url"
                ? <input className="input" value={f.digital?.url ?? ""} onChange={(e) => set({ digital: { kind: "url", url: e.target.value } })} placeholder="https://… access link" />
                : <ImageInput value={f.digital?.file ?? ""} onChange={(u) => set({ digital: { kind: "file", file: u } })} placeholder="Upload file / PDF" />}
            </div>
          )}
          {f.product_type === "physical" && (
            <div className="field"><label className="label">Delivery estimate (days)</label><input className="input" type="number" value={f.delivery_days ?? ""} onChange={(e) => set({ delivery_days: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="4" /></div>
          )}
          {isPlanType && (
            <div className="field">
              <label className="label">Plans (buyer picks one)</label>
              {(f.plans ?? []).map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input className="input" style={{ flex: 2 }} value={p.label} onChange={(e) => set({ plans: f.plans.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Plan name" />
                  <select className="select" style={{ width: 110 }} value={p.period ?? "monthly"} onChange={(e) => set({ plans: f.plans.map((x, j) => (j === i ? { ...x, period: e.target.value } : x)) })}>{PLAN_PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <input className="input" style={{ width: 80 }} type="number" value={p.price || ""} onChange={(e) => set({ plans: f.plans.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)) })} placeholder="₹" />
                  <button className="btn-ghost" type="button" onClick={() => set({ plans: f.plans.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              <button className="btn-ghost" type="button" onClick={() => set({ plans: [...(f.plans ?? []), { label: "Monthly", period: "monthly", price: 0 }] })}>+ Add plan</button>
            </div>
          )}

          <div className="field"><label className="label">Badge (optional)</label><input className="input" value={f.badge ?? ""} onChange={(e) => set({ badge: e.target.value })} placeholder="Bestseller" /></div>
          <div className="field"><label className="label">Description</label><textarea className="input" rows={3} value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="Describe the product for its page…" /></div>

          <div className="field">
            <label className="label">Product details (specs)</label>
            {(f.details ?? []).map((d, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input className="input" style={{ flex: 1 }} value={d.label} onChange={(e) => set({ details: f.details.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label (e.g. Material)" />
                <input className="input" style={{ flex: 1.4 }} value={d.value} onChange={(e) => set({ details: f.details.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="Value (e.g. 100% Cotton)" />
                <button className="btn-ghost" type="button" onClick={() => set({ details: f.details.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn-ghost" type="button" onClick={() => set({ details: [...(f.details ?? []), { label: "", value: "" }] })}>+ Add detail</button>
          </div>

          <div className="pm-sec">Product page (Shopify-style)</div>

          <div className="field">
            <label className="label">Key highlights (bullets above the description)</label>
            {(f.highlights ?? []).map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input className="input" value={h} onChange={(e) => set({ highlights: f.highlights.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Highlight ${i + 1}`} />
                <button className="btn-ghost" type="button" onClick={() => set({ highlights: f.highlights.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn-ghost" type="button" onClick={() => set({ highlights: [...(f.highlights ?? []), ""] })}>+ Add highlight</button>
          </div>

          <div className="field">
            <label className="label">Variants / options (e.g. Size, Color)</label>
            {(f.options ?? []).map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input className="input" style={{ flex: 1 }} value={o.name} onChange={(e) => set({ options: f.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Option name (Size)" />
                <input className="input" style={{ flex: 1.6 }} value={(o.values ?? []).join(", ")} onChange={(e) => set({ options: f.options.map((x, j) => (j === i ? { ...x, values: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) } : x)) })} placeholder="Values: S, M, L" />
                <button className="btn-ghost" type="button" onClick={() => set({ options: f.options.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn-ghost" type="button" onClick={() => set({ options: [...(f.options ?? []), { name: "", values: [] }] })}>+ Add option</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div className="field"><label className="label">Rating (0–5)</label><input className="input" inputMode="decimal" value={f.rating ?? ""} onChange={(e) => set({ rating: e.target.value === "" ? undefined : Number(e.target.value.replace(/[^0-9.]/g, "")) })} placeholder="4.8" /></div>
            <div className="field"><label className="label"># reviews</label><input className="input" inputMode="numeric" value={f.reviews_count ?? ""} onChange={(e) => set({ reviews_count: e.target.value === "" ? undefined : Number(e.target.value.replace(/[^0-9]/g, "")) })} placeholder="1247" /></div>
            <div className="field"><label className="label">Stock left</label><input className="input" inputMode="numeric" value={f.stock ?? ""} onChange={(e) => set({ stock: e.target.value === "" ? undefined : Number(e.target.value.replace(/[^0-9]/g, "")) })} placeholder="∞" /></div>
          </div>

          <div className="field">
            <label className="label">Customer reviews</label>
            {(f.reviews ?? []).map((r, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 9, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input className="input" style={{ flex: 1 }} value={r.name} onChange={(e) => set({ reviews: f.reviews.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Reviewer name" />
                  <select className="select" style={{ width: 90 }} value={r.rating} onChange={(e) => set({ reviews: f.reviews.map((x, j) => (j === i ? { ...x, rating: Number(e.target.value) } : x)) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select>
                  <button className="btn-ghost" type="button" onClick={() => set({ reviews: f.reviews.filter((_, j) => j !== i) })}>✕</button>
                </div>
                <textarea className="input" rows={2} value={r.text} onChange={(e) => set({ reviews: f.reviews.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="What they said…" />
              </div>
            ))}
            <button className="btn-ghost" type="button" onClick={() => set({ reviews: [...(f.reviews ?? []), { name: "", rating: 5, text: "" }] })}>+ Add review</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field"><label className="label">SKU</label><input className="input" value={f.sku ?? ""} onChange={(e) => set({ sku: e.target.value })} placeholder="ABC-123" /></div>
            <div className="field"><label className="label">Vendor / brand</label><input className="input" value={f.vendor ?? ""} onChange={(e) => set({ vendor: e.target.value })} placeholder="Your brand" /></div>
          </div>

          <div className="field"><label className="label">Trust badges (comma separated)</label><input className="input" value={(f.trust_badges ?? []).join(", ")} onChange={(e) => set({ trust_badges: e.target.value.split(",").map((b) => b.trim()).filter(Boolean) })} placeholder="Secure checkout, 7-day returns, Free shipping" /></div>
          <div className="field"><label className="label">Shipping info</label><textarea className="input" rows={2} value={f.shipping_info ?? ""} onChange={(e) => set({ shipping_info: e.target.value })} placeholder="Ships in 1–2 days. Free shipping over ₹999." /></div>
          <div className="field"><label className="label">Returns / refund info</label><textarea className="input" rows={2} value={f.returns_info ?? ""} onChange={(e) => set({ returns_info: e.target.value })} placeholder="7-day easy returns. Money-back guarantee." /></div>

          <div className="pm-vis">
            <div><strong style={{ fontSize: 14 }}>Show in store</strong><p className="hint" style={{ margin: "2px 0 0" }}>When off, the product is hidden from your storefront.</p></div>
            <Toggle on={f.store_visible} onClick={() => set({ store_visible: !f.store_visible })} />
          </div>

          {err && <div className="alert alert-error" style={{ marginTop: 10 }}>{err}</div>}
        </div>

        <div className="pm-foot">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-gradient" onClick={save} disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Add product"}</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductCatalog({ initial }: { initial: CatalogProduct[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(initial);

  const refresh = () => { setOpen(false); setEditing(null); router.refresh(); };

  async function toggle(p: CatalogProduct) { await setProductVisible(p.id, !p.store_visible); router.refresh(); }
  async function remove(p: CatalogProduct) { if (!confirm(`Delete “${p.name}”?`)) return; await deleteCatalogProduct(p.id); router.refresh(); }
  // Move a product up/down and persist the new order (sort = position).
  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    setList(next);
    await reorderCatalogProducts(next.map((p) => p.id));
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="dx-muted" style={{ fontSize: 13 }}>{list.length} product{list.length === 1 ? "" : "s"} · added directly to your store</span>
        <button className="btn grad" onClick={() => { setEditing(null); setOpen(true); }}>+ Add product</button>
      </div>

      {list.length === 0 && <div className="dx-empty">No store products yet. Click “+ Add product” to add one in a quick popup — set price, image, type and whether it shows in your store.</div>}

      <div className="dx-prodlist">
        {list.map((p, idx) => (
          <div className="dx-prow" key={p.id} style={{ cursor: "default" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="dx-editbtn" style={{ padding: "0 6px", lineHeight: 1.2, opacity: idx === 0 ? 0.3 : 1 }} disabled={idx === 0} onClick={() => move(idx, -1)} title="Move up">▲</button>
              <button className="dx-editbtn" style={{ padding: "0 6px", lineHeight: 1.2, opacity: idx === list.length - 1 ? 0.3 : 1 }} disabled={idx === list.length - 1} onClick={() => move(idx, 1)} title="Move down">▼</button>
            </span>
            <span className="dx-pthumb" style={p.image ? { backgroundImage: `url('${p.image}')` } : undefined}>{!p.image && "📦"}</span>
            <span className="dx-pname">{p.name}</span>
            <span className="dx-pcat">{p.category || p.product_type}</span>
            <span className="dx-pprice">{p.price != null ? formatPrice(p.price, p.currency) : "Free"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }} title="Show in store">
              <Toggle on={p.store_visible} onClick={() => toggle(p)} />
              <span className="dx-muted" style={{ fontSize: 11 }}>{p.store_visible ? "In store" : "Hidden"}</span>
            </span>
            <button className="dx-editbtn" onClick={() => { setEditing(p); setOpen(true); }}>Edit</button>
            <button className="dx-editbtn" style={{ color: "var(--secondary)" }} onClick={() => remove(p)}>✕</button>
          </div>
        ))}
      </div>

      {open && <ProductModal initial={editing} onClose={() => { setOpen(false); setEditing(null); }} onSaved={refresh} />}
    </>
  );
}
