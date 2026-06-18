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
  pageTypeForPath,
  websiteSubPage,
  type SitePage,
  type StoreSeoDefaults,
} from "@/lib/sites";
import { formatPrice, type OppContent } from "@/lib/products";
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
import "../../../bio.css";
import "../../../website.css";
import "../../../store.css";
import ProductTemplate from "@/components/templates/ProductTemplate";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import PixelInjector from "@/components/PixelInjector";

export const dynamic = "force-dynamic";

type Params = { domain: string; path?: string[] };

// Prefixed "many" page types addressed by /{prefix}/{public_id}.
const MANY_PREFIXES = new Set(["opp", "pay", "book", "ldf", "vpc", "led", "env"]);

/** Resolve the page for a host+path, with a bio fallback for the site root. */
async function resolve(domain: string, path?: string[]) {
  const store = await resolveStoreByHost(domain);
  if (!store) return { store: null, page: null };

  // /{prefix}/{public_id} (not /checkout/…) → a "many" page.
  const seg0 = (path?.[0] ?? "").toLowerCase();
  if (MANY_PREFIXES.has(seg0) && path?.[1] && path[1].toLowerCase() !== "checkout") {
    const page = await getPublishedPageByPublicId(store.id, seg0, path[1]);
    return { store, page };
  }

  const type = pageTypeForPath(path);
  let page: SitePage | null = type ? await getPublishedPage(store.id, type) : null;
  if (!page && (!path || path.length === 0)) {
    page = await getPublishedPage(store.id, "bio");
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
    const sold = await getPaidOrderCount(page.id);
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
  const relRows = await getStoreCatalog(store.id, 12);
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
      <ProductPage product={product} store={storeContent} storeName={store.store_name ?? "Store"} storeUrl="/store" payEnabled={payEnabled} related={related} />
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
  if (!store || !order || order.store_id !== store.id || order.page_type !== pageType) {
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
