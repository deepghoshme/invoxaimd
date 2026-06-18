"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";

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
 * Save the seller's gateway keys. A blank key_secret keeps the stored one
 * (so the seller never has to re-enter it just to toggle). Keys are written via
 * the seller's RLS-scoped client; the secret is never returned to the browser.
 *
 * DB note: payment_gateways has store_id as its primary key (one row per store).
 * Only Razorpay rows are fully wired into checkout. Non-Razorpay gateways are
 * UI placeholders — keys are NOT saved to the DB until the schema gains a
 * composite (store_id, provider) PK and checkout integration is built.
 */
export async function saveGateway(input: {
  provider: string;
  key_id: string;
  key_secret: string;
  is_enabled: boolean;
  mode?: string;
}): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;
  const { supabase, storeId } = await ownerStoreId();
  if (!storeId) return { ok: false, error: "No store found." };

  const provider = input.provider.toLowerCase().trim();

  // Non-Razorpay gateways: the DB schema has store_id as PK (one row per store).
  // Saving a non-Razorpay row would overwrite the Razorpay row. Block until
  // a future migration adds a composite (store_id, provider) primary key.
  if (provider !== "razorpay") {
    return {
      ok: false,
      error: `${input.provider} checkout integration is coming soon. Keys cannot be saved yet — the database schema will be extended in a future update.`,
    };
  }

  const keyId = input.key_id.trim();
  const secret = input.key_secret.trim();

  // Enabling Razorpay requires a key id AND a key secret on file.
  if (input.is_enabled && !keyId) {
    return { ok: false, error: "Enter your Razorpay Key ID to enable payments." };
  }
  if (input.is_enabled && !secret) {
    // Check whether a secret is already stored before rejecting.
    const { data: existing } = await supabase
      .from("payment_gateways")
      .select("key_secret")
      .eq("store_id", storeId)
      .maybeSingle();
    if (!existing?.key_secret) {
      return { ok: false, error: "Enter your Razorpay Key Secret to enable payments." };
    }
  }

  const row: Record<string, unknown> = {
    store_id: storeId,
    provider: "razorpay",
    key_id: keyId || null,
    is_enabled: input.is_enabled,
  };
  if (secret) row.key_secret = secret; // only overwrite when a new secret is given
  if (input.mode) row.mode = input.mode;

  const { error } = await supabase
    .from("payment_gateways")
    .upsert(row, { onConflict: "store_id" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings/payments");
  return { ok: true };
}

/**
 * Test the Razorpay connection by validating key format and confirming a
 * secret is on file. This does NOT make a live Razorpay API call — it checks
 * that key_id matches the rzp_test_* or rzp_live_* pattern and that a secret
 * exists in the DB. We say "Key format valid" not "Connection successful" to
 * be honest about what the check actually does.
 * A full API ping runs at first real checkout.
 */
export async function testGateway(input: {
  provider: string;
  key_id: string;
}): Promise<Result & { message?: string }> {
  const { supabase, storeId } = await ownerStoreId();
  if (!storeId) return { ok: false, error: "No store found." };

  const provider = input.provider.toLowerCase().trim();
  const keyId = input.key_id.trim();

  if (provider !== "razorpay") {
    return {
      ok: false,
      error: `${input.provider} integration is coming soon — cannot test yet.`,
    };
  }

  // Validate Razorpay key format.
  if (!keyId) {
    return { ok: false, error: "Enter a Key ID to test." };
  }
  if (!keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) {
    return {
      ok: false,
      error: "Key ID must start with rzp_test_ or rzp_live_.",
    };
  }

  // Check a secret exists on file.
  const { data: existing } = await supabase
    .from("payment_gateways")
    .select("key_secret")
    .eq("store_id", storeId)
    .maybeSingle();

  if (!existing?.key_secret) {
    return {
      ok: false,
      error: "Save your Key Secret first — needed to verify payments.",
    };
  }

  return {
    ok: true,
    message: "Key format valid and secret is on file. (Full API ping runs at first checkout.)",
  };
}
