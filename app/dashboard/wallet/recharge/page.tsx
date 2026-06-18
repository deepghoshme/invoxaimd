import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead } from "@/components/dx/ui";
import WalletRecharge from "./WalletRecharge";

export const dynamic = "force-dynamic";

export default async function WalletRechargePage() {
  const { store: baseStore } = await requireDashboardStore();

  // Re-fetch via admin client to get wallet_balance (not in the base select).
  const admin = createAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id, wallet_balance")
    .eq("id", baseStore.id)
    .maybeSingle();

  // Detect if the wallet_balance column doesn't exist yet
  const errMsg = (storeError as { message?: string } | null)?.message ?? "";
  const migrationPending =
    !store ||
    errMsg.includes("wallet_balance") ||
    errMsg.includes("column") ||
    false;

  // If store fetch succeeds but wallet_balance is missing from the column
  // (the select succeeded but the key is absent), also flag as pending.
  const balancePaise = migrationPending
    ? 0
    : Number((store as Record<string, unknown> | null)?.wallet_balance ?? 0);

  return (
    <>
      <Phead title="Recharge wallet" sub="Add money to your commission wallet." />
      <WalletRecharge
        initialBalancePaise={balancePaise}
        migrationPending={migrationPending}
      />
    </>
  );
}
