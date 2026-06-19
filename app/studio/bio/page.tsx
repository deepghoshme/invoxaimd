import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BioBuilder from "@/components/bio/BioBuilder";
import { DEFAULT_BIO, type BioContent } from "@/lib/bio";
import "../../dashboard/dx.css";
import "../../bio.css";

export const dynamic = "force-dynamic";

/**
 * Full-screen Bio Builder (no dashboard chrome) — opened in a new tab.
 * Replaces the old redirect to /dashboard/pages/bio/edit.
 */
export default async function StudioBio() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await sb
    .from("stores")
    .select("id, store_name, subdomain, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: bio } = await sb
    .from("pages")
    .select("content, status")
    .eq("store_id", store.id)
    .eq("page_type", "bio")
    .maybeSingle();

  const existing = bio?.content as BioContent | undefined;
  const content: BioContent =
    existing && Object.keys(existing).length > 0
      ? { ...DEFAULT_BIO, ...existing }
      : {
          ...DEFAULT_BIO,
          name: store.store_name ?? "Your name",
          handle: "Add your headline",
          bio: "Write a short bio about yourself.",
          links: [{ ic: "🔗", t: "My first link", u: "", type: "link" }],
          socials: [{ platform: "instagram", url: "" }],
        };

  const publicUrl = store.subdomain
    ? `https://${store.subdomain}.invoxai.io/bio`
    : null;

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard">
          <span className="dot" /> invoxai <em>Bio Builder</em>
        </a>
        <a className="studio-exit" href="/dashboard/pages/bio">
          Exit ✕
        </a>
      </div>
      <div className="studio-wrap">
        <BioBuilder
          initial={content}
          publicUrl={publicUrl}
          initialStatus={bio?.status ?? "draft"}
        />
      </div>
    </div>
  );
}
