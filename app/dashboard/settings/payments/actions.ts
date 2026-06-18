"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

async function ownerStoreId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, storeId: null as string | null };
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, storeId: store?.id ?? null };
}

/**
 * Save the seller's Razorpay keys. A blank key_secret keeps the stored one
 * (so the seller never has to re-enter it just to toggle). Keys are written via
 * the seller's RLS-scoped client; the secret is never returned to the browser.
 */
export async function saveGateway(input: {
  key_id: string;
  key_secret: string;
  is_enabled: boolean;
}): Promise<Result> {
  const { supabase, storeId } = await ownerStoreId();
  if (!storeId) return { ok: false, error: "No store found." };

  const keyId = input.key_id.trim();
  const secret = input.key_secret.trim();

  // Enabling requires a key id and a secret on file.
  if (input.is_enabled && !keyId) {
    return { ok: false, error: "Enter your Razorpay Key ID to enable payments." };
  }

  const row: Record<string, unknown> = {
    store_id: storeId,
    provider: "razorpay",
    key_id: keyId || null,
    is_enabled: input.is_enabled,
  };
  if (secret) row.key_secret = secret; // only overwrite when a new secret is given

  const { error } = await supabase
    .from("payment_gateways")
    .upsert(row, { onConflict: "store_id" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/payments");
  return { ok: true };
}
