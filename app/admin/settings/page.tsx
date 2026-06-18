import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const sb = await createClient();

  // Load platform_settings — gracefully handle missing new columns.
  const { data: ps } = await sb
    .from("platform_settings")
    .select("platform_name, support_email")
    .eq("id", true)
    .maybeSingle();

  // Reserved subdomains — admin RLS, always available here (server + admin session).
  const { data: reserved } = await sb
    .from("reserved_subdomains")
    .select("name, reason")
    .order("name");

  return (
    <SettingsClient
      platformName={(ps as { platform_name?: string | null } | null)?.platform_name ?? ""}
      supportEmail={(ps as { support_email?: string | null } | null)?.support_email ?? ""}
      reserved={(reserved ?? []) as { name: string; reason: string | null }[]}
    />
  );
}
