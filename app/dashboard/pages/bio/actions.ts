"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

async function bioPageId(): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: store } = await sb.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return { ok: false, error: "No store." };
  const { data: existing } = await sb.from("pages").select("id").eq("store_id", store.id).eq("page_type", "bio").maybeSingle();
  if (existing) return { ok: true, id: existing.id };
  const { data, error } = await sb.from("pages").insert({ store_id: store.id, page_type: "bio", template_id: "bio", title: "My bio", status: "draft" }).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function saveBio(content: Record<string, unknown>): Promise<Result> {
  const id = await bioPageId();
  if (!id.ok || !id.id) return { ok: false, error: id.error };
  const sb = await createClient();
  const { error } = await sb.from("pages").update({ content }).eq("id", id.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/pages/bio");
  return { ok: true };
}

export async function publishBio(content: Record<string, unknown>, publish: boolean): Promise<Result> {
  const id = await bioPageId();
  if (!id.ok || !id.id) return { ok: false, error: id.error };
  const sb = await createClient();
  const { error } = await sb.from("pages").update({ content, status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null }).eq("id", id.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/pages/bio");
  return { ok: true };
}
