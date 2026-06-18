import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

export default async function CheckoutPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Real checkout metrics from orders
  const { data: orderRows } = await sb
    .from("orders")
    .select("amount, status, gateway, created_at, paid_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const allOrders = orderRows ?? [];
  const paid = allOrders.filter((o) => o.status === "paid");
  const pending = allOrders.filter((o) => o.status === "created");
  const totalRevenue = paid.reduce((s, o) => s + (o.amount ?? 0), 0);
  const convRate = allOrders.length
    ? `${((paid.length / allOrders.length) * 100).toFixed(1)}%`
    : "0%";

  // Gateway breakdown
  const byGateway: Record<string, { count: number; revenue: number }> = {};
  for (const o of paid) {
    const gw = o.gateway || "unknown";
    byGateway[gw] = byGateway[gw] || { count: 0, revenue: 0 };
    byGateway[gw].count++;
    byGateway[gw].revenue += o.amount ?? 0;
  }

  // Average time to pay (for paid orders that have paid_at)
  const timesToPay = paid
    .filter((o) => o.paid_at && o.created_at)
    .map((o) => (new Date(o.paid_at!).getTime() - new Date(o.created_at).getTime()) / 1000);
  const avgTimeSec = timesToPay.length
    ? Math.round(timesToPay.reduce((s, t) => s + t, 0) / timesToPay.length)
    : null;
  const avgTimeStr = avgTimeSec != null
    ? avgTimeSec < 60
      ? `${avgTimeSec}s`
      : `${Math.round(avgTimeSec / 60)}m`
    : "—";

  // Payment settings page
  const { data: pgPage } = await sb
    .from("pages")
    .select("id")
    .eq("store_id", store.id)
    .eq("page_type", "store")
    .maybeSingle();

  return (
    <>
      <Phead
        title="Checkout"
        sub="Checkout performance and payment configuration."
        action={
          <a href="/dashboard/settings/payments" className="btn ghost" style={{ fontSize: 13 }}>
            Payment gateways →
          </a>
        }
      />

      <Kpis
        items={[
          {
            icon: "bag",
            color: "var(--primary)",
            label: "Started checkout",
            value: allOrders.length.toLocaleString("en-IN"),
          },
          {
            icon: "rupee",
            color: "var(--green)",
            label: "Revenue collected",
            value: inr(totalRevenue),
          },
          {
            icon: "spark",
            color: "var(--secondary)",
            label: "Completion rate",
            value: convRate,
          },
          {
            icon: "chart",
            color: "var(--accent)",
            label: "Avg. time to pay",
            value: avgTimeStr,
          },
        ]}
      />

      <style>{`
        .ck-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 700px) { .ck-grid { grid-template-columns: 1fr; } }
        .ck-gw-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px;
          font-size: 13px; margin-bottom: 8px;
        }
        .ck-gw-row b { text-transform: capitalize; }
        .ck-gw-row span { color: var(--muted); font-size: 12px; }
        .ck-settings-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 0; border-bottom: 1px solid var(--border); font-size: 13px;
        }
        .ck-settings-row:last-child { border-bottom: 0; }
        .ck-settings-row b { font-weight: 600; }
        .ck-settings-row span { color: var(--muted); font-size: 12px; }
        .ck-funnel { display: flex; flex-direction: column; gap: 8px; }
        .ck-funnel-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
        .ck-funnel-label { width: 160px; flex: none; }
        .ck-funnel-track {
          flex: 1; height: 8px; background: var(--surface2);
          border-radius: 99px; overflow: hidden;
        }
        .ck-funnel-fill { height: 100%; border-radius: 99px; }
        .ck-funnel-val { font-weight: 700; font-size: 12.5px; width: 40px; text-align: right; }
        .ck-hint { font-size: 12px; color: var(--muted); margin-top: 6px; }
      `}</style>

      <div className="ck-grid">
        <div>
          <Card title="Checkout funnel">
            <div className="ck-funnel">
              <div className="ck-funnel-row">
                <span className="ck-funnel-label">Started checkout</span>
                <div className="ck-funnel-track">
                  <div
                    className="ck-funnel-fill"
                    style={{ width: "100%", background: "var(--primary)" }}
                  />
                </div>
                <span className="ck-funnel-val">{allOrders.length}</span>
              </div>
              <div className="ck-funnel-row">
                <span className="ck-funnel-label">Pending payment</span>
                <div className="ck-funnel-track">
                  <div
                    className="ck-funnel-fill"
                    style={{
                      width: allOrders.length
                        ? `${Math.max(4, (pending.length / allOrders.length) * 100)}%`
                        : "0%",
                      background: "var(--secondary)",
                    }}
                  />
                </div>
                <span className="ck-funnel-val">{pending.length}</span>
              </div>
              <div className="ck-funnel-row">
                <span className="ck-funnel-label">Completed (paid)</span>
                <div className="ck-funnel-track">
                  <div
                    className="ck-funnel-fill"
                    style={{
                      width: allOrders.length
                        ? `${Math.max(4, (paid.length / allOrders.length) * 100)}%`
                        : "0%",
                      background: "var(--green)",
                    }}
                  />
                </div>
                <span className="ck-funnel-val">{paid.length}</span>
              </div>
            </div>
            <p className="ck-hint">
              Completion rate: <strong>{convRate}</strong>
              {pending.length > 0 && (
                <> · <a href="/dashboard/abandoned" style={{ color: "var(--primary)" }}>{pending.length} abandoned →</a></>
              )}
            </p>
          </Card>

          <div style={{ height: 14 }} />

          <Card title="Payment gateways used">
            {Object.keys(byGateway).length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>
                No paid orders yet.{" "}
                <a href="/dashboard/settings/payments" style={{ color: "var(--primary)" }}>
                  Configure gateways →
                </a>
              </div>
            ) : (
              Object.entries(byGateway)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([gw, stats]) => (
                  <div key={gw} className="ck-gw-row">
                    <div>
                      <b>{gw}</b>
                      <span style={{ display: "block" }}>{stats.count} orders</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <b style={{ fontSize: 14, fontWeight: 700 }}>{inr(stats.revenue)}</b>
                      <span style={{ display: "block", fontSize: 11 }}>revenue</span>
                    </div>
                  </div>
                ))
            )}
            <a
              href="/dashboard/settings/payments"
              className="dx-editbtn"
              style={{ display: "inline-block", marginTop: 10 }}
            >
              Manage payment gateways →
            </a>
          </Card>
        </div>

        <div>
          <Card title="Checkout settings">
            <div className="ck-settings-row">
              <div>
                <b>Coupon field</b>
                <span style={{ display: "block" }}>Allow discount codes at checkout</span>
              </div>
              <Tag kind="neu">Coming soon</Tag>
            </div>
            <div className="ck-settings-row">
              <div>
                <b>Order bump / upsell</b>
                <span style={{ display: "block" }}>
                  Add bump offers on checkout page
                </span>
              </div>
              <a href="/dashboard/upsell" style={{ color: "var(--primary)", fontSize: 13 }}>
                Manage →
              </a>
            </div>
            <div className="ck-settings-row">
              <div>
                <b>Buyer fields</b>
                <span style={{ display: "block" }}>Name, email, phone — always collected</span>
              </div>
              <Tag kind="paid">Active</Tag>
            </div>
            <div className="ck-settings-row">
              <div>
                <b>Ad pixels at checkout</b>
                <span style={{ display: "block" }}>
                  Fire InitiateCheckout + Purchase events
                </span>
              </div>
              <a href="/dashboard/seo" style={{ color: "var(--primary)", fontSize: 13 }}>
                Configure →
              </a>
            </div>
            <div className="ck-settings-row">
              <div>
                <b>Thank-you page</b>
                <span style={{ display: "block" }}>Post-payment confirmation</span>
              </div>
              <Tag kind="paid">Active</Tag>
            </div>
          </Card>

          <div style={{ height: 14 }} />

          <Card title="Checkout URL pattern">
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
              Checkout pages are at:
            </p>
            <div
              style={{
                background: "var(--surface2)",
                borderRadius: 8,
                padding: "9px 12px",
                fontFamily: "monospace",
                fontSize: 12.5,
                marginBottom: 8,
              }}
            >
              {store.subdomain
                ? `${store.subdomain}.invoxai.io/opp/{page-id}/checkout`
                : "/opp/{page-id}/checkout"}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Each one-page product has its own checkout. Store product checkout is embedded inline on the store page.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
