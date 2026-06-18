import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GatewayForm from "./GatewayForm";

export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("stores")
    .select("id, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: gateway } = await supabase
    .from("payment_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("store_id", store.id)
    .maybeSingle();

  return (
    <main className="page-wrap">
      <header style={{ marginBottom: "var(--space-3)" }}>
        <p className="eyebrow">Settings</p>
        <h1 style={{ margin: "0.15rem 0 0" }}>Payments</h1>
      </header>
      <GatewayForm
        initial={{
          key_id: gateway?.key_id ?? "",
          is_enabled: gateway?.is_enabled ?? false,
          has_secret: !!gateway?.key_secret,
        }}
      />
    </main>
  );
}
