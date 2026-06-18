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

/** A published "many" page (opp/pay/…) resolved by its public_id. */
export async function getPublishedPageByPublicId(
  storeId: string,
  pageType: string,
  pid: string,
): Promise<SitePage | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("pages")
    .select("id, page_type, title, template_id, content, seo, pixels, status")
    .eq("store_id", storeId)
    .eq("page_type", pageType)
    .eq("public_id", pid)
    .eq("status", "published")
    .maybeSingle();
  return (data as SitePage | null) ?? null;
}

/** Count paid orders for a page (drives the live "seats left" counter). */
/** Published one-page products for a store (for the website "Shop" section). */
export async function getStoreProducts(storeId: string, limit = 8): Promise<{ id: string; public_id: string | null; title: string | null; content: Record<string, unknown> }[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("pages")
    .select("id, public_id, title, content")
    .eq("store_id", storeId)
    .eq("page_type", "opp")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as { id: string; public_id: string | null; title: string | null; content: Record<string, unknown> }[];
}

/** Visible store catalog products (the `products` table) for the storefront. */
export async function getStoreCatalog(storeId: string, limit = 60): Promise<Record<string, unknown>[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .eq("store_visible", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Record<string, unknown>[];
}

/** A single catalog product by id (service role) — used at checkout. */
export async function getProductById(productId: string): Promise<Record<string, unknown> | null> {
  const sb = createAdminClient();
  const { data } = await sb.from("products").select("*").eq("id", productId).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function getPaidOrderCount(pageId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("page_id", pageId)
    .eq("status", "paid");
  return count ?? 0;
}

/** Fetch a page by its uuid (service role) — used to read pixels/seo at checkout. */
export async function getPageById(pageId: string): Promise<SitePage | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("pages")
    .select("id, page_type, title, template_id, content, seo, pixels, status")
    .eq("id", pageId)
    .maybeSingle();
  return (data as SitePage | null) ?? null;
}

export type StoreGateway = {
  provider: string;
  key_id: string | null;
  key_secret: string | null;
  is_enabled: boolean;
};

/** Read a store's connected gateway (server-only; includes the secret). */
export async function getStoreGateway(storeId: string): Promise<StoreGateway | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("payment_gateways")
    .select("provider, key_id, key_secret, is_enabled")
    .eq("store_id", storeId)
    .maybeSingle();
  return (data as StoreGateway | null) ?? null;
}

/** The commission rate that applies to a store: override → category → default. */
export async function getStoreCommissionRate(storeId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data: store } = await supabase
    .from("stores")
    .select("commission_rate_override, category_id")
    .eq("id", storeId)
    .maybeSingle();
  if (store?.commission_rate_override != null) return Number(store.commission_rate_override);
  if (store?.category_id) {
    const { data: cat } = await supabase
      .from("business_categories")
      .select("commission_rate")
      .eq("id", store.category_id)
      .maybeSingle();
    if (cat?.commission_rate != null) return Number(cat.commission_rate);
  }
  return 0.05;
}

export type Order = {
  id: string;
  store_id: string;
  page_id: string | null;
  product_id?: string | null;
  page_type: string;
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  product_title: string | null;
  amount: number;
  currency: string;
  gateway: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  status: string;
  commission_rate: number | null;
  commission_amount: number | null;
  paid_at: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Insert a new order (service role — public checkout has no session). */
export async function createOrderRecord(input: {
  store_id: string;
  page_id: string | null;
  product_id?: string | null;
  page_type: string;
  product_title: string | null;
  amount: number;
  currency: string;
  commission_rate: number;
  commission_amount: number;
  buyer_email?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
}): Promise<Order | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({ ...input, status: "created" })
    .select("*")
    .single();
  if (error) return null;
  return data as Order;
}

/** Fetch an order by id (service role). */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  return (data as Order | null) ?? null;
}

/** Patch an order (service role) — set gateway ids / status / paid_at. */
export async function updateOrder(
  orderId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  return !error;
}

export type PlatformSettings = { show_brand_badge: boolean };

/**
 * Read the singleton platform settings (admin-controlled global switches).
 * Defaults to show_brand_badge=true and tolerates the table not existing yet
 * (before the migration is applied) so public pages never break.
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("show_brand_badge")
      .maybeSingle();
    return { show_brand_badge: data?.show_brand_badge ?? true };
  } catch {
    return { show_brand_badge: true };
  }
}

/** Legal/policy doc slugs (kept in sync with lib/website.ts LEGAL_DOCS). */
const LEGAL_KEYS = ["privacy", "terms", "refund", "shipping", "disclaimer", "cookies"];
/** Website sub-pages served by the single `website` page (real deep-link URLs). */
export const WEBSITE_SUBPATHS = ["about", "contact", ...LEGAL_KEYS];

/** Map a URL path to a singleton page type (Phase 1: website + bio). */
export function pageTypeForPath(path?: string[]): string | null {
  const seg = (path?.[0] ?? "").toLowerCase();
  if (!seg) return "website";
  if (WEBSITE_SUBPATHS.includes(seg)) return "website"; // /about, /contact, /privacy…
  if (["bio", "store", "courses"].includes(seg)) return seg;
  return null; // dynamic types (opp/pay/…) handled in later phases
}

/** The WebsiteView sub-page key for a URL path (home | about | legal:privacy | <custom slug>). */
export function websiteSubPage(path?: string[]): string {
  const seg = (path?.[0] ?? "").toLowerCase();
  if (!seg) return "home";
  if (seg === "about" || seg === "contact") return seg;
  if (LEGAL_KEYS.includes(seg)) return `legal:${seg}`;
  return seg; // custom page slug (validated in the renderer)
}
