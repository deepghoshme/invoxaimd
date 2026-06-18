import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WebsiteBuilder from "@/components/website/WebsiteBuilder";
import { DEFAULT_WEBSITE, SECTIONS, LEGAL_DOCS, type WebsiteContent } from "@/lib/website";
import "../../dashboard/dx.css";
import "../../website.css";

export const dynamic = "force-dynamic";

// Full-screen website builder (no dashboard sidebar/topbar) — opened in a new tab.
export default async function StudioWebsite() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await sb
    .from("stores")
    .select("id, store_name, subdomain, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: site } = await sb
    .from("pages")
    .select("content, status")
    .eq("store_id", store.id)
    .eq("page_type", "website")
    .maybeSingle();

  const existing = site?.content as WebsiteContent | undefined;
  const content: WebsiteContent = existing && Object.keys(existing).length > 0
    ? { ...DEFAULT_WEBSITE, ...existing }
    : { ...DEFAULT_WEBSITE, site: store.store_name ?? "Your brand" };

  // Backfill sections + legal docs added after this site was first saved.
  const allKeys = SECTIONS.map((s) => s[0]);
  content.order = [...(content.order ?? []), ...allKeys.filter((k) => !(content.order ?? []).includes(k))];
  content.sections = { ...Object.fromEntries(allKeys.map((k) => [k, true])), ...(content.sections ?? {}) };
  content.legal = { ...(DEFAULT_WEBSITE.legal ?? {}), ...(content.legal ?? {}) };
  for (const [k, label] of LEGAL_DOCS) content.legal[k] ??= { on: false, title: label, text: "" };

  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io` : null;

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard"><span className="dot" /> invoxai <em>Website Builder</em></a>
        <a className="studio-exit" href="/dashboard/website">Exit ✕</a>
      </div>
      <div className="studio-wrap">
        <WebsiteBuilder initial={content} publicUrl={publicUrl} initialStatus={site?.status ?? "draft"} />
      </div>
    </div>
  );
}
