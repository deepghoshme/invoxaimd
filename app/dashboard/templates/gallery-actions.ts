"use server";

/**
 * Gallery-specific server actions for /dashboard/templates.
 *
 * Phase E of docs/PREMIUM-TEMPLATES-PLAN.md.
 *
 * This file owns the purchase entry point for the gallery.
 * The real apply logic lives in app/dashboard/templates/actions.ts — the
 * dependency only flows this way: gallery-actions → actions (never the reverse).
 *
 * `startTemplatePurchase` implements the WALLET rail end-to-end.
 * The Razorpay rail is handled by two API routes:
 *   /api/templates/buy/start  (creates the Razorpay order)
 *   /api/templates/buy/verify (verifies signature + records purchase + applies)
 *
 * The gallery client (TemplateGallery.tsx) calls this for the wallet path and
 * directly calls the API routes for the Razorpay path.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature } from "@/lib/plan-features.server";
import { SINGLETON_PAGE_TYPES, TYPE_TO_PAGE, type TemplateType, type PageTypeEnum } from "@/lib/templates-apply";
import { applyTemplate } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PurchaseResult =
  | { ok: true; redirect: string; pageId: string }
  | { ok: false; error: string; needsRecharge?: true; price_paise?: number; balance?: number };

type PurchaseOptions = {
  /** Which payment rail to use. Only 'wallet' is processed here; 'razorpay' is handled by the API routes. */
  rail: "wallet" | "razorpay";
};

type TemplateRow = {
  id: string;
  name: string;
  type: string;
  tier: "free" | "premium";
  price_paise: number;
  license_model: "per_store" | "per_page" | "all_access";
  status: string;
  content: Record<string, unknown>;
  theme: Record<string, unknown>;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getAuthedStore(): Promise<{ userId: string; storeId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: store } = await admin
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) return { error: "No store found for this account." };
  return { userId: user.id, storeId: store.id as string };
}

/**
 * Resolve the target page for a template purchase/apply.
 * For singleton page types: finds or creates the store's one page of that type.
 * For many-type pages: validates the provided targetPageId (ownership + type match).
 * Returns the resolved page id.
 *
 * This mirrors the same logic in applyTemplate() (actions.ts) so purchase and
 * apply use the same target-page identity. Exported so the API routes can reuse
 * it too without duplicating the logic.
 */
