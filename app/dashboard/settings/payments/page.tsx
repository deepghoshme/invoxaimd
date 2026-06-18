import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import GatewayForm from "./GatewayForm";

export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage() {
  const { store } = await requireDashboardStore();
  const supabase = createAdminClient();

  // Fetch the Razorpay gateway row (current schema: one row per store, store_id PK).
  const { data: gateway } = await supabase
    .from("payment_gateways")
    .select("provider, key_id, key_secret, is_enabled, mode")
    .eq("store_id", store.id)
    .maybeSingle();

  type GatewayRow = {
    key_id: string;
    has_secret: boolean;
    is_enabled: boolean;
    mode: string;
  };

  const gwMap: Record<string, GatewayRow> = {};
  if (gateway) {
    const provider = (gateway.provider as string | null) ?? "razorpay";
    gwMap[provider] = {
      key_id: (gateway.key_id as string | null) ?? "",
      has_secret: !!(gateway.key_secret as string | null),
      is_enabled: (gateway.is_enabled as boolean | null) ?? false,
      mode: (gateway.mode as string | null) ?? "test",
    };
  }

  return <GatewayForm gwMap={gwMap} />;
}
