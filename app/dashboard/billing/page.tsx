import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead } from "@/components/dx/ui";
import { getStoreSubscription } from "@/lib/subscriptions";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

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
    </>
  );
}
