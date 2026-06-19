import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis, Card, AreaChart } from "@/components/dx/ui";
import { getPlanMrr } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const inr = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

function BarChart({
  points,
  labels,
  color = "var(--grad)",
  dimColor = "var(--surface2)",
}: {
  points: number[];
  labels: string[];
  color?: string;
  dimColor?: string;
}) {
  const max = Math.max(...points, 1);
  const lastIdx = points.length - 1;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        height: 120,
        paddingTop: 8,
      }}
    >
      {points.map((v, i) => {
        const h = Math.max(4, (v / max) * 100);
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              height: "100%",
              justifyContent: "flex-end",
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text)", minHeight: 13 }}>
              {v > 0 ? v : ""}
            </span>
            <div
              style={{
                width: "100%",
                maxWidth: 32,
                height: `${h}%`,
                borderRadius: "6px 6px 0 0",
                background: i === lastIdx ? color : dimColor,
                transition: "height .3s ease",
              }}
            />
            <span style={{ fontSize: 10.5, color: "var(--muted)", whiteSpace: "nowrap" }}>
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */
export default async function AdminPage() {
  const sb = createAdminClient();

  const [
    { count: totalUsers },
    { count: totalSellers },
    { count: totalStores },
    { count: publishedPages },
    { data: paidOrders },
    { data: walletLedger },
    { data: allOrders12m },
    { data: storeRows },
    { data: plans },
    planMrrData,
  ] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }),
    sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "seller"),
    sb.from("stores").select("*", { count: "exact", head: true }),
    sb.from("pages").select("*", { count: "exact", head: true }).eq("status", "published"),
    sb.from("orders").select("amount, commission_amount, paid_at, created_at").eq("status", "paid"),
    sb.from("wallet_ledger").select("amount, type, created_at"),
    sb
      .from("orders")
      .select("amount, commission_amount, status, created_at")
      .gte("created_at", new Date(Date.now() - 365 * 86400 * 1000).toISOString()),
    sb
      .from("stores")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 365 * 86400 * 1000).toISOString()),
    sb.from("plans").select("id, name, price").eq("is_active", true),
    // plan MRR from subscriptions table (degrades to 0 if table not applied)
    getPlanMrr(),
  ]);

  /* ── aggregates ─────────────────────────────────────────────────────────── */
  const gmv = (paidOrders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
  const commissionFromOrders = (paidOrders ?? []).reduce(
    (s, o) => s + (o.commission_amount ?? 0),
    0
  );
  const walletDebits = (walletLedger ?? [])
    .filter((r) => r.type === "debit")
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const commission = Math.max(commissionFromOrders, walletDebits);

  const totalPaidOrders = (paidOrders ?? []).length;

  /* ── 6-month GMV trend ───────────────────────────────────────────────────── */
  const now = new Date();
  const monthLabels: string[] = [];
  const monthGmv: number[] = [];
  const monthSellerCounts: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    monthLabels.push(d.toLocaleString("default", { month: "short" }));

    const monthPaidOrders = (allOrders12m ?? []).filter((o) => {
      if (o.status !== "paid") return false;
      const od = new Date(o.created_at);
      return od.getFullYear() === yr && od.getMonth() === mo;
    });
    monthGmv.push(monthPaidOrders.reduce((s, o) => s + (o.amount ?? 0), 0));

    const monthStoreCount = (storeRows ?? []).filter((s) => {
      const sd = new Date(s.created_at);
      return sd.getFullYear() === yr && sd.getMonth() === mo;
    }).length;
    monthSellerCounts.push(monthStoreCount);
  }

  /* ── KPI deltas ─────────────────────────────────────────────────────────── */
  // Compare current month vs previous month
  const curMonthGmv = monthGmv[monthGmv.length - 1] ?? 0;
  const prevMonthGmv = monthGmv[monthGmv.length - 2] ?? 0;
  const gmvDelta =
    prevMonthGmv > 0
      ? `${curMonthGmv >= prevMonthGmv ? "▲" : "▼"} ${Math.abs(Math.round(((curMonthGmv - prevMonthGmv) / prevMonthGmv) * 100))}% vs last month`
      : totalPaidOrders > 0
      ? `${totalPaidOrders} paid orders`
      : undefined;

  const curMonthSellers = monthSellerCounts[monthSellerCounts.length - 1] ?? 0;
  const sellerDelta =
    curMonthSellers > 0 ? `+${curMonthSellers} this month` : undefined;

  /* ── plan MRR from subscriptions ─────────────────────────────────────────── */
  const planMrr = planMrrData.mrrPaise;
  const activeSubCount = planMrrData.activeCount;
  const planNames = (plans ?? []).map((p) => p.name).join(", ");

  /* ── platform summary rows ──────────────────────────────────────────────── */
  const summaryRows: [string, string][] = [
    ["Total stores", String(totalStores ?? 0)],
    ["Sellers", String(totalSellers ?? 0)],
    ["Total users", String(totalUsers ?? 0)],
    ["Published pages", String(publishedPages ?? 0)],
    ["Paid orders (all time)", String(totalPaidOrders)],
    ["Commission collected", commission > 0 ? inr(commission) : "₹0"],
    ["GMV (all time)", gmv > 0 ? inr(gmv) : "₹0"],
  ];

  return (
    <>
      <style>{`
        .ov-stream { display: flex; align-items: center; gap: 11px; padding: 11px 0; border-top: 1px solid var(--border); }
        .ov-stream:first-child { border-top: 0; }
        .ov-stream .sk { width: 10px; height: 28px; border-radius: 4px; flex: none; }
        .ov-stream .nm { font-weight: 600; font-size: 13px; }
        .ov-stream .ds { font-size: 11.5px; color: var(--muted); }
        .ov-stream .amt { margin-left: auto; font-weight: 700; font-family: var(--font-sora, Sora, sans-serif); font-size: 13px; white-space: nowrap; }
        .ov-stream .amt.muted { color: var(--muted); }
        .ov-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
        .ov-stat { background: var(--surface2); border-radius: 10px; padding: 10px 12px; }
        .ov-stat .sl { font-size: 11.5px; color: var(--muted); margin-bottom: 3px; }
        .ov-stat .sv { font-family: var(--font-sora, Sora, sans-serif); font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
        @media (max-width: 480px) { .ov-stat-grid { grid-template-columns: 1fr; } }
      `}</style>

      <Phead
        title="Platform overview"
        sub="Real-time aggregates across all sellers, buyers and orders."
      />

      {/* KPIs */}
      <Kpis
        items={[
          {
            icon: "rupee",
            color: "var(--primary)",
            label: "GMV (paid orders)",
            value: gmv > 0 ? inr(gmv) : "₹0",
            delta: gmvDelta,
          },
          {
            icon: "users",
            color: "var(--secondary)",
            label: "Sellers",
            value: String(totalSellers ?? 0),
            delta: sellerDelta,
          },
          {
            icon: "user",
            color: "var(--accent)",
            label: "Total users",
            value: String(totalUsers ?? 0),
          },
          {
            icon: "wallet",
            color: "var(--gold)",
            label: "Commission collected",
            value: commission > 0 ? inr(commission) : "₹0",
          },
        ]}
      />

      {/* Main two-column grid */}
      <div className="dx-grid dx-cols">

        {/* Left: Monthly GMV area chart */}
        <Card title="Monthly GMV trend" link="Last 6 months">
          {monthGmv.every((v) => v === 0) ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <AreaChart />
              <p className="dx-muted" style={{ fontSize: 12, marginTop: 8 }}>
                No paid orders yet — chart will populate as sales come in.
              </p>
            </div>
          ) : (
            <>
              <AreaChart points={monthGmv} money />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                {monthLabels.map((l) => (
                  <span
                    key={l}
                    style={{
                      fontSize: 10.5,
                      color: "var(--muted)",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Platform summary stat grid */}
          <Card title="Platform at a glance">
            <div className="ov-stat-grid">
              <div className="ov-stat">
                <div className="sl">Stores</div>
                <div className="sv">{totalStores ?? 0}</div>
              </div>
              <div className="ov-stat">
                <div className="sl">Published pages</div>
                <div className="sv">{publishedPages ?? 0}</div>
              </div>
              <div className="ov-stat">
                <div className="sl">Paid orders</div>
                <div className="sv">{totalPaidOrders}</div>
              </div>
              <div className="ov-stat">
                <div className="sl">Total users</div>
                <div className="sv">{totalUsers ?? 0}</div>
              </div>
            </div>

            {/* key-value rows */}
            <div style={{ marginTop: 12 }}>
              {summaryRows.slice(5).map(([k, v]) => (
                <div className="dx-kv" key={k}>
                  <span>{k}</span>
                  <span className="dx-fw6">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* New sellers per month bar chart */}
          <Card title="New stores per month" link="Last 6 months">
            {monthSellerCounts.every((v) => v === 0) ? (
              <p className="dx-muted" style={{ fontSize: 12.5 }}>
                No new stores registered in the last 6 months.
              </p>
            ) : (
              <BarChart
                points={monthSellerCounts}
                labels={monthLabels}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Revenue streams breakdown */}
      <div style={{ marginTop: 16 }}>
        <Card title="Revenue streams">
          <p
            className="dx-muted"
            style={{ fontSize: 12, marginBottom: 12 }}
          >
            Only streams with live data sources are shown as active.
            {planNames && ` Plans: ${planNames}.`}
            {activeSubCount > 0 && ` ${activeSubCount} active subscription${activeSubCount === 1 ? "" : "s"}.`}
          </p>

          <div className="ov-stream">
            <span
              className="sk"
              style={{ background: commission > 0 ? "var(--secondary)" : "var(--border)" }}
            />
            <div>
              <div className="nm">Per-sale commission</div>
              <div className="ds">Deducted from seller wallet on each sale</div>
            </div>
            <span className="amt" style={{ color: commission > 0 ? "var(--text)" : "var(--muted)" }}>
              {commission > 0 ? inr(commission) : "₹0"}
            </span>
          </div>

          <div className="ov-stream">
            <span
              className="sk"
              style={{ background: planMrr > 0 ? "var(--primary)" : "var(--border)" }}
            />
            <div>
              <div className="nm" style={{ opacity: planMrr > 0 ? 1 : 0.6 }}>
                Plan subscriptions (MRR)
              </div>
              <div className="ds">
                {activeSubCount > 0
                  ? `${activeSubCount} active subscription${activeSubCount === 1 ? "" : "s"}`
                  : "No active subscriptions yet"}
              </div>
            </div>
            <span className="amt" style={{ color: planMrr > 0 ? "var(--text)" : "var(--muted)" }}>
              {planMrr > 0 ? inr(planMrr) : "₹0"}
            </span>
          </div>

          <div className="ov-stream">
            <span className="sk" style={{ background: "var(--border)" }} />
            <div>
              <div className="nm" style={{ opacity: 0.6 }}>Premium templates</div>
              <div className="ds">One-time template sales — not yet tracked</div>
            </div>
            <span className="amt muted">— (coming soon)</span>
          </div>

          <div className="ov-stream">
            <span className="sk" style={{ background: "var(--border)" }} />
            <div>
              <div className="nm" style={{ opacity: 0.6 }}>Contact overage</div>
              <div className="ds">₹10 / extra contact — not yet tracked</div>
            </div>
            <span className="amt muted">— (coming soon)</span>
          </div>

          <div className="ov-stream">
            <span className="sk" style={{ background: "var(--border)" }} />
            <div>
              <div className="nm" style={{ opacity: 0.6 }}>Extra domains / add-ons</div>
              <div className="ds">Add-on billing — not yet tracked</div>
            </div>
            <span className="amt muted">— (coming soon)</span>
          </div>
        </Card>
      </div>
    </>
  );
}
