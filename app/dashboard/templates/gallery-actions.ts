"use server";

/**
 * Gallery-specific server actions for /dashboard/templates.
 *
 * Phase D of docs/PREMIUM-TEMPLATES-PLAN.md.
 *
 * This file owns only gallery UI concerns (purchase entry point stub).
 * The real apply logic lives in app/dashboard/templates/actions.ts — never import
 * from this file into actions.ts; the dependency only flows the other way.
 *
 * Phase E will REPLACE the body of `startTemplatePurchase` with real wallet +
 * Razorpay logic. The signature and return shape are locked so that Phase E's
 * only change is swapping the stub body.
 */

// ── Phase-E purchase stub ─────────────────────────────────────────────────────

export type PurchaseResult =
  | { ok: false; error: "purchase_not_implemented" }
  | { ok: false; error: string };

/**
 * Entry point for the "Buy & Apply" flow.
 *
 * STUB — Phase E will replace this body with the real wallet / Razorpay flow.
 * See docs/PREMIUM-TEMPLATES-PLAN.md §7 for the full purchase sequence.
 *
 * After Phase E completes this function should:
 *   1. Debit the seller's wallet (Rail A) or open a Razorpay order (Rail B).
 *   2. On success: insert into template_purchases, increment templates.sales_count,
 *      record platform revenue, then call applyTemplate() and return the redirect.
 *   3. On failure: return { ok: false, error: <human-readable message> }.
 *
 * @param templateId  UUID of the template to purchase.
 * @param pageType    The page_type enum value expected by applyTemplate.
 * @param targetPageId  Required for many-type templates (opp/pay/book/ldf/vpc/env).
 *                      Omit for singleton types (website/store/bio/courses).
 *
 * TODO (Phase E): implement wallet debit + Razorpay purchase flow here.
 */
export async function startTemplatePurchase(
  _templateId: string,
  _pageType: string,
  _targetPageId?: string,
): Promise<PurchaseResult> {
  // TODO Phase E: replace this stub with the real purchase + apply pipeline.
  return { ok: false, error: "purchase_not_implemented" };
}
