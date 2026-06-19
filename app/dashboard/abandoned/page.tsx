import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card } from "@/components/dx/ui";
import Pagination from "@/components/dx/Pagination";
import AbandonedClient, { type AbandonedOrder } from "./AbandonedClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

export default async function AbandonedCartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // "Abandoned" = orders with status = 'created' (started but not paid)
  // These ARE in the DB right now — no separate table needed.
  const { data: abandonedRows, count: abandonedCount } = await sb
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, product_title, amount, status, created_at",
      { count: "exact" },
    )
    .eq("store_id", store.id)
    .eq("status", "created")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const abandoned = (abandonedRows ?? []) as AbandonedOrder[];
  const totalAbandoned = abandonedCount ?? 0;

  // For KPIs: total lost value requires sum of all abandoned (not just current page).
  // Fetch lightweight amount-only for the full set.
  const { data: allAmounts } = await sb
    .from("orders")
    .select("amount")
    .eq("store_id", store.id)
    .eq("status", "created");
  const totalValue = (allAmounts ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);

  // For recovery rate: compare abandoned vs paid
  const { data: paidRows } = await sb
    .from("orders")
    .select("id")
    .eq("store_id", store.id)
    .eq("status", "paid");
  const paidCount = (paidRows ?? []).length;
  const totalStarted = totalAbandoned + paidCount;
  const recoveryRate = totalStarted > 0
    ? `${((paidCount / totalStarted) * 100).toFixed(1)}%`
    : "0%";

  return (
    <>
      <Phead
        title="Abandoned cart"
        sub="Orders that were started but not completed."
      />

      <Kpis
        items={[
          {
            icon: "cart",
            color: "var(--primary)",
            label: "Abandoned",
            value: totalAbandoned.toLocaleString("en-IN"),
          },
          {
            icon: "rupee",
            color: "var(--secondary)",
            label: "Lost value",
            value: inr(totalValue),
          },
          {
            icon: "spark",
            color: "var(--green)",
            label: "Checkout conv.",
            value: recoveryRate,
          },
          {
            icon: "bag",
            color: "var(--accent)",
            label: "Paid orders",
            value: paidCount.toLocaleString("en-IN"),
          },
        ]}
      />

      <style>{`
        .ab-table { width: 100%; border-collapse: collapse; }
        .ab-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .ab-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .ab-table tr:last-child td { border-bottom: 0; }
        .ab-table tr:hover td { background: var(--surface2); }
        .ab-empty { text-align: center; padding: 48px; color: var(--muted); font-size: 13.5px; }
        .ab-recovery-note {
          background: color-mix(in srgb, var(--green) 8%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--green) 20%, var(--border));
          border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; font-size: 13px;
        }
        .ab-recovery-note b { display: block; margin-bottom: 4px; }
        .ab-coming {
          background: var(--surface2); border-radius: 10px; padding: 14px 16px;
          font-size: 12.5px; color: var(--muted); margin-top: 14px;
        }
        .ab-coming b { display: block; color: var(--text); margin-bottom: 4px; }
      `}</style>

      {totalAbandoned > 0 && (
        <div className="ab-recovery-note">
          <b>Recovery opportunity: {inr(totalValue)}</b>
          {totalAbandoned} checkout{totalAbandoned !== 1 ? "s" : ""} started but not completed.
          Follow up via email or WhatsApp to recover these sales.
        </div>
      )}

      <div className="dx-grid dx-cols">
        <div>
          <Card title={`Abandoned checkouts (${totalAbandoned})`}>
            <AbandonedClient abandoned={abandoned} />
            {totalAbandoned > PAGE_SIZE && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={totalAbandoned} baseParams={sp} />
            )}
          </Card>
        </div>

        <div>
          <Card title="Recovery settings">
            <div className="ab-coming">
              <b>Automated recovery emails — coming soon</b>
              Automated follow-up emails to abandoned checkouts will send via your configured
              email sender. The <code>abandoned_carts</code> table and recovery job are on the
              roadmap — once live, you will set a delay (e.g. 1 hour) and a custom message here.
            </div>
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                Manual recovery tips:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px" }}>
                  Email the buyer at the address shown in the table above.
                </div>
                <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px" }}>
                  WhatsApp them via the phone number to share your payment link.
                </div>
                <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px" }}>
                  Add a coupon code — go to{" "}
                  <a href="/dashboard/coupons" style={{ color: "var(--primary)" }}>
                    Coupons
                  </a>{" "}
                  to create a discount and share it.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
