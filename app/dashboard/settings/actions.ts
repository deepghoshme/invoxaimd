"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string };

/** Basic email format check — mirrors the DB CHECK constraint on reply_to_email. */
function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

/** Update the signed-in seller's store name + category + reply_to_email (RLS-scoped to owner). */
export async function saveStoreSettings(input: {
  store_name: string;
  category_id: string | null;
  reply_to_email?: string | null;
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

  // reply_to_email: trim; empty string → null; validate format when non-empty.
  const rawReplyTo = (input.reply_to_email ?? "").trim();
  const replyToEmail: string | null = rawReplyTo === "" ? null : rawReplyTo;
  if (replyToEmail !== null && !isValidEmail(replyToEmail)) {
    return { ok: false, error: "Reply-to email address is not valid." };
  }

  const { error } = await sb
    .from("stores")
    .update({ store_name: name, category_id: input.category_id || null, reply_to_email: replyToEmail })
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
