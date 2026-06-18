"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type Result = { ok: boolean; error?: string };

// ── Platform gateway helpers ──────────────────────────────────────────────────

/**
 * Returns the platform gateway row with `has_secret` in place of the raw
 * key_secret value — the secret must never be sent to the browser.
 * Returns null when the table does not yet exist (migration pending).
 */
export async function getPlatformGateway(): Promise<{
  provider: string;
  key_id: string | null;
  has_secret: boolean;
  mode: string;
  is_enabled: boolean;
} | null> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("platform_gateways")
      .select("provider, key_id, key_secret, mode, is_enabled")
      .eq("id", true)
      .maybeSingle();
    if (error) return null; // table missing or RLS blocks (unapplied migration)
    if (!data) return null;
    return {
      provider: (data.provider as string) ?? "razorpay",
      key_id: (data.key_id as string | null) ?? null,
      has_secret: !!(data.key_secret as string | null),
      mode: (data.mode as string) ?? "test",
      is_enabled: (data.is_enabled as boolean) ?? false,
    };
  } catch {
    return null; // table does not exist yet
  }
}

/**
 * Upsert the platform gateway row.
 *
 * Security guarantees:
 *   - RLS (platform_gateways_admin_write, using is_admin()) rejects the write
 *     for any non-admin JWT at the database level.
 *   - We also verify admin server-side before building the payload.
 *   - A blank key_secret keeps the stored one — the admin never has to
 *     re-enter it just to flip a switch.
 *   - The key_secret is never returned (getPlatformGateway returns has_secret).
 */
export async function savePlatformGateway(input: {
  provider: string;
  key_id: string;
  key_secret: string;
  is_enabled: boolean;
  mode: string;
}): Promise<Result> {
  const supabase = await createClient();

  // Server-side admin check (belt + RLS suspenders).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { ok: false, error: "Admin access required." };

  const provider = input.provider.toLowerCase().trim();
  const keyId = input.key_id.trim();
  const secret = input.key_secret.trim();

  // Enabling requires a key_id present and a secret on file.
  if (input.is_enabled && !keyId) {
    return { ok: false, error: "Enter a Key ID to enable the gateway." };
  }
  if (input.is_enabled && !secret) {
    // Allow enabling when a secret is already stored.
    const { data: existing } = await supabase
      .from("platform_gateways")
      .select("key_secret")
      .eq("id", true)
      .maybeSingle();
    if (!(existing as { key_secret?: string } | null)?.key_secret) {
      return { ok: false, error: "Enter a Key Secret to enable the gateway." };
    }
  }

  const row: Record<string, unknown> = {
    id: true,
    provider,
    key_id: keyId || null,
    is_enabled: input.is_enabled,
    mode: input.mode,
  };
  if (secret) row.key_secret = secret; // only overwrite when a new secret is given

  const { error } = await supabase
    .from("platform_gateways")
    .upsert(row, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.id,
    actorEmail:  user.email ?? null,
    actorRole:   "admin",
    action:      "gateway.save",
    targetType:  "gateway",
    targetId:    provider,
    storeId:     null,
    metadata: {
      provider,
      mode:       input.mode,
      is_enabled: input.is_enabled,
      key_id_set: !!keyId,
      secret_set: !!secret,
    },
  });

  revalidatePath("/admin/gateways");
  return { ok: true };
}

/** Update a category's commission rate. Input is a percent (e.g. 5 → 0.05). */
export async function updateCommission(
  categoryId: string,
  percent: number,
): Promise<Result> {
  const rate = Number(percent) / 100;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    return { ok: false, error: "Enter a percentage between 0 and 100." };
  }

  // RLS (categories_admin_write -> is_admin()) enforces admin-only writes.
  const supabase = await createClient();
  const { data: { user: commUser } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("business_categories")
    .update({ commission_rate: rate })
    .eq("id", categoryId);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: commUser?.id    ?? null,
    actorEmail:  commUser?.email ?? null,
    actorRole:   "admin",
    action:      "commission.update",
    targetType:  "category",
    targetId:    categoryId,
    storeId:     null,
    metadata:    { rate_percent: percent },
  });

  revalidatePath("/admin");
  return { ok: true };
}

/** Global on/off for the "Built with InvoxAI" badge on public seller pages. */
export async function setBrandBadge(show: boolean): Promise<Result> {
  // RLS (platform_settings_admin_write -> is_admin()) enforces admin-only writes.
  const supabase = await createClient();
  const { data: { user: badgeUser } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("platform_settings")
    .update({ show_brand_badge: show })
    .eq("id", true);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: badgeUser?.id    ?? null,
    actorEmail:  badgeUser?.email ?? null,
    actorRole:   "admin",
    action:      "brand.badge",
    targetType:  "platform_settings",
    targetId:    "singleton",
    storeId:     null,
    metadata:    { show_brand_badge: show },
  });

  revalidatePath("/admin");
  return { ok: true };
}
