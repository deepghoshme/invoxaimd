"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_STORE } from "@/lib/store";

type Result = { ok: boolean; error?: string };

async function storePageId(): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: store } = await sb.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return { ok: false, error: "No store." };
  const { data: existing } = await sb.from("pages").select("id").eq("store_id", store.id).eq("page_type", "store").maybeSingle();
  if (existing) return { ok: true, id: existing.id };
  const { data, error } = await sb.from("pages").insert({ store_id: store.id, page_type: "store", template_id: "store", title: "My store", status: "draft" }).select("id").single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function saveStore(content: Record<string, unknown>): Promise<Result> {
  const id = await storePageId();
  if (!id.ok || !id.id) return { ok: false, error: id.error };
  const sb = await createClient();
  const { error } = await sb.from("pages").update({ content }).eq("id", id.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/store");
  return { ok: true };
}

/** Save just the product list from the Store dashboard (merges into store content). */
export async function saveStoreProducts(products: unknown[]): Promise<Result> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: store } = await sb.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return { ok: false, error: "No store." };
  let { data: page } = await sb.from("pages").select("id, content").eq("store_id", store.id).eq("page_type", "store").maybeSingle();
  if (!page) {
    const ins = await sb.from("pages").insert({ store_id: store.id, page_type: "store", template_id: "store", title: "My store", status: "draft" }).select("id, content").single();
    if (ins.error) return { ok: false, error: ins.error.message };
    page = ins.data;
  }
  const existing = (page.content ?? {}) as Record<string, unknown>;
  const content = { ...DEFAULT_STORE, ...existing, products };
  const { error } = await sb.from("pages").update({ content }).eq("id", page.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/store");
  return { ok: true };
}

export async function publishStore(content: Record<string, unknown>, publish: boolean): Promise<Result> {
  const id = await storePageId();
  if (!id.ok || !id.id) return { ok: false, error: id.error };
  const sb = await createClient();
  const { error } = await sb.from("pages").update({ content, status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null }).eq("id", id.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/store");
  return { ok: true };
}
