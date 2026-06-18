import { createClient } from "@/lib/supabase/server";
import BrandingClient from "./BrandingClient";

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  const sb = await createClient();

  const { data: ps } = await sb
    .from("platform_settings")
    .select("platform_name, logo_url, favicon_url, invoice_footer, show_brand_badge")
    .eq("id", true)
    .maybeSingle();

  const row = ps as {
    platform_name?: string | null;
    logo_url?: string | null;
    favicon_url?: string | null;
    invoice_footer?: string | null;
    show_brand_badge?: boolean | null;
  } | null;

  return (
    <BrandingClient
      platformName={row?.platform_name ?? ""}
      logoUrl={row?.logo_url ?? ""}
      faviconUrl={row?.favicon_url ?? ""}
      invoiceFooter={row?.invoice_footer ?? ""}
      showBrandBadge={row?.show_brand_badge ?? true}
      newColsExist={row != null && "logo_url" in (row ?? {})}
    />
  );
}
