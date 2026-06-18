"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string };

/** Update the signed-in seller's store name + category (RLS-scoped to owner). */
export async function saveStoreSettings(input: {
  store_name: string;
  category_id: string | null;
}): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const name = input.store_name.trim();
  if (!name) return { ok: false, error: "Store name is required." };

  const { error } = await sb
    .from("stores")
    .update({ store_name: name, category_id: input.category_id || null })
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
