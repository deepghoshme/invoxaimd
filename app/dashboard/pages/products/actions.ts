"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { publicId } from "@/lib/ids";

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

/**
 * Create a new draft one-page product; returns its id.
 * Optionally pick a design (`layout`) and/or prefill from an existing store
 * catalog product (`fromProductId`).
 */
export async function createProduct(
  opts?: { layout?: "landing" | "pdp"; fromProductId?: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const layout = opts?.layout === "pdp" ? "pdp" : "landing";
  let title = "New product";
  let content: Record<string, unknown> = { currency: "INR", cta_label: "Buy now", layout };

  if (opts?.fromProductId) {
    const { data: prod } = await supabase
      .from("products").select("*").eq("id", opts.fromProductId).eq("store_id", store.id).maybeSingle();
    if (prod) {
      title = prod.name ?? title;
      content = {
        ...content,
        headline: prod.name ?? undefined,
        category: prod.category ?? undefined,
        productType: prod.product_type ?? "digital",
        price: prod.price != null ? Number(prod.price) : undefined,
        compare_at_price: prod.compare_at_price != null ? Number(prod.compare_at_price) : undefined,
        currency: prod.currency ?? "INR",
        image_url: prod.image ?? undefined,
        gallery: Array.isArray(prod.gallery) ? prod.gallery : [],
        description_html: prod.description ? `<p>${prod.description}</p>` : undefined,
        badges: prod.badge ? [prod.badge] : [],
        plans: Array.isArray(prod.plans) ? prod.plans : [],
        digital: prod.digital ?? undefined,
        deliveryDays: prod.delivery_days ?? undefined,
      };
    }
  }

  const { data, error } = await supabase
    .from("pages")
    .insert({
      store_id: store.id,
      page_type: "opp",
      public_id: publicId(),
      template_id: layout === "pdp" ? "opp-pdp" : "opp-sunset",
      title,
      status: "draft",
      content,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/pages/products");
  return { ok: true, id: data.id };
}

/** Lightweight catalog list for the "start from existing product" picker. */
export async function listCatalogForPicker(): Promise<{ id: string; name: string; price: number | null; image: string | null }[]> {
  const { supabase, store } = await ownerStore();
  if (!store) return [];
  const { data } = await supabase.from("products").select("id, name, price, image").eq("store_id", store.id).order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id as string, name: (r.name as string) ?? "Untitled", price: r.price != null ? Number(r.price) : null, image: (r.image as string) ?? null }));
}

export type ProductSave = {
  title: string;
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  pixels: Record<string, unknown>;
};

export async function saveProduct(pageId: string, payload: ProductSave): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .update({
      title: payload.title,
      content: payload.content,
      seo: payload.seo,
      pixels: payload.pixels,
    })
    .eq("id", pageId)
    .eq("page_type", "opp");
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/pages/products/${pageId}`);
  revalidatePath("/dashboard/pages/products");
  return { ok: true };
}

export async function setProductStatus(
  pageId: string,
  status: "draft" | "published",
): Promise<Result> {
  const supabase = await createClient();

  // Backstop the publish requirements server-side (can't be bypassed by a client).
  if (status === "published") {
    const { data: page } = await supabase
      .from("pages")
      .select("content")
      .eq("id", pageId)
      .eq("page_type", "opp")
      .maybeSingle();
    const c = (page?.content ?? {}) as { price?: number; seller_email?: string };
    if (!c.price || Number(c.price) <= 0) {
      return { ok: false, error: "Set a price above 0 before publishing." };
    }
    if (!c.seller_email || !String(c.seller_email).trim()) {
      return { ok: false, error: "Add a seller contact email before publishing (required)." };
    }
  }

  const { error } = await supabase
    .from("pages")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", pageId)
    .eq("page_type", "opp");
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/pages/products/${pageId}`);
  revalidatePath("/dashboard/pages/products");
  return { ok: true };
}

/** Delete a product page. */
export async function deleteProduct(pageId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", pageId)
    .eq("page_type", "opp");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/pages/products");
  return { ok: true };
}
