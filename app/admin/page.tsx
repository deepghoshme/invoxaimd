import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis, Card, AreaChart, Tag } from "@/components/dx/ui";
import { getPlanMrr } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const inr = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

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
    { data: walletAll },
    { data: allOrders12m },
    { data: storeRows },
    { data: plans },
    planMrrData,
    // plan_payments: all rows for KPI sum + recent 5 for mini feed
    { data: allPlanPayments },
    { data: recentPlanPayments },
    // wallet recharges: recent 5 for mini feed
    { data: recentRecharges },
  ] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }),
    sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "seller"),
    sb.from("stores").select("*", { count: "exact", head: true }),
    sb.from("pages").select("*", { count: "exact", head: true }).eq("status", "published"),

    // Paid orders for GMV + commission aggregates
    sb.from("orders").select("amount, commission_amount, paid_at, created_at").eq("status", "paid"),

    // Full wallet ledger for commission + recharge aggregates
    sb.from("wallet_ledger").select("amount, type, reason, created_at"),

    // Orders last 12 months for monthly GMV trend
    sb
      .from("orders")
      .select("amount, commission_amount, status, created_at")
      .gte("created_at", new Date(Date.now() - 365 * 86400 * 1000).toISOString()),

    // Stores created last 12 months for new-stores chart
    sb
      .from("stores")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 365 * 86400 * 1000).toISOString()),

    sb.from("plans").select("id, name, price").eq("is_active", true),

    // Plan MRR from subscriptions table
    getPlanMrr(),

    // All plan_payments for KPI sum (amount only)
    // Source: plan_payments.amount — actual cash charged per confirmed plan purchase
    sb.from("plan_payments").select("amount"),

    // Recent plan payments for mini transactions feed
    sb
      .from("plan_payments")
      .select("id, amount, created_at, store:stores(store_name), plan:plans(name)")
      .order("created_at", { ascending: false })
      .limit(5),

    // Recent wallet recharges for mini transactions feed
    sb
      .from("wallet_ledger")
      .select("id, amount, reason, created_at, store:stores(store_name)")
      .eq("type", "credit")
      .in("reason", ["recharge", "recharge_bonus"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  /* ── aggregates ─────────────────────────────────────────────────────────── */

  // Source: orders.amount WHERE status='paid' → GMV
  const gmv = (paidOrders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);

  // Source: orders.commission_amount WHERE status='paid' (snapshot column)
  const commissionFromOrders = (paidOrders ?? []).reduce(
    (s, o) => s + (o.commission_amount ?? 0),
    0
  );

  // Source: wallet_ledger.amount WHERE type='debit' (authoritative)
  const walletDebits = (walletAll ?? [])
    .filter((r) => r.type === "debit")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  const commission = Math.max(commissionFromOrders, walletDebits);

  // Source: wallet_ledger.amount WHERE type='credit' AND reason='recharge'
  const walletRechargePaid = (walletAll ?? [])
    .filter((r) => r.type === "credit" && r.reason === "recharge")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  // Source: plan_payments.amount — all rows, actual charged amounts (paise)
  const planRevenueTotal = (allPlanPayments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const planPaymentCount = (allPlanPayments ?? []).length;

  const totalPaidOrders = (paidOrders ?? []).length;

  /* ── plan MRR ────────────────────────────────────────────────────────────── */
  const planMrr = planMrrData.mrrPaise;
  const activeSubCount = planMrrData.activeCount;
  const planNames = (plans ?? []).map((p) => p.name).join(", ");

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
      const od = new Date(o.created_at as string);
      return od.getFullYear() === yr && od.getMonth() === mo;
    });
    monthGmv.push(monthPaidOrders.reduce((s, o) => s + (o.amount ?? 0), 0));

    const monthStoreCount = (storeRows ?? []).filter((s) => {
      const sd = new Date(s.created_at as string);
      return sd.getFullYear() === yr && sd.getMonth() === mo;
    }).length;
    monthSellerCounts.push(monthStoreCount);
  }

  const curMonthGmv = monthGmv[monthGmv.length - 1] ?? 0;
  const prevMonthGmv = monthGmv[monthGmv.length - 2] ?? 0;
  const gmvDelta =
    prevMonthGmv > 0
      ? `${curMonthGmv >= prevMonthGmv ? "▲" : "▼"} ${Math.abs(Math.round(((curMonthGmv - prevMonthGmv) / prevMonthGmv) * 100))}% vs last month`
      : totalPaidOrders > 0
      ? `${totalPaidOrders} paid orders`
      : undefined;

  const curMonthSellers = monthSellerCounts[monthSellerCounts.length - 1] ?? 0;
  const sellerDelta = curMonthSellers > 0 ? `+${curMonthSellers} this month` : undefined;

  /* ── platform revenue total ──────────────────────────────────────────────── */
  const totalRevenue = commission + planRevenueTotal;

  /* ── mini transactions feed (merged, newest 5 overall) ───────────────────── */
  type MiniTx = {
    date: string;
    type: "Plan" | "Recharge" | "Bonus";
    storeName: string;
    amount: number;
    desc: string;
  };

  const planMiniRows: MiniTx[] = (recentPlanPayments ?? []).map((p) => {
    const store = p.store as { store_name?: string | null } | null;
    const plan = p.plan as { name?: string | null } | null;
    const pn = Array.isArray(plan) ? (plan[0] as { name?: string | null })?.name : (plan as { name?: string | null } | null)?.name;
    return {
      date: p.created_at as string,
      type: "Plan",
      storeName: store?.store_name ?? "—",
      amount: Number(p.amount),
      desc: pn ? `${pn} plan` : "Plan subscription",
    };
  });

  const rechargeMiniRows: MiniTx[] = (recentRecharges ?? []).map((w) => {
    const store = w.store as { store_name?: string | null } | null;
    const reason = w.reason as string | null;
    return {
      date: w.created_at as string,
      type: reason === "recharge_bonus" ? "Bonus" : "Recharge",
      storeName: store?.store_name ?? "—",
      amount: Number(w.amount),
      desc: reason === "recharge_bonus" ? "Recharge bonus" : "Wallet top-up",
    };
  });

  const miniTx = [...planMiniRows, ...rechargeMiniRows]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

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
        .ov-mini-tx { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--border); font-size: 13px; }
        .ov-mini-tx:first-child { border-top: 0; }
        .ov-mini-tx .td { color: var(--muted); font-size: 11px; white-space: nowrap; }
        .ov-mini-tx .ts { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ov-mini-tx .ta { font-weight: 700; font-family: var(--font-sora, Sora, sans-serif); margin-left: auto; white-space: nowrap; }
        @media (max-width: 480px) { .ov-stat-grid { grid-template-columns: 1fr; } }
      `}</style>

      <Phead
        title="Platform overview"
        sub="Real-time aggregates across all sellers, buyers and orders."
      />

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <Kpis
        items={[
          {
            icon: "rupee",
            color: "var(--primary)",
            label: "Platform revenue",
            value: totalRevenue > 0 ? inr(totalRevenue) : "₹0",
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
            icon: "tag",
            color: "var(--gold)",
            label: "Plan purchases",
            value: planRevenueTotal > 0 ? inr(planRevenueTotal) : "₹0",
            delta: planPaymentCount > 0
              ? `${planPaymentCount} payment${planPaymentCount === 1 ? "" : "s"}`
              : "No plan purchases yet",
          },
          {
            icon: "wallet",
            color: "var(--accent)",
            label: "Wallet recharge inflow",
            value: walletRechargePaid > 0 ? inr(walletRechargePaid) : "₹0",
          },
        ]}
      />

      {/* ── Main two-column grid ──────────────────────────────────────────── */}
      <div className="dx-grid dx-cols">

        {/* Left: Monthly GMV area chart */}
        <Card title="Monthly GMV trend" link="Last 6 months">
          {monthGmv.every((v) => v === 0) ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <AreaChart />
              <p className="dx-muted" style={{ fontSize: 12, marginTop: 8 }}>
                No paid orders yet — chart populates as sales come in.
              </p>
            </div>
          ) : (
            <>
              <AreaChart points={monthGmv} money />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                {monthLabels.map((l) => (
                  <span
                    key={l}
                    style={{ fontSize: 10.5, color: "var(--muted)", flex: 1, textAlign: "center" }}
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

          {/* Platform at a glance */}
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
            <div style={{ marginTop: 12 }}>
              <div className="dx-kv">
                <span>Commission collected</span>
                <span className="dx-fw6">{commission > 0 ? inr(commission) : "₹0"}</span>
              </div>
              <div className="dx-kv">
                <span>GMV (all time)</span>
                <span className="dx-fw6">{gmv > 0 ? inr(gmv) : "₹0"}</span>
              </div>
              <div className="dx-kv">
                <span>Plan revenue collected</span>
                <span className="dx-fw6" style={{ color: planRevenueTotal > 0 ? "var(--primary)" : undefined }}>
                  {planRevenueTotal > 0 ? inr(planRevenueTotal) : "₹0"}
                </span>
              </div>
              <div className="dx-kv">
                <span>Wallet recharge inflow</span>
                <span className="dx-fw6">{walletRechargePaid > 0 ? inr(walletRechargePaid) : "₹0"}</span>
              </div>
            </div>
          </Card>

          {/* New stores per month */}
          <Card title="New stores per month" link="Last 6 months">
            {monthSellerCounts.every((v) => v === 0) ? (
              <p className="dx-muted" style={{ fontSize: 12.5 }}>
                No new stores registered in the last 6 months.
              </p>
            ) : (
              <BarChart points={monthSellerCounts} labels={monthLabels} />
            )}
          </Card>
        </div>
      </div>

      {/* ── Revenue streams ───────────────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <Card title="Revenue streams">
          <p className="dx-muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Only streams with live data sources shown. Active plan{planNames ? `s: ${planNames}` : "s: none"}.
            {activeSubCount > 0 && ` ${activeSubCount} active subscription${activeSubCount === 1 ? "" : "s"}.`}
          </p>

          <div className="ov-stream">
            <span className="sk" style={{ background: commission > 0 ? "var(--secondary)" : "var(--border)" }} />
            <div>
              <div className="nm">Per-sale commission</div>
              <div className="ds">Deducted from seller wallet on each completed sale</div>
            </div>
            <span className="amt" style={{ color: commission > 0 ? "var(--text)" : "var(--muted)" }}>
              {commission > 0 ? inr(commission) : "₹0"}
            </span>
          </div>

          <div className="ov-stream">
            <span className="sk" style={{ background: planRevenueTotal > 0 ? "var(--primary)" : "var(--border)" }} />
            <div>
              <div className="nm" style={{ opacity: planRevenueTotal > 0 ? 1 : 0.6 }}>
                Plan subscriptions — cash collected
              </div>
              <div className="ds">
                {planPaymentCount > 0
                  ? `${planPaymentCount} payment${planPaymentCount === 1 ? "" : "s"}`
                  : "No plan purchases yet"}
              </div>
            </div>
            <span className="amt" style={{ color: planRevenueTotal > 0 ? "var(--text)" : "var(--muted)" }}>
              {planRevenueTotal > 0 ? inr(planRevenueTotal) : "₹0"}
            </span>
          </div>

          <div className="ov-stream">
            <span className="sk" style={{ background: planMrr > 0 ? "var(--gold)" : "var(--border)" }} />
            <div>
              <div className="nm" style={{ opacity: planMrr > 0 ? 1 : 0.6 }}>
                Plan MRR (active subscriptions)
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
              <div className="nm" style={{ opacity: 0.6 }}>Contact overage & add-ons</div>
              <div className="ds">₹10/extra contact, domain add-ons — not yet tracked</div>
            </div>
            <span className="amt muted">— (coming soon)</span>
          </div>
        </Card>
      </div>

      {/* ── Recent transactions mini-feed ─────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <Card title="Recent transactions" link="See all → /admin/revenue">
          {miniTx.length === 0 ? (
            <p className="dx-muted" style={{ fontSize: 12.5 }}>
              No transactions yet. Plan purchases and wallet recharges will appear here.
            </p>
          ) : (
            miniTx.map((tx, i) => (
              <div key={i} className="ov-mini-tx">
                <span className="td">{fmtDate(tx.date)}</span>
                {tx.type === "Plan" ? (
                  <Tag kind="paid">Plan</Tag>
                ) : tx.type === "Bonus" ? (
                  <Tag kind="neu">Bonus</Tag>
                ) : (
                  <Tag kind="pend">Recharge</Tag>
                )}
                <span className="ts">{tx.storeName} · {tx.desc}</span>
                <span className="ta">{inr(tx.amount)}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
