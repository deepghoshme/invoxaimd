import { NextResponse } from "next/server";
import { resolveStoreByHost, getStoreSeoDefaults } from "@/lib/sites";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;

  const store = await resolveStoreByHost(domain);

  // No store → block all crawlers (unknown host).
  if (!store) {
    const body = `User-agent: *\nDisallow: /\n`;
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Derive the canonical sitemap URL for this store.
  const usesCustom =
    store.primary_domain === "custom" &&
    store.custom_domain &&
    store.custom_domain.length > 0;
  const baseHost = usesCustom ? store.custom_domain! : `${store.subdomain}.invoxai.io`;
  const sitemapUrl = `https://${baseHost}/sitemap.xml`;

  // Check the per-store seo_indexable flag.
  const seoDefaults = await getStoreSeoDefaults(store.id);

  let body: string;
  if (seoDefaults.seo_indexable) {
    body = `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`;
  } else {
    // Store owner has disabled search indexing — block all crawlers.
    body = `User-agent: *\nDisallow: /\n`;
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Cache for 5 minutes; the flag change should propagate quickly.
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
