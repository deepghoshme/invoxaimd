"use client";

import { useState, useTransition } from "react";
import {
  createUpsellOffer,
  updateUpsellOffer,
  toggleUpsellActive,
  deleteUpsellOffer,
  reorderUpsellOffers,
  type UpsellOfferInput,
} from "./actions";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type Product = {
  id: string;
  name: string;
  price: number | null;
  source: "store" | "opp";
};

export type UpsellOffer = {
  id: string;
  name: string;
  trigger_type: "any" | "product";
  trigger_product_id: string | null;
  offer_product_id: string;
  offer_kind: "bump" | "post_purchase";
  discount_type: "percent" | "flat" | "none";
  discount_value: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function inr(v: number | null) {
  if (v == null) return "—";
  return "₹" + Math.round(v).toLocaleString("en-IN");
}

function discountLabel(o: UpsellOffer) {
  if (o.discount_type === "none") return "No discount";
  if (o.discount_type === "percent") return `${o.discount_value}% off`;
  return `₹${o.discount_value} off`;
}

function kindLabel(k: string) {
  return k === "bump" ? "Order bump" : "Post-purchase";
}

function triggerLabel(o: UpsellOffer, products: Product[]) {
  if (o.trigger_type === "any") return "Any checkout";
  const p = products.find((x) => x.id === o.trigger_product_id);
  return p ? `On: ${p.name}` : "Specific product";
}

/* ── Offer form / modal ─────────────────────────────────────────────────────── */

const EMPTY_INPUT: UpsellOfferInput = {
  name: "",
  trigger_type: "any",
  trigger_product_id: null,
  offer_product_id: "",
  offer_kind: "bump",
  discount_type: "none",
  discount_value: 0,
};

function OfferModal({
  products,
  initial,
  editId,
  onClose,
  onSaved,
}: {
  products: Product[];
  initial?: UpsellOffer;
  editId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<UpsellOfferInput>(
    initial
      ? {
          name: initial.name,
          trigger_type: initial.trigger_type,
          trigger_product_id: initial.trigger_product_id,
          offer_product_id: initial.offer_product_id,
          offer_kind: initial.offer_kind,
          discount_type: initial.discount_type,
          discount_value: initial.discount_value,
        }
      : EMPTY_INPUT
  );
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function set<K extends keyof UpsellOfferInput>(k: K, v: UpsellOfferInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Name is required."); return; }
    if (!form.offer_product_id) { setErr("Choose a product to offer."); return; }
    if (form.trigger_type === "product" && !form.trigger_product_id) {
      setErr("Choose the trigger product."); return;
    }
    setErr("");
    start(async () => {
      const res = editId
        ? await updateUpsellOffer(editId, form)
        : await createUpsellOffer(form);
      if (!res.ok) { setErr(res.error ?? "Failed to save."); return; }
      onSaved();
      onClose();
    });
  }

  const inp = "up-inp";
  const lbl = "up-lbl";
  const sel = "up-sel";

  return (
    <div className="up-overlay">
      <div className="up-modal">
        <div className="up-modal-head">
          <b>{editId ? "Edit offer" : "New upsell offer"}</b>
          <button className="up-x" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <label className={lbl}>Offer name (internal)</label>
          <input
            className={inp}
            placeholder="e.g. Workbook bump on checkout"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />

          <label className={lbl}>Offer type</label>
          <div className="up-radio-group">
            {(["bump", "post_purchase"] as const).map((k) => (
              <label key={k} className={`up-radio${form.offer_kind === k ? " on" : ""}`}>
                <input
                  type="radio"
                  name="offer_kind"
                  value={k}
                  checked={form.offer_kind === k}
                  onChange={() => set("offer_kind", k)}
                />
                <span>
                  <b>{kindLabel(k)}</b>
                  <span className="up-radio-sub">
                    {k === "bump"
                      ? "Checkbox shown at checkout before payment"
                      : "One-click offer on the thank-you page"}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <label className={lbl}>Trigger</label>
          <select
            className={sel}
            value={form.trigger_type}
            onChange={(e) =>
              set("trigger_type", e.target.value as "any" | "product")
            }
          >
            <option value="any">Any checkout</option>
            <option value="product">Specific product in cart</option>
          </select>

          {form.trigger_type === "product" && (
            <>
              <label className={lbl}>Trigger product</label>
              <select
                className={sel}
                value={form.trigger_product_id ?? ""}
                onChange={(e) =>
                  set("trigger_product_id", e.target.value || null)
                }
              >
                <option value="">— choose product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.source === "opp" ? " (opp)" : ""}
                    {p.price != null ? ` — ${inr(p.price)}` : ""}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className={lbl}>Product to offer</label>
          <select
            className={sel}
            value={form.offer_product_id}
            onChange={(e) => set("offer_product_id", e.target.value)}
          >
            <option value="">— choose product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.source === "opp" ? " (opp)" : ""}
                {p.price != null ? ` — ${inr(p.price)}` : ""}
              </option>
            ))}
          </select>

          <label className={lbl}>Discount</label>
          <div className="up-inline">
            <select
              className={sel}
              style={{ flex: "0 0 140px" }}
              value={form.discount_type}
              onChange={(e) =>
                set(
                  "discount_type",
                  e.target.value as "percent" | "flat" | "none"
                )
              }
            >
              <option value="none">No discount</option>
              <option value="percent">Percent off</option>
              <option value="flat">Flat ₹ off</option>
            </select>
            {form.discount_type !== "none" && (
              <input
                className={inp}
                style={{ flex: 1 }}
                type="number"
                min={0}
                max={form.discount_type === "percent" ? 100 : undefined}
                placeholder={form.discount_type === "percent" ? "e.g. 20" : "e.g. 299"}
                value={form.discount_value === 0 ? "" : form.discount_value}
                onChange={(e) =>
                  set("discount_value", Math.max(0, Number(e.target.value) || 0))
                }
              />
            )}
          </div>

          {err && <div className="up-ferr">{err}</div>}

          <div className="up-modal-foot">
            <button type="button" className="up-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="up-btn-primary" disabled={pending}>
              {pending ? "Saving…" : editId ? "Save changes" : "Create offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Offer row ──────────────────────────────────────────────────────────────── */

function OfferRow({
  offer,
  products,
  onEdit,
  onDelete,
  onToggle,
  isDragging,
  onDragStart,
}: {
  offer: UpsellOffer;
  products: Product[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
  isDragging: boolean;
  onDragStart: () => void;
}) {
  const offerProd = products.find((p) => p.id === offer.offer_product_id);
  return (
    <div
      className={`up-row${isDragging ? " up-row-dragging" : ""}`}
      draggable
      onDragStart={onDragStart}
    >
      <span className="up-drag" title="Drag to reorder">⠿</span>
      <div className="up-row-main">
        <div className="up-row-name">{offer.name}</div>
        <div className="up-row-meta">
          <span className={`up-kind-badge up-kind-${offer.offer_kind}`}>
            {kindLabel(offer.offer_kind)}
          </span>
          <span className="up-dot">·</span>
          <span>{triggerLabel(offer, products)}</span>
          <span className="up-dot">·</span>
          <span>
            {offerProd ? offerProd.name : "Unknown product"}
          </span>
          {offer.discount_type !== "none" && (
            <>
              <span className="up-dot">·</span>
              <span className="up-discount">{discountLabel(offer)}</span>
            </>
          )}
        </div>
      </div>
      <div className="up-row-actions">
        <button
          className={`up-toggle${offer.is_active ? " up-toggle-on" : ""}`}
          onClick={() => onToggle(!offer.is_active)}
          title={offer.is_active ? "Deactivate" : "Activate"}
        >
          {offer.is_active ? "Active" : "Inactive"}
        </button>
        <button className="up-icon-btn" onClick={onEdit} title="Edit">
          ✎
        </button>
        <button
          className="up-icon-btn up-icon-del"
          onClick={onDelete}
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ── Main client ─────────────────────────────────────────────────────────────── */

export default function UpsellClient({
  storeId,
  initial,
  products,
  migrationPending,
}: {
  storeId: string;
  initial: UpsellOffer[];
  products: Product[];
  migrationPending: boolean;
}) {
  const [offers, setOffers] = useState<UpsellOffer[]>(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [editOffer, setEditOffer] = useState<UpsellOffer | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, start] = useTransition();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function reloadOffers() {
    // Full-page refresh via router would lose state; we do a lightweight fetch.
    // Since actions call revalidatePath, next navigation will show fresh data.
    // For client-side immediacy we just refetch offers via a simple GET.
    fetch(`/dashboard/upsell/api?storeId=${storeId}`)
      .then((r) => r.json())
      .then((data) => setOffers(data))
      .catch(() => {});
  }

  function handleToggle(id: string, active: boolean) {
    setOffers((prev) =>
      prev.map((o) => (o.id === id ? { ...o, is_active: active } : o))
    );
    start(async () => {
      const res = await toggleUpsellActive(id, active);
      if (!res.ok) {
        // revert
        setOffers((prev) =>
          prev.map((o) => (o.id === id ? { ...o, is_active: !active } : o))
        );
        showToast(res.error ?? "Failed to update.");
      } else {
        showToast(active ? "Offer activated." : "Offer deactivated.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this upsell offer?")) return;
    const prev = offers;
    setOffers((o) => o.filter((x) => x.id !== id));
    start(async () => {
      const res = await deleteUpsellOffer(id);
      if (!res.ok) {
        setOffers(prev);
        showToast(res.error ?? "Failed to delete.");
      } else {
        showToast("Offer deleted.");
      }
    });
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = offers.map((o) => o.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    const reordered = next
      .map((id) => offers.find((o) => o.id === id)!)
      .filter(Boolean)
      .map((o, i) => ({ ...o, sort_order: i }));
    setOffers(reordered);
    setDragId(null);
    setDragOverId(null);
    start(async () => {
      await reorderUpsellOffers(next);
    });
  }

  if (migrationPending) {
    return (
      <div className="up-wrap">
        <div className="up-pending-card">
          <div style={{ fontSize: 32 }}>🔧</div>
          <h3>Migration required</h3>
          <p>
            The <code>upsell_offers</code> table does not exist yet. Ask your
            admin to apply the migration and then reload this page.
          </p>
          <code className="up-code">
            node scripts/db-apply.mjs
            supabase/migrations/20260618340000_upsell.sql
          </code>
          <p className="up-muted">After applying, reload this page.</p>
        </div>
      </div>
    );
  }

  const activeCount = offers.filter((o) => o.is_active).length;

  return (
    <div className="up-wrap">
      <style>{`
        /* ── variables ── */
        .up-wrap {
          --up-green: #1fb57a;
          --up-green-bg: rgba(31,181,122,.12);
          --up-bump-color: var(--primary);
          --up-post-color: var(--secondary);
        }
        /* ── page header row ── */
        .up-list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .up-list-info p { color: var(--muted); font-size: 13.5px; margin: 3px 0 0; }
        /* ── offer list ── */
        .up-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
        .up-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 14px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: 13px;
          transition: border-color .15s, opacity .15s;
        }
        .up-row-dragging { opacity: .5; border-style: dashed; }
        .up-row:hover { border-color: color-mix(in srgb, var(--primary) 35%, var(--border)); }
        .up-drag {
          cursor: grab;
          color: var(--muted);
          font-size: 15px;
          flex: none;
          user-select: none;
          line-height: 1;
        }
        .up-drag:active { cursor: grabbing; }
        .up-row-main { flex: 1; min-width: 0; }
        .up-row-name { font-weight: 600; font-size: 14px; }
        .up-row-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 3px;
          font-size: 12px;
          color: var(--muted);
        }
        .up-dot { color: var(--border); }
        .up-discount { color: var(--up-green); font-weight: 600; }
        /* kind badge */
        .up-kind-badge {
          font-size: 10.5px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 99px;
        }
        .up-kind-bump {
          background: color-mix(in srgb, var(--up-bump-color) 12%, var(--surface));
          color: var(--up-bump-color);
        }
        .up-kind-post_purchase {
          background: color-mix(in srgb, var(--up-post-color) 12%, var(--surface));
          color: var(--up-post-color);
        }
        /* row actions */
        .up-row-actions { display: flex; align-items: center; gap: 6px; flex: none; }
        .up-toggle {
          font-size: 11.5px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 99px;
          border: 1.5px solid var(--border);
          background: var(--surface2);
          color: var(--muted);
          cursor: pointer;
          white-space: nowrap;
        }
        .up-toggle-on {
          background: var(--up-green-bg);
          border-color: rgba(31,181,122,.35);
          color: var(--up-green);
        }
        .up-icon-btn {
          width: 28px; height: 28px;
          border-radius: 7px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
          display: grid;
          place-items: center;
          font-size: 13px;
        }
        .up-icon-btn:hover { background: var(--surface2); color: var(--text); }
        .up-icon-del:hover { border-color: var(--red,#e5476f); color: var(--red,#e5476f); }
        /* empty state */
        .up-empty {
          text-align: center;
          padding: 60px 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          margin-bottom: 18px;
        }
        .up-empty-icon { font-size: 38px; margin-bottom: 12px; }
        .up-empty h3 {
          font-family: var(--font-sora, "Sora", sans-serif);
          font-size: 18px; margin: 0 0 8px;
        }
        .up-empty p { color: var(--muted); font-size: 13.5px; margin: 0 0 20px; }
        /* checkout note */
        .up-checkout-note {
          padding: 14px 16px;
          background: color-mix(in srgb, var(--primary) 7%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
          border-radius: 12px;
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 18px;
          line-height: 1.55;
        }
        .up-checkout-note b { color: var(--text); }
        /* suggest more */
        .up-suggest {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 16px 18px;
          background: color-mix(in srgb, var(--secondary) 6%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--secondary) 20%, var(--border));
          border-radius: 14px;
          margin-top: 8px;
        }
        .up-suggest-icon { font-size: 21px; flex: none; margin-top: 1px; }
        .up-suggest b { font-size: 13.5px; display: block; margin-bottom: 6px; }
        .up-suggest-list {
          margin: 0; padding-left: 18px;
          font-size: 12.5px; color: var(--muted); line-height: 1.8;
        }
        /* migration pending */
        .up-pending-card {
          text-align: center; padding: 64px 24px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; max-width: 560px; margin: 0 auto;
        }
        .up-pending-card h3 {
          font-family: var(--font-sora, "Sora", sans-serif);
          font-size: 18px; margin: 12px 0 8px;
        }
        .up-pending-card p { color: var(--muted); font-size: 13.5px; margin: 0 0 14px; }
        .up-code {
          display: block; background: var(--surface2);
          border: 1px solid var(--border); border-radius: 8px;
          padding: 10px 14px; font-size: 12px; font-family: monospace;
          color: var(--text); word-break: break-all; text-align: left;
          margin-bottom: 14px;
        }
        .up-muted { color: var(--muted); font-size: 12.5px; margin: 0; }
        /* modal */
        .up-overlay {
          position: fixed; inset: 0; z-index: 80;
          background: rgba(0,0,0,.48);
          display: grid; place-items: center; padding: 20px;
        }
        .up-modal {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 18px; padding: 24px;
          width: 100%; max-width: 460px;
          box-shadow: 0 24px 60px -20px rgba(0,0,0,.45);
          max-height: 90vh; overflow-y: auto;
        }
        .up-modal-head {
          display: flex; align-items: center;
          justify-content: space-between;
          margin-bottom: 20px; font-size: 16px;
        }
        .up-x {
          background: none; border: 1px solid var(--border);
          border-radius: 8px; width: 28px; height: 28px;
          cursor: pointer; color: var(--muted); font-size: 13px;
        }
        /* form controls */
        .up-lbl {
          display: block; font-size: 12.5px; font-weight: 600;
          color: var(--muted); margin: 14px 0 5px;
        }
        .up-lbl:first-of-type { margin-top: 0; }
        .up-inp, .up-sel {
          width: 100%; padding: 9px 12px;
          border: 1px solid var(--border); border-radius: 9px;
          background: var(--bg); color: var(--text);
          font: inherit; font-size: 13.5px;
        }
        .up-inp:focus, .up-sel:focus {
          outline: 2px solid var(--primary); outline-offset: 1px;
        }
        .up-inline { display: flex; gap: 8px; align-items: stretch; }
        /* radio group */
        .up-radio-group { display: flex; flex-direction: column; gap: 7px; }
        .up-radio {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 12px;
          border: 1.5px solid var(--border); border-radius: 10px;
          cursor: pointer; font-size: 13px;
        }
        .up-radio.on { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, var(--surface)); }
        .up-radio input[type=radio] { flex: none; margin-top: 3px; accent-color: var(--primary); }
        .up-radio b { display: block; font-size: 13px; margin-bottom: 2px; }
        .up-radio-sub { font-size: 12px; color: var(--muted); }
        /* error + footer */
        .up-ferr { font-size: 12.5px; color: var(--red,#e5476f); margin-top: 10px; }
        .up-modal-foot {
          display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;
        }
        /* buttons */
        .up-btn-primary {
          background: var(--primary); color: #fff;
          border: 0; border-radius: 10px; padding: 9px 16px;
          font: inherit; font-weight: 600; font-size: 13px;
          cursor: pointer; white-space: nowrap;
        }
        .up-btn-primary:hover { opacity: .9; }
        .up-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .up-btn-ghost {
          background: var(--surface); color: var(--text);
          border: 1px solid var(--border); border-radius: 10px;
          padding: 9px 16px; font: inherit; font-weight: 600;
          font-size: 13px; cursor: pointer;
        }
        /* toast */
        .up-toastbox {
          position: fixed; left: 50%; bottom: 24px; z-index: 90;
          transform: translateX(-50%);
          background: #18121f; color: #fff;
          padding: 11px 18px; border-radius: 12px;
          font-size: 13px; font-weight: 600;
          box-shadow: 0 20px 50px -20px rgba(0,0,0,.6);
          display: flex; align-items: center; gap: 9px;
          animation: up-toast .35s ease;
          white-space: nowrap;
        }
        .up-tdot { width: 8px; height: 8px; border-radius: 50%; background: #36c98e; }
        @keyframes up-toast {
          from { transform: translate(-50%,150%); opacity: 0; }
          to   { transform: translate(-50%,0);    opacity: 1; }
        }
      `}</style>

      {/* ── header ── */}
      <div className="up-list-head">
        <div className="up-list-info">
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            Upsell offers
            {offers.length > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--muted)",
                  marginLeft: 8,
                }}
              >
                {activeCount} active / {offers.length} total
              </span>
            )}
          </span>
          <p>
            Order bumps and post-purchase offers managed here. Checkout
            integration surfaces these at the right moment automatically.
          </p>
        </div>
        <button
          className="up-btn-primary"
          onClick={() => setShowCreate(true)}
          disabled={products.length === 0}
          title={products.length === 0 ? "Add products first" : undefined}
        >
          + New offer
        </button>
      </div>

      {/* ── checkout integration note ── */}
      <div className="up-checkout-note">
        <b>How this works:</b> Active offers will surface at checkout automatically — order bumps appear as a checkbox before payment, post-purchase offers appear on the thank-you page after payment. Checkout rendering is handled separately; no changes needed here.
      </div>

      {/* ── list ── */}
      {offers.length === 0 ? (
        <div className="up-empty">
          <div className="up-empty-icon">🎯</div>
          <h3>No upsell offers yet</h3>
          <p>
            Create an order bump or post-purchase offer to start increasing your
            average order value.
          </p>
          <button
            className="up-btn-primary"
            onClick={() => setShowCreate(true)}
            disabled={products.length === 0}
          >
            {products.length === 0 ? "Add products first" : "Create first offer"}
          </button>
          {products.length === 0 && (
            <p style={{ marginTop: 10, fontSize: 12 }}>
              You need at least one product in your store.{" "}
              <a href="/dashboard/store" style={{ color: "var(--primary)" }}>
                Add products →
              </a>
            </p>
          )}
        </div>
      ) : (
        <div
          className="up-list"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => dragOverId && handleDrop(dragOverId)}
        >
          {offers.map((offer) => (
            <div
              key={offer.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId(offer.id);
              }}
            >
              <OfferRow
                offer={offer}
                products={products}
                onEdit={() => setEditOffer(offer)}
                onDelete={() => handleDelete(offer.id)}
                onToggle={(active) => handleToggle(offer.id, active)}
                isDragging={dragId === offer.id}
                onDragStart={() => setDragId(offer.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── suggest more ── */}
      <div className="up-suggest">
        <div className="up-suggest-icon">💡</div>
        <div>
          <b>Offer ideas to try</b>
          <ul className="up-suggest-list">
            <li>Add a workbook bump on your flagship course (10–20% off)</li>
            <li>Post-purchase: offer a 1:1 coaching session after any digital download</li>
            <li>Bundle: trigger an accessory offer when a core product is bought</li>
            <li>Upsell a higher-tier plan on any checkout — flat ₹200 off</li>
          </ul>
        </div>
      </div>

      {/* ── modals ── */}
      {showCreate && (
        <OfferModal
          products={products}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            reloadOffers();
            showToast("Offer created.");
          }}
        />
      )}

      {editOffer && (
        <OfferModal
          products={products}
          initial={editOffer}
          editId={editOffer.id}
          onClose={() => setEditOffer(null)}
          onSaved={() => {
            reloadOffers();
            showToast("Offer updated.");
          }}
        />
      )}

      {/* ── toast ── */}
      {toast && (
        <div className="up-toastbox">
          <span className="up-tdot" />
          {toast}
        </div>
      )}
    </div>
  );
}
