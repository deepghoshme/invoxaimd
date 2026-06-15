"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

async function ownerStore() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, store: null as { id: string } | null };
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, store };
}

/** Ensure a (draft) bio page exists for this store; return its id. */
export async function ensureBioPage(): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const { data: existing } = await supabase
    .from("pages")
    .select("id")
    .eq("store_id", store.id)
    .eq("page_type", "bio")
    .maybeSingle();

  if (existing) return { ok: true, id: existing.id };

  const { data, error } = await supabase
    .from("pages")
    .insert({
      store_id: store.id,
      page_type: "bio",
      template_id: "bio-sunset",
      title: "My bio",
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export type BioSave = {
  title: string;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  pixels: Record<string, unknown>;
};

export async function saveBioPage(pageId: string, payload: BioSave): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({
      title: payload.title,
      content: payload.content,
      seo: payload.seo,
      pixels: payload.pixels,
    })
    .eq("id", pageId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/pages/bio");
  return { ok: true };
}

export async function setBioStatus(
  pageId: string,
  status: "draft" | "published",
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", pageId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/pages/bio");
  revalidatePath("/dashboard");
  return { ok: true };
}
