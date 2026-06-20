import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PlansAdmin, { type Plan, type PlatformFeeDefaults } from "./PlansAdmin";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const sb = await createClient();
  const admin = createAdminClient();
  const [{ data: plansData }, { data: settings }] = await Promise.all([
    sb
      .from("plans")
      .select("id, name, price, page_limit, contact_limit, features, is_popular, interval, is_recommended, commission_pct, flat_fee_paise, feature_keys")
      .order("sort_order"),
    admin
      .from("platform_settings")
      .select("default_commission_pct, default_flat_fee_paise, plan_flat_fee_paise")
      .maybeSingle(),
  ]);
  const feeDefaults: PlatformFeeDefaults = {
    default_commission_pct: (settings as { default_commission_pct?: number } | null)?.default_commission_pct ?? 0.05,
    default_flat_fee_paise: (settings as { default_flat_fee_paise?: number } | null)?.default_flat_fee_paise ?? 0,
    plan_flat_fee_paise: (settings as { plan_flat_fee_paise?: number } | null)?.plan_flat_fee_paise ?? 0,
  };
  return <PlansAdmin plans={(plansData ?? []) as Plan[]} feeDefaults={feeDefaults} />;
}
