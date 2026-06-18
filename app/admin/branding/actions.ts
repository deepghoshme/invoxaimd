"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Not authenticated." };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { supabase: null, error: "Admin access required." };
  return { supabase, error: null };
}

/**
 * Save branding settings: platform_name, logo_url, favicon_url, invoice_footer.
 * show_brand_badge reuses the existing setBrandBadge action from app/admin/actions.ts
 * via client-side BrandBadgeToggle — we intentionally keep that wiring separate.
 *
 * Columns platform_name, logo_url, favicon_url, invoice_footer are added by migration
 * 20260618260000. Until applied, writes to those columns will fail gracefully here.
 */
export async function saveBrandingSettings(fd: FormData): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const platformName = (fd.get("platform_name") as string | null)?.trim() ?? "";
  const logoUrl = (fd.get("logo_url") as string | null)?.trim() ?? "";
  const faviconUrl = (fd.get("favicon_url") as string | null)?.trim() ?? "";
  const invoiceFooter = (fd.get("invoice_footer") as string | null)?.trim() ?? "";
  const showBrandBadge = fd.get("show_brand_badge") === "true";

  if (platformName && platformName.length > 80) {
    return { ok: false, error: "Platform name must be 80 characters or fewer." };
  }
  if (invoiceFooter && invoiceFooter.length > 200) {
    return { ok: false, error: "Invoice footer must be 200 characters or fewer." };
  }

  // show_brand_badge always exists — safe to update unconditionally.
  const basePayload: Record<string, unknown> = { show_brand_badge: showBrandBadge };

  // Try full payload first (requires migration).
  const fullPayload: Record<string, unknown> = {
    ...basePayload,
    ...(platformName ? { platform_name: platformName } : {}),
    ...(logoUrl ? { logo_url: logoUrl } : {}),
    ...(faviconUrl ? { favicon_url: faviconUrl } : {}),
    ...(invoiceFooter ? { invoice_footer: invoiceFooter } : {}),
  };

  const { error } = await supabase
    .from("platform_settings")
    .update(fullPayload)
    .eq("id", true);

  if (error) {
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      // Fall back: save only show_brand_badge (always exists).
      const { error: e2 } = await supabase
        .from("platform_settings")
        .update(basePayload)
        .eq("id", true);
      if (e2) return { ok: false, error: e2.message };
      revalidatePath("/admin/branding");
      return {
        ok: true,
        error:
          "Badge toggle saved. Platform name, logo, favicon, and invoice footer will persist after migration 20260618260000 is applied.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/branding");
  return { ok: true };
}
