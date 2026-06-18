import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type Subscription = {
  id: string;
  store_id: string;
  plan_id: string;
  status: "active" | "canceled" | "past_due";
  amount_paise: number;
  started_at: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
};

export type SubscriptionWithPlan = Subscription & {
  plan: { id: string; name: string; price: number; features: string[]; contact_limit: number | null };
};

/**
 * Get the current subscription for a store, joined with plan data.
 * Uses service-role to bypass RLS so this works in server actions and
 * server components regardless of session state.
 * Returns null if the subscriptions table doesn't exist yet (graceful
 * degradation before migration is applied).
 */
export async function getStoreSubscription(
  storeId: string
): Promise<SubscriptionWithPlan | null> {
  const sb = createAdminClient();
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .select("*, plan:plans(id, name, price, features, contact_limit)")
      .eq("store_id", storeId)
      .maybeSingle();

    if (error) {
      // Graceful degradation: table doesn't exist yet
      if (error.message?.includes("subscriptions") || error.code === "PGRST205" || error.code === "42P01") {
        return null;
      }
      throw error;
    }
    return data as SubscriptionWithPlan | null;
  } catch {
    return null;
  }
}

/**
 * Upsert a subscription for a store. Creates a new active subscription or
 * updates the existing one (status → active, new plan, new period).
 * Called from server actions only — uses service-role to bypass RLS.
 * Returns the upserted row or an error message.
 */
export async function upsertSubscription(params: {
  storeId: string;
  planId: string;
  amountPaise: number;
  periodEndDate: Date;
}): Promise<{ ok: true; sub: Subscription } | { ok: false; error: string }> {
  const sb = createAdminClient();
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .upsert(
        {
          store_id: params.storeId,
          plan_id: params.planId,
          status: "active",
          amount_paise: params.amountPaise,
          started_at: new Date().toISOString(),
          current_period_end: params.periodEndDate.toISOString(),
        },
        { onConflict: "store_id", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, sub: data as Subscription };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

/**
 * Compute plan MRR (in paise) from all active subscriptions.
 * Returns 0 and activeCount=0 gracefully if the table doesn't exist yet.
 */
export async function getPlanMrr(): Promise<{
  mrrPaise: number;
  activeCount: number;
}> {
  const sb = createAdminClient();
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .select("amount_paise")
      .eq("status", "active");

    if (error) {
      // Table doesn't exist — degrade to zero
      return { mrrPaise: 0, activeCount: 0 };
    }

    const rows = data ?? [];
    const mrrPaise = rows.reduce((s, r) => s + (r.amount_paise ?? 0), 0);
    return { mrrPaise, activeCount: rows.length };
  } catch {
    return { mrrPaise: 0, activeCount: 0 };
  }
}
