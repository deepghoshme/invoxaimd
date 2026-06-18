import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreGateway } from "@/lib/sites";
import ProductEditor from "@/app/dashboard/pages/products/[id]/ProductEditor";
import "../../../dashboard/dx.css";
import "../../../website.css";

export const dynamic = "force-dynamic";

// Full-screen product builder (no dashboard chrome) — opened in a new tab.
export default async function StudioProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await sb.from("stores").select("id, subdomain, onboarding_completed").eq("owner_id", user.id).maybeSingle();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: page } = await sb
    .from("pages")
    .select("id, title, public_id, content, seo, pixels, status, store_id, page_type")
    .eq("id", id)
    .maybeSingle();
  if (!page || page.store_id !== store.id || page.page_type !== "opp") notFound();

  const gateway = await getStoreGateway(store.id);
  const payEnabled = !!(gateway?.is_enabled && gateway.key_id && gateway.key_secret);
  const publicUrl = store.subdomain && page.public_id ? `https://${store.subdomain}.invoxai.io/opp/${page.public_id}` : null;

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard"><span className="dot" /> invoxai <em>Product Builder</em></a>
        <a className="studio-exit" href="/dashboard/store">Exit ✕</a>
      </div>
      <div className="studio-wrap">
        <ProductEditor
          page={{
            id: page.id,
            title: page.title,
            public_id: page.public_id,
            content: (page.content ?? {}) as Record<string, unknown>,
            seo: (page.seo ?? {}) as Record<string, unknown>,
            pixels: (page.pixels ?? {}) as Record<string, unknown>,
            status: page.status,
          }}
          publicUrl={publicUrl}
          payEnabled={payEnabled}
        />
      </div>
    </div>
  );
}
