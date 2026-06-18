"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

async function websitePageId(): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: store } = await sb.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return { ok: false, error: "No store." };
  const { data: existing } = await sb.from("pages").select("id").eq("store_id", store.id).eq("page_type", "website").maybeSingle();
  if (existing) return { ok: true, id: existing.id };
  const { data, error } = await sb.from("pages").insert({ store_id: store.id, page_type: "website", template_id: "website", title: "My website", status: "draft" }).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function saveWebsite(content: Record<string, unknown>): Promise<Result> {
  const id = await websitePageId();
  if (!id.ok || !id.id) return { ok: false, error: id.error };
  const sb = await createClient();
  const { error } = await sb.from("pages").update({ content }).eq("id", id.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/website");
  return { ok: true };
}

export async function publishWebsite(content: Record<string, unknown>, publish: boolean): Promise<Result> {
  const id = await websitePageId();
  if (!id.ok || !id.id) return { ok: false, error: id.error };
  const sb = await createClient();
  const { error } = await sb.from("pages").update({ content, status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null }).eq("id", id.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/website");
  return { ok: true };
}
