"use server";

import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";
import { sendTeamInviteEmail } from "@/lib/transactional";

type Role = "admin" | "editor" | "viewer";

/** Verify caller owns the given store — never trust client-supplied identity. */
async function verifyOwnership(storeId: string) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, user: null, owned: false, store: null as null | { id: string; store_name: string | null } };

  const { data: store } = await sb
    .from("stores")
    .select("id, store_name")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  return { sb, user, owned: !!store, store: store as { id: string; store_name: string | null } | null };
}

// ── Invite a new member ──────────────────────────────────────────────────────
export async function inviteMember(
  storeId: string,
  email: string,
  role: Role,
): Promise<{ id?: string; error?: string }> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { error: guard.error };
  try {
    const { sb, user, owned, store } = await verifyOwnership(storeId);
    if (!owned) return { error: "Not authorized" };

    const { data, error } = await sb
      .from("team_members")
      .insert({
        store_id: storeId,
        email: email.trim().toLowerCase(),
        role,
        status: "invited",
      })
      .select("id")
      .single();

    if (error) {
      // Duplicate seat
      if (error.code === "23505") return { error: "That person is already in your team" };
      return { error: error.message };
    }

    // Send invite email — non-fatal, never block the insert
    try {
      const inviterName =
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        null;
      await sendTeamInviteEmail({
        to: email.trim().toLowerCase(),
        inviterName,
        storeName: store?.store_name ?? null,
        role,
        inviteUrl: "https://app.invoxai.io/login",
      });
    } catch { /* non-fatal */ }

    return { id: data.id };
  } catch (err) {
    // Table doesn't exist yet (migration pending)
    if (err instanceof Error && err.message.includes("relation")) {
      return { error: "Apply the pending migration to enable invites" };
    }
    return { error: "An unexpected error occurred" };
  }
}

// ── Update a member's role ───────────────────────────────────────────────────
export async function updateMemberRole(
  storeId: string,
  memberId: string,
  role: Role,
): Promise<{ error?: string }> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { error: guard.error };
  try {
    const { sb, owned } = await verifyOwnership(storeId);
    if (!owned) return { error: "Not authorized" };

    const { error } = await sb
      .from("team_members")
      .update({ role })
      .eq("id", memberId)
      .eq("store_id", storeId);

    if (error) return { error: error.message };
    return {};
  } catch {
    return {};
  }
}

// ── Remove a member ──────────────────────────────────────────────────────────
export async function removeMember(
  storeId: string,
  memberId: string,
): Promise<{ error?: string }> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { error: guard.error };
  try {
    const { sb, owned } = await verifyOwnership(storeId);
    if (!owned) return { error: "Not authorized" };

    const { error } = await sb
      .from("team_members")
      .delete()
      .eq("id", memberId)
      .eq("store_id", storeId);

    if (error) return { error: error.message };
    return {};
  } catch {
    return {};
  }
}
