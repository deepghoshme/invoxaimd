"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";
import { publicId } from "@/lib/ids";
import { DEFAULT_LEADFORM, type LeadFormContent } from "@/lib/leadform";

type Result = { ok: boolean; error?: string };

async function ownerStore() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, store: null as { id: string; subdomain: string | null } | null };
  const { data: store } = await sb
    .from("stores")
    .select("id, subdomain")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { sb, store };
}

/**
 * Create a new lead form page (draft) and redirect to its builder.
 */
export async function createLeadFormPage(): Promise<void> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) redirect("/dashboard/leadform");

  const { sb, store } = await ownerStore();
  if (!store) redirect("/dashboard/leadform");

  const pid = publicId(9);
  const { data, error } = await sb
    .from("pages")
    .insert({
      store_id: store.id,
      page_type: "ldf",
      public_id: pid,
      title: "New Lead Form",
      content: DEFAULT_LEADFORM as unknown as Record<string, unknown>,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) redirect("/dashboard/leadform");
  revalidatePath("/dashboard/leadform");
  redirect(`/studio/leadform/${data.id}`);
}

/** Save lead form page content. */
export async function saveLeadFormPage(
  pageId: string,
  content: LeadFormContent,
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: store } = await sb
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return { ok: false, error: "No store." };

  const { error } = await sb
    .from("pages")
    .update({
      content: content as unknown as Record<string, unknown>,
      title: content.headline || "Lead Form",
    })
    .eq("id", pageId)
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/leadform");
  return { ok: true };
}

/** Publish or unpublish a lead form page. */
export async function setLeadFormStatus(
  pageId: string,
  status: "draft" | "published",
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: store } = await sb
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return { ok: false, error: "No store." };

  const { error } = await sb
    .from("pages")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", pageId)
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/leadform");
  revalidatePath("/dashboard");
  return { ok: true };
}
