"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertNotImpersonating } from "@/lib/impersonation";

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

export type UpsellOfferInput = {
  name: string;
  trigger_type: "any" | "product";
  trigger_product_id: string | null;
  offer_product_id: string;
  offer_kind: "bump" | "post_purchase";
  discount_type: "percent" | "flat" | "none";
  discount_value: number;
};

// Both offer_product_id and trigger_product_id are FK'd to products.id. Validate
// the referenced products belong to this store before writing, so an invalid id
// returns a clear message instead of a raw foreign-key constraint error.
async function validateProductRefs(
  supabase: Awaited<ReturnType<typeof ownerStore>>["supabase"],
  storeId: string,
  input: UpsellOfferInput
): Promise<string | null> {
  const ids = [input.offer_product_id];
  if (input.trigger_type === "product" && input.trigger_product_id) {
    ids.push(input.trigger_product_id);
  }
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("store_id", storeId)
    .in("id", ids);
  const found = new Set((data ?? []).map((r) => r.id as string));
  if (!found.has(input.offer_product_id)) {
    return "Pick an offer product from your store catalog (Products). Opp funnel pages can't be offered as a bump.";
  }
  if (input.trigger_type === "product" && input.trigger_product_id && !found.has(input.trigger_product_id)) {
    return "The selected trigger product isn't in your store catalog.";
  }
  return null;
}

export async function createUpsellOffer(
  input: UpsellOfferInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const refErr = await validateProductRefs(supabase, store.id, input);
  if (refErr) return { ok: false, error: refErr };

  // Compute next sort_order
  const { count } = await supabase
    .from("upsell_offers")
    .select("*", { count: "exact", head: true })
    .eq("store_id", store.id);

  const { data, error } = await supabase
    .from("upsell_offers")
    .insert({
      store_id: store.id,
      name: input.name.trim() || "Untitled offer",
      trigger_type: input.trigger_type,
      trigger_product_id:
        input.trigger_type === "product" ? input.trigger_product_id : null,
      offer_product_id: input.offer_product_id,
      offer_kind: input.offer_kind,
      discount_type: input.discount_type,
      discount_value:
        input.discount_type === "none" ? 0 : Math.max(0, input.discount_value),
      sort_order: count ?? 0,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/upsell");
  return { ok: true, id: data.id };
}

export async function updateUpsellOffer(
  id: string,
  input: UpsellOfferInput
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const refErr = await validateProductRefs(supabase, store.id, input);
  if (refErr) return { ok: false, error: refErr };

  const { error } = await supabase
    .from("upsell_offers")
    .update({
      name: input.name.trim() || "Untitled offer",
      trigger_type: input.trigger_type,
      trigger_product_id:
        input.trigger_type === "product" ? input.trigger_product_id : null,
      offer_product_id: input.offer_product_id,
      offer_kind: input.offer_kind,
      discount_type: input.discount_type,
      discount_value:
        input.discount_type === "none" ? 0 : Math.max(0, input.discount_value),
    })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/upsell");
  return { ok: true };
}

export async function toggleUpsellActive(
  id: string,
  is_active: boolean
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const { error } = await supabase
    .from("upsell_offers")
    .update({ is_active })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/upsell");
  return { ok: true };
}

export async function deleteUpsellOffer(id: string): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const { error } = await supabase
    .from("upsell_offers")
    .delete()
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/upsell");
  return { ok: true };
}

export async function reorderUpsellOffers(
  orderedIds: string[]
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  // Verify ownership before bulk update
  const { data: owned } = await supabase
    .from("upsell_offers")
    .select("id")
    .eq("store_id", store.id)
    .in("id", orderedIds);

  const ownedIds = new Set((owned ?? []).map((r) => r.id as string));

  await Promise.all(
    orderedIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) =>
        supabase
          .from("upsell_offers")
          .update({ sort_order: index })
          .eq("id", id)
          .eq("store_id", store.id)
      )
  );

  revalidatePath("/dashboard/upsell");
  return { ok: true };
}
