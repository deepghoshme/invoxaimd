import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreCatalog } from "@/lib/sites";
import { formatPrice } from "@/lib/products";
import StoreBuilder from "@/components/store/StoreBuilder";
import { DEFAULT_STORE, STORE_SECTIONS, type StoreContent, type StoreProduct } from "@/lib/store";
import "../../dashboard/dx.css";
import "../../website.css";
import "../../store.css";

export const dynamic = "force-dynamic";

// Full-screen store builder (no dashboard chrome) — opened in a new tab.
export default async function StudioStore() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await sb.from("stores").select("id, store_name, subdomain, onboarding_completed").eq("owner_id", user.id).maybeSingle();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: page } = await sb.from("pages").select("content, status").eq("store_id", store.id).eq("page_type", "store").maybeSingle();
  const existing = page?.content as StoreContent | undefined;
  const content: StoreContent = existing && Object.keys(existing).length > 0
    ? { ...DEFAULT_STORE, ...existing }
    : { ...DEFAULT_STORE, store: store.store_name ?? "Your store" };

  const allKeys = STORE_SECTIONS.map((s) => s[0]);
  content.order = [...(content.order ?? []), ...allKeys.filter((k) => !(content.order ?? []).includes(k))];
  // Default missing keys to FALSE so a template that only lists its curated
  // sections is not overridden. Explicit true/false in content.sections are
  // preserved by the spread.
  content.sections = { ...Object.fromEntries(allKeys.map((k) => [k, false])), ...(content.sections ?? {}) };

  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io` : null;

  // The seller's real catalog products, so the builder preview shows the actual
  // store instead of placeholder samples. buyable:false → preview won't open a
  // live checkout from inside the builder.
  const catalog = await getStoreCatalog(store.id);
  const initialProducts: StoreProduct[] = catalog.map((r) => {
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
      buyable: false,
    };
  });

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard"><span className="dot" /> invoxai <em>Store Builder</em></a>
        <a className="studio-exit" href="/dashboard/store">Exit ✕</a>
      </div>
      <div className="studio-wrap">
        <StoreBuilder initial={content} publicUrl={publicUrl} initialStatus={page?.status ?? "draft"} initialProducts={initialProducts} />
      </div>
    </div>
  );
}
