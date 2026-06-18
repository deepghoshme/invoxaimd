import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Card } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Check if coupons table exists
  let tableExists = false;
  type CouponRow = {
    id: string;
    code: string;
    type: string;
    value: number;
    min_order_amount: number | null;
    max_uses: number | null;
    used_count: number;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
  };
  let coupons: CouponRow[] = [];

  try {
    const { data, error } = await sb
      .from("coupons")
      .select("id, code, type, value, min_order_amount, max_uses, used_count, expires_at, is_active, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    if (!error) {
      tableExists = true;
      coupons = (data ?? []) as CouponRow[];
    }
  } catch {}

  const activeCoupons = coupons.filter((c) => c.is_active);
  const subdomain = store.subdomain;

  return (
    <>
      <Phead
        title="Coupons"
        sub="Discount codes and auto-apply links for your store."
        action={
          tableExists ? (
            <button className="btn grad" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
              + New coupon (coming soon)
            </button>
          ) : undefined
        }
      />

      <style>{`
        .coup-banner {
          background: color-mix(in srgb, var(--accent) 8%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
          border-radius: 14px; padding: 20px 22px; margin-bottom: 18px;
        }
        .coup-banner h3 { font-size: 15px; margin: 0 0 7px; }
        .coup-banner p { font-size: 13px; color: var(--muted); margin: 0 0 10px; }
        .coup-codebox {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 9px; padding: 10px 14px; font-family: monospace;
          font-size: 13px; color: var(--text); margin: 6px 0;
        }
        .coup-table { width: 100%; border-collapse: collapse; }
        .coup-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .coup-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .coup-table tr:last-child td { border-bottom: 0; }
        .coup-badge {
          display: inline-block; padding: 3px 10px; border-radius: 99px;
          font-size: 11.5px; font-weight: 700;
        }
        .coup-badge.active { background: var(--greenbg); color: var(--green); }
        .coup-badge.inactive { background: var(--surface2); color: var(--muted); }
        .coup-empty { text-align: center; padding: 48px 24px; color: var(--muted); font-size: 13.5px; }
        .coup-roadmap {
          display: flex; flex-direction: column; gap: 10px; margin-top: 8px;
        }
        .coup-roadmap-item {
          display: flex; gap: 12px; padding: 12px 14px;
          background: var(--surface2); border-radius: 10px; font-size: 13px;
        }
        .coup-roadmap-item .icon { font-size: 18px; flex: none; }
        .coup-roadmap-item b { display: block; font-weight: 600; margin-bottom: 2px; }
        .coup-roadmap-item p { margin: 0; color: var(--muted); font-size: 12.5px; }
      `}</style>

      {!tableExists ? (
        <>
          <div className="coup-banner">
            <h3>Coupons — coming soon</h3>
            <p>
              The <code>coupons</code> table has not been created yet. Once the coupon migration is applied,
              you will be able to create percentage or fixed-amount discount codes and auto-apply links.
            </p>
            {subdomain && (
              <>
                <p style={{ marginTop: 8, marginBottom: 4 }}>Auto-apply link format (once live):</p>
                <div className="coup-codebox">
                  https://{subdomain}.invoxai.io/store?coupon=CODE
                </div>
              </>
            )}
          </div>

          <div className="dx-grid dx-cols">
            <div>
              <Card title="Planned coupon features">
                <div className="coup-roadmap">
                  <div className="coup-roadmap-item">
                    <span className="icon">%</span>
                    <div>
                      <b>Percentage discounts</b>
                      <p>E.g. SAVE20 → 20% off any order</p>
                    </div>
                  </div>
                  <div className="coup-roadmap-item">
                    <span className="icon">₹</span>
                    <div>
                      <b>Fixed-amount discounts</b>
                      <p>E.g. FLAT100 → ₹100 off orders above ₹500</p>
                    </div>
                  </div>
                  <div className="coup-roadmap-item">
                    <span className="icon">🔗</span>
                    <div>
                      <b>Auto-apply links</b>
                      <p>Share a URL that auto-applies the coupon at checkout</p>
                    </div>
                  </div>
                  <div className="coup-roadmap-item">
                    <span className="icon">🎯</span>
                    <div>
                      <b>Usage limits</b>
                      <p>Set max uses per coupon or per customer</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <Card title="How to apply the migration">
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                  Run the following command to create the <code>coupons</code> table:
                </p>
                <div className="coup-codebox">
                  node scripts/db-apply.mjs supabase/migrations/YYYYMMDDXXXXXX_coupons.sql
                </div>
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                  After applying, reload this page and the coupon creation form will be available.
                </p>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <div className="dx-grid dx-cols">
          <div>
            <Card title={`Your coupons (${coupons.length})`}>
              {coupons.length === 0 ? (
                <div className="coup-empty">
                  No coupons yet. Create your first discount code to boost conversions.
                </div>
              ) : (
                <table className="coup-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Min order</th>
                      <th>Used</th>
                      <th>Expires</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <code style={{ fontWeight: 700, fontSize: 13.5 }}>{c.code}</code>
                        </td>
                        <td style={{ textTransform: "capitalize" }}>{c.type}</td>
                        <td>
                          {c.type === "percent"
                            ? `${c.value}%`
                            : `₹${Math.round(c.value / 100).toLocaleString("en-IN")}`}
                        </td>
                        <td>
                          {c.min_order_amount
                            ? `₹${Math.round(c.min_order_amount / 100).toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                        <td>
                          {c.used_count}
                          {c.max_uses ? ` / ${c.max_uses}` : ""}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>
                          {c.expires_at
                            ? new Date(c.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                            : "Never"}
                        </td>
                        <td>
                          <span className={`coup-badge ${c.is_active ? "active" : "inactive"}`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <div>
            <Card title="Active coupons">
              <div className="dx-kv">
                <span>Active</span>
                <span className="dx-fw6">{activeCoupons.length}</span>
              </div>
              <div className="dx-kv">
                <span>Total uses</span>
                <span className="dx-fw6">
                  {coupons.reduce((s, c) => s + c.used_count, 0)}
                </span>
              </div>
              {subdomain && (
                <>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "12px 0 6px" }}>
                    Auto-apply link format:
                  </p>
                  <div className="coup-codebox">
                    {subdomain}.invoxai.io/store?coupon=CODE
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
