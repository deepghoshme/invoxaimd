import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis } from "@/components/dx/ui";
import AbandonedClient, { type AbandonedOrder } from "./AbandonedClient";
import type { RecoverySettings } from "./actions";

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

  // Fetch recovery settings from stores table (migration is live)
  const { data: storeRow } = await sb
    .from("stores")
    .select("recovery_enabled, recovery_delay_minutes, recovery_subject, recovery_message")
    .eq("id", store.id)
    .maybeSingle();

  const recoverySettings: RecoverySettings = {
    recovery_enabled: Boolean(storeRow?.recovery_enabled ?? false),
    recovery_delay_minutes: Number(storeRow?.recovery_delay_minutes ?? 60),
    recovery_subject: (storeRow?.recovery_subject as string | null) ?? "",
    recovery_message: (storeRow?.recovery_message as string | null) ?? "",
  };

  // "Abandoned" = orders with status = 'created' (started but not paid)
  const { data: abandonedRows, count: abandonedCount } = await sb
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, product_title, amount, status, created_at, recovery_sent_at, recovery_count",
      { count: "exact" },
    )
    .eq("store_id", store.id)
    .eq("status", "created")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const abandoned = (abandonedRows ?? []) as AbandonedOrder[];
  const totalAbandoned = abandonedCount ?? 0;

  // For KPIs: total lost value requires sum of all abandoned (not just current page).
  const { data: allAmounts } = await sb
    .from("orders")
    .select("amount")
    .eq("store_id", store.id)
    .eq("status", "created");
  const totalValue = (allAmounts ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);

  // For conversion rate: compare abandoned vs paid
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
        .ab-recovery-note {
          background: color-mix(in srgb, var(--green) 8%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--green) 20%, var(--border));
          border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; font-size: 13px;
        }
        .ab-recovery-note b { display: block; margin-bottom: 4px; }
      `}</style>

      {totalAbandoned > 0 && (
        <div className="ab-recovery-note">
          <b>Recovery opportunity: {inr(totalValue)}</b>
          {totalAbandoned} checkout{totalAbandoned !== 1 ? "s" : ""} started but not completed.
          Use the recovery settings below to send follow-up emails.
        </div>
      )}

      <AbandonedClient
        abandoned={abandoned}
        totalAbandoned={totalAbandoned}
        page={page}
        pageSize={PAGE_SIZE}
        baseParams={sp}
        recoverySettings={recoverySettings}
      />
    </>
  );
}
