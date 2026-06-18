import { createClient } from "@/lib/supabase/server";
import MaintenanceClient from "./MaintenanceClient";

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage() {
  const sb = await createClient();

  const { data: ps } = await sb
    .from("platform_settings")
    .select("maintenance_mode, maintenance_eta, allow_signups, force_https")
    .eq("id", true)
    .maybeSingle();

  // Safely read new columns with fallback defaults.
  const row = ps as {
    maintenance_mode?: boolean | null;
    maintenance_eta?: string | null;
    allow_signups?: boolean | null;
    force_https?: boolean | null;
  } | null;

  return (
    <MaintenanceClient
      maintenanceMode={row?.maintenance_mode ?? false}
      maintenanceEta={row?.maintenance_eta ?? ""}
      allowSignups={row?.allow_signups ?? true}
      forceHttps={row?.force_https ?? true}
      newColsExist={row != null && "allow_signups" in (row ?? {})}
    />
  );
}