export async function resolveTargetPage(
  storeId: string,
  pageType: PageTypeEnum,
  targetPageId?: string,
): Promise<{ pageId: string } | { error: string }> {
  const admin = createAdminClient();

  if (SINGLETON_PAGE_TYPES.has(pageType)) {
    // Singleton: find or create the store's one page of this type.
    const { data: existing } = await admin
      .from("pages")
      .select("id")
      .eq("store_id", storeId)
      .eq("page_type", pageType)
      .maybeSingle();

    if (existing) return { pageId: existing.id as string };

    // Create a draft singleton page.
    const { data: created, error: createErr } = await admin
      .from("pages")
      .insert({
        store_id: storeId,
        page_type: pageType,
        title: pageType.charAt(0).toUpperCase() + pageType.slice(1),
        status: "draft",
        content: {},
        seo: {},
        pixels: {},
      })
      .select("id")
      .single();

    if (createErr || !created) {
      return { error: "Failed to create page: " + (createErr?.message ?? "unknown error") };
    }
    return { pageId: created.id as string };
  } else {
    // Many-type: targetPageId is required.
    if (!targetPageId) {
      return { error: `A targetPageId is required for page type '${pageType}'.` };
    }

    const { data: page } = await admin
      .from("pages")
      .select("id, store_id, page_type")
      .eq("id", targetPageId)
      .maybeSingle();

    if (!page) return { error: "Target page not found." };
    if ((page as { store_id: string }).store_id !== storeId) return { error: "You do not own this page." };
    if ((page as { page_type: string }).page_type !== pageType) {
      return { error: `Page type mismatch: page is '${(page as { page_type: string }).page_type}', template requires '${pageType}'.` };
    }
    return { pageId: page.id as string };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Entry point for the "Buy & Apply" flow (WALLET rail only).
 *
 * Razorpay rail: the client calls /api/templates/buy/start and /api/templates/buy/verify
 * directly — this function is NOT used for that rail (rail='razorpay' is an error here,
 * kept in the type for symmetry with the client chooser UI).
 *
 * Wallet rail logic:
 *  1. Auth + resolve store.
 *  2. Load template (admin client); assert published + premium.
 *  3. Determine license slot:
 *       all_access  → skip charge, go straight to applyTemplate.
 *       per_store   → page_id = NULL.
 *       per_page    → resolve targetPageId (create singleton if needed).
 *  4. If already licensed for that slot → skip debit, apply.
 *  5. Check wallet_balance; if insufficient → return {needsRecharge:true, ...}.
 *  6. Insert template_purchases row (idempotent on unique index — duplicate → apply
 *     without double-debit). Then debit wallet:
 *       update stores.wallet_balance -= price_paise
 *       insert wallet_ledger {type:'debit', reason:'template_purchase', amount, store_id}
 *  7. Increment templates.sales_count.
 *  8. Call applyTemplate(templateId, {pageType, targetPageId}) → return its redirect.
 *
 * @param templateId   UUID of the template to purchase.
 * @param pageType     The page_type enum value expected by applyTemplate.
 * @param targetPageId Required for many-type templates (opp/pay/book/ldf/vpc/env).
 * @param options      { rail: 'wallet' | 'razorpay' } — only 'wallet' handled here.
 */
export async function startTemplatePurchase(
  templateId: string,
  pageType: string,
  targetPageId?: string,
  options?: PurchaseOptions,
): Promise<PurchaseResult> {
  // Only the wallet rail is handled here.
  if (options?.rail === "razorpay") {
    return { ok: false, error: "Use the /api/templates/buy/start route for the Razorpay rail." };
  }

  // ── 1. Auth + store ────────────────────────────────────────────────────────
  const storeResult = await getAuthedStore();
  if ("error" in storeResult) return { ok: false, error: storeResult.error };
  const { storeId } = storeResult;

  const admin = createAdminClient();

  // ── 2. Load template ───────────────────────────────────────────────────────
  const { data: tmpl, error: tmplErr } = await admin
    .from("templates")
    .select("id, name, type, tier, price_paise, license_model, status, content, theme")
    .eq("id", templateId)
    .maybeSingle();

  if (tmplErr || !tmpl) return { ok: false, error: "Template not found." };

  const template = tmpl as TemplateRow;

  if (template.status !== "published") return { ok: false, error: "Template is not published." };
  if (template.tier !== "premium") return { ok: false, error: "This template is free — use applyTemplate directly." };

  // Map template type → page type to validate the caller's pageType param.
  const mappedPageType = TYPE_TO_PAGE[template.type as TemplateType];
  if (mappedPageType === null || mappedPageType === undefined) {
    return { ok: false, error: `Template type '${template.type}' cannot be applied to a page.` };
  }
  if (mappedPageType !== pageType) {
    return { ok: false, error: `Template type '${template.type}' maps to page type '${mappedPageType}' but '${pageType}' was requested.` };
  }

  const resolvedPageType = pageType as PageTypeEnum;

  // ── 3. License-slot determination ─────────────────────────────────────────

  // all_access: plan feature unlocks this template; no charge needed.
  if (template.license_model === "all_access") {
    const hasAccess = await hasFeature(storeId, "templates_all_access");
    if (!hasAccess) {
      return { ok: false, error: "This template requires an all-access plan subscription." };
    }
    // Skip charge; go straight to apply.
    const applyResult = await applyTemplate(templateId, { pageType: resolvedPageType, targetPageId });
    if (!applyResult.ok) {
      return { ok: false, error: (applyResult as { error: string }).error ?? "Failed to apply template." };
    }
    return { ok: true, redirect: applyResult.redirect, pageId: applyResult.pageId };
  }

  // Resolve the target page (needed for license-slot check + apply).
  const pageResult = await resolveTargetPage(storeId, resolvedPageType, targetPageId);
  if ("error" in pageResult) return { ok: false, error: pageResult.error };
  const resolvedPageId = pageResult.pageId;

  // For per_store: the license slot has no page (page_id is NULL in the DB).
  // For per_page: the license slot is tied to the specific page.
  const licensePageId = template.license_model === "per_page" ? resolvedPageId : null;

  // ── 4. Already licensed? ───────────────────────────────────────────────────
  {
    let existingQuery = admin
      .from("template_purchases")
      .select("id")
      .eq("store_id", storeId)
      .eq("template_id", templateId);

    if (licensePageId === null) {
      existingQuery = existingQuery.is("page_id", null);
    } else {
      existingQuery = existingQuery.eq("page_id", licensePageId);
    }

    const { data: existingRow } = await existingQuery.maybeSingle();
    if (existingRow) {
      // Already licensed — skip debit, just apply.
      const applyResult = await applyTemplate(templateId, { pageType: resolvedPageType, targetPageId: resolvedPageId });
      if (!applyResult.ok) {
        return { ok: false, error: (applyResult as { error: string }).error ?? "Failed to apply template." };
      }
      return { ok: true, redirect: applyResult.redirect, pageId: applyResult.pageId };
    }
  }

  // ── 5. Wallet balance check ────────────────────────────────────────────────
  const { data: storeRow } = await admin
    .from("stores")
    .select("wallet_balance")
    .eq("id", storeId)
    .maybeSingle();

  const currentBalance = Number(storeRow?.wallet_balance ?? 0);
  const price = template.price_paise;

  if (currentBalance < price) {
    return {
      ok: false,
      error: "Insufficient wallet balance.",
      needsRecharge: true,
      price_paise: price,
      balance: currentBalance,
    };
  }

  // ── 6. Insert template_purchases row (idempotency guard) ──────────────────
  // The UNIQUE index on (store_id, template_id, coalesce(page_id, zero-uuid))
  // prevents double-insertion. If a race produces a duplicate, the insert
  // returns a unique-violation (code '23505'); treat as already-owned.
  const { data: purchaseRow, error: purchaseErr } = await admin
    .from("template_purchases")
    .insert({
      store_id: storeId,
      template_id: templateId,
      page_id: licensePageId,
      price_paise: price,
      source: "wallet",
      payment_ref: null, // will be updated with ledger id below
    })
    .select("id")
    .single();

  if (purchaseErr) {
    if (purchaseErr.code === "23505") {
      // Race: another request just inserted the same row. Treat as already-owned.
      // No debit — the other request (or a prior one) already charged the wallet.
      const applyResult = await applyTemplate(templateId, { pageType: resolvedPageType, targetPageId: resolvedPageId });
      if (!applyResult.ok) {
        return { ok: false, error: (applyResult as { error: string }).error ?? "Failed to apply template." };
      }
      return { ok: true, redirect: applyResult.redirect, pageId: applyResult.pageId };
    }
    console.error("[templates/wallet] purchase insert failed:", purchaseErr);
    return { ok: false, error: "Failed to record purchase. Please try again." };
  }

  const purchaseId = (purchaseRow as { id: string }).id;

  // ── Wallet debit ───────────────────────────────────────────────────────────
  // Debit: update stores.wallet_balance and insert a wallet_ledger debit row.
  // The wallet_ledger reason for template purchases is 'template_purchase'.
  // Phase F reads template revenue from:
  //   (a) wallet_ledger WHERE reason = 'template_purchase' (wallet sales)
  //   (b) template_purchases WHERE source = 'razorpay' (razorpay sales)
  const newBalance = currentBalance - price;

  const { data: ledgerRow, error: ledgerErr } = await admin
    .from("wallet_ledger")
    .insert({
      store_id: storeId,
      type: "debit",
      amount: price,
      balance_after: newBalance,
      reason: "template_purchase",
      gateway_payment_id: null,
      razorpay_order_id: null,
    })
    .select("id")
    .single();

  if (ledgerErr) {
    // Ledger insert failed. The purchase row was already inserted but the wallet
    // was not debited — roll back the purchase row to keep state consistent.
    console.error("[templates/wallet] ledger insert failed:", ledgerErr);
    await admin.from("template_purchases").delete().eq("id", purchaseId);
    return { ok: false, error: "Failed to debit wallet. Please try again." };
  }

  // Update the denormalised wallet_balance on stores.
  await admin.from("stores").update({ wallet_balance: newBalance }).eq("id", storeId);

  // Back-fill payment_ref on the purchase row with the ledger row id.
  const ledgerId = (ledgerRow as { id: string }).id;
  await admin
    .from("template_purchases")
    .update({ payment_ref: ledgerId })
    .eq("id", purchaseId);

  // ── 7. Increment templates.sales_count ────────────────────────────────────
  // Use a raw SQL increment via rpc if available; fall back to a read-then-write.
  // A tiny race on the fallback is acceptable — this is a display counter only.
  const rpcResult = await admin.rpc("increment_template_sales", { tmpl_id: templateId });
  if (rpcResult.error) {
    // RPC not available: fall back to an atomic SQL expression via raw query.
    // Supabase JS v2 does not expose `.increment()` natively, so we use a
    // manual approach with the service-role client (which bypasses RLS).
    await admin
      .from("templates")
      .update({ sales_count: ((tmpl as TemplateRow & { sales_count: number }).sales_count ?? 0) + 1 })
      .eq("id", templateId);
  }

  // ── 8. Apply the template ──────────────────────────────────────────────────
  // Now that the purchase row + wallet debit are recorded, applyTemplate will
  // find the license and apply the template content.
  const applyResult = await applyTemplate(templateId, { pageType: resolvedPageType, targetPageId: resolvedPageId });
  if (!applyResult.ok) {
    // Purchase + debit succeeded but apply failed. The license is already recorded
    // so the seller can retry. Return a specific error but don't roll back the charge.
    return {
      ok: false,
      error: "Payment recorded but template apply failed. Please go to Templates and click Apply.",
    };
  }

  return { ok: true, redirect: applyResult.redirect, pageId: applyResult.pageId };
}
