"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/;

async function userClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Create the store row on first onboarding visit (idempotent). */
export async function ensureStore(): Promise<Result> {
  const { supabase, user } = await userClient();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!existing) {
    // Logged in via verified email/Google → the OTP step is satisfied.
    const { error } = await supabase
      .from("stores")
      .insert({ owner_id: user.id, onboarding_step: "store_name" });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function saveStoreName(name: string): Promise<Result> {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Please enter a store name." };
  if (clean.length > 60) return { ok: false, error: "Keep it under 60 characters." };

  const { supabase, user } = await userClient();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("stores")
    .update({ store_name: clean, onboarding_step: "subdomain" })
    .eq("owner_id", user.id)
    .in("onboarding_step", ["store_name", "subdomain"]);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function saveSubdomain(subdomain: string): Promise<Result> {
  const sub = subdomain.trim().toLowerCase();
  if (!SUBDOMAIN_RE.test(sub)) {
    return { ok: false, error: "Use 3–63 lowercase letters, numbers or hyphens." };
  }

  const { supabase, user } = await userClient();
  if (!user) return { ok: false, error: "Not signed in." };

  // Re-check availability server-side (guards against races / stale UI).
  const { data: available, error: rpcErr } = await supabase.rpc(
    "is_subdomain_available",
    { _name: sub },
  );
  if (rpcErr) return { ok: false, error: rpcErr.message };
  if (!available) return { ok: false, error: "That subdomain is taken or reserved." };

  const { error } = await supabase
    .from("stores")
    .update({ subdomain: sub, onboarding_step: "category" })
    .eq("owner_id", user.id)
    .in("onboarding_step", ["subdomain", "category"]);

  if (error) {
    // Unique-violation safety net if two users raced the same name.
    if (error.code === "23505") {
      return { ok: false, error: "That subdomain was just taken. Try another." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function saveCategory(categoryId: string): Promise<Result> {
  if (!categoryId) return { ok: false, error: "Please pick a category." };

  const { supabase, user } = await userClient();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("stores")
    .update({ category_id: categoryId, onboarding_step: "billing" })
    .eq("owner_id", user.id)
    .in("onboarding_step", ["category", "billing"]);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/onboarding");
  return { ok: true };
}

export type BillingInput = {
  full_name: string;
  phone: string;
  country: string;
  business_name?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  tax_id?: string;
};

export async function saveBilling(input: BillingInput): Promise<Result> {
  if (!input.full_name?.trim()) return { ok: false, error: "Name is required." };
  if (!input.phone?.trim()) return { ok: false, error: "Phone is required." };
  if (!input.country?.trim()) return { ok: false, error: "Country is required." };

  const { supabase, user } = await userClient();
  if (!user) return { ok: false, error: "Not signed in." };

  const billing = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, (v ?? "").toString().trim()]),
  );

  const { error } = await supabase
    .from("stores")
    .update({
      billing,
      onboarding_step: "done",
      onboarding_completed: true,
    })
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}
