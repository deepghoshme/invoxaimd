"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CatalogInput } from "@/lib/catalog";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string };

async function ownerStore() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, store: null as { id: string } | null };
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  return { supabase, store };
}

/** Whitelist + coerce the editable columns (never trust raw client shape). */
function clean(input: Partial<CatalogInput>) {
  const num = (v: unknown) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
  return {
    name: (input.name ?? "").toString().trim() || "Untitled product",
    description: (input.description ?? "").toString().trim() || null,
    price: num(input.price),
    compare_at_price: num(input.compare_at_price),
    currency: (input.currency || "INR").toString().toUpperCase(),
    image: (input.image ?? "").toString().trim() || null,
    gallery: Array.isArray(input.gallery) ? input.gallery.filter(Boolean) : [],
    category: (input.category ?? "").toString().trim() || null,
    badge: (input.badge ?? "").toString().trim() || null,
    product_type: ["digital", "physical", "service", "subscription"].includes(input.product_type as string) ? input.product_type : "digital",
    digital: input.digital ?? null,
    plans: Array.isArray(input.plans) ? input.plans.filter((p) => p?.label) : [],
    details: Array.isArray(input.details) ? input.details.filter((d) => d?.label || d?.value) : [],
    delivery_days: input.delivery_days != null && !isNaN(Number(input.delivery_days)) ? Number(input.delivery_days) : null,
    highlights: Array.isArray(input.highlights) ? input.highlights.map((h) => String(h).trim()).filter(Boolean) : [],
    options: Array.isArray(input.options) ? input.options.filter((o) => o?.name && (o.values ?? []).length).map((o) => ({ name: String(o.name).trim(), values: o.values.map((v) => String(v).trim()).filter(Boolean) })) : [],
    reviews: Array.isArray(input.reviews) ? input.reviews.filter((r) => r?.text || r?.name).map((r) => ({ name: String(r.name ?? "").trim() || "Verified buyer", rating: num(r.rating) ?? 5, text: String(r.text ?? "").trim(), date: r.date })) : [],
    rating: num(input.rating),
    reviews_count: num(input.reviews_count),
    stock: input.stock != null && !isNaN(Number(input.stock)) ? Number(input.stock) : null,
    sku: (input.sku ?? "").toString().trim() || null,
    vendor: (input.vendor ?? "").toString().trim() || null,
    shipping_info: (input.shipping_info ?? "").toString().trim() || null,
    returns_info: (input.returns_info ?? "").toString().trim() || null,
    trust_badges: Array.isArray(input.trust_badges) ? input.trust_badges.map((b) => String(b).trim()).filter(Boolean) : [],
    store_visible: input.store_visible !== false,
  };
}

export async function createCatalogProduct(input: Partial<CatalogInput>): Promise<{ ok: boolean; id?: string; error?: string }> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;
  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };
  const { data, error } = await supabase.from("products").insert({ store_id: store.id, ...clean(input) }).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/store");
  return { ok: true, id: data.id };
}

export async function updateCatalogProduct(id: string, input: Partial<CatalogInput>): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;
  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };
  const { error } = await supabase.from("products").update(clean(input)).eq("id", id).eq("store_id", store.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/store");
  return { ok: true };
}

export async function setProductVisible(id: string, visible: boolean): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;
  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };
  const { error } = await supabase.from("products").update({ store_visible: visible }).eq("id", id).eq("store_id", store.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/store");
  return { ok: true };
}

/** Persist catalog display order. Writes sort = position for each id, scoped to
 * the caller's own store (IDOR-safe). Kept separate from clean() because the
 * edit modal doesn't carry a sort value and would otherwise reset it. */
export async function reorderCatalogProducts(ids: string[]): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;
  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from("products").update({ sort: i }).eq("id", ids[i]).eq("store_id", store.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/dashboard/store");
  return { ok: true };
}

export async function deleteCatalogProduct(id: string): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;
  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };
  const { error } = await supabase.from("products").delete().eq("id", id).eq("store_id", store.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/store");
  return { ok: true };
}
