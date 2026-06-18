import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StoreBuilder from "@/components/store/StoreBuilder";
import { DEFAULT_STORE, STORE_SECTIONS, type StoreContent } from "@/lib/store";
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
  content.sections = { ...Object.fromEntries(allKeys.map((k) => [k, true])), ...(content.sections ?? {}) };

  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io` : null;

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard"><span className="dot" /> invoxai <em>Store Builder</em></a>
        <a className="studio-exit" href="/dashboard/store">Exit ✕</a>
      </div>
      <div className="studio-wrap">
        <StoreBuilder initial={content} publicUrl={publicUrl} initialStatus={page?.status ?? "draft"} />
      </div>
    </div>
  );
}
