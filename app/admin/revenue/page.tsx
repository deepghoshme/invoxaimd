import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis, Card, AreaChart } from "@/components/dx/ui";
import { getPlanMrr } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const inr = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

function MonthAxisLabels({ labels }: { labels: string[] }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
      {labels.map((l) => (
        <span
          key={l}
          style={{ fontSize: 10.5, color: "var(--muted)", flex: 1, textAlign: "center" }}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

function StreamRow({
  color,
  name,
  desc,
  value,
  real,
}: {
  color: string;
  name: string;
  desc: string;
  value: string;
  real: boolean;
}) {
  return (
    <div className="rv-stream">
      <span className="sk" style={{ background: real ? color : "var(--border)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="nm" style={{ opacity: real ? 1 : 0.55 }}>
          {name}
        </div>
        <div className="ds">{desc}</div>
      </div>
      <span className="amt" style={{ color: real ? "var(--text)" : "var(--muted)" }}>
        {value}
      </span>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */
export default async function RevenueAdminPage() {
  const sb = createAdminClient();

  const [
    { data: paidOrders },
    { data: walletLedger },
    { count: activeSellers },
    { data: plans },
    { data: allPaidOrders12m },
    planMrrData,
  ] = await Promise.all([
    // all paid orders — GMV + commission snapshot
    sb
      .from("orders")
      .select("amount, commission_amount, created_at")
      .eq("status", "paid"),

    // full wallet ledger (credits + debits)
    sb.from("wallet_ledger").select("amount, type, created_at"),

    // active sellers
    sb
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "seller"),

    // active plans (to list them in the breakdown)
    sb.from("plans").select("id, name, price").eq("is_active", true),

    // paid orders last 12 months for monthly trend charts
    sb
      .from("orders")
      .select("amount, commission_amount, created_at")
      .eq("status", "paid")
      .gte("created_at", new Date(Date.now() - 365 * 86400 * 1000).toISOString()),

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
  const walletCredits = (walletLedger ?? [])
    .filter((r) => r.type === "credit")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  // Authoritative commission = max of order snapshot vs wallet debit
  const commission = Math.max(commissionFromOrders, walletDebits);

  // Plan MRR: from subscriptions table (0 if table not yet applied)
  const planMrr = planMrrData.mrrPaise; // paise
  const activeSubCount = planMrrData.activeCount;
  const planSummary =
    (plans ?? []).length > 0
      ? (plans ?? []).map((p) => `${p.name} (${p.price === 0 ? "Free" : inr(p.price * 100) + "/mo"})`).join(", ")
      : "No active plans";

  /* ── total "platform revenue" = commission + plan MRR ────────────────────── */
  // Wallet credits are seller recharges (prepaid commission) — not counted
  // twice since commission itself is the debit side. Plan MRR is additive.
  const totalRevenue = commission + planMrr;

  /* ── 6-month trend: GMV + commission ─────────────────────────────────────── */
  const now = new Date();
  const monthLabels: string[] = [];
  const monthGmvPoints: number[] = [];
  const monthCommPoints: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    monthLabels.push(d.toLocaleString("default", { month: "short" }));

    const monthOrders = (allPaidOrders12m ?? []).filter((o) => {
      const od = new Date(o.created_at);
      return od.getFullYear() === yr && od.getMonth() === mo;
    });
    monthGmvPoints.push(monthOrders.reduce((s, o) => s + (o.amount ?? 0), 0));
    monthCommPoints.push(
      monthOrders.reduce((s, o) => s + (o.commission_amount ?? 0), 0)
    );
  }

  /* ── KPI deltas ─────────────────────────────────────────────────────────── */
  const curMonthGmv = monthGmvPoints[monthGmvPoints.length - 1] ?? 0;
  const prevMonthGmv = monthGmvPoints[monthGmvPoints.length - 2] ?? 0;
  const gmvDelta =
    prevMonthGmv > 0
      ? `${curMonthGmv >= prevMonthGmv ? "▲" : "▼"} ${Math.abs(Math.round(((curMonthGmv - prevMonthGmv) / prevMonthGmv) * 100))}% vs ${monthLabels[monthLabels.length - 2]}`
      : (paidOrders?.length ?? 0) > 0
      ? `${paidOrders?.length} paid orders`
      : undefined;

  const totalPaidOrders = paidOrders?.length ?? 0;
  const avgOrderValue =
    totalPaidOrders > 0 ? Math.round(gmv / totalPaidOrders) : 0;

  return (
    <>
      <style>{`
        .rv-stream { display: flex; align-items: center; gap: 11px; padding: 12px 0; border-top: 1px solid var(--border); }
        .rv-stream:first-child { border-top: 0; }
        .rv-stream .sk { width: 10px; height: 28px; border-radius: 4px; flex: none; }
        .rv-stream .nm { font-weight: 600; font-size: 13px; }
        .rv-stream .ds { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
        .rv-stream .amt { margin-left: auto; font-weight: 700; font-family: var(--font-sora, Sora, sans-serif); font-size: 13px; white-space: nowrap; }
        .rv-divider { border: 0; border-top: 1px solid var(--border); margin: 12px 0 8px; }
        .rv-note { font-size: 11.5px; color: var(--muted); line-height: 1.6; }
        .rv-metric-row { display: flex; gap: 12px; margin-top: 14px; }
        .rv-metric { flex: 1; background: var(--surface2); border-radius: 10px; padding: 10px 12px; }
        .rv-metric .ml { font-size: 11.5px; color: var(--muted); margin-bottom: 2px; }
        .rv-metric .mv { font-family: var(--font-sora, Sora, sans-serif); font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
        @media (max-width: 480px) { .rv-metric-row { flex-direction: column; } }
      `}</style>

      <Phead
        title="Revenue overview"
        sub="All revenue streams across the platform. Real data where available."
        action={
          <button className="btn ghost" style={{ cursor: "default" }}>
            All time
          </button>
        }
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
            color: "var(--accent)",
            label: "Active sellers",
            value: String(activeSellers ?? 0),
          },
          {
            icon: "wallet",
            color: "var(--secondary)",
            label: "Commission collected",
            value: commission > 0 ? inr(commission) : "₹0",
            delta:
              walletCredits > 0
                ? `${inr(walletCredits)} wallet credits`
                : undefined,
          },
          {
            icon: "tag",
            color: "var(--gold)",
            label: "Plan MRR",
            value: planMrr > 0 ? inr(planMrr) : "₹0",
            delta: activeSubCount > 0 ? `${activeSubCount} active subscription${activeSubCount === 1 ? "" : "s"}` : "No active subscriptions yet",
          },
        ]}
      />

      {/* Charts row */}
      <div className="dx-grid dx-cols">

        {/* Monthly GMV chart */}
        <Card title="Monthly GMV" link="Paid orders · 6 months">
          {monthGmvPoints.every((v) => v === 0) ? (
            <>
              <AreaChart />
              <p className="dx-muted" style={{ fontSize: 12, marginTop: 8 }}>
                No paid orders in the last 6 months — chart will populate as orders come in.
              </p>
            </>
          ) : (
            <>
              <AreaChart points={monthGmvPoints} money />
              <MonthAxisLabels labels={monthLabels} />
            </>
          )}

          {/* Supporting metrics */}
          <div className="rv-metric-row">
            <div className="rv-metric">
              <div className="ml">Total orders</div>
              <div className="mv">{totalPaidOrders}</div>
            </div>
            <div className="rv-metric">
              <div className="ml">Avg. order value</div>
              <div className="mv">{avgOrderValue > 0 ? inr(avgOrderValue) : "—"}</div>
            </div>
            <div className="rv-metric">
              <div className="ml">Commission rate (avg)</div>
              <div className="mv">
                {gmv > 0 && commission > 0
                  ? `${((commission / gmv) * 100).toFixed(1)}%`
                  : "—"}
              </div>
            </div>
          </div>
        </Card>

        {/* Revenue streams breakdown */}
        <Card title="6 revenue streams">
          <StreamRow
            color="var(--secondary)"
            name="Per-sale commission"
            desc="Wallet deducted on each sale"
            value={commission > 0 ? inr(commission) : "₹0"}
            real={true}
          />
          <StreamRow
            color="var(--primary)"
            name="Plan subscriptions (MRR)"
            desc={
              activeSubCount > 0
                ? `${activeSubCount} active sub${activeSubCount === 1 ? "" : "s"} · ${planSummary}`
                : planMrr === 0 && activeSubCount === 0
                ? `Plans available: ${planSummary}`
                : planSummary
            }
            value={planMrr > 0 ? inr(planMrr) : "₹0"}
            real={planMrr > 0}
          />
          <StreamRow
            color="var(--accent)"
            name="Wallet recharges (credits)"
            desc="Sellers topping up commission wallet"
            value={walletCredits > 0 ? inr(walletCredits) : "₹0"}
            real={walletCredits > 0}
          />
          <StreamRow
            color="var(--gold)"
            name="Premium templates"
            desc="One-time template marketplace sales"
            value="— (coming soon)"
            real={false}
          />
          <StreamRow
            color="#2ea3a3"
            name="Contact overage"
            desc="₹10 / extra contact beyond plan limit"
            value="— (coming soon)"
            real={false}
          />
          <StreamRow
            color="#9b6b3f"
            name="Extra domains / add-ons"
            desc="Custom domains & misc upgrades"
            value="— (coming soon)"
            real={false}
          />

          <hr className="rv-divider" />
          <p className="rv-note">
            Streams marked "— (coming soon)" have no backing table yet.
            Numbers update live as data flows in.
          </p>
        </Card>
      </div>

      {/* Commission monthly chart — only if there is data */}
      {monthCommPoints.some((v) => v > 0) && (
        <div style={{ marginTop: 16 }}>
          <Card title="Monthly commission (from orders)" link="Last 6 months">
            <AreaChart points={monthCommPoints} money />
            <MonthAxisLabels labels={monthLabels} />
            <p
              className="dx-muted"
              style={{ fontSize: 12, marginTop: 10 }}
            >
              This uses the{" "}
              <code
                style={{
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: 11,
                  background: "var(--surface2)",
                  padding: "1px 5px",
                  borderRadius: 4,
                }}
              >
                commission_amount
              </code>{" "}
              column on the orders table. Once wallet debits are fully wired
              this chart will switch to the wallet ledger as the authoritative
              source.
            </p>
          </Card>
        </div>
      )}

      {/* Total revenue breakdown summary card */}
      <div style={{ marginTop: 16 }}>
        <Card title="Platform revenue summary">
          <div className="dx-kv">
            <span>GMV (gross merchandise value)</span>
            <span className="dx-fw6">{gmv > 0 ? inr(gmv) : "₹0"}</span>
          </div>
          <div className="dx-kv">
            <span>Commission collected (platform revenue)</span>
            <span className="dx-fw6" style={{ color: "var(--primary)" }}>
              {commission > 0 ? inr(commission) : "₹0"}
            </span>
          </div>
          <div className="dx-kv">
            <span>Wallet credits (seller recharges)</span>
            <span className="dx-fw6">{walletCredits > 0 ? inr(walletCredits) : "₹0"}</span>
          </div>
          <div className="dx-kv">
            <span>Plan MRR ({activeSubCount} active sub{activeSubCount === 1 ? "" : "s"})</span>
            <span className="dx-fw6" style={{ color: planMrr > 0 ? "var(--primary)" : undefined }}>
              {planMrr > 0 ? inr(planMrr) : "₹0"}
            </span>
          </div>
          <div className="dx-kv">
            <span>Template / domain / overage</span>
            <span className="dx-fw6 dx-muted">—</span>
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 13,
              borderTop: "2px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              Total platform revenue (confirmed)
            </span>
            <span
              style={{
                fontFamily: "var(--font-sora, Sora, sans-serif)",
                fontWeight: 800,
                fontSize: 18,
                color: "var(--primary)",
                letterSpacing: "-.02em",
              }}
            >
              {totalRevenue > 0 ? inr(totalRevenue) : "₹0"}
            </span>
          </div>
          <p className="dx-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
            Commission is deducted from the seller wallet at sale time. Plan
            MRR reflects active subscriptions from the subscriptions table.
            Templates and add-ons are not yet tracked.
          </p>
        </Card>
      </div>
    </>
  );
}
