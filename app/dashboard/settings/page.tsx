import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireDashboardStore } from "@/lib/auth";
import { Phead } from "@/components/dx/ui";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { store } = await requireDashboardStore();
  const sb = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  const [{ data: cats }, { data: storeExtra }, { data: profile }] = await Promise.all([
    admin
      .from("business_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("stores")
      .select(
        "reply_to_email, logo_url, currency, timezone, support_email, social_links, gstin, gst_rate, legal_name, billing, custom_domain, custom_domain_verified, primary_domain, wallet_balance",
      )
      .eq("id", store.id)
      .maybeSingle(),
    sb
      .from("profiles")
      .select("full_name, avatar_url, email")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  const billing = (storeExtra?.billing as Record<string, string> | null) ?? {};
  const socialLinks = (storeExtra?.social_links as Record<string, string> | null) ?? {};

  return (
    <>
      <Phead title="Settings" sub="Store, profile, and account." />
      <SettingsForm
        storeName={store.store_name ?? ""}
        subdomain={store.subdomain ?? null}
        categoryId={store.category_id ?? null}
        categories={cats ?? []}
        logoUrl={storeExtra?.logo_url ?? ""}
        fullName={profile?.full_name ?? ""}
        avatarUrl={profile?.avatar_url ?? ""}
        accountEmail={profile?.email ?? user?.email ?? ""}
        replyToEmail={storeExtra?.reply_to_email ?? ""}
        supportEmail={storeExtra?.support_email ?? ""}
        currency={storeExtra?.currency ?? "INR"}
        timezone={storeExtra?.timezone ?? ""}
        legalName={storeExtra?.legal_name ?? ""}
        gstin={storeExtra?.gstin ?? ""}
        gstRate={storeExtra?.gst_rate ?? null}
        billingBusinessName={billing.business_name ?? ""}
        billingAddress={billing.address ?? ""}
        billingCity={billing.city ?? ""}
        billingState={billing.state ?? ""}
        billingPostalCode={billing.postal_code ?? ""}
        billingPhone={billing.phone ?? ""}
        socialInstagram={socialLinks.instagram ?? ""}
        socialTwitter={socialLinks.twitter ?? ""}
        socialYoutube={socialLinks.youtube ?? ""}
        socialWebsite={socialLinks.website ?? ""}
        walletBalance={Number(storeExtra?.wallet_balance ?? 0)}
        customDomain={storeExtra?.custom_domain ?? null}
        customDomainVerified={storeExtra?.custom_domain_verified ?? null}
        primaryDomain={storeExtra?.primary_domain ?? null}
      />
    </>
  );
}
