import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead } from "@/components/dx/ui";
import DomainConnectWizard from "./DomainConnectWizard";

export const dynamic = "force-dynamic";

/**
 * Returns true if the custom_domains table exists.
 * Called server-side so we can render a graceful banner instead of 500ing
 * when the migration hasn't been applied yet.
 */
async function checkMigration(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("custom_domains")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export default async function DomainConnectPage() {
  const { store } = await requireDashboardStore();

  // ── Migration guard ────────────────────────────────────────────────
  const migrated = await checkMigration();

  // ── Existing domain (only when migration is applied) ──────────────
  let existingDomain: { domain: string; status: string } | null = null;
  if (migrated) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("custom_domains")
      .select("domain, status")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingDomain = data ?? null;
  }

  return (
    <>
      <Phead
        title="Connect a custom domain"
        sub="Point your own domain at invoxai — SSL is issued automatically."
      />
      <DomainConnectWizard
        storeId={store.id}
        existingDomain={existingDomain}
        migrationPending={!migrated}
      />
    </>
  );
}
