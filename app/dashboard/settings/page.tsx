import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Phead } from "@/components/dx/ui";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await sb
    .from("stores")
    .select("store_name, subdomain, category_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  const { data: cats } = await sb.from("business_categories").select("id, name").eq("is_active", true).order("sort_order");

  return (
    <>
      <Phead title="Settings" sub="Store, profile, and account." />
      <SettingsForm
        storeName={store?.store_name ?? ""}
        subdomain={store?.subdomain ?? null}
        categoryId={store?.category_id ?? null}
        categories={cats ?? []}
      />
    </>
  );
}
