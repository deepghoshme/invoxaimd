import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Platform-level wallet-gate configuration.
 * Read from platform_settings (singleton row). Gracefully returns
 * feature-off defaults if the columns or table don't exist yet.
 */
export type WalletGatePlatformConfig = {
  wallet_gate_enabled: boolean;
  wallet_floor_paise: number;
};

/**
 * Store row shape expected by isCheckoutBlockedForStore.
 * Only the fields needed for the gate decision.
 */
export type StoreWalletFields = {
  wallet_balance: number | null;
  checkout_blocked: boolean | null;
  wallet_floor_paise: number | null;
};

/**
 * Result of a gate check.
 */
export type WalletGateResult = {
  blocked: boolean;
  effectiveFloor: number;
  reason: string;
};

/**
 * Read platform_settings wallet-gate config.
 * Best-effort — returns feature-off defaults on any error so a DB hiccup
 * never prevents checkouts when the feature is actually off.
 */
export async function getWalletGatePlatformConfig(): Promise<WalletGatePlatformConfig> {
  const defaults: WalletGatePlatformConfig = {
    wallet_gate_enabled: false,
    wallet_floor_paise: 0,
  };
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("wallet_gate_enabled, wallet_floor_paise")
      .maybeSingle();
    if (!data) return defaults;
    return {
      wallet_gate_enabled: (data as Record<string, unknown>).wallet_gate_enabled === true,
      wallet_floor_paise: Number((data as Record<string, unknown>).wallet_floor_paise ?? 0),
    };
  } catch {
    return defaults;
  }
}

/**
 * Decide whether checkout should be blocked for a store.
 *
 * Logic:
 * - If platform.wallet_gate_enabled is false → never blocked (feature off).
 * - effectiveFloor = store.wallet_floor_paise (if > 0) else platform.wallet_floor_paise.
 * - blocked = wallet_balance <= effectiveFloor.
 *
 * This is a pure-ish function: it receives both the store fields and the
 * platform config so callers can batch-load them (no hidden extra DB calls).
 *
 * Money-safety: this PREVENTS new orders from starting — it never alters
 * prices, amounts, or commission math.
 */
export function isCheckoutBlockedForStore(
  store: StoreWalletFields,
  platform: WalletGatePlatformConfig,
): WalletGateResult {
  if (!platform.wallet_gate_enabled) {
    return { blocked: false, effectiveFloor: 0, reason: "wallet_gate_disabled" };
  }

  const balance = Number(store.wallet_balance ?? 0);
  const effectiveFloor =
    store.wallet_floor_paise != null && store.wallet_floor_paise > 0
      ? Number(store.wallet_floor_paise)
      : Number(platform.wallet_floor_paise ?? 0);

  const blocked = balance <= effectiveFloor;
  return {
    blocked,
    effectiveFloor,
    reason: blocked
      ? `wallet_balance_${balance}_lte_floor_${effectiveFloor}`
      : "wallet_sufficient",
  };
}

/**
 * Persist the checkout_blocked flag on a store when the gate state changes.
 * Non-fatal: any DB error is logged and swallowed — the authoritative live
 * check is always wallet_balance vs floor, not this cached flag.
 */
export async function syncCheckoutBlockedFlag(
  storeId: string,
  blocked: boolean,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("stores")
      .update({ checkout_blocked: blocked })
      .eq("id", storeId);
  } catch (e) {
    console.warn("[walletGate] syncCheckoutBlockedFlag non-fatal error:", e);
  }
}
