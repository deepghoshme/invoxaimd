import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpaySignature, fetchRazorpayOrder } from "@/lib/razorpay";
import { upsertSubscription, getStoreSubscription, computeUpgradeCredit } from "@/lib/subscriptions";
import { sendPlanInvoiceEmail } from "@/lib/transactional";
import { createInvoiceForPlan } from "@/lib/invoice";
import { validatePromoCode, incrementPromoUsage } from "@/lib/promos";

export const dynamic = "force-dynamic";

/**
 * Verify a plan-subscription payment against the PLATFORM gateway secret and,
 * only on a valid signature, activate the subscription. The subscription is
 * created here (post-payment) so an abandoned checkout never grants a paid plan.
 *
 * Amount validation for prorated upgrades:
 * - We read the full_amount_paise and credit_paise from the Razorpay order's
 *   server-set notes (written by /start, client-untamperable).
 * - We RECOMPUTE the credit server-side from the current DB sub to guard against
 *   any time-of-check/time-of-use drift; if the recomputed credit matches (within
 *   rounding), we accept the order. If the notes are absent (legacy non-prorated
 *   order), we fall back to the old exact-match check.
 *
 * amount_paise vs charged amount:
 * - subscriptions.amount_paise = FULL new plan price (for correct MRR/ARR).
 * - plan_payments.amount = actual charge (prorated/discounted amount).
 * These MUST be different for prorated upgrades; the comment is intentional.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: {
    plan_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const { plan_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!plan_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: gw } = await admin
    .from("platform_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("id", true)
    .maybeSingle();
  if (!gw?.key_id || !gw?.key_secret) return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });

  const valid = verifyRazorpaySignature(
    gw.key_secret as string,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  if (!valid) return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });

  const { data: store } = await admin.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "No store found for your account." }, { status: 403 });

  // The signature only proves THIS order was paid — not which plan/amount it was
  // for. Re-fetch the order from Razorpay and bind activation to its server-set
  // notes + amount (set at /start, untamperable by the client). This blocks a
  // pay-cheap-activate-expensive swap: body.plan_id is NOT trusted.
  let rpOrder;
  try {
    rpOrder = await fetchRazorpayOrder({ keyId: gw.key_id as string, keySecret: gw.key_secret as string }, razorpay_order_id);
  } catch {
    return NextResponse.json({ error: "Could not verify the order." }, { status: 502 });
  }
  const notes = rpOrder.notes ?? {};
  if (notes.kind !== "plan" || notes.store_id !== store.id) {
    return NextResponse.json({ error: "This payment does not match your account." }, { status: 400 });
  }
  const orderPlanId = notes.plan_id;
  if (!orderPlanId || (plan_id && plan_id !== orderPlanId)) {
    return NextResponse.json({ error: "Plan mismatch." }, { status: 400 });
  }

  const { data: plan } = await admin
    .from("plans")
    .select("id, name, price, interval, is_active")
    .eq("id", orderPlanId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan not found or inactive." }, { status: 404 });

  const planInterval: "monthly" | "annual" = plan.interval === "annual" ? "annual" : "monthly";
  const fullAmountPaise = (plan.price as number) * 100;

  // ── Amount validation ────────────────────────────────────────────────────────
  // For prorated upgrades, the order amount < plan price. We validate against
  // the RECOMPUTED expected charge, not blindly against the full plan price.
  //
  // Strategy:
  //  1. Read full_amount_paise + credit_paise from server-set order notes.
  //  2. Recompute the credit server-side from the CURRENT DB sub to validate.
  //  3. If the recomputed credit is within ±100 paise of notes.credit_paise
  //     (rounding tolerance over the seconds between /start and /verify), accept.
  //  4. Legacy orders (no proration notes) fall back to the exact plan price check.

  let expectedChargePaise: number;
  const notesFullPaise = notes.full_amount_paise ? Number(notes.full_amount_paise) : null;
  const notesCreditPaise = notes.credit_paise ? Number(notes.credit_paise) : null;

  if (notesFullPaise !== null && notesCreditPaise !== null) {
    // Prorated order — validate the full price matches what /start recorded.
    if (notesFullPaise !== fullAmountPaise) {
      return NextResponse.json({ error: "Plan price mismatch in order notes." }, { status: 400 });
    }

    // Recompute credit server-side to cross-check the stashed notes value.
    const currentSub = await getStoreSubscription(store.id as string);
    let recomputedCredit = 0;
    if (
      currentSub &&
      currentSub.status === "active" &&
      currentSub.amount_paise > 0 &&
      fullAmountPaise > currentSub.amount_paise
    ) {
      recomputedCredit = computeUpgradeCredit({
        currentAmountPaise: currentSub.amount_paise,
        periodStart: currentSub.period_start ?? null,
        startedAt: currentSub.started_at ?? null,
        periodEnd: currentSub.current_period_end,
        now: new Date(),
      });
    }

    // Allow ±100 paise tolerance: a few seconds elapsed between /start and /verify
    // can shift the remaining-fraction slightly. The order was created by the server
    // at /start so the actual Razorpay amount is already locked; we just need to
    // confirm the credit from notes is plausible vs. the recomputed value.
    const tolerance = 100; // ₹1 in paise
    if (Math.abs(recomputedCredit - notesCreditPaise) > tolerance) {
      // Recomputed credit diverged — this shouldn't happen in normal flows.
      // Log and reject to prevent a scenario where someone games the timing.
      console.error(
        `[plans/verify] credit mismatch: notes=${notesCreditPaise} recomputed=${recomputedCredit} store=${store.id}`,
      );
      return NextResponse.json({ error: "Credit amount mismatch. Please try again." }, { status: 400 });
    }

    // Expected charge = full price minus the notes-stashed credit (which we just
    // validated is consistent with the recomputed value).
    expectedChargePaise = Math.max(0, fullAmountPaise - notesCreditPaise);
  } else {
    // Legacy / non-prorated order: charge must equal the full plan price exactly.
    expectedChargePaise = fullAmountPaise;
  }

  // ── Promo discount re-validation ─────────────────────────────────────────────
  // Re-validate the promo from server-set order notes. We call validatePromoCode
  // again with the same plan + full amount to recompute the discount independently,
  // then confirm the recomputed value matches what /start stashed in the notes.
  // This blocks any tampered notes: if promo_discount_paise was inflated on the
  // client side (impossible via Razorpay notes, but defensive), this check catches
  // it. incrementPromoUsage is called ONLY after the plan_payments ledger insert
  // succeeds, so a replayed verify (duplicate order_id) never double-increments.
  const notesPromoDiscountPaise = notes.promo_discount_paise ? Number(notes.promo_discount_paise) : 0;
  const notesPromoId = typeof notes.promo_id === "string" && notes.promo_id ? notes.promo_id : null;
  const notesPromoCode = typeof notes.promo_code === "string" && notes.promo_code ? notes.promo_code : null;

  if (notesPromoCode && notesPromoId) {
    // Re-run validation to get the server-computed discount for this code + plan.
    const revalidated = await validatePromoCode(notesPromoCode, plan.name as string, fullAmountPaise);
    if (!revalidated.ok) {
      // Code is now invalid (expired/disabled between /start and /verify).
      // The order was already created by /start with the discounted amount, so we
      // must still honor it (the user already paid). Accept it with a warning log
      // only if the Razorpay order amount matches what /start charged — the amount
      // check below will catch any real tamper. Log for audit visibility.
      console.warn(
        `[plans/verify] promo ${notesPromoCode} no longer valid at verify time (store=${store.id}), proceeding with order amount.`,
      );
    } else {
      // Promo still valid — confirm the discount in notes matches the recomputed value.
      if (revalidated.discountPaise !== notesPromoDiscountPaise) {
        console.error(
          `[plans/verify] promo discount mismatch: notes=${notesPromoDiscountPaise} recomputed=${revalidated.discountPaise} code=${notesPromoCode} store=${store.id}`,
        );
        return NextResponse.json({ error: "Promo discount mismatch. Please try again." }, { status: 400 });
      }
    }
    // Subtract the stashed promo discount from the expected charge.
    expectedChargePaise = Math.max(0, expectedChargePaise - notesPromoDiscountPaise);
  }

  if (Number(rpOrder.amount) !== expectedChargePaise) {
    return NextResponse.json({ error: "Amount mismatch." }, { status: 400 });
  }

  // Single-use: the UNIQUE index on razorpay_order_id makes a replayed order a
  // no-op (idempotent) instead of a free renewal/extension.
  //
  // plan_payments.amount = ACTUAL CHARGED AMOUNT (prorated/discounted).
  // subscriptions.amount_paise = FULL new plan price (for correct MRR tracking).
  // These intentionally differ for prorated upgrades.
  const { error: ledgerErr } = await admin.from("plan_payments").insert({
    store_id: store.id as string,
    plan_id: plan.id as string,
    razorpay_order_id,
    razorpay_payment_id,
    amount: expectedChargePaise, // Actual charge (may be < full price for prorated/promo-discounted orders)
  });
  if (ledgerErr) {
    // Duplicate (already processed) → treat as success without re-activating.
    // Critically: do NOT increment promo usage here — the first successful
    // insert already triggered it below, so a replayed verify won't double-count.
    return NextResponse.json({ ok: true, already: true });
  }

  // Increment promo usage ONLY after the ledger insert succeeds (non-fatal).
  // The UNIQUE constraint on razorpay_order_id in plan_payments means this branch
  // executes exactly once per order — the duplicate path above returns early.
  if (notesPromoId) {
    await incrementPromoUsage(notesPromoId);
  }

  // ── Period end by interval ───────────────────────────────────────────────────
  // Monthly plans: +1 calendar month. Annual plans: +1 calendar year.
  const periodEnd = new Date();
  if (planInterval === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const result = await upsertSubscription({
    storeId: store.id as string,
    planId: plan.id as string,
    // Store the FULL plan price in amount_paise for correct MRR/ARR calculation.
    // The actual discounted charge is in plan_payments.amount above.
    amountPaise: fullAmountPaise,
    periodEndDate: periodEnd,
  });
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Could not activate plan." }, { status: 500 });

  // ── Single combined plan email: activation confirmation + GST tax invoice ──
  // One email (sendPlanInvoiceEmail) covers both the plan-activated confirmation
  // and the attached PDF tax invoice. sendPlanReceipt is no longer called here.
  // Entirely non-fatal: wrapped in try/catch so any failure NEVER blocks the
  // 200 response. createInvoiceForPlan is idempotent on razorpay_order_id stored
  // in meta. If platform GSTIN is not configured, a zero-rate invoice is issued
  // (still a valid receipt). Amount/subscription logic above is untouched.
  try {
    const planName = (plan.name as string) || "Plan";
    // Fetch seller display name from profile for the buyer_name field
    const { data: profileRow } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const buyerName = (profileRow as { full_name?: string | null } | null)?.full_name ?? null;

    const inv = await createInvoiceForPlan({
      adminClient: admin,
      storeId: store.id as string,
      buyerEmail: user.email ?? null,
      buyerName,
      // Invoice amount = actual charge (what was collected), not the full price.
      amountPaise: expectedChargePaise,
      currency: "INR",
      planName,
      razorpayOrderId: razorpay_order_id,
    });

    if (inv) {
      await sendPlanInvoiceEmail({
        to: user.email ?? null,
        invoice: inv,
        planName,
        periodEnd: periodEnd.toDateString(),
      });
    }
  } catch {
    // Non-fatal: invoice/email failure must never block plan activation.
    console.error("[plans/verify] tax invoice generation failed for store", store.id);
  }

  return NextResponse.json({ ok: true });
}
