import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "./Wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: store } = await supabase
    .from("stores")
    .select("store_name, subdomain, category_id, onboarding_step, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (store?.onboarding_completed) redirect("/dashboard");

  // First visit: create the tenant row (OTP step already satisfied by login).
  if (!store) {
    await supabase
      .from("stores")
      .insert({ owner_id: user.id, onboarding_step: "store_name" });
    const { data } = await supabase
      .from("stores")
      .select("store_name, subdomain, category_id, onboarding_step, onboarding_completed")
      .eq("owner_id", user.id)
      .maybeSingle();
    store = data;
  }

  const { data: categories } = await supabase
    .from("business_categories")
    .select("id, name, commission_rate")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <OnboardingWizard
      email={user.email ?? ""}
      initial={{
        store_name: store?.store_name ?? "",
        subdomain: store?.subdomain ?? "",
        category_id: store?.category_id ?? "",
        step: (store?.onboarding_step ?? "store_name") as string,
      }}
      categories={categories ?? []}
    />
  );
}
