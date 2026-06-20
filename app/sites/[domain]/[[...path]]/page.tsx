import type { Metadata } from "next";
import {
  resolveStoreByHost,
  getPublishedPage,
  getPublishedPageByPublicId,
  getPageById,
  getStoreGateway,
  getOrderById,
  getPaidOrderCount,
  getPlatformSettings,
  getStoreProducts,
  getStoreCatalog,
  getProductById,
  getStoreSeoDefaults,
  getNewestPublishedPage,
  pageTypeForPath,
  websiteSubPage,
  type SitePage,
  type StoreSeoDefaults,
} from "@/lib/sites";
import { formatPrice, type OppContent } from "@/lib/products";
import { type ProductReview, type ReviewStats } from "@/components/templates/ReviewsSection";
import BioView from "@/components/bio/BioView";
import BioTracker from "@/components/bio/BioTracker";
import { type BioContent } from "@/lib/bio";
import WebsiteView from "@/components/website/WebsiteView";
import WebsiteTracker from "@/components/website/WebsiteTracker";
import { type WebsiteContent } from "@/lib/website";
import StoreView from "@/components/store/StoreView";
import ProductPage from "@/components/store/ProductPage";
import { type StoreContent } from "@/lib/store";
import { rowToProduct } from "@/lib/catalog";
import CourseView from "@/components/course/CourseView";
import { type CourseContent, type CourseModule, type CourseLesson } from "@/lib/course";
import BookingView from "@/components/booking/BookingView";
import { type BookingContent } from "@/lib/booking";
import EventView from "@/components/event/EventView";
import { type EventContent } from "@/lib/event";
import VipView from "@/components/vip/VipView";
import { type VipContent } from "@/lib/vip";
import LeadFormView from "@/components/leadform/LeadFormView";
import { type LeadFormContent } from "@/lib/leadform";
import "../../../bio.css";
import "../../../website.css";
import "../../../store.css";
import "../../../booking.css";
import ProductTemplate from "@/components/templates/ProductTemplate";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import PixelInjector from "@/components/PixelInjector";

export const dynamic = "force-dynamic";

type Params = { domain: string; path?: string[] };

// Prefixed "many" page types addressed by /{prefix}/{public_id}.
const MANY_PREFIXES = new Set(["opp", "pay", "book", "ldf", "vpc", "led", "env", "course", "event", "vip"]);
// URL prefix → page_type (most match; booking is reached via /book/…)
const PREFIX_TO_TYPE: Record<string, string> = { book: "booking" };

