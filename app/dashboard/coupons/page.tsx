import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis } from "@/components/dx/ui";
import CouponClient, { type CouponRow } from "./CouponClient";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const { store, impersonating } = await requireDashboardStore();
  const sb = createAdminClient();

  // ── Graceful degradation: coupons table may not exist yet ─────────────────
  let tableExists = false;
  let coupons: CouponRow[] = [];
  let totalUses = 0;
  let activeCouponCount = 0;

  try {
    const { data, error } = await sb
      .from("coupons")
      .select(
        "id, code, discount_type, discount_value, min_order_paise, max_uses, used_count, applies_to, expires_at, is_active, created_at",
      )
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    if (!error) {
      tableExists = true;
      coupons = (data ?? []) as CouponRow[];
      totalUses = coupons.reduce((s, c) => s + (c.used_count ?? 0), 0);
      activeCouponCount = coupons.filter((c) => c.is_active).length;
    }
  } catch {
    // table doesn't exist yet — show migration message
  }

  return (
    <>
      <Phead
        title="Coupons"
        sub="Discount codes that auto-apply across every paid page and checkout."
      />

      {!tableExists ? (
        <MigrationPending subdomain={store.subdomain} />
      ) : (
        <>
          <Kpis
            items={[
              { icon: "tag",   color: "var(--primary)",   label: "Total coupons", value: String(coupons.length) },
              { icon: "eye",   color: "var(--secondary)", label: "Active",        value: String(activeCouponCount) },
              { icon: "bag",   color: "var(--green)",     label: "Total uses",    value: totalUses.toLocaleString("en-IN") },
              { icon: "chart", color: "var(--accent)",    label: "Inactive",      value: String(coupons.length - activeCouponCount) },
            ]}
          />
          <CouponClient
            storeId={store.id}
            subdomain={store.subdomain ?? null}
            initial={coupons}
            impersonating={!!impersonating}
          />
        </>
      )}
    </>
  );
}

// ── Migration-pending banner ────────────────────────────────────────────────

function MigrationPending({ subdomain }: { subdomain: string | null }) {
  return (
    <>
      <style>{`
        .coup-mp-banner {
          background: color-mix(in srgb, var(--accent) 8%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
          border-radius: 14px; padding: 20px 22px; margin-bottom: 18px;
        }
        .coup-mp-banner h3 { font-size: 15px; margin: 0 0 7px; }
        .coup-mp-banner p  { font-size: 13px; color: var(--muted); margin: 0 0 10px; }
        .coup-mp-codebox {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 9px; padding: 10px 14px; font-family: monospace;
          font-size: 13px; color: var(--text); margin: 6px 0;
        }
        .coup-mp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 700px) { .coup-mp-cols { grid-template-columns: 1fr; } }
        .coup-mp-item {
          display: flex; gap: 12px; padding: 12px 14px;
          background: var(--surface2); border-radius: 10px; font-size: 13px; margin-bottom: 10px;
        }
        .coup-mp-item .icon { font-size: 18px; flex: none; }
        .coup-mp-item b { display: block; font-weight: 600; margin-bottom: 2px; }
        .coup-mp-item p { margin: 0; color: var(--muted); font-size: 12.5px; }
      `}</style>

      <div className="coup-mp-banner">
        <h3>Migration required</h3>
        <p>
          The <code>coupons</code> table has not been created yet. Apply the migration below
          and reload — the full coupon builder will appear.
        </p>
        {subdomain && (
          <>
            <p style={{ marginTop: 8, marginBottom: 4 }}>Auto-apply link format (once live):</p>
            <div className="coup-mp-codebox">
              https://{subdomain}.invoxai.io/store?coupon=CODE
            </div>
          </>
        )}
      </div>

      <div className="coup-mp-cols">
        <div>
          <div className="dx-card">
            <h3 style={{ fontSize: 15, marginBottom: 14, fontWeight: 700 }}>Planned features</h3>
            <div className="coup-mp-item">
              <span className="icon">%</span>
              <div><b>Percentage discounts</b><p>SAVE20 → 20% off any order</p></div>
            </div>
            <div className="coup-mp-item">
              <span className="icon">₹</span>
              <div><b>Flat-amount discounts</b><p>FLAT100 → ₹100 off orders above ₹500</p></div>
            </div>
            <div className="coup-mp-item">
              <span className="icon">link</span>
              <div><b>Auto-apply links</b><p>Share a URL that applies the coupon automatically</p></div>
            </div>
            <div className="coup-mp-item">
              <span className="icon">lock</span>
              <div><b>Server-side validation</b><p>Discounts computed server-side; clients cannot bypass them</p></div>
            </div>
          </div>
        </div>

        <div>
          <div className="dx-card">
            <h3 style={{ fontSize: 15, marginBottom: 10, fontWeight: 700 }}>Apply migration</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              Run this command on the server to create the <code>coupons</code> table:
            </p>
            <div className="coup-mp-codebox">
              node scripts/db-apply.mjs supabase/migrations/20260618330000_coupons.sql
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
              After applying, reload this page — the coupon builder will be ready.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
