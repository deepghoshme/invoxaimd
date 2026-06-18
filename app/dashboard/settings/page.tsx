import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead } from "@/components/dx/ui";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();
  const { data: cats } = await sb.from("business_categories").select("id, name").eq("is_active", true).order("sort_order");

  return (
    <>
      <Phead title="Settings" sub="Store, profile, and account." />
      <SettingsForm
        storeName={store.store_name ?? ""}
        subdomain={store.subdomain ?? null}
        categoryId={store.category_id ?? null}
        categories={cats ?? []}
      />
    </>
  );
}
