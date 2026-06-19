import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead } from "@/components/dx/ui";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();
  const [{ data: cats }, { data: storeExtra }] = await Promise.all([
    sb.from("business_categories").select("id, name").eq("is_active", true).order("sort_order"),
    sb.from("stores").select("reply_to_email").eq("id", store.id).maybeSingle(),
  ]);

  return (
    <>
      <Phead title="Settings" sub="Store, profile, and account." />
      <SettingsForm
        storeName={store.store_name ?? ""}
        subdomain={store.subdomain ?? null}
        categoryId={store.category_id ?? null}
        categories={cats ?? []}
        replyToEmail={storeExtra?.reply_to_email ?? null}
      />
    </>
  );
}
