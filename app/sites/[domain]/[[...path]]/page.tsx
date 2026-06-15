import type { Metadata } from "next";
import {
  resolveStoreByHost,
  getPublishedPage,
  pageTypeForPath,
  type SitePage,
} from "@/lib/sites";
import BioTemplate, { type BioContent } from "@/components/templates/BioTemplate";
import PixelInjector from "@/components/PixelInjector";

export const dynamic = "force-dynamic";

type Params = { domain: string; path?: string[] };

/** Resolve the page for a host+path, with a bio fallback for the site root. */
async function resolve(domain: string, path?: string[]) {
  const store = await resolveStoreByHost(domain);
  if (!store) return { store: null, page: null };

  const type = pageTypeForPath(path);
  let page: SitePage | null = type ? await getPublishedPage(store.id, type) : null;
  // Root (/) with no website yet → fall back to the bio page if published.
  if (!page && (!path || path.length === 0)) {
    page = await getPublishedPage(store.id, "bio");
  }
  return { store, page };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { domain, path } = await params;
  const { store, page } = await resolve(domain, path);
  if (!store) return { title: "Not found" };

  const seo = (page?.seo ?? {}) as Record<string, string>;
  const title = seo.title || page?.title || store.store_name || "invoxai.io";
  const description = seo.description || "";
  const robots = seo.robots === "noindex" ? { index: false, follow: false } : undefined;
  const canonical = seo.canonical || undefined;

  return {
    title,
    description,
    robots,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: seo.og_title || title,
      description: seo.og_description || description,
      images: seo.og_image ? [seo.og_image] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SitePage({ params }: { params: Promise<Params> }) {
  const { domain, path } = await params;
  const { store, page } = await resolve(domain, path);

  if (!store) {
    return <Notice title="Site not found" body="This address isn’t connected to a store." />;
  }
  if (!page) {
    return (
      <Notice
        title={store.store_name || "Coming soon"}
        body="This page hasn’t been published yet."
      />
    );
  }

  return (
    <>
      <PixelInjector pixels={page.pixels} />
      {page.page_type === "bio" ? (
        <BioTemplate
          content={page.content as BioContent}
          fallbackName={store.store_name ?? undefined}
        />
      ) : (
        <Notice title={page.title || store.store_name || ""} body="Template coming soon." />
      )}
    </>
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