/** Resolve the page for a host+path, with a bio fallback for the site root. */
async function resolve(domain: string, path?: string[]) {
  const store = await resolveStoreByHost(domain);
  if (!store) return { store: null, page: null };

  // Extra-subdomain alias with a page_id target: when the alias row targets a
  // specific page AND there is no explicit path (root request), resolve directly
  // to that page instead of the store root. Explicit paths (e.g. /opp/xyz) still
  // work normally — alias_page_id only overrides the root "/" resolution.
  const isRootRequest = !path || path.length === 0;
  if (store.alias_page_id && isRootRequest) {
    const { data: targetPage } = await import("@/lib/supabase/admin").then(
      async ({ createAdminClient }) =>
        createAdminClient()
          .from("pages")
          .select("id, page_type, title, template_id, content, seo, pixels, status")
          .eq("id", store.alias_page_id!)
          .eq("store_id", store.id)
          .eq("status", "published")
          .maybeSingle(),
    );
    // If the targeted page is published and belongs to this store, serve it.
    // Otherwise fall through to the standard root resolution (safe degradation).
    if (targetPage) return { store, page: targetPage as SitePage };
  }

  // /{prefix}/{public_id} (not /checkout/…) → a "many" page.
  const seg0 = (path?.[0] ?? "").toLowerCase();
  if (MANY_PREFIXES.has(seg0) && path?.[1] && path[1].toLowerCase() !== "checkout") {
    const page = await getPublishedPageByPublicId(store.id, PREFIX_TO_TYPE[seg0] ?? seg0, path[1]);
    return { store, page };
  }

  const type = pageTypeForPath(path);
  let page: SitePage | null = type ? await getPublishedPage(store.id, type) : null;
  if (!page && isRootRequest) {
    // Root-path fallback precedence: website > store > bio > newest-published-of-any-type.
    // pageTypeForPath already tried "website" above; only fall through if that missed.
    page = await getPublishedPage(store.id, "store");
    if (!page) page = await getPublishedPage(store.id, "bio");
    if (!page) page = await getNewestPublishedPage(store.id);
  }
  // Custom website page: a single unknown segment that matches a page slug.
  if (!page && path && path.length === 1 && !MANY_PREFIXES.has(seg0)) {
    const wp = await getPublishedPage(store.id, "website");
    const pages = ((wp?.content as { pages?: { slug: string }[] } | undefined)?.pages) ?? [];
    if (wp && pages.some((p) => p.slug === seg0)) page = wp;
  }
  return { store, page };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { domain, path } = await params;
  const seg0 = (path?.[0] ?? "").toLowerCase();
  if (MANY_PREFIXES.has(seg0) && path?.[1]?.toLowerCase() === "checkout") {
    return { title: "Checkout", robots: { index: false, follow: false } };
  }

  const { store, page } = await resolve(domain, path);
  if (!store) return { title: "Not found" };

  // Fetch store-level SEO defaults (graceful — returns nulls if migration unapplied).
  const storeSeo = await getStoreSeoDefaults(store.id);

  const seo = (page?.seo ?? {}) as Record<string, string>;
  // Website pages keep their SEO + favicon inside content (single JSONB blob).
  const content = (page?.content ?? {}) as { seo?: { title?: string; description?: string; ogImage?: string }; favicon?: string };
  const wsSeo = page?.page_type === "website" ? (content.seo ?? {}) : {};
  const favicon = page?.page_type === "website" ? content.favicon : undefined;

  // Resolution: page-level seo column → website content.seo → store defaults → fallback.
  const title =
    seo.title || wsSeo.title || page?.title ||
    storeSeo.default_meta_title || store.store_name || "invoxai.io";
  const description =
    seo.description || wsSeo.description ||
    storeSeo.default_meta_description || "";
  const ogImage = seo.og_image || wsSeo.ogImage || storeSeo.og_image_url || undefined;

  // noindex: page-level "noindex" flag OR store-level seo_indexable=false.
  const noindex = seo.robots === "noindex" || !storeSeo.seo_indexable;
  const robots = noindex ? { index: false, follow: false } : undefined;
  const canonical = seo.canonical || undefined;

  return {
    title,
    description,
    robots,
    icons: favicon ? { icon: favicon, shortcut: favicon, apple: favicon } : undefined,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: seo.og_title || title,
      description: seo.og_description || description,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SitePage({ params }: { params: Promise<Params> }) {
  const { domain, path } = await params;
  const seg0 = (path?.[0] ?? "").toLowerCase();

  // Page-type-aware checkout: /{page_type}/checkout/{order_id}
  if (MANY_PREFIXES.has(seg0) && path?.[1]?.toLowerCase() === "checkout" && path[2]) {
    return <Checkout domain={domain} pageType={seg0} orderId={path[2]} />;
  }

  // Catalog product detail page (Shopify-style): /p/{product_id}
  if (seg0 === "p" && path?.[1]) {
    return <CatalogProductPage domain={domain} productId={path[1]} />;
  }

  const { store, page } = await resolve(domain, path);
  if (!store) {
    return <Notice title="Site not found" body="This address isn’t connected to a store." />;
  }

  // Suspension check — graceful if the column doesn’t exist yet (migration unapplied).
  const isSuspended = await isStoreSuspended(store.id);
  if (isSuspended) {
    return <StoreSuspended storeName={store.store_name} />;
  }

  if (!page) {
    return (
      <Notice
        title={store.store_name || "Coming soon"}
        body="This page hasn’t been published yet."
      />
    );
  }

  // Store-level SEO defaults + pixel IDs (graceful — nulls if migration unapplied).
  const storeSeo = await getStoreSeoDefaults(store.id);

  const { show_brand_badge } = await getPlatformSettings();

  if (page.page_type === "opp") {
    const gateway = await getStoreGateway(store.id);
    const payEnabled = !!(gateway?.is_enabled && gateway.key_id && gateway.key_secret);
    const [sold, { reviews: oppReviews, stats: oppReviewStats }] = await Promise.all([
      getPaidOrderCount(page.id),
      fetchProductReviews({ page_id: page.id }),
    ]);
    return (
      <>
        <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
        <ProductTemplate
          content={page.content as OppContent}
          pageId={page.id}
          fallbackTitle={page.title ?? store.store_name ?? undefined}
          payEnabled={payEnabled}
          showBrand={show_brand_badge}
          sold={sold}
          storeName={store.store_name ?? "Store"}
          reviews={oppReviews}
          reviewStats={oppReviewStats}
        />
      </>
    );
  }

  if (page.page_type === "website") {
    const raw = await getStoreProducts(store.id);
    const products = raw.map((p) => {
      const ct = (p.content ?? {}) as OppContent;
      return {
        title: p.title || ct.headline || "Product",
        img: (ct.gallery ?? []).filter(Boolean)[0] || ct.image_url || "",
        price: ct.price ? formatPrice(ct.price, ct.currency) : "",
        compareAt: ct.compare_at_price ? formatPrice(ct.compare_at_price, ct.currency) : "",
        url: p.public_id ? `/opp/${p.public_id}` : "#",
      };
    });
    return (
      <>
        <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
        <WebsiteView content={page.content as WebsiteContent} showBrand={show_brand_badge} track={{ pageId: page.id, storeId: store.id }} initialPage={websiteSubPage(path)} products={products} stage live />
        <WebsiteTracker pageId={page.id} storeId={store.id} />
      </>
    );
  }

  if (page.page_type === "store") {
    const rows = await getStoreCatalog(store.id);
    const products = rows.map((r) => {
      const price = r.price != null ? Number(r.price) : undefined;
      const currency = (r.currency as string) || "INR";
      return {
        id: String(r.id),
        name: (r.name as string) || "Product",
        cat: (r.category as string) || "Shop",
        price: price != null ? formatPrice(price, currency) : "",
        compareAt: r.compare_at_price != null ? formatPrice(Number(r.compare_at_price), currency) : "",
        img: (r.image as string) || (Array.isArray(r.gallery) ? (r.gallery as string[])[0] : "") || "",
        badge: (r.badge as string) || undefined,
        url: `/p/${r.id}`,
        priceNum: price,
        currency,
        buyable: true,
      };
    });
    const gateway = await getStoreGateway(store.id);
    const payEnabled = !!(gateway?.is_enabled && gateway.key_id && gateway.key_secret);
    return (
      <>
        <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
        <StoreView content={page.content as StoreContent} products={products} payEnabled={payEnabled} stage />
        <WebsiteTracker pageId={page.id} storeId={store.id} />
      </>
    );
  }

  if (page.page_type === "course") {
    const gateway = await getStoreGateway(store.id);
    const payEnabled = !!(gateway?.is_enabled && gateway.key_id && gateway.key_secret);
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    let courseModules: CourseModule[] = [];
    try {
      const { data: modRows } = await admin
        .from("course_modules").select("id, page_id, title, sort_order")
        .eq("page_id", page.id).order("sort_order", { ascending: true });
      if (modRows && modRows.length) {
        const modIds = (modRows as { id: string }[]).map((m) => m.id);
        const { data: lesRows } = await admin
          .from("course_lessons")
          .select("id, module_id, title, video_url, duration, is_free_preview, sort_order, content")
          .in("module_id", modIds).order("sort_order", { ascending: true });
        const byMod = new Map<string, CourseLesson[]>();
        for (const l of ((lesRows ?? []) as CourseLesson[])) {
          const k = (l as unknown as { module_id: string }).module_id;
          if (!byMod.has(k)) byMod.set(k, []);
          byMod.get(k)!.push(l);
        }
        courseModules = (modRows as { id: string; page_id: string; title: string; sort_order: number }[]).map((m) => ({
          id: m.id, page_id: m.page_id, title: m.title, sort_order: m.sort_order, lessons: byMod.get(m.id) ?? [],
        }));
      }
    } catch { /* tables not applied yet */ }
    return (
      <>
        <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
        <CourseView page={{ id: page.id, public_id: (page as { public_id?: string | null }).public_id ?? null, content: page.content as CourseContent, status: page.status }} modules={courseModules} storeName={store.store_name ?? "Academy"} pageId={page.id} payEnabled={payEnabled} enrolled={false} />
      </>
    );
  }

  if (page.page_type === "booking") {
    return (
      <>
        <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
        <BookingView content={page.content as BookingContent} pageId={page.id} publicUrl={`/book/${(page as { public_id?: string | null }).public_id ?? ""}`} storeName={store.store_name ?? "Store"} />
      </>
    );
  }

  if (page.page_type === "event") {
    const gateway = await getStoreGateway(store.id);
    const payEnabled = !!(gateway?.is_enabled && gateway.key_id && gateway.key_secret);
    return (
      <>
        <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
        <EventView content={page.content as EventContent} pageId={page.id} storeName={store.store_name ?? "Store"} payEnabled={payEnabled} />
      </>
    );
  }

  if (page.page_type === "vip") {
    const gateway = await getStoreGateway(store.id);
    const payEnabled = !!(gateway?.is_enabled && gateway.key_id && gateway.key_secret);
    const memberCount = await getPaidOrderCount(page.id);
    return (
      <>
        <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
        <VipView content={page.content as VipContent} pageId={page.id} storeName={store.store_name ?? "Store"} memberCount={memberCount} payEnabled={payEnabled} stage={false} />
      </>
    );
  }

  if (page.page_type === "ldf") {
    return (
      <>
        <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
        <LeadFormView
          content={page.content as LeadFormContent}
          pageId={page.id}
          storeId={store.id}
        />
      </>
    );
  }

  return (
    <>
      <PixelInjector pixels={page.pixels as { meta_pixel_id?: string; google_id?: string }} storePixels={storeSeo} />
      {page.page_type === "bio" ? (
        <>
          <BioView content={page.content as BioContent} showBrand={show_brand_badge} track={{ pageId: page.id, storeId: store.id }} stage />
          <BioTracker pageId={page.id} storeId={store.id} />
        </>
      ) : (
        <ComingSoon storeName={store.store_name} pageTitle={page.title} />
      )}
    </>
  );
}

async function CatalogProductPage({ domain, productId }: { domain: string; productId: string }) {
  const store = await resolveStoreByHost(domain);
  if (!store) return <Notice title="Site not found" body="This address isn’t connected to a store." />;
  const suspended = await isStoreSuspended(store.id);
  if (suspended) return <StoreSuspended storeName={store.store_name} />;

  const row = await getProductById(productId);
  if (!row || row.store_id !== store.id || row.store_visible === false) {
    return <Notice title={store.store_name || "Store"} body="This product isn’t available." />;
  }
  const product = rowToProduct(row);

  const storePage = await getPublishedPage(store.id, "store");
  const storeContent = (storePage?.content ?? {}) as StoreContent;
  const gateway = await getStoreGateway(store.id);
  const payEnabled = !!(gateway?.is_enabled && gateway.key_id && gateway.key_secret);

  // Store-level SEO / pixel defaults.
  const storeSeo = await getStoreSeoDefaults(store.id);

  // "You may also like" — other visible products from the same store.
  const [relRows, { reviews: catalogReviews, stats: catalogReviewStats }] = await Promise.all([
    getStoreCatalog(store.id, 12),
    fetchProductReviews({ product_id: product.id }),
  ]);
  const related = relRows
    .filter((r) => String(r.id) !== product.id)
    .slice(0, 4)
    .map((r) => ({
      id: String(r.id),
      name: (r.name as string) || "Product",
      image: (r.image as string) || (Array.isArray(r.gallery) ? (r.gallery as string[])[0] : "") || "",
      price: r.price != null ? formatPrice(Number(r.price), (r.currency as string) || "INR") : "",
    }));

  return (
    <>
      <PixelInjector
        pixels={storePage ? (storePage.pixels as { meta_pixel_id?: string; google_id?: string }) : undefined}
        storePixels={storeSeo}
      />
      <ProductPage product={product} store={storeContent} storeName={store.store_name ?? "Store"} storeUrl="/store" payEnabled={payEnabled} related={related} realReviews={catalogReviews} realReviewStats={catalogReviewStats} />
      {storePage && <WebsiteTracker pageId={storePage.id} storeId={store.id} />}
    </>
  );
}

async function Checkout({
  domain,
  pageType,
  orderId,
}: {
  domain: string;
  pageType: string;
  orderId: string;
}) {
  const store = await resolveStoreByHost(domain);
  const order = await getOrderById(orderId);

  // Order must exist, belong to THIS store, and match the page type in the URL.
  // URL prefixes may differ from stored page_type (e.g. "book" → page_type "booking"),
  // so resolve the URL prefix back to the canonical page_type before comparing.
  const resolvedPageType = PREFIX_TO_TYPE[pageType] ?? pageType;
  if (!store || !order || order.store_id !== store.id || order.page_type !== resolvedPageType) {
    return <Notice title="Order not found" body="This checkout link is invalid or expired." />;
  }

  // Suspended stores cannot transact.
  const suspended = await isStoreSuspended(store.id);
  if (suspended) return <StoreSuspended storeName={store.store_name} />;

  const sourcePage = order.page_id ? await getPageById(order.page_id) : null;
  const storeSeo = await getStoreSeoDefaults(store.id);

  return (
    <main className="checkout-page">
      <PixelInjector
        pixels={(sourcePage?.pixels ?? {}) as { meta_pixel_id?: string; google_id?: string }}
        storePixels={storeSeo}
      />
      <CheckoutForm
        order={{
          id: order.id,
          product_title: order.product_title,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
        }}
        storeName={store.store_name ?? "Store"}
      />
    </main>
  );
}

/**
 * Fetch approved + visible product_reviews for a page (opp) or product
 * (catalog). Returns { reviews, stats } — gracefully returns empty on error
 * (e.g. if the migration hasn't been applied yet).
 */
async function fetchProductReviews(
  filter: { page_id: string } | { product_id: string },
  limit = 50,
): Promise<{ reviews: ProductReview[]; stats: ReviewStats }> {
  const empty = { reviews: [], stats: { avg: 0, count: 0 } };
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const sb = createAdminClient();
    let q = sb
      .from("product_reviews")
      .select("id, buyer_name, buyer_email, rating, body, created_at, seller_reply, replied_at")
      .eq("is_visible", true)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);
    if ("page_id" in filter) {
      q = q.eq("page_id", filter.page_id);
    } else {
      q = q.eq("product_id", filter.product_id);
    }
    const { data, error } = await q;
    if (error || !data || !data.length) return empty;
    const rows = data as ProductReview[];
    const count = rows.length;
    const avg = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return { reviews: rows, stats: { avg, count } };
  } catch {
    return empty;
  }
}

