import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis, Card, AreaChart, Table, Tag } from "@/components/dx/ui";
import { getPlanMrr } from "@/lib/subscriptions";
import Pagination from "@/components/dx/Pagination";

export const dynamic = "force-dynamic";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const inr = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

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
  color, name, desc, value, real,
}: { color: string; name: string; desc: string; value: string; real: boolean }) {
  return (
    <div className="rv-stream">
      <span className="sk" style={{ background: real ? color : "var(--border)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="nm" style={{ opacity: real ? 1 : 0.55 }}>{name}</div>
        <div className="ds">{desc}</div>
      </div>
      <span className="amt" style={{ color: real ? "var(--text)" : "var(--muted)" }}>
        {value}
      </span>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

const TX_PAGE_SIZE = 50;

export default async function RevenueAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const txPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const txOffset = (txPage - 1) * TX_PAGE_SIZE;

  const sb = createAdminClient();

  // Current-month ISO start (midnight on the 1st of this month)
  const thisMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const [
    { data: paidOrders },
    { data: walletAll },
    { count: activeSellers },
    { data: plans },
    { data: allPaidOrders12m },
    planMrrData,
    // plan_payments aggregate: all rows for KPI sum
    { data: allPlanPayments },
    // plan_payments paginated: for the transactions table
    { data: planPaymentsPage, count: planPaymentsTotal },
    // wallet credits (recharge + bonus) paginated: for the transactions table
    { data: walletCreditsPage, count: walletCreditsTotal },
    // this-month plan payments (amount only) — for current-month KPI split
    { data: thisMonthPlanPayments },
    // this-month wallet recharges (amount only, recharge only — no bonus) — for current-month KPI split
    { data: thisMonthWalletRecharges },
    // template_purchases via Razorpay — revenue rail 2 for templates.
    // NOTE: wallet-rail template sales are counted via wallet_ledger (reason='template_purchase')
    // fetched in walletAll above. We do NOT include wallet-rail rows here to avoid double-counting
    // (a wallet sale appears in both wallet_ledger AND template_purchases with source='wallet';
    //  we count it only once via wallet_ledger in the totals aggregation).
    { data: razorpayTemplatePurchases },
    // template_purchases joined to templates+stores for the transactions feed.
    // Fetches both wallet and razorpay source rows so the feed shows both rails.
    // For per-template analytics we use template_purchases as single source (§ per-template note).
    { data: templatePurchasesFeed },
  ] = await Promise.all([
    // Paid orders — GMV + commission snapshot
    sb
      .from("orders")
      .select("amount, commission_amount, created_at")
      .eq("status", "paid"),

    // Full wallet ledger for aggregate KPIs (all types/reasons)
    sb.from("wallet_ledger").select("amount, type, reason, created_at"),

    // Active sellers count
    sb
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "seller"),

    // Active plans for display in breakdown
    sb.from("plans").select("id, name, price").eq("is_active", true),

    // Paid orders last 12 months for trend chart
    sb
      .from("orders")
      .select("amount, commission_amount, created_at")
      .eq("status", "paid")
      .gte("created_at", new Date(Date.now() - 365 * 86400 * 1000).toISOString()),

    // Plan MRR from subscriptions table (gracefully returns 0 if table not applied)
    getPlanMrr(),

    // All plan_payments for KPI sum (amount only — lightweight)
    // Source table: plan_payments
    // Columns: amount (actual charged paise, post-promo/prorate)
    sb.from("plan_payments").select("amount"),

    // plan_payments paginated for transactions feed
    // Source: plan_payments joined with stores + plans for display names
    sb
      .from("plan_payments")
      .select(
        "id, amount, created_at, promo_code, promo_discount_paise, razorpay_payment_id, store:stores(store_name, subdomain), plan:plans(name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(txOffset, txOffset + TX_PAGE_SIZE - 1),

    // wallet_ledger credits (recharges + bonuses) paginated for transactions feed
    // Source: wallet_ledger WHERE type='credit' AND reason IN ('recharge','recharge_bonus')
    sb
      .from("wallet_ledger")
      .select(
        "id, amount, reason, created_at, store:stores(store_name, subdomain)",
        { count: "exact" }
      )
      .eq("type", "credit")
      .in("reason", ["recharge", "recharge_bonus"])
      .order("created_at", { ascending: false })
      .range(txOffset, txOffset + TX_PAGE_SIZE - 1),

    // This-month plan payments — for current-month revenue KPI
    // Source: plan_payments WHERE created_at >= first day of current month
    sb
      .from("plan_payments")
      .select("amount")
      .gte("created_at", thisMonthStart),

    // This-month wallet recharges (cash paid in, not bonuses) — for current-month KPI
    // Source: wallet_ledger WHERE type='credit' AND reason='recharge' AND created_at >= this month
    sb
      .from("wallet_ledger")
      .select("amount")
      .eq("type", "credit")
      .eq("reason", "recharge")
      .gte("created_at", thisMonthStart),

    // Razorpay-rail template purchases — KPI aggregate (amount only).
    // Used for the revenue TOTAL. Wallet-rail template sales are counted separately
    // from wallet_ledger to avoid double-counting (wallet sale exists in both tables;
    // we pick wallet_ledger as the single source for wallet-rail totals).
    sb
      .from("template_purchases")
      .select("price_paise, created_at")
      .eq("source", "razorpay"),

    // Template purchases feed for the transactions table (both rails).
    // For the feed display we use template_purchases for both rails (has template_id,
    // price_paise, source in one place) joined to templates + stores.
    // Fetch most-recent 200 rows; exact cross-source pagination is v2.
    sb
      .from("template_purchases")
      .select(
        "id, price_paise, source, payment_ref, created_at, template:templates(name), store:stores(store_name, subdomain)"
      )
      .in("source", ["wallet", "razorpay"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  /* ── commission aggregates ───────────────────────────────────────────────── */

  // Source: orders.amount WHERE status='paid' → GMV
  const gmv = (paidOrders ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);

  // Source: orders.commission_amount WHERE status='paid' → commission snapshot
  const commissionFromOrders = (paidOrders ?? []).reduce(
    (s, o) => s + (o.commission_amount ?? 0),
    0
  );

  // Source: wallet_ledger.amount WHERE type='debit' AND reason='commission'
  // IMPORTANT: only count reason='commission' (the value written by app/api/checkout/verify/route.ts).
  // Before this fix the filter was type='debit' which would also count reason='template_purchase'
  // debits, wrongly inflating commission and double-inflating totalRevenue.
  const walletDebits = (walletAll ?? [])
    .filter((r) => r.type === "debit" && r.reason === "commission")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  // Authoritative commission = max of order snapshot vs wallet debits
  const commission = Math.max(commissionFromOrders, walletDebits);

  /* ── wallet recharge aggregates ──────────────────────────────────────────── */

  // Source: wallet_ledger.amount WHERE type='credit' AND reason='recharge'
  // → seller cash paid in (net recharge inflow, excluding bonuses)
  const walletRechargePaid = (walletAll ?? [])
    .filter((r) => r.type === "credit" && r.reason === "recharge")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  // Source: wallet_ledger.amount WHERE type='credit' AND reason='recharge_bonus'
  // → platform-granted bonuses (platform cost, not revenue)
  const walletRechargeBonus = (walletAll ?? [])
    .filter((r) => r.type === "credit" && r.reason === "recharge_bonus")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  // Total credits in ledger (includes all reasons)
  const walletCreditsAll = (walletAll ?? [])
    .filter((r) => r.type === "credit")
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  /* ── plan payment aggregates ─────────────────────────────────────────────── */

  // Source: plan_payments.amount (paise) — ALL rows, actual charge per payment
  // Note: for prorated upgrades, amount < plan.price * 100 (discount already applied)
  const planRevenueTotal = (allPlanPayments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const planPaymentCount = (allPlanPayments ?? []).length;

  /* ── template revenue aggregates ─────────────────────────────────────────── */

  // WALLET-RAIL template sales: counted via wallet_ledger (reason='template_purchase').
  // These debits are already in walletAll (fetched above with all reasons).
  // NOTE: wallet sales also have a row in template_purchases with source='wallet',
  // but we do NOT count those here — we count wallet_ledger as the single source
  // for wallet-rail totals to avoid double-counting.
  const walletTemplateSalesPaise = (walletAll ?? [])
    .filter((r) => r.type === "debit" && r.reason === "template_purchase")
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const walletTemplateSalesCount = (walletAll ?? []).filter(
    (r) => r.type === "debit" && r.reason === "template_purchase"
  ).length;

  // RAZORPAY-RAIL template sales: counted via template_purchases WHERE source='razorpay'.
  // These are NOT in wallet_ledger, so there is no double-count risk.
  const razorpayTemplateSalesPaise = (razorpayTemplatePurchases ?? []).reduce(
    (s, p) => s + ((p as { price_paise?: number }).price_paise ?? 0),
    0
  );
  const razorpayTemplateSalesCount = (razorpayTemplatePurchases ?? []).length;

  // Total template revenue = wallet rail + razorpay rail (each counted exactly once)
  const templateRevenueTotal = walletTemplateSalesPaise + razorpayTemplateSalesPaise;
  const templateSalesCount = walletTemplateSalesCount + razorpayTemplateSalesCount;

  /* ── this-month aggregates ───────────────────────────────────────────────── */

  // Source: plan_payments.amount WHERE created_at >= first of this month
  const thisMonthPlanRevenue = (thisMonthPlanPayments ?? []).reduce(
    (s, p) => s + (p.amount ?? 0),
    0
  );
  const thisMonthPlanCount = (thisMonthPlanPayments ?? []).length;

  // Source: wallet_ledger.amount WHERE type='credit' AND reason='recharge' AND created_at >= first of this month
  const thisMonthRechargeRevenue = (thisMonthWalletRecharges ?? []).reduce(
    (s, r) => s + (r.amount ?? 0),
    0
  );

  // Combined platform revenue this month (plan purchases + recharge inflow)
  const thisMonthTotal = thisMonthPlanRevenue + thisMonthRechargeRevenue;

  /* ── plan MRR ────────────────────────────────────────────────────────────── */

  // Source: subscriptions.amount_paise WHERE status='active' (summed in lib)
  const planMrr = planMrrData.mrrPaise;
  const activeSubCount = planMrrData.activeCount;

  const planSummary =
    (plans ?? []).length > 0
      ? (plans ?? [])
          .map((p) => `${p.name} (${(p.price as number) === 0 ? "Free" : inr((p.price as number) * 100) + "/mo"})`)
          .join(", ")
      : "No active plans";

  /* ── total platform revenue ──────────────────────────────────────────────── */
  // = commission (per-sale, deducted from seller wallets) + plan purchases (cash collected)
  //   + template sales (wallet rail via wallet_ledger + razorpay rail via template_purchases)
  // Wallet recharge volume is not additive here — those are seller inflows that
  // eventually become commission debits when a sale happens.
  const totalRevenue = commission + planRevenueTotal + templateRevenueTotal;

  const totalPaidOrders = paidOrders?.length ?? 0;
  const avgOrderValue = totalPaidOrders > 0 ? Math.round(gmv / totalPaidOrders) : 0;

  /* ── 6-month GMV trend ───────────────────────────────────────────────────── */
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
      const od = new Date(o.created_at as string);
      return od.getFullYear() === yr && od.getMonth() === mo;
    });
    monthGmvPoints.push(monthOrders.reduce((s, o) => s + (o.amount ?? 0), 0));
    monthCommPoints.push(monthOrders.reduce((s, o) => s + (o.commission_amount ?? 0), 0));
  }

  const curMonthGmv = monthGmvPoints[monthGmvPoints.length - 1] ?? 0;
  const prevMonthGmv = monthGmvPoints[monthGmvPoints.length - 2] ?? 0;
  const gmvDelta =
    prevMonthGmv > 0
      ? `${curMonthGmv >= prevMonthGmv ? "▲" : "▼"} ${Math.abs(Math.round(((curMonthGmv - prevMonthGmv) / prevMonthGmv) * 100))}% vs ${monthLabels[monthLabels.length - 2]}`
      : totalPaidOrders > 0
      ? `${totalPaidOrders} paid orders`
      : undefined;

  /* ── build merged transaction rows for the feed ──────────────────────────── */
  type TxEntry = {
    date: string;
    type: "Plan" | "Recharge" | "Bonus" | "Template";
    storeName: string;
    storeSubdomain: string;
    desc: string;
    amount: number;
    promoCode?: string | null;
    promoDiscount?: number | null;
  };

  const planTxRows: TxEntry[] = (planPaymentsPage ?? []).map((p) => {
    const store = p.store as { store_name?: string | null; subdomain?: string | null } | null;
    const plan = p.plan as { name?: string | null } | null;
    const planName = Array.isArray(plan) ? (plan[0] as { name?: string | null })?.name : (plan as { name?: string | null } | null)?.name;
    return {
      date: p.created_at as string,
      type: "Plan",
      storeName: store?.store_name ?? "—",
      storeSubdomain: store?.subdomain ?? "",
      desc: planName ? `${planName} subscription` : "Plan subscription",
      amount: Number(p.amount),
      promoCode: (p as Record<string, unknown>).promo_code as string | null,
      promoDiscount: (p as Record<string, unknown>).promo_discount_paise as number | null,
    };
  });

  const walletTxRows: TxEntry[] = (walletCreditsPage ?? []).map((w) => {
    const store = w.store as { store_name?: string | null; subdomain?: string | null } | null;
    const reason = w.reason as string | null;
    return {
      date: w.created_at as string,
      type: reason === "recharge_bonus" ? "Bonus" : "Recharge",
      storeName: store?.store_name ?? "—",
      storeSubdomain: store?.subdomain ?? "",
      desc: reason === "recharge_bonus" ? "Recharge bonus" : "Wallet recharge",
      amount: Number(w.amount),
    };
  });

  // Template purchase tx rows — built from template_purchases feed (both rails).
  // For the feed we use template_purchases as the single source for both wallet and
  // razorpay rails because it has template_id + template name in one joined query.
  // NOTE: the revenue TOTALS use wallet_ledger for wallet-rail to avoid double-counting;
  // the feed display using template_purchases is fine because we display, not sum, here.
  const templateTxRows: TxEntry[] = (templatePurchasesFeed ?? []).map((p) => {
    const rec = p as {
      price_paise?: number;
      source?: string;
      created_at?: string;
      template?: { name?: string | null } | null;
      store?: { store_name?: string | null; subdomain?: string | null } | null;
    };
    const store = rec.store;
    const tmpl = rec.template;
    const tmplName = tmpl?.name ?? "Unknown template";
    const src = rec.source ?? "wallet";
    return {
      date: rec.created_at ?? "",
      type: "Template",
      storeName: store?.store_name ?? "—",
      storeSubdomain: store?.subdomain ?? "",
      desc: `${tmplName} (${src})`,
      amount: Number(rec.price_paise ?? 0),
    };
  });

  // Merge and sort by timestamp descending
  const mergedTx = [...planTxRows, ...walletTxRows, ...templateTxRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Total count = plan payments + wallet recharge credits + template sales
  const txTotal = (planPaymentsTotal ?? 0) + (walletCreditsTotal ?? 0) + templateSalesCount;

  const txTableRows = mergedTx.map((tx) => [
    <span key="d" style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
      {fmtDate(tx.date)}
    </span>,
    tx.type === "Plan" ? (
      <Tag key="t" kind="paid">Plan purchase</Tag>
    ) : tx.type === "Bonus" ? (
      <Tag key="t" kind="neu">Recharge bonus</Tag>
    ) : tx.type === "Template" ? (
      <Tag key="t" kind="paid">Template sale</Tag>
    ) : (
      <Tag key="t" kind="pend">Wallet recharge</Tag>
    ),
    <span key="s">
      <span style={{ fontWeight: 600, fontSize: 13 }}>{tx.storeName}</span>
      {tx.storeSubdomain && (
        <span style={{ color: "var(--muted)", fontSize: 11.5, marginLeft: 6 }}>
          {tx.storeSubdomain}.invoxai.io
        </span>
      )}
    </span>,
    <span key="desc" style={{ fontSize: 12.5 }}>
      {tx.desc}
      {tx.promoCode && (
        <span
          style={{
            marginLeft: 6,
            fontSize: 11,
            color: "var(--primary)",
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            padding: "1px 6px",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          {tx.promoCode}
          {tx.promoDiscount ? ` −${inr(Number(tx.promoDiscount))}` : ""}
        </span>
      )}
    </span>,
    <span key="a" style={{ fontWeight: 700, whiteSpace: "nowrap", fontFamily: "var(--font-sora, Sora, sans-serif)" }}>
      {inr(tx.amount)}
    </span>,
  ] as React.ReactNode[]);

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
        .rv-tx-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
        .rv-tx-kpi { background: var(--surface2); border-radius: 10px; padding: 11px 14px; }
        .rv-tx-kpi .k { font-size: 11.5px; color: var(--muted); margin-bottom: 3px; }
        .rv-tx-kpi .v { font-family: var(--font-sora, Sora, sans-serif); font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
        .rv-tx-kpi .vsub { font-size: 11px; color: var(--muted); font-weight: 500; margin-top: 2px; }
        @media (max-width: 600px) { .rv-metric-row { flex-direction: column; } .rv-tx-kpis { grid-template-columns: 1fr; } }
      `}</style>

      <Phead
        title="Revenue overview"
        sub="All platform revenue streams — commission, plan subscriptions, wallet recharges, and template sales — from real ledger tables."
        action={
          <button className="btn ghost" style={{ cursor: "default", fontSize: 12.5 }}>
            All time
          </button>
        }
      />

      {/* ── KPIs ───────────────────────────────────────────────────────────────── */}
      <Kpis
        items={[
          {
            icon: "rupee",
            color: "var(--primary)",
            label: "Platform revenue",
            value: totalRevenue > 0 ? inr(totalRevenue) : "₹0",
            delta: "Commission + plan purchases + templates",
          },
          {
            icon: "tag",
            color: "var(--gold)",
            label: "Plan purchase revenue",
            value: planRevenueTotal > 0 ? inr(planRevenueTotal) : "₹0",
            delta: planPaymentCount > 0
              ? `${planPaymentCount} payment${planPaymentCount === 1 ? "" : "s"}`
              : "No plan purchases yet",
          },
          {
            icon: "layers",
            color: "var(--secondary)",
            label: "Template sales",
            value: templateRevenueTotal > 0 ? inr(templateRevenueTotal) : "₹0",
            delta: templateSalesCount > 0
              ? `${templateSalesCount} sale${templateSalesCount === 1 ? "" : "s"} · wallet + Razorpay`
              : "No template sales yet",
          },
          {
            icon: "wallet",
            color: "var(--accent)",
            label: "Wallet recharge inflow",
            value: walletRechargePaid > 0 ? inr(walletRechargePaid) : "₹0",
            delta: walletRechargeBonus > 0
              ? `+${inr(walletRechargeBonus)} bonus credited`
              : undefined,
          },
          {
            icon: "users",
            color: "var(--muted)",
            label: "Active sellers",
            value: String(activeSellers ?? 0),
            delta: activeSubCount > 0
              ? `${activeSubCount} on paid plan${activeSubCount === 1 ? "" : "s"}`
              : undefined,
          },
        ]}
      />

      {/* ── Charts row ─────────────────────────────────────────────────────────── */}
      <div className="dx-grid dx-cols">

        {/* Monthly GMV trend */}
        <Card title="Monthly GMV" link="Paid orders · 6 months">
          {monthGmvPoints.every((v) => v === 0) ? (
            <>
              <AreaChart />
              <p className="dx-muted" style={{ fontSize: 12, marginTop: 8 }}>
                No paid orders in the last 6 months — chart populates as orders come in.
              </p>
            </>
          ) : (
            <>
              <AreaChart points={monthGmvPoints} money />
              <MonthAxisLabels labels={monthLabels} />
            </>
          )}
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
        <Card title="Revenue streams">
          <StreamRow
            color="var(--secondary)"
            name="Per-sale commission"
            desc="Deducted from seller wallet on each completed sale"
            value={commission > 0 ? inr(commission) : "₹0"}
            real={commission > 0}
          />
          <StreamRow
            color="var(--primary)"
            name="Plan subscriptions — cash collected"
            desc={
              planPaymentCount > 0
                ? `${planPaymentCount} payment${planPaymentCount === 1 ? "" : "s"} · ${planSummary}`
                : `Available: ${planSummary}`
            }
            value={planRevenueTotal > 0 ? inr(planRevenueTotal) : "₹0"}
            real={planRevenueTotal > 0}
          />
          <StreamRow
            color="var(--gold)"
            name="Plan MRR (active subscriptions)"
            desc={
              activeSubCount > 0
                ? `${activeSubCount} active sub${activeSubCount === 1 ? "" : "s"} · current monthly run-rate`
                : "No active subscriptions yet"
            }
            value={planMrr > 0 ? inr(planMrr) : "₹0"}
            real={planMrr > 0}
          />
          <StreamRow
            color="var(--accent)"
            name="Wallet recharge inflow"
            desc="Sellers topping up commission wallet (not direct revenue)"
            value={walletRechargePaid > 0 ? inr(walletRechargePaid) : "₹0"}
            real={walletRechargePaid > 0}
          />
          <StreamRow
            color="var(--secondary)"
            name="Premium templates"
            desc={
              templateSalesCount > 0
                ? `${templateSalesCount} sale${templateSalesCount === 1 ? "" : "s"} · one-time unlock (wallet + Razorpay rails)`
                : "One-time template marketplace sales — wallet + Razorpay rails"
            }
            value={inr(templateRevenueTotal)}
            real={templateRevenueTotal > 0}
          />
          <StreamRow
            color="var(--border)"
            name="Contact overage & domain add-ons"
            desc="₹10/extra contact, custom domain upgrades — not yet tracked"
            value="— (coming soon)"
            real={false}
          />

          <hr className="rv-divider" />
          <p className="rv-note">
            Streams showing "— (coming soon)" have no backing table yet.
            All real numbers come from live DB queries on every page load.
            Template sales are tracked via <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5 }}>template_purchases</code> (Razorpay rail) and <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5 }}>wallet_ledger</code> reason=template_purchase (wallet rail).
          </p>
        </Card>
      </div>

      {/* ── Commission monthly chart ──────────────────────────────────────────── */}
      {monthCommPoints.some((v) => v > 0) && (
        <div style={{ marginTop: 16 }}>
          <Card title="Monthly commission (from orders)" link="Last 6 months">
            <AreaChart points={monthCommPoints} money />
            <MonthAxisLabels labels={monthLabels} />
            <p className="dx-muted" style={{ fontSize: 12, marginTop: 10 }}>
              Source:{" "}
              <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, background: "var(--surface2)", padding: "1px 5px", borderRadius: 4 }}>
                orders.commission_amount
              </code>{" "}
              WHERE status = &apos;paid&apos;. Wallet ledger debits are the authoritative source once fully wired.
            </p>
          </Card>
        </div>
      )}

      {/* ── Platform revenue summary ──────────────────────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <Card title="Platform revenue summary">
          <div className="dx-kv">
            <span>GMV (gross merchandise value, paid orders)</span>
            <span className="dx-fw6">{gmv > 0 ? inr(gmv) : "₹0"}</span>
          </div>
          <div className="dx-kv">
            <span>Commission collected</span>
            <span className="dx-fw6" style={{ color: "var(--primary)" }}>
              {commission > 0 ? inr(commission) : "₹0"}
            </span>
          </div>
          <div className="dx-kv">
            <span>
              Plan subscription revenue — charged
              {planPaymentCount > 0 && (
                <span className="dx-muted" style={{ fontSize: 11.5, marginLeft: 6, fontWeight: 400 }}>
                  ({planPaymentCount} payment{planPaymentCount === 1 ? "" : "s"})
                </span>
              )}
            </span>
            <span className="dx-fw6" style={{ color: planRevenueTotal > 0 ? "var(--primary)" : undefined }}>
              {planRevenueTotal > 0 ? inr(planRevenueTotal) : "₹0"}
            </span>
          </div>
          <div className="dx-kv">
            <span>Plan MRR ({activeSubCount} active sub{activeSubCount === 1 ? "" : "s"})</span>
            <span className="dx-fw6" style={{ color: planMrr > 0 ? "var(--primary)" : undefined }}>
              {planMrr > 0 ? inr(planMrr) : "₹0"}
            </span>
          </div>
          <div className="dx-kv">
            <span>Wallet recharge inflow (seller cash in)</span>
            <span className="dx-fw6">{walletRechargePaid > 0 ? inr(walletRechargePaid) : "₹0"}</span>
          </div>
          <div className="dx-kv">
            <span>Wallet recharge bonuses granted (platform cost)</span>
            <span className="dx-fw6 dx-muted">
              {walletRechargeBonus > 0 ? `−${inr(walletRechargeBonus)}` : "₹0"}
            </span>
          </div>
          <div className="dx-kv">
            <span>All wallet credits (recharge + bonus)</span>
            <span className="dx-fw6 dx-muted">{walletCreditsAll > 0 ? inr(walletCreditsAll) : "₹0"}</span>
          </div>
          <div className="dx-kv">
            <span>
              Template sales
              {templateSalesCount > 0 && (
                <span className="dx-muted" style={{ fontSize: 11.5, marginLeft: 6, fontWeight: 400 }}>
                  ({templateSalesCount} sale{templateSalesCount === 1 ? "" : "s"})
                </span>
              )}
            </span>
            <span className="dx-fw6" style={{ color: templateRevenueTotal > 0 ? "var(--primary)" : undefined }}>
              {templateRevenueTotal > 0 ? inr(templateRevenueTotal) : "₹0"}
            </span>
          </div>
          <div className="dx-kv">
            <span>Domain add-ons / overage</span>
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
              Total platform revenue confirmed
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
            Platform revenue = commission (
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5 }}>wallet_ledger</code>
            {" "}reason=commission) + plan purchases (
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5 }}>plan_payments</code>
            {" "}amounts) + template sales (
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5 }}>wallet_ledger</code>
            {" "}reason=template_purchase +{" "}
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5 }}>template_purchases</code>
            {" "}source=razorpay). Wallet recharge inflow funds future commission — not additive revenue.
          </p>
        </Card>
      </div>

      {/* ── Platform transactions feed ────────────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <Card title="Platform transactions" link="Plan purchases + wallet recharges + template sales · all sellers">

          {/* KPI mini row */}
          {/* All-time row */}
          <div className="rv-tx-kpis">
            <div className="rv-tx-kpi">
              <div className="k">Plan payments (all time)</div>
              <div className="v" style={{ color: "var(--primary)" }}>
                {planPaymentCount > 0 ? inr(planRevenueTotal) : "₹0"}
              </div>
              <div className="vsub">
                {planPaymentCount} charge{planPaymentCount !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="rv-tx-kpi">
              <div className="k">Wallet recharges (all time)</div>
              <div className="v" style={{ color: "var(--accent)" }}>
                {walletRechargePaid > 0 ? inr(walletRechargePaid) : "₹0"}
              </div>
              <div className="vsub">
                {walletCreditsTotal ?? 0} transaction{(walletCreditsTotal ?? 0) !== 1 ? "s" : ""}
                {walletRechargeBonus > 0 && ` · +${inr(walletRechargeBonus)} bonuses`}
              </div>
            </div>
            <div className="rv-tx-kpi">
              <div className="k">Total transactions</div>
              <div className="v">{txTotal}</div>
              <div className="vsub">across all sellers</div>
            </div>
          </div>

          {/* This-month row */}
          <div className="rv-tx-kpis" style={{ marginTop: 10 }}>
            <div className="rv-tx-kpi">
              <div className="k">Plan payments — this month</div>
              <div className="v" style={{ color: thisMonthPlanRevenue > 0 ? "var(--primary)" : undefined }}>
                {thisMonthPlanRevenue > 0 ? inr(thisMonthPlanRevenue) : "₹0"}
              </div>
              <div className="vsub">
                {thisMonthPlanCount} charge{thisMonthPlanCount !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="rv-tx-kpi">
              <div className="k">Wallet recharges — this month</div>
              <div className="v" style={{ color: thisMonthRechargeRevenue > 0 ? "var(--accent)" : undefined }}>
                {thisMonthRechargeRevenue > 0 ? inr(thisMonthRechargeRevenue) : "₹0"}
              </div>
              <div className="vsub">seller cash-in only</div>
            </div>
            <div className="rv-tx-kpi">
              <div className="k">Platform revenue — this month</div>
              <div className="v" style={{ color: thisMonthTotal > 0 ? "var(--secondary)" : undefined }}>
                {thisMonthTotal > 0 ? inr(thisMonthTotal) : "₹0"}
              </div>
              <div className="vsub">plan + recharge combined</div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            Unified, time-ordered feed from{" "}
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, background: "var(--surface2)", padding: "1px 5px", borderRadius: 4 }}>
              plan_payments
            </code>
            ,{" "}
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, background: "var(--surface2)", padding: "1px 5px", borderRadius: 4 }}>
              wallet_ledger
            </code>
            {" "}(recharge / recharge_bonus), and{" "}
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, background: "var(--surface2)", padding: "1px 5px", borderRadius: 4 }}>
              template_purchases
            </code>
            {" "}(wallet + razorpay). Real data only. Template rows show most-recent 200.
          </p>

          <Table
            cols={["Date", "Type", "Store", "Description", "Amount"]}
            rows={txTableRows}
            empty="No transactions yet. Plan purchases, wallet recharges, and template sales will appear here as they happen."
          />

          <Pagination
            page={txPage}
            pageSize={TX_PAGE_SIZE}
            total={txTotal}
            baseParams={sp}
          />
        </Card>
      </div>
    </>
  );
}
