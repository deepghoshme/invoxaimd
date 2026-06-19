"use server";

import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string };

/** Resolve the current user + their store_id using the session client (RLS scoped). */
async function getOwnUserAndStore(): Promise<
  | { ok: true; userId: string; storeId: string }
  | { ok: false; error: string }
> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: store } = await sb
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return { ok: false, error: "No store found." };

  return { ok: true, userId: user.id, storeId: store.id };
}

/**
 * Add a note for a customer (identified by buyer_email).
 *
 * Guards:
 *  - Not impersonating (writes always refused when admin is viewing-as).
 *  - Session client so the `owns_store` RLS policy on customer_notes applies.
 *  - body must be non-empty after trimming.
 *  - buyerEmail must be a non-empty string.
 */
export async function addCustomerNote({
  buyerEmail,
  body,
}: {
  buyerEmail: string;
  body: string;
}): Promise<
  Result & {
    note?: { id: string; body: string; created_at: string; updated_at: string | null };
  }
> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  // Validate inputs
  const trimmedEmail = (buyerEmail ?? "").trim().toLowerCase();
  if (!trimmedEmail) return { ok: false, error: "Buyer email is required." };

  const trimmedBody = (body ?? "").trim();
  if (!trimmedBody) return { ok: false, error: "Note body cannot be empty." };
  if (trimmedBody.length > 5000) {
    return { ok: false, error: "Note is too long (max 5000 characters)." };
  }

  const ctx = await getOwnUserAndStore();
  if (!ctx.ok) return ctx;

  const sb = await createClient();
  const { data, error } = await sb
    .from("customer_notes")
    .insert({
      store_id: ctx.storeId,
      buyer_email: trimmedEmail,
      body: trimmedBody,
      created_by: ctx.userId,
    })
    .select("id, body, created_at, updated_at")
    .single();

  if (error) {
    console.error("[addCustomerNote]", error.message);
    return { ok: false, error: "Failed to save note. Please try again." };
  }

  // Return the full row so the client can prepend it to local state — router
  // .refresh() alone does NOT update the already-initialised useState(notes).
  return {
    ok: true,
    note: {
      id: data.id as string,
      body: data.body as string,
      created_at: data.created_at as string,
      updated_at: (data.updated_at as string | null) ?? null,
    },
  };
}

/**
 * Delete a note by id.
 *
 * RLS policy `owns_store` on customer_notes ensures only the store owner can
 * delete their own notes — the session client enforces this without any extra
 * store_id check in application code (the DB rejects mismatches).
 */
export async function deleteCustomerNote(noteId: string): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  if (!noteId || typeof noteId !== "string") {
    return { ok: false, error: "Invalid note ID." };
  }

  const sb = await createClient();
  const { error } = await sb
    .from("customer_notes")
    .delete()
    .eq("id", noteId);

  if (error) {
    console.error("[deleteCustomerNote]", error.message);
    return { ok: false, error: "Failed to delete note. Please try again." };
  }

  return { ok: true };
}

/**
 * Update the body of an existing note.
 *
 * Same RLS enforcement as delete — the session client's owns_store policy
 * prevents editing notes that belong to a different store.
 */
export async function updateCustomerNote(
  noteId: string,
  body: string,
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  if (!noteId || typeof noteId !== "string") {
    return { ok: false, error: "Invalid note ID." };
  }

  const trimmedBody = (body ?? "").trim();
  if (!trimmedBody) return { ok: false, error: "Note body cannot be empty." };
  if (trimmedBody.length > 5000) {
    return { ok: false, error: "Note is too long (max 5000 characters)." };
  }

  const sb = await createClient();
  const { error } = await sb
    .from("customer_notes")
    .update({ body: trimmedBody, updated_at: new Date().toISOString() })
    .eq("id", noteId);

  if (error) {
    console.error("[updateCustomerNote]", error.message);
    return { ok: false, error: "Failed to update note. Please try again." };
  }

  return { ok: true };
}