/**
 * Check if a store is suspended.
 * Gracefully returns false if the `suspended` column doesn't exist yet
 * (migration unapplied) — we never 500 on a missing column.
 */
async function isStoreSuspended(storeId: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("stores")
      .select("suspended")
      .eq("id", storeId)
      .maybeSingle();
    if (error) return false; // column missing or other DB error → fail open
    return !!(data as { suspended?: boolean } | null)?.suspended;
  } catch {
    return false;
  }
}

function StoreSuspended({ storeName }: { storeName: string | null }) {
  const name = storeName || "This store";
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-4, 32px) var(--space-3, 24px)",
        background: "var(--color-bg, #f9fafb)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          background: "var(--color-card, #fff)",
          border: "1px solid var(--color-border, #e5e7eb)",
          borderRadius: 20,
          padding: "40px 32px",
          boxShadow: "0 4px 24px rgba(0,0,0,.07)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: "var(--brand-gradient, linear-gradient(135deg,#ff4d7d,#a855f7))",
            display: "grid",
            placeItems: "center",
            fontSize: 32,
            margin: "0 auto 24px",
            boxShadow: "0 14px 36px -10px rgba(168,85,247,.35)",
          }}
        >
          🔒
        </div>
        <h1
          style={{
            fontFamily: "var(--font-heading, inherit)",
            fontSize: "clamp(1.2rem, 4vw, 1.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
            color: "var(--color-text, #111827)",
          }}
        >
          {name}
        </h1>
        <p
          style={{
            color: "var(--color-muted, #6b7280)",
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          This store is currently unavailable.
        </p>
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--space-3)" }}>
      <div className="card" style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ marginTop: 0 }}>{title}</h1>
        <p className="muted">{body}</p>
      </div>
    </main>
  );
}

