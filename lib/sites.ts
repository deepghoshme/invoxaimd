import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const ROOT = "invoxai.io";

export type SiteStore = {
  id: string;
  store_name: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  primary_domain: string;
};

export type SitePage = {
  id: string;
  page_type: string;
  title: string | null;
  template_id: string | null;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  pixels: Record<string, unknown>;
  status: string;
};

/** Resolve a seller store from an incoming public host (subdomain or custom domain). */
export async function resolveStoreByHost(host: string): Promise<SiteStore | null> {
  const h = host.split(":")[0].toLowerCase();
  const supabase = createAdminClient();
  const cols = "id, store_name, subdomain, custom_domain, primary_domain";

  if (h.endsWith(`.${ROOT}`)) {
    const sub = h.slice(0, -(ROOT.length + 1));
    if (!sub || sub.includes(".")) return null;
    const { data } = await supabase
      .from("stores")
      .select(cols)
      .eq("subdomain", sub)
      .maybeSingle();
    return (data as SiteStore | null) ?? null;
  }

  // Custom domain (must be verified to serve).
  const { data } = await supabase
    .from("stores")
    .select(cols)
    .eq("custom_domain", h)
    .eq("custom_domain_verified", true)
    .maybeSingle();
  return (data as SiteStore | null) ?? null;
}

/** Fetch a published page of a given type for a store. */
export async function getPublishedPage(
  storeId: string,
  pageType: string,
): Promise<SitePage | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("pages")
    .select("id, page_type, title, template_id, content, seo, pixels, status")
    .eq("store_id", storeId)
    .eq("page_type", pageType)
    .eq("status", "published")
    .maybeSingle();
  return (data as SitePage | null) ?? null;
}

/** Map a URL path to a singleton page type (Phase 1: website + bio). */
export function pageTypeForPath(path?: string[]): string | null {
  const seg = (path?.[0] ?? "").toLowerCase();
  if (!seg) return "website";
  if (["bio", "store", "courses"].includes(seg)) return seg;
  return null; // dynamic types (opp/pay/…) handled in later phases
}
