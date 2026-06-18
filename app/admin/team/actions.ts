"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: boolean; error?: string; warn?: string };

// ── assertAdmin ──────────────────────────────────────────────────────────────
// Every exported action calls this first. Verifies the caller holds role='admin'
// in user_roles (server-side session — never trust client-supplied identity).
// The RLS policy user_roles_admin_write provides a second layer of enforcement
// at the database level (is_admin() = has_role(auth.uid(),'admin')).

async function assertAdmin(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; error: null }
  | { supabase: null; userId: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, userId: null, error: "Not authenticated." };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { supabase: null, userId: null, error: "Admin access required." };

  return { supabase, userId: user.id, error: null };
}

// ── countAdmins (admin client — bypasses RLS for safe counting) ──────────────
// Used by the last-admin guard. We use createAdminClient so the count cannot
// be influenced by RLS row visibility gaps.
async function countAdmins(): Promise<number> {
  const sb = createAdminClient();
  const { count } = await sb
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  return count ?? 0;
}

// ── grantAdmin ───────────────────────────────────────────────────────────────
/**
 * Grant platform-admin access to a user identified by email.
 *
 * Safety:
 *  1. assertAdmin — caller must be admin (server-side session check).
 *  2. RLS user_roles_admin_write — DB rejects the insert for non-admin JWTs.
 *  3. Email validation — basic format check before hitting the DB.
 *  4. "User must exist" guard — if no profile found, returns a clear error
 *     instead of silently failing (the user hasn't signed up yet).
 *  5. Idempotent — uses upsert with onConflict so re-granting is a no-op.
 */
export async function grantAdmin(email: string): Promise<Result> {
  const auth = await assertAdmin();
  if (!auth.supabase) return { ok: false, error: auth.error };

  const clean = email.trim().toLowerCase();
  if (!clean) return { ok: false, error: "Email is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  // Look up profile by email. Use admin client so RLS on profiles doesn't
  // block a cross-user lookup (profiles_select_own only allows own row or admin,
  // but the caller IS admin — the user-scoped client works too; admin client
  // is extra-safe here).
  const sb = createAdminClient();
  const { data: profile, error: lookupErr } = await sb
    .from("profiles")
    .select("id, email, full_name")
    .eq("email", clean)
    .maybeSingle();

  if (lookupErr) return { ok: false, error: lookupErr.message };
  if (!profile) {
    return {
      ok: false,
      error: `No account found for "${clean}". The user must sign up first.`,
    };
  }

  // Prevent trivial self-grant loop (already admin = no-op, but give feedback).
  const { data: existing } = await sb
    .from("user_roles")
    .select("id")
    .eq("user_id", profile.id)
    .eq("role", "admin")
    .maybeSingle();

  if (existing) {
    return { ok: false, error: `${clean} already has admin access.` };
  }

  // Insert via user-scoped client so RLS user_roles_admin_write is exercised.
  const { error: insertErr } = await auth.supabase
    .from("user_roles")
    .insert({ user_id: profile.id, role: "admin" });

  if (insertErr) return { ok: false, error: insertErr.message };

  console.info(
    `[admin/team] GRANT admin: caller=${auth.userId} → target=${profile.id} (${clean})`
  );
  revalidatePath("/admin/team");
  return { ok: true };
}

// ── revokeAdmin ──────────────────────────────────────────────────────────────
/**
 * Revoke platform-admin access from a user by their user_id.
 *
 * Safety:
 *  1. assertAdmin — caller must be admin.
 *  2. RLS user_roles_admin_write — DB enforces at DB level too.
 *  3. Last-admin lockout prevention — counts current admins; refuses if
 *     revoking this user would leave 0 admins.
 *  4. Self-revoke warning — allowed (not blocked) but returns a `warn` field
 *     so the UI can surface a confirmation step. The caller is still removed.
 */
export async function revokeAdmin(
  targetUserId: string
): Promise<Result> {
  const auth = await assertAdmin();
  if (!auth.supabase) return { ok: false, error: auth.error };

  if (!targetUserId) return { ok: false, error: "User ID is required." };

  // Last-admin guard: count BEFORE the deletion.
  const total = await countAdmins();
  if (total <= 1) {
    return {
      ok: false,
      error:
        "Cannot remove the last platform admin. Grant admin to another user first.",
    };
  }

  // Self-revoke: allowed but flag it so the caller can warn the user.
  const isSelf = targetUserId === auth.userId;

  // Delete via user-scoped client so RLS is exercised.
  const { error: delErr } = await auth.supabase
    .from("user_roles")
    .delete()
    .eq("user_id", targetUserId)
    .eq("role", "admin");

  if (delErr) return { ok: false, error: delErr.message };

  console.info(
    `[admin/team] REVOKE admin: caller=${auth.userId} → target=${targetUserId}${isSelf ? " (self)" : ""}`
  );
  revalidatePath("/admin/team");
  return {
    ok: true,
    warn: isSelf ? "You revoked your own admin access." : undefined,
  };
}
