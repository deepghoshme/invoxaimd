"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export type TemplateRow = {
  id: string;
  name: string;
  type: string;
  tier: string;
  price_paise: number;
  thumbnail_url: string | null;
  description: string | null;
  status: string;
  sales_count: number;
  created_at: string;
};

export type TemplateInput = {
  name: string;
  type: string;
  tier: string;
  price_paise: number;
  thumbnail_url: string;
  description: string;
  status: string;
};

/** Fetch all templates (admin can see all statuses). Degrades gracefully if the table doesn't exist yet. */
export async function listTemplates(): Promise<{ rows: TemplateRow[]; migrationMissing: boolean }> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("templates")
    .select("id, name, type, tier, price_paise, thumbnail_url, description, status, sales_count, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    // 42P01 = undefined_table (pre-migration). Only treat truly missing table as
    // migrationMissing; surface all other errors so they aren't hidden.
    const genuinelyMissing =
      error.code === "42P01" ||
      (error.message?.toLowerCase().includes("does not exist") &&
        error.message?.toLowerCase().includes("relation"));
    if (genuinelyMissing) {
      return { rows: [], migrationMissing: true };
    }
    console.error("[admin/templates] listTemplates error:", error.message, error.code);
    throw new Error(error.message);
  }
  return { rows: (data ?? []) as TemplateRow[], migrationMissing: false };
}

export async function createTemplate(): Promise<Result<{ id: string }>> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("templates")
    .insert({ name: "New template", type: "bio", tier: "free", status: "draft" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb
    .from("templates")
    .update({
      name: input.name.trim() || "Template",
      type: input.type,
      tier: input.tier,
      price_paise: input.tier === "premium" ? Math.max(0, Number(input.price_paise) || 0) : 0,
      thumbnail_url: input.thumbnail_url.trim() || null,
      description: input.description.trim() || null,
      status: input.status,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true };
}

export async function toggleTemplateStatus(id: string, current: string): Promise<Result> {
  const next = current === "published" ? "draft" : "published";
  const sb = await createClient();
  const { error } = await sb.from("templates").update({ status: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true };
}
