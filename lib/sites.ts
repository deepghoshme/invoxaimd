import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

const ROOT = "invoxai.io";

export type SiteStore = {
  id: string;
  store_name: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  primary_domain: string;
};

/** Store-level SEO + pixel defaults (from the store_seo migration columns). */
export type StoreSeoDefaults = {
  default_meta_title: string | null;
  default_meta_description: string | null;
  og_image_url: string | null;
  meta_pixel_id: string | null;
  google_analytics_id: string | null;
  google_ads_id: string | null;
  seo_indexable: boolean;
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
  coupon_code?: string | null;
  discount_paise?: number | null;
  original_amount_paise?: number | null;
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
  // Coupon fields (optional — only present when a code was applied)
  coupon_code?: string | null;
  discount_paise?: number | null;
  original_amount_paise?: number | null;
  // Order-bump upsell (optional — only present when a bump was added)
  bump_offer_id?: string | null;
  bump_amount?: number | null;
  bump_title?: string | null;
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

/**
 * Fetch store-level SEO defaults + pixel IDs.
 * Gracefully returns safe defaults if the columns don't exist yet
 * (migration unapplied) — never throws, never 500s public pages.
 */
export async function getStoreSeoDefaults(storeId: string): Promise<StoreSeoDefaults> {
  const empty: StoreSeoDefaults = {
    default_meta_title: null,
    default_meta_description: null,
    og_image_url: null,
    meta_pixel_id: null,
    google_analytics_id: null,
    google_ads_id: null,
    seo_indexable: true,
  };
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("stores")
      .select(
        "default_meta_title, default_meta_description, og_image_url, meta_pixel_id, google_analytics_id, google_ads_id, seo_indexable",
      )
      .eq("id", storeId)
      .maybeSingle();
    if (!data) return empty;
    return {
      default_meta_title: (data as Record<string, unknown>).default_meta_title as string | null ?? null,
      default_meta_description: (data as Record<string, unknown>).default_meta_description as string | null ?? null,
      og_image_url: (data as Record<string, unknown>).og_image_url as string | null ?? null,
      meta_pixel_id: (data as Record<string, unknown>).meta_pixel_id as string | null ?? null,
      google_analytics_id: (data as Record<string, unknown>).google_analytics_id as string | null ?? null,
      google_ads_id: (data as Record<string, unknown>).google_ads_id as string | null ?? null,
      seo_indexable: ((data as Record<string, unknown>).seo_indexable as boolean | null) ?? true,
    };
  } catch {
    return empty;
  }
}

export type PlatformSettings = {
  show_brand_badge: boolean;
  logo_url: string | null;
  favicon_url: string | null;
  platform_name: string | null;
};

/**
 * Read the singleton platform settings (admin-controlled global switches +
 * branding). Defaults are safe and tolerate the table/columns not existing yet
 * so public pages never break. Wrapped in React cache() so the multiple callers
 * in one request (root layout metadata + the site renderer) share a single read.
 */
export const getPlatformSettings = cache(async function getPlatformSettings(): Promise<PlatformSettings> {
  const fallback: PlatformSettings = { show_brand_badge: true, logo_url: null, favicon_url: null, platform_name: null };
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("show_brand_badge, logo_url, favicon_url, platform_name")
      .maybeSingle();
    if (!data) return fallback;
    return {
      show_brand_badge: data.show_brand_badge ?? true,
      logo_url: (data.logo_url as string) ?? null,
      favicon_url: (data.favicon_url as string) ?? null,
      platform_name: (data.platform_name as string) ?? null,
    };
  } catch {
    return fallback;
  }
});

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
