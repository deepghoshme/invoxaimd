"use client";

import { useState, useTransition } from "react";
import { createCoupon, toggleCouponActive, deleteCoupon, type CreateCouponInput } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CouponRow = {
  id: string;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  min_order_paise: number;
  max_uses: number | null;
  used_count: number;
  applies_to: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

type Props = {
  storeId: string;
  subdomain: string | null;
  initial: CouponRow[];
  impersonating: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

function fmtDiscount(row: CouponRow): string {
  if (row.discount_type === "percent") return `${row.discount_value}% off`;
  return `₹${fmt(Math.round(row.discount_value / 100))} off`;
}

function fmtExpiry(expires_at: string | null): string {
  if (!expires_at) return "Never";
  const d = new Date(expires_at);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function computeDiscount(type: "percent" | "flat", value: number, sample: number): number {
  if (type === "percent") return Math.round(sample * Math.min(value, 100) / 100);
  return Math.min(Math.round(value * 100), sample * 100) / 100; // rupees
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CouponClient({ storeId, subdomain, initial, impersonating }: Props) {
  const [coupons, setCoupons] = useState<CouponRow[]>(initial);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState("20");
  const [minOrder, setMinOrder] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [appliesTo, setAppliesTo] = useState("All products");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Live preview calculations ───────────────────────────────────────────────
  const sampleRupees = 2000;
  const discountNum = parseFloat(discountValue) || 0;
  const minOrderNum = parseFloat(minOrder) || 0;
  const previewCode = (code || "YOURCODE").toUpperCase();
  const discountRupees = discountType === "percent"
    ? Math.round(sampleRupees * Math.min(discountNum, 100) / 100)
    : Math.min(discountNum, sampleRupees);
  const finalRupees = Math.max(0, sampleRupees - discountRupees);
  const offLabel = discountType === "percent"
    ? `${discountNum}% OFF`
    : `₹${fmt(discountNum)} OFF`;
  const condParts: string[] = [];
  if (minOrderNum > 0) condParts.push(`Min. order ₹${fmt(minOrderNum)}`);
  if (appliesTo !== "All products") condParts.push(appliesTo);
  const condLabel = condParts.join(" · ") || "All orders";

  // ── Create handler ──────────────────────────────────────────────────────────
  function handleCreate() {
    setFormError("");
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleanCode) { setFormError("Enter a coupon code."); return; }

    const val = parseFloat(discountValue);
    if (!val || val <= 0) { setFormError("Enter a valid discount value."); return; }
    if (discountType === "percent" && val > 100) { setFormError("Percent cannot exceed 100."); return; }

    const minRupees = parseFloat(minOrder) || 0;
    const maxU = maxUses.trim() ? parseInt(maxUses, 10) : null;
    if (maxU !== null && (isNaN(maxU) || maxU < 1)) { setFormError("Usage limit must be a positive number."); return; }

    let expiresIso: string | null = null;
    if (expiresAt.trim()) {
      const d = new Date(expiresAt);
      if (isNaN(d.getTime())) { setFormError("Invalid expiry date."); return; }
      expiresIso = d.toISOString();
    }

    const input: CreateCouponInput = {
      code: cleanCode,
      discount_type: discountType,
      discount_value: val,
      min_order_rupees: minRupees,
      max_uses: maxU,
      applies_to: appliesTo,
      expires_at: expiresIso,
    };

    startTransition(async () => {
      const res = await createCoupon(input);
      if (!res.ok) { setFormError(res.error ?? "Failed to create coupon."); return; }
      showToast(`Coupon ${cleanCode} created.`);
      setCode("");
      setDiscountValue("20");
      setMinOrder("0");
      setMaxUses("");
      setExpiresAt("");
      // Optimistic: add to list (server revalidates; a page refresh gets the real row)
      const newRow: CouponRow = {
        id: res.id ?? `tmp-${Date.now()}`,
        code: cleanCode,
        discount_type: discountType,
        discount_value: discountType === "flat" ? val * 100 : val,
        min_order_paise: minRupees * 100,
        max_uses: maxU,
        used_count: 0,
        applies_to: appliesTo,
        expires_at: expiresIso,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setCoupons((prev) => [newRow, ...prev]);
    });
  }

  // ── Toggle handler ──────────────────────────────────────────────────────────
  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleCouponActive(id, !current);
      if (!res.ok) { showToast(res.error ?? "Failed.", false); return; }
      setCoupons((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: !current } : c))
      );
    });
  }

  // ── Delete handler ──────────────────────────────────────────────────────────
  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteCoupon(id);
      if (!res.ok) { showToast(res.error ?? "Failed to delete.", false); return; }
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirm(null);
      showToast("Coupon deleted.");
    });
  }

  const autoLink = subdomain
    ? `${subdomain}.invoxai.io/store?coupon=${previewCode}`
    : `your-store.invoxai.io/store?coupon=${previewCode}`;

  const activeCoupons = coupons.filter((c) => c.is_active);

  return (
    <>
      <style>{`
        .cp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
        @media (max-width: 820px) { .cp-cols { grid-template-columns: 1fr; } }

        .cp-label { display: block; font-size: 12.5px; font-weight: 700; margin: 14px 0 6px; color: var(--text); }
        .cp-label:first-of-type { margin-top: 0; }
        .cp-input {
          width: 100%; padding: 10px 13px; font: inherit; font-size: 14px;
          color: var(--text); background: var(--surface2);
          border: 1.5px solid var(--border); border-radius: 10px; outline: none;
          transition: border-color .15s;
        }
        .cp-input:focus { border-color: var(--primary); }
        .cp-input.cp-code { text-transform: uppercase; font-family: ui-monospace, Menlo, monospace; font-weight: 700; letter-spacing: 1px; }
        .cp-ff { display: flex; gap: 11px; }
        .cp-ff > * { flex: 1; min-width: 0; }

        .cp-seg {
          display: flex; background: var(--surface2); border: 1px solid var(--border);
          border-radius: 10px; padding: 3px; gap: 3px;
        }
        .cp-seg button {
          flex: 1; border: 0; background: none; font: inherit; font-weight: 600;
          font-size: 13px; color: var(--muted); padding: 9px; border-radius: 8px; cursor: pointer;
          transition: background .15s, color .15s;
        }
        .cp-seg button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.14); }

        .cp-create {
          width: 100%; margin-top: 18px;
          background: var(--grad, linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4));
          color: #fff; border: 0; border-radius: 12px; padding: 14px;
          font-family: inherit; font-weight: 800; font-size: 15px; cursor: pointer;
          opacity: 1; transition: opacity .15s;
        }
        .cp-create:disabled { opacity: .55; cursor: not-allowed; }

        .cp-error { font-size: 12.5px; color: var(--red, #e53935); margin-top: 8px; }

        /* ticket preview */
        .cp-ticket {
          position: relative; border-radius: 16px; overflow: hidden;
          background: linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4);
          color: #fff; padding: 26px 24px; text-align: center;
        }
        .cp-ticket::before, .cp-ticket::after {
          content: ""; position: absolute; top: 50%;
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--surface); transform: translateY(-50%);
        }
        .cp-ticket::before { left: -11px; }
        .cp-ticket::after  { right: -11px; }
        .cp-ticket .tlab { font-size: 12px; font-weight: 700; opacity: .9; text-transform: uppercase; letter-spacing: .06em; }
        .cp-ticket .tcode {
          font-family: ui-monospace, Menlo, monospace; font-weight: 800;
          font-size: 28px; letter-spacing: 2px; margin: 8px 0;
          border: 2px dashed rgba(255,255,255,.6); border-radius: 12px; padding: 10px;
          word-break: break-all;
        }
        .cp-ticket .toff { font-weight: 800; font-size: 17px; }
        .cp-ticket .tcond { font-size: 12px; opacity: .9; margin-top: 6px; }

        .cp-calc { margin-top: 16px; }
        .cp-row { display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 8px; }
        .cp-row .g { color: var(--green); }
        .cp-total {
          display: flex; justify-content: space-between; align-items: baseline;
          padding-top: 12px; border-top: 1px solid var(--border);
        }
        .cp-total-val { font-weight: 800; font-size: 22px; }

        .cp-link-row { display: flex; gap: 8px; margin-top: 16px; }
        .cp-link-url {
          flex: 1; font-family: ui-monospace, Menlo, monospace; font-size: 12px;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 9px; padding: 10px 12px; color: var(--accent);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cp-copy-btn {
          font: inherit; font-weight: 700; font-size: 12.5px;
          border: 1px solid var(--border); background: var(--surface);
          color: var(--text); padding: 10px 14px; border-radius: 9px; cursor: pointer;
          white-space: nowrap;
        }
        .cp-hint { font-size: 12px; color: var(--muted); margin-top: 8px; }

        /* list */
        .cp-list-title { font-size: 15px; font-weight: 700; margin: 24px 0 12px; }
        .cp-cpn {
          display: flex; align-items: center; gap: 13px; padding: 13px 16px;
          border: 1px solid var(--border); border-radius: 12px; margin-bottom: 9px;
          background: var(--surface);
        }
        .cp-cpn .cd {
          font-family: ui-monospace, Menlo, monospace; font-weight: 700;
          font-size: 13.5px; color: var(--primary);
          background: color-mix(in srgb, var(--primary) 10%, transparent);
          padding: 6px 12px; border-radius: 8px; white-space: nowrap;
        }
        .cp-cpn .cpn-meta { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
        .cp-cpn .cpn-meta b { color: var(--text); font-size: 13px; }
        .cp-cpn .cpn-use { margin-left: auto; text-align: right; flex: none; }
        .cp-cpn .cpn-use .n { font-weight: 700; font-size: 13px; }
        .cp-cpn .cpn-use .l { font-size: 11px; color: var(--muted); }
        .cp-sw {
          width: 44px; height: 25px; border-radius: 999px;
          background: var(--border); border: 0; cursor: pointer; position: relative; flex: none;
          transition: background .2s;
        }
        .cp-sw.on { background: linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4); }
        .cp-sw i {
          position: absolute; top: 3px; left: 3px;
          width: 19px; height: 19px; border-radius: 50%;
          background: #fff; transition: transform .18s; display: block;
        }
        .cp-sw.on i { transform: translateX(19px); }

        .cp-del-btn {
          font: inherit; font-size: 12px; color: var(--muted);
          background: none; border: 0; cursor: pointer; padding: 4px 8px;
          border-radius: 6px; transition: color .15s, background .15s;
        }
        .cp-del-btn:hover { color: var(--red, #e53935); background: color-mix(in srgb, var(--red, #e53935) 8%, transparent); }
        .cp-del-confirm {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          background: color-mix(in srgb, var(--red, #e53935) 8%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--red, #e53935) 24%, var(--border));
          border-radius: 10px; font-size: 13px; margin-bottom: 9px;
        }
        .cp-del-confirm button { font: inherit; font-size: 13px; border: 0; border-radius: 7px; padding: 5px 12px; cursor: pointer; }
        .cp-del-yes { background: var(--red, #e53935); color: #fff; font-weight: 700; }
        .cp-del-no { background: var(--surface2); color: var(--text); }

        .cp-empty { text-align: center; padding: 40px 24px; color: var(--muted); font-size: 13.5px; }

        /* toast */
        .cp-toast {
          position: fixed; left: 50%; bottom: 24px; z-index: 200;
          background: #18121f; color: #fff; padding: 12px 20px;
          border-radius: 12px; font-size: 13px; font-weight: 600;
          box-shadow: 0 20px 50px -20px rgba(0,0,0,.6);
          display: flex; align-items: center; gap: 9px;
          transform: translateX(-50%);
          animation: cp-toast-in .35s ease;
        }
        .cp-toast .d { width: 8px; height: 8px; border-radius: 50%; }
        .cp-toast .d.ok { background: #36c98e; }
        .cp-toast .d.err { background: #e53935; }
        @keyframes cp-toast-in { from { transform: translate(-50%,16px); opacity: 0; } to { transform: translate(-50%,0); opacity: 1; } }

        .cp-readonly-banner {
          background: color-mix(in srgb, var(--accent) 8%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
          border-radius: 12px; padding: 12px 16px; font-size: 13px;
          color: var(--muted); margin-bottom: 18px;
        }

        .cp-stat-card { margin-bottom: 18px; }
        .dx-kv { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; }
        .dx-kv:last-child { border-bottom: 0; }
        .dx-fw6 { font-weight: 600; }
      `}</style>

      {impersonating && (
        <div className="cp-readonly-banner">
          You are viewing this store as an admin. Coupon management is read-only while impersonating.
        </div>
      )}

      <div className="cp-cols">
        {/* ── Builder panel ── */}
        <div className="dx-card">
          <h3 style={{ fontSize: 15, marginBottom: 16, fontWeight: 700 }}>Create a coupon</h3>

          <label className="cp-label">Code</label>
          <input
            className="cp-input cp-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="SUMMER25"
            maxLength={30}
            disabled={impersonating}
          />

          <label className="cp-label">Discount type</label>
          <div className="cp-seg">
            <button
              className={discountType === "percent" ? "on" : ""}
              onClick={() => setDiscountType("percent")}
              disabled={impersonating}
            >
              Percent %
            </button>
            <button
              className={discountType === "flat" ? "on" : ""}
              onClick={() => setDiscountType("flat")}
              disabled={impersonating}
            >
              Flat ₹
            </button>
          </div>

          <div className="cp-ff" style={{ marginTop: 14 }}>
            <div>
              <label className="cp-label" style={{ marginTop: 0 }}>
                {discountType === "percent" ? "Percent %" : "Amount ₹"}
              </label>
              <input
                className="cp-input"
                type="number"
                min={1}
                max={discountType === "percent" ? 100 : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value.replace(/[^0-9]/g, ""))}
                disabled={impersonating}
              />
            </div>
            <div>
              <label className="cp-label" style={{ marginTop: 0 }}>Min. order ₹</label>
              <input
                className="cp-input"
                type="number"
                min={0}
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                disabled={impersonating}
              />
            </div>
          </div>

          <label className="cp-label">Applies to</label>
          <select
            className="cp-input"
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value)}
            disabled={impersonating}
          >
            <option>All products</option>
            <option>Courses only</option>
            <option>Digital only</option>
            <option>Physical only</option>
          </select>

          <div className="cp-ff" style={{ marginTop: 14 }}>
            <div>
              <label className="cp-label" style={{ marginTop: 0 }}>Usage limit</label>
              <input
                className="cp-input"
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Unlimited"
                disabled={impersonating}
              />
            </div>
            <div>
              <label className="cp-label" style={{ marginTop: 0 }}>Expires</label>
              <input
                className="cp-input"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={impersonating}
              />
            </div>
          </div>

          {formError && <p className="cp-error">{formError}</p>}

          <button
            className="cp-create"
            onClick={handleCreate}
            disabled={impersonating || isPending}
          >
            {isPending ? "Creating…" : "Create coupon"}
          </button>
        </div>

        {/* ── Preview panel ── */}
        <div>
          <div className="dx-card">
            <h3 style={{ fontSize: 15, marginBottom: 16, fontWeight: 700 }}>Live preview</h3>

            <div className="cp-ticket">
              <div className="tlab">Coupon</div>
              <div className="tcode">{previewCode}</div>
              <div className="toff">{offLabel}</div>
              <div className="tcond">{condLabel}</div>
            </div>

            <div className="cp-calc">
              <div className="cp-row">
                <span style={{ color: "var(--muted)" }}>Sample order (₹{fmt(sampleRupees)})</span>
                <span>₹{fmt(sampleRupees)}</span>
              </div>
              <div className="cp-row">
                <span className="g">Discount</span>
                <span className="g">−₹{fmt(discountRupees)}</span>
              </div>
              <div className="cp-total">
                <span style={{ fontWeight: 700 }}>Buyer pays</span>
                <span className="cp-total-val">₹{fmt(finalRupees)}</span>
              </div>
            </div>

            <label className="cp-label">Auto-apply link</label>
            <div className="cp-link-row">
              <span className="cp-link-url">{autoLink}</span>
              <button
                className="cp-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(`https://${autoLink}`).catch(() => {});
                  showToast("Link copied to clipboard.");
                }}
              >
                Copy
              </button>
            </div>
            <p className="cp-hint">Share this anywhere — the coupon auto-applies at checkout.</p>
          </div>

          {/* Stats card */}
          <div className="dx-card cp-stat-card" style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12, fontWeight: 700 }}>Summary</h3>
            <div className="dx-kv">
              <span>Total coupons</span>
              <span className="dx-fw6">{coupons.length}</span>
            </div>
            <div className="dx-kv">
              <span>Active</span>
              <span className="dx-fw6">{activeCoupons.length}</span>
            </div>
            <div className="dx-kv">
              <span>Total uses</span>
              <span className="dx-fw6">{coupons.reduce((s, c) => s + c.used_count, 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Coupon list ── */}
      <h3 className="cp-list-title">Your coupons ({coupons.length})</h3>

      {coupons.length === 0 ? (
        <div className="cp-empty">No coupons yet. Create your first discount code above.</div>
      ) : (
        coupons.map((c) => (
          <div key={c.id}>
            {deleteConfirm === c.id ? (
              <div className="cp-del-confirm">
                <span style={{ flex: 1 }}>Delete <b>{c.code}</b>? This cannot be undone.</span>
                <button className="cp-del-yes" onClick={() => handleDelete(c.id)} disabled={isPending}>
                  {isPending ? "Deleting…" : "Delete"}
                </button>
                <button className="cp-del-no" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              </div>
            ) : (
              <div className="cp-cpn">
                <span className="cd">{c.code}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{fmtDiscount(c)}</div>
                  <div className="cpn-meta">
                    {c.applies_to !== "all" && c.applies_to !== "All products"
                      ? c.applies_to
                      : "All products"}
                    {c.min_order_paise > 0
                      ? ` · Min. ₹${fmt(Math.round(c.min_order_paise / 100))}`
                      : ""}
                    {" · "}expires {fmtExpiry(c.expires_at)}
                  </div>
                </div>
                <div className="cpn-use">
                  <div className="n">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</div>
                  <div className="l">used</div>
                </div>
                <button
                  className={`cp-sw ${c.is_active ? "on" : ""}`}
                  onClick={() => !impersonating && handleToggle(c.id, c.is_active)}
                  title={c.is_active ? "Deactivate" : "Activate"}
                  disabled={impersonating}
                >
                  <i />
                </button>
                {!impersonating && (
                  <button
                    className="cp-del-btn"
                    onClick={() => setDeleteConfirm(c.id)}
                    title="Delete coupon"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}

      {toast && (
        <div className="cp-toast">
          <span className={`d ${toast.ok ? "ok" : "err"}`} />
          {toast.msg}
        </div>
      )}
    </>
  );
}
