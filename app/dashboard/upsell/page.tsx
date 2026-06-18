import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

export default async function UpsellPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Check if upsell_offers table exists; if so, load real data
  let tableExists = false;
  type UpsellOffer = {
    id: string;
    trigger_product_id: string | null;
    offer_product_id: string | null;
    offer_title: string | null;
    discount_pct: number | null;
    conversions: number;
    revenue_paise: number;
    is_active: boolean;
    created_at: string;
  };
  let offers: UpsellOffer[] = [];

  try {
    const { data, error } = await sb
      .from("upsell_offers")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    if (!error) {
      tableExists = true;
      offers = (data ?? []) as UpsellOffer[];
    }
  } catch {}

  // Real analytics: what's the order bump rate from existing orders?
  const { data: paidOrders } = await sb
    .from("orders")
    .select("amount, product_title")
    .eq("store_id", store.id)
    .eq("status", "paid");
  const paidCount = (paidOrders ?? []).length;
  const totalRevenue = (paidOrders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
  const avgOrder = paidCount ? Math.round(totalRevenue / paidCount) : 0;

  // Load store products for the upsell trigger picker
  const { data: products } = await sb
    .from("products")
    .select("id, name, price")
    .eq("store_id", store.id)
    .eq("store_visible", true)
    .order("sort", { ascending: true })
    .limit(20);

  const totalUpsellRevenue = offers.reduce((s, o) => s + (o.revenue_paise ?? 0), 0);
  const totalConversions = offers.reduce((s, o) => s + (o.conversions ?? 0), 0);

  return (
    <>
      <Phead
        title="Upsell"
        sub="Offer order bumps and post-purchase upsells at checkout."
      />

      <Kpis
        items={[
          {
            icon: "up",
            color: "var(--primary)",
            label: "Upsell offers",
            value: tableExists ? String(offers.length) : "—",
          },
          {
            icon: "rupee",
            color: "var(--green)",
            label: "Upsell revenue",
            value: tableExists ? inr(totalUpsellRevenue) : "—",
          },
          {
            icon: "bag",
            color: "var(--secondary)",
            label: "Paid orders",
            value: paidCount.toLocaleString("en-IN"),
          },
          {
            icon: "chart",
            color: "var(--accent)",
            label: "Avg. order value",
            value: inr(avgOrder),
          },
        ]}
      />

      <style>{`
        .up-table { width: 100%; border-collapse: collapse; }
        .up-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .up-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .up-table tr:last-child td { border-bottom: 0; }
        .up-empty { text-align: center; padding: 40px; color: var(--muted); font-size: 13.5px; }
        .up-coming {
          background: color-mix(in srgb, var(--primary) 7%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
          border-radius: 14px; padding: 20px; margin-bottom: 16px;
        }
        .up-coming h3 { font-size: 15px; margin: 0 0 7px; }
        .up-coming p { font-size: 13px; color: var(--muted); margin: 0 0 10px; }
        .up-feature { display: flex; flex-direction: column; gap: 9px; margin-top: 8px; }
        .up-feat-item {
          display: flex; gap: 10px; padding: 10px 12px;
          background: var(--surface2); border-radius: 9px; font-size: 13px;
        }
        .up-feat-item .ic { font-size: 17px; flex: none; }
        .up-feat-item b { display: block; margin-bottom: 2px; }
        .up-feat-item p { margin: 0; color: var(--muted); font-size: 12px; }
        .up-products { display: flex; flex-direction: column; gap: 8px; }
        .up-prod-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border: 1px solid var(--border);
          border-radius: 10px; font-size: 13px;
        }
        .up-prod-row b { flex: 1; }
      `}</style>

      {!tableExists ? (
        <div className="dx-grid dx-cols">
          <div>
            <div className="up-coming">
              <h3>Upsell offers — coming soon</h3>
              <p>
                The <code>upsell_offers</code> table has not been created yet. Once the migration is
                applied, you can add order bumps and post-checkout upsells to maximise your revenue
                per order.
              </p>
            </div>

            <Card title="Planned upsell types">
              <div className="up-feature">
                <div className="up-feat-item">
                  <span className="ic">⬆️</span>
                  <div>
                    <b>Order bump</b>
                    <p>Add a small checkbox offer on the checkout page (e.g. "+₹299 — add the workbook")</p>
                  </div>
                </div>
                <div className="up-feat-item">
                  <span className="ic">🎁</span>
                  <div>
                    <b>Post-purchase upsell</b>
                    <p>Show a one-click offer on the thank-you page after a successful payment</p>
                  </div>
                </div>
                <div className="up-feat-item">
                  <span className="ic">📦</span>
                  <div>
                    <b>Bundle discount</b>
                    <p>Offer "buy X + Y together for ₹Z" at a discount from combined price</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <Card title="Your products (available for upsell)">
              {(products ?? []).length === 0 ? (
                <div className="up-empty">
                  No store products yet.{" "}
                  <a href="/dashboard/store" style={{ color: "var(--primary)" }}>
                    Add products →
                  </a>
                </div>
              ) : (
                <div className="up-products">
                  {(products ?? []).map((p) => (
                    <div key={p.id} className="up-prod-row">
                      <b>{(p.name as string) || "Untitled"}</b>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>
                        {p.price != null ? inr(Number(p.price) * 100) : "—"}
                      </span>
                    </div>
                  ))}
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                    These products will be selectable as upsell triggers and offers once the feature is live.
                  </p>
                </div>
              )}
            </Card>

            <div style={{ height: 14 }} />
            <Card title="Revenue potential">
              <div className="dx-kv">
                <span>Paid orders (lifetime)</span>
                <span className="dx-fw6">{paidCount}</span>
              </div>
              <div className="dx-kv">
                <span>Avg. order value</span>
                <span className="dx-fw6">{inr(avgOrder)}</span>
              </div>
              <div className="dx-kv">
                <span>10% upsell attach rate</span>
                <span className="dx-fw6" style={{ color: "var(--green)" }}>
                  +{inr(Math.round(avgOrder * 0.3 * paidCount))} potential
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Assuming a ₹{Math.round(avgOrder / 100 * 0.3).toLocaleString("en-IN")} order bump at 10% attach.
              </p>
            </Card>
          </div>
        </div>
      ) : (
        <div className="dx-grid dx-cols">
          <div>
            <Card title={`Upsell offers (${offers.length})`}>
              {offers.length === 0 ? (
                <div className="up-empty">
                  No upsell offers yet. Create your first to add order bumps at checkout.
                </div>
              ) : (
                <table className="up-table">
                  <thead>
                    <tr>
                      <th>Offer</th>
                      <th>Discount</th>
                      <th>Conversions</th>
                      <th>Revenue</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>{o.offer_title || "Untitled"}</td>
                        <td>{o.discount_pct != null ? `${o.discount_pct}%` : "—"}</td>
                        <td>{o.conversions}</td>
                        <td>{inr(o.revenue_paise)}</td>
                        <td>
                          <span
                            style={{
                              background: o.is_active ? "var(--greenbg)" : "var(--surface2)",
                              color: o.is_active ? "var(--green)" : "var(--muted)",
                              padding: "3px 9px",
                              borderRadius: 99,
                              fontSize: 11.5,
                              fontWeight: 700,
                            }}
                          >
                            {o.is_active ? "Active" : "Inactive"}
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
            <Card title="Summary">
              <div className="dx-kv">
                <span>Total upsell revenue</span>
                <span className="dx-fw6">{inr(totalUpsellRevenue)}</span>
              </div>
              <div className="dx-kv">
                <span>Total conversions</span>
                <span className="dx-fw6">{totalConversions}</span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
