import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BioEditor from "./BioEditor";

export const dynamic = "force-dynamic";

export default async function BioEditorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("stores")
    .select("id, subdomain, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store || !store.onboarding_completed) redirect("/onboarding");

  let { data: page } = await supabase
    .from("pages")
    .select("id, title, content, seo, pixels, status")
    .eq("store_id", store.id)
    .eq("page_type", "bio")
    .maybeSingle();

  if (!page) {
    const { data } = await supabase
      .from("pages")
      .insert({
        store_id: store.id,
        page_type: "bio",
        template_id: "bio-sunset",
        title: "My bio",
        status: "draft",
      })
      .select("id, title, content, seo, pixels, status")
      .single();
    page = data;
  }

  if (!page) redirect("/dashboard");

  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io/bio` : null;

  return <BioEditor page={page} publicUrl={publicUrl} />;
}