/**
 * Polished branded fallback for page types that exist in the DB (courses, pay,
 * book, ldf, vpc, led, env) but don't yet have a public renderer. Uses the
 * global design tokens so it respects the user's OS-level light/dark preference
 * and the site's colour scheme — never looks broken.
 */
function ComingSoon({
  storeName,
  pageTitle,
}: {
  storeName: string | null;
  pageTitle: string | null;
}) {
  const name = storeName || "This store";
  const label = pageTitle || "This page";
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4) var(--space-3)",
        background: "var(--color-bg)",
        textAlign: "center",
      }}
    >
      {/* Brand accent bar */}
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 5,
          borderRadius: 99,
          background: "var(--brand-gradient)",
          marginBottom: "var(--space-3)",
        }}
      />
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: "clamp(1.25rem, 4vw, 1.75rem)",
          color: "var(--color-text)",
          letterSpacing: "-0.02em",
          marginBottom: "var(--space-1)",
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          fontSize: "clamp(0.95rem, 3vw, 1.15rem)",
          color: "var(--color-primary)",
          marginBottom: "var(--space-2)",
        }}
      >
        {label}
      </div>
      <p
        style={{
          color: "var(--color-muted)",
          fontSize: "0.9375rem",
          maxWidth: 360,
          lineHeight: 1.6,
          margin: "0 auto",
        }}
      >
        We&rsquo;re putting the finishing touches on this page. Check back soon.
      </p>
    </main>
  );
}
