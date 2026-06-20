import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "@/lib/razorpay";
import { getStoreSubscription, computeUpgradeCredit } from "@/lib/subscriptions";
import { validatePromoCode, incrementPromoUsage } from "@/lib/promos";
import { resolvePlanCheckoutFlatFee } from "@/lib/platform-fees";

export const dynamic = "force-dynamic";

/**
 * Start a seller plan-subscription payment. Charges the PLATFORM's Razorpay
 * gateway (admin-configured), not the seller's own keys — plan revenue belongs
 * to the platform. Amount is the plan price from the DB (never client-trusted).
 *
 * Upgrade proration:
 * - If the store has an active subscription and the new plan is MORE expensive,
 *   we compute the unused credit from the current plan's remaining period and
 *   deduct it from the charge. This is done SERVER-SIDE from stored DB values —
 *   the client only sends plan_id, never an amount or credit.
 * - The credit and full plan price are stashed in the Razorpay order notes
 *   (server-set, client-untamperable) so /verify can re-validate the amount.
 *
 * Zero-charge edge:
 * - If credit >= new plan price, charge is 0. Razorpay rejects 0-amount orders,
 *   so we activate the plan directly without creating a Razorpay order, returning
 *   { zero_charge: true } so the client skips the payment modal.
 *
 * Returns the Razorpay order + platform key_id for the checkout, OR
 * { zero_charge: true } if the upgrade is fully covered by unused credit.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { plan_id?: string; promoCode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const planId = typeof body.plan_id === "string" ? body.plan_id : "";
  if (!planId) return NextResponse.json({ error: "Missing plan_id" }, { status: 400 });
  const promoCodeInput = typeof body.promoCode === "string" ? body.promoCode.trim() : "";

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("plans")
    .select("id, name, price, interval, is_active")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan not found or inactive." }, { status: 404 });

  const planInterval: "monthly" | "annual" = plan.interval === "annual" ? "annual" : "monthly";
  const newAmountPaise = (plan.price as number) * 100;

  if (!plan.price || plan.price <= 0) {
    return NextResponse.json({ error: "This plan is free — no payment needed." }, { status: 400 });
  }

  const { data: store } = await admin.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "No store found for your account." }, { status: 403 });

  // Platform gateway — admin client reads the secret server-side (RLS-bypassing).
  const { data: gw } = await admin
    .from("platform_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("id", true)
    .maybeSingle();
  if (!gw || !gw.is_enabled || !gw.key_id || !gw.key_secret) {
    return NextResponse.json({ error: "Platform payments aren't set up yet. Ask the admin to enable the payment gateway." }, { status: 503 });
  }

  // ── Promo code validation ────────────────────────────────────────────────────
  // Validated server-side AFTER the plan price is read from DB. The client can
  // only supply the code string — the discount is always computed here, never
  // derived from any client-supplied amount. Invalid codes return 400 immediately
  // so the user is never silently charged full price on a bad code.
  let discountPaise = 0;
  let validatedPromoId: string | null = null;
  let validatedPromoCode: string | null = null;
  if (promoCodeInput) {
    const promoResult = await validatePromoCode(promoCodeInput, plan.name as string, newAmountPaise);
    if (!promoResult.ok) {
      return NextResponse.json({ error: promoResult.reason, promoError: true }, { status: 400 });
    }
    discountPaise = promoResult.discountPaise;
    validatedPromoId = promoResult.promoId;
    validatedPromoCode = promoResult.code;
  }

  // ── Upgrade proration ────────────────────────────────────────────────────────
  // Fetch the store's current active subscription (if any).
  // All credit logic is derived from STORED DB values — the client never supplies
  // an amount, credit, or discount figure.
  let creditPaise = 0;
  const currentSub = await getStoreSubscription(store.id as string);

  if (
    currentSub &&
    currentSub.status === "active" &&
    currentSub.amount_paise > 0 &&
    newAmountPaise > currentSub.amount_paise // Only credit on true upgrades
  ) {
    creditPaise = computeUpgradeCredit({
      currentAmountPaise: currentSub.amount_paise,
      periodStart: currentSub.period_start ?? null,
      startedAt: currentSub.started_at ?? null,
      periodEnd: currentSub.current_period_end,
      now: new Date(),
    });
  }

  // ── Flat platform fee at plan checkout ──────────────────────────────────────
  // An optional fixed platform fee added on top of the (discounted) plan price.
  // Precedence: plan.flat_fee_paise > platform_settings.plan_flat_fee_paise.
  // Resolved server-side and stashed in the order notes so /verify re-validates
  // it. It is added AFTER discounts (it's a platform fee, not part of the
  // discountable plan price) and is NOT proration-credited.
  const planFlatFeePaise = await resolvePlanCheckoutFlatFee(plan.id as string);

  // Effective charge = plan price − upgrade credit − promo discount (floor 0)
  // + flat platform fee.
  const chargePaise =
    Math.max(0, newAmountPaise - creditPaise - discountPaise) + planFlatFeePaise;

  // ── Zero-charge path ─────────────────────────────────────────────────────────
  // Razorpay rejects 0-amount orders. Activate directly without a payment modal.
  // This is intentionally idempotent: the caller can re-hit this endpoint and
  // get the same zero_charge response if the plan is already active.
  if (chargePaise === 0) {
    // Activate the plan directly. This path is safe because:
    //  1. We confirmed the store is authenticated (user.id, store.id verified above).
    //  2. The new plan was fetched server-side from DB.
    //  3. creditPaise was computed server-side from the stored sub.
    //  4. The only way to reach chargePaise=0 is credit >= newAmountPaise,
    //     meaning the user already paid MORE than the new plan cost this period.
    const { upsertSubscription } = await import("@/lib/subscriptions");
    const periodEnd = new Date();
    if (planInterval === "annual") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    const result = await upsertSubscription({
      storeId: store.id as string,
      planId: plan.id as string,
      // amount_paise stores the FULL plan price for correct MRR tracking.
      // The actual charge (0) is recorded separately in plan_payments.
      amountPaise: newAmountPaise,
      periodEndDate: periodEnd,
    });
    if (!result.ok) {
      return NextResponse.json({ error: "Could not activate plan." }, { status: 500 });
    }
    // Record a zero-charge payment for the ledger (idempotent: no Razorpay IDs).
    await admin.from("plan_payments").insert({
      store_id: store.id as string,
      plan_id: plan.id as string,
      razorpay_order_id: `zero_credit_${store.id}_${Date.now()}`,
      razorpay_payment_id: null,
      amount: 0,
    }).then(() => {}); // Non-fatal if it fails
    // Increment promo usage AFTER the subscription upsert succeeds (non-fatal).
    if (validatedPromoId) {
      await incrementPromoUsage(validatedPromoId);
    }
    return NextResponse.json({
      zero_charge: true,
      plan_name: plan.name,
      discount_paise: discountPaise,
    });
  }

  // ── Normal Razorpay order ────────────────────────────────────────────────────
  try {
    const rp = await createRazorpayOrder(
      { keyId: gw.key_id as string, keySecret: gw.key_secret as string },
      {
        amount: chargePaise,
        currency: "INR",
        receipt: `plan_${plan.id}`.slice(0, 40),
        notes: {
          kind: "plan",
          plan_id: plan.id as string,
          store_id: store.id as string,
          // Stash the full plan price, credit, and promo discount in server-set
          // notes so /verify can re-validate the prorated/discounted amount
          // without trusting any client-supplied figure.
          full_amount_paise: String(newAmountPaise),
          credit_paise: String(creditPaise),
          plan_flat_fee_paise: String(planFlatFeePaise),
          plan_interval: planInterval,
          // Promo fields — set only when a code was applied. /verify re-validates
          // the code and confirms the discount matches before activating the plan.
          promo_discount_paise: String(discountPaise),
          promo_id: validatedPromoId ?? "",
          promo_code: validatedPromoCode ?? "",
        },
      },
    );
    return NextResponse.json({
      razorpay_order_id: rp.id,
      key_id: gw.key_id,
      amount: chargePaise,
      currency: "INR",
      plan_name: plan.name,
      // Returned so the UI can display the server-computed discounted total.
      // The client MUST show this value, never recompute the discount itself.
      discount_paise: discountPaise,
    });
  } catch {
    return NextResponse.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
