"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string };

export type SeoFormData = {
  default_meta_title: string;
  default_meta_description: string;
  og_image_url: string;
  meta_pixel_id: string;
  google_analytics_id: string;
  google_ads_id: string;
  seo_indexable: boolean;
};

/**
 * Persist store-level SEO defaults + pixel IDs to the `stores` table.
 * Write-guarded: impersonating admins get a read-only error.
 */
export async function saveStoreSeo(data: SeoFormData): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const patch: Record<string, unknown> = {
    default_meta_title: data.default_meta_title.trim() || null,
    default_meta_description: data.default_meta_description.trim() || null,
    og_image_url: data.og_image_url.trim() || null,
    meta_pixel_id: data.meta_pixel_id.trim() || null,
    google_analytics_id: data.google_analytics_id.trim() || null,
    google_ads_id: data.google_ads_id.trim() || null,
    seo_indexable: data.seo_indexable,
  };

  const { error } = await sb
    .from("stores")
    .update(patch)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/seo");
  return { ok: true };
}
