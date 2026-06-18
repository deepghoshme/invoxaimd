"use client";

import { useState } from "react";
import { type StoreItem } from "@/lib/store";
import { saveStoreProducts } from "@/app/dashboard/store/actions";

async function upload(file: File): Promise<string | null> {
  const fd = new FormData(); fd.append("file", file);
  try { const res = await fetch("/api/upload", { method: "POST", body: fd }); const j = await res.json(); return res.ok ? (j.url as string) : null; } catch { return null; }
}

/** Dashboard-side product manager for the store: add / edit / remove + list. */
export default function StoreProducts({ initial }: { initial: StoreItem[] }) {
  const [items, setItems] = useState<StoreItem[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);

  const set = (id: string, p: Partial<StoreItem>) => setItems((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const add = () => { const id = "p" + Math.random().toString(36).slice(2, 8); setItems((a) => [...a, { id, name: "New product", cat: "Shop", price: "₹499", compareAt: "₹999", rating: "5.0", url: "#" }]); setEdit(id); };
  const del = (id: string) => setItems((a) => a.filter((x) => x.id !== id));

  async function save() {
    setBusy(true); setMsg(null);
    const res = await saveStoreProducts(items as unknown[]);
    setBusy(false);
    setMsg(res.ok ? "Saved ✓" : (res.error ?? "Failed"));
    setTimeout(() => setMsg(null), 2000);
  }

  return (
    <div className="dx-storeprod">
      <div className="dx-sp-head">
        <span className="dx-muted" style={{ fontSize: 13 }}>{items.length} product{items.length === 1 ? "" : "s"}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          <button className="dx-editbtn" onClick={add}>+ Add product</button>
          <button className="btn grad" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save products"}</button>
        </span>
      </div>

      {items.length === 0 && <div className="dx-empty">No products yet. Click “Add product”.</div>}

      <div className="dx-sp-list">
        {items.map((p) => (
          <div className="dx-sp-row" key={p.id}>
            <label className="dx-sp-thumb" style={p.img ? { backgroundImage: `url('${p.img}')` } : undefined}>
              {!p.img && "📦"}
              <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const u = await upload(f); if (u) set(p.id, { img: u }); }} />
            </label>
            <div className="dx-sp-main">
              <div className="dx-sp-top">
                <span className="dx-sp-name">{p.name || "Untitled"}</span>
                <span className="dx-sp-price">{p.price}{p.compareAt && <s>{p.compareAt}</s>}</span>
                <span className="dx-sp-cat">{p.cat}</span>
                <button className="dx-sp-x" onClick={() => setEdit(edit === p.id ? null : p.id)}>{edit === p.id ? "Close" : "Edit"}</button>
                <button className="dx-sp-x del" onClick={() => del(p.id)}>✕</button>
              </div>
              {edit === p.id && (
                <div className="dx-sp-edit">
                  <div className="dx-sp-ff"><input value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} placeholder="Product name" /><input value={p.cat} onChange={(e) => set(p.id, { cat: e.target.value })} placeholder="Category" /></div>
                  <div className="dx-sp-ff"><input value={p.price ?? ""} onChange={(e) => set(p.id, { price: e.target.value })} placeholder="Price ₹999" /><input value={p.compareAt ?? ""} onChange={(e) => set(p.id, { compareAt: e.target.value })} placeholder="MRP ₹2,999" /></div>
                  <div className="dx-sp-ff"><input value={p.badge ?? ""} onChange={(e) => set(p.id, { badge: e.target.value })} placeholder="Badge (e.g. Bestseller)" /><input value={p.rating ?? ""} onChange={(e) => set(p.id, { rating: e.target.value })} placeholder="Rating 4.9" /></div>
                  <input value={p.url ?? ""} onChange={(e) => set(p.id, { url: e.target.value })} placeholder="Buy / checkout link (/opp/… or https://)" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
