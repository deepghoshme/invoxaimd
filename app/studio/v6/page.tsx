import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BuilderV6 from "@/components/builder/v6/BuilderV6";
import { ensureV6Page } from "./actions";
import "../../dashboard/dx.css";
import "./v6.css";

export const dynamic = "force-dynamic";

// Page Builder v6 — editor (Phase 5: persisted to public.pages, content.v=6).
export default async function StudioV6() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // Resolve-or-create the seller's v6 landing page (de-risk: one page type
  // first). landing → page_type 'opp'.
  const res = await ensureV6Page("landing");
  if (!res.ok || !res.doc) {
    if (res.error === "No store.") redirect("/onboarding");
    redirect("/dashboard");
  }

  return <BuilderV6 initial={res.doc!} />;
}
