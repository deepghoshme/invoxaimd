import { NextResponse } from "next/server";
import { resolveStoreByHost } from "@/lib/sites";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Map page_type → canonical URL prefix on the storefront.
// Singletons get a fixed path; many-types use /{prefix}/{public_id}.
const SINGLETON_PATHS: Record<string, string> = {
  website: "/",
  store: "/store",
  bio: "/bio",
  courses: "/courses",
};

// Many-type page_type → URL prefix (inverse of PREFIX_TO_TYPE in the catch-all)
const MANY_TYPE_PREFIX: Record<string, string> = {
  opp: "opp",
  pay: "pay",
  booking: "book", // page_type "booking" is served at /book/{public_id}
  ldf: "ldf",
  vpc: "vpc",
  led: "led",
  env: "env",
  course: "course",
  event: "event",
  vip: "vip",
};

type PageRow = {
  page_type: string;
  public_id: string | null;
  published_at: string | null;
  updated_at: string;
};

function buildSitemapXml(baseUrl: string, pages: PageRow[]): string {
  const urls: string[] = [];

  for (const row of pages) {
    const type = row.page_type;
    const lastmod = (row.published_at ?? row.updated_at).split("T")[0]; // YYYY-MM-DD

    if (type in SINGLETON_PATHS) {
      const path = SINGLETON_PATHS[type];
      urls.push(
        `  <url>\n    <loc>${baseUrl}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
      );
    } else if (type in MANY_TYPE_PREFIX && row.public_id) {
      const prefix = MANY_TYPE_PREFIX[type];
      urls.push(
        `  <url>\n    <loc>${baseUrl}/${prefix}/${row.public_id}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
      );
    }
    // Unknown types are silently skipped — never emit a broken URL.
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;

  const store = await resolveStoreByHost(domain);

  // No store → return an empty but valid sitemap (200).
  if (!store) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`,
      { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
  }

  // Derive the canonical base URL for this store (prefer primary_domain setting).
  const usesCustom =
    store.primary_domain === "custom" &&
    store.custom_domain &&
    store.custom_domain.length > 0;
  const baseHost = usesCustom ? store.custom_domain! : `${store.subdomain}.invoxai.io`;
  const baseUrl = `https://${baseHost}`;

  // Single query: all published pages for this store.
  // We only need page_type, public_id, published_at, updated_at.
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("pages")
    .select("page_type, public_id, published_at, updated_at")
    .eq("store_id", store.id)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error || !data || data.length === 0) {
    // Empty sitemap — store exists but has no published pages, or DB error.
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>`,
      { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
  }

  const xml = buildSitemapXml(baseUrl, data as PageRow[]);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Cache for 10 minutes on the CDN; revalidate in background.
      "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
