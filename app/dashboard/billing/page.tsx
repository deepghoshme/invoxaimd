import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Card, Table } from "@/components/dx/ui";
import { getStoreSubscription } from "@/lib/subscriptions";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

const inr = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type Invoice = { date: string; kind: string; desc: string; amountPaise: number };

/** Plan-subscription payments + wallet recharges, newest first. */
async function loadInvoices(storeId: string): Promise<Invoice[]> {
  const admin = createAdminClient();
  const [planRes, walletRes] = await Promise.all([
    admin.from("plan_payments").select("amount, created_at, plan:plan_id(name)").eq("store_id", storeId).order("created_at", { ascending: false }).limit(50),
    admin.from("wallet_ledger").select("amount, reason, created_at").eq("store_id", storeId).eq("type", "credit").order("created_at", { ascending: false }).limit(50),
  ]);
  const planRows = (planRes.data ?? []).map((p) => {
    const plan = p.plan as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(plan) ? plan[0]?.name : plan?.name;
    return { date: p.created_at as string, kind: "Plan", desc: `${name ?? "Plan"} subscription`, amountPaise: Number(p.amount) };
  });
  const walletRows = (walletRes.data ?? []).map((w) => ({
    date: w.created_at as string,
    kind: "Wallet",
    desc: w.reason === "recharge_bonus" ? "Recharge bonus" : "Wallet recharge",
    amountPaise: Number(w.amount),
  }));
  return [...planRows, ...walletRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default async function BillingPage() {
  const { store } = await requireDashboardStore();
  const admin = createAdminClient();

  // Load all active plans (server-side, for display)
  const { data: plans } = await admin
    .from("plans")
    .select("id, name, price, contact_limit, features, is_popular, is_active")
    .eq("is_active", true)
    .order("sort_order");

  // Load current subscription (gracefully returns null if table not applied)
  const currentSub = await getStoreSubscription(store.id);

  // Detect whether the subscriptions migration has been applied
  // getStoreSubscription returns null both when table is missing AND when no sub
  // exists. We distinguish by trying a direct admin query for the table.
  let migrationPending = false;
  if (currentSub === null) {
    const { error: probeErr } = await admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id);
    if (
      probeErr &&
      (probeErr.message?.includes("subscriptions") || (probeErr as { code?: string }).code === "PGRST205")
    ) {
      migrationPending = true;
    }
  }

  // Shape for client
  type SubForClient = {
    plan_id: string;
    status: string;
    amount_paise: number;
    current_period_end: string;
    plan: { name: string; price: number };
  } | null;

  const subForClient: SubForClient = currentSub
    ? {
        plan_id: currentSub.plan_id,
        status: currentSub.status,
        amount_paise: currentSub.amount_paise,
        current_period_end: currentSub.current_period_end,
        plan: { name: currentSub.plan.name, price: currentSub.plan.price },
      }
    : null;

  const invoices = await loadInvoices(store.id);
  const invoiceRows = invoices.map((iv) => [
    <span key="d" style={{ whiteSpace: "nowrap" }}>{fmtDate(iv.date)}</span>,
    <span key="k" className={`dx-pill ${iv.kind === "Plan" ? "" : ""}`} style={{ fontSize: 11.5 }}>{iv.kind}</span>,
    iv.desc,
    <span key="a" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{inr(iv.amountPaise)}</span>,
  ]);

  return (
    <>
      <Phead
        title="Plan & billing"
        sub="Choose a plan. Your subscription is stored in real-time."
      />
      <BillingClient
        plans={(plans ?? []) as Parameters<typeof BillingClient>[0]["plans"]}
        currentSub={subForClient}
        migrationPending={migrationPending}
      />

      <div style={{ marginTop: 20 }}>
        <Card title="Billing history">
          <Table
            cols={["Date", "Type", "Description", "Amount"]}
            rows={invoiceRows}
            empty="No payments yet. Plan upgrades and wallet recharges will appear here."
          />
        </Card>
      </div>
    </>
  );
}
