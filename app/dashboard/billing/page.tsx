import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Card, Table } from "@/components/dx/ui";
import { getStoreSubscription } from "@/lib/subscriptions";
import BillingClient from "./BillingClient";
import type { InvoiceRow } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const inr = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type LegacyInvoice = { date: string; kind: string; desc: string; amountPaise: number };

/** Plan-subscription payments + wallet recharges, newest first. */
async function loadLegacyInvoices(storeId: string): Promise<LegacyInvoice[]> {
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

/**
 * Platform-to-seller invoices only: plan subscriptions and wallet recharges.
 * Buyer/order invoices (kind="order") belong on the seller order page, not here.
 */
async function loadTaxInvoices(storeId: string): Promise<InvoiceRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invoices")
    .select(
      "id, store_id, order_id, invoice_number, buyer_name, buyer_email, currency, subtotal_paise, tax_rate, cgst_paise, sgst_paise, igst_paise, total_paise, gstin, seller_legal_name, seller_address, kind, meta, created_at",
    )
    .eq("store_id", storeId)
    .in("kind", ["plan", "wallet"])
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as InvoiceRow[];
}

export default async function BillingPage() {
  const { store } = await requireDashboardStore();
  const admin = createAdminClient();

  // Load all active plans (server-side, for display), including interval + is_recommended
  const { data: plans } = await admin
    .from("plans")
    .select("id, name, price, contact_limit, features, is_popular, is_active, interval, is_recommended")
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
    plan: { name: string; price: number; interval: string };
  } | null;

  const subForClient: SubForClient = currentSub
    ? {
        plan_id: currentSub.plan_id,
        status: currentSub.status,
        amount_paise: currentSub.amount_paise,
        current_period_end: currentSub.current_period_end,
        plan: {
          name: currentSub.plan.name,
          price: currentSub.plan.price,
          interval: (currentSub.plan as { interval?: string }).interval ?? "monthly",
        },
      }
    : null;

  const legacyInvoices = await loadLegacyInvoices(store.id);
  const legacyRows = legacyInvoices.map((iv) => [
    <span key="d" style={{ whiteSpace: "nowrap" }}>{fmtDate(iv.date)}</span>,
    <span key="k" className="dx-pill" style={{ fontSize: 11.5 }}>{iv.kind}</span>,
    iv.desc,
    <span key="a" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{inr(iv.amountPaise)}</span>,
  ]);

  // Load real GST tax invoices from the invoices table (auto-generated on every confirmed payment)
  const taxInvoices = await loadTaxInvoices(store.id);
  const taxInvoiceRows = taxInvoices.map((inv) => {
    const rate = Number(inv.tax_rate ?? 0);
    let gstBreakdown = "Nil";
    if (rate > 0) {
      const cgst = Number(inv.cgst_paise);
      const sgst = Number(inv.sgst_paise);
      const igst = Number(inv.igst_paise);
      if (cgst > 0 || sgst > 0) {
        gstBreakdown = `CGST ${inr(cgst)} + SGST ${inr(sgst)} (${rate / 2}+${rate / 2}%)`;
      } else if (igst > 0) {
        gstBreakdown = `IGST ${inr(igst)} (${rate}%)`;
      }
    }
    const kindLabel = inv.kind === "plan" ? "Plan" : "Wallet";
    return [
      <span key="n" style={{ fontFamily: "monospace", fontSize: 12 }}>{inv.invoice_number}</span>,
      <span key="d" style={{ whiteSpace: "nowrap" }}>{fmtDate(inv.created_at)}</span>,
      <span key="k" style={{ fontSize: 11.5 }}>{kindLabel}</span>,
      <span key="sub" style={{ whiteSpace: "nowrap" }}>{inr(Number(inv.subtotal_paise))}</span>,
      <span key="gst" style={{ fontSize: 11.5, color: "#7a6770" }}>{gstBreakdown}</span>,
      <span key="tot" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{inr(Number(inv.total_paise))}</span>,
      <a
        key="dl"
        href={`/api/invoices/${inv.id}/pdf`}
        download={`Invoice-${inv.invoice_number}.pdf`}
        style={{
          display: "inline-block",
          padding: "3px 10px",
          fontSize: 11.5,
          fontWeight: 600,
          color: "#7b3fe4",
          border: "1px solid #c4a8f0",
          borderRadius: 6,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Download PDF
      </a>,
    ];
  });

  return (
    <>
      <Phead
        title="Plan & billing"
        sub="Choose or switch your plan below. Platform invoices and billing history are on this same page."
      />
      <BillingClient
        plans={(plans ?? []) as Parameters<typeof BillingClient>[0]["plans"]}
        currentSub={subForClient}
        migrationPending={migrationPending}
      />

      {/* Platform invoices — plan subscriptions and wallet recharges billed by the platform to this seller.
          Customer/order invoices (kind="order") are strictly on the Orders page per-order, never here. */}
      <div id="platform-invoices" style={{ marginTop: 20 }}>
        <Card title="Platform invoices (what you paid us)">
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
            These are invoices for <strong>your plan subscriptions</strong> and{" "}
            <strong>wallet recharges</strong> — amounts you paid invoxai.
            Your customer order receipts are on the{" "}
            <a href="/dashboard/orders" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Orders page
            </a>.
          </p>
          <Table
            cols={["Invoice No.", "Date", "Type", "Taxable Value", "GST Breakdown", "Total", ""]}
            rows={taxInvoiceRows}
            empty="No platform invoices yet. Plan subscriptions and wallet recharges will appear here."
          />
        </Card>
      </div>

      <div style={{ marginTop: 20 }}>
        <Card title="Billing history">
          <Table
            cols={["Date", "Type", "Description", "Amount"]}
            rows={legacyRows}
            empty="No payments yet. Plan upgrades and wallet recharges will appear here."
          />
        </Card>
      </div>
    </>
  );
}
