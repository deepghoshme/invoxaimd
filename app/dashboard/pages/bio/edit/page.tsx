import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import BioBuilder from "@/components/bio/BioBuilder";
import { DEFAULT_BIO, type BioContent } from "@/lib/bio";
import "../../../../bio.css";

export const dynamic = "force-dynamic";

export default async function BioEditPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  const { data: bio } = await sb
    .from("pages")
    .select("content, status")
    .eq("store_id", store.id)
    .eq("page_type", "bio")
    .maybeSingle();

  // Existing bio → load it. New bio → seed starter content (real store name) so
  // the builder preview is populated, not blank.
  const existing = bio?.content as BioContent | undefined;
  const content: BioContent = existing && Object.keys(existing).length > 0
    ? { ...DEFAULT_BIO, ...existing }
    : {
        ...DEFAULT_BIO,
        name: store.store_name ?? "Your name",
        handle: "Add your headline",
        bio: "Write a short bio about yourself.",
        links: [{ ic: "🔗", t: "My first link", u: "", type: "link" }],
        socials: [{ platform: "instagram", url: "" }],
      };
  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io/bio` : null;

  return <BioBuilder initial={content} publicUrl={publicUrl} initialStatus={bio?.status ?? "draft"} />;
}
