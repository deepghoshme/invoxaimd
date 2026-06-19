import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GstSplit = {
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxRatePct: number;
};

export type InvoiceRow = {
  id: string;
  store_id: string | null;
  order_id: string | null;
  invoice_number: string;
  buyer_name: string | null;
  buyer_email: string | null;
  currency: string;
  subtotal_paise: number;
  tax_rate: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  gstin: string | null;
  seller_legal_name: string | null;
  seller_address: string | null;
  kind: "order" | "plan" | "wallet";
  meta: Record<string, unknown> | null;
  created_at: string;
};

// ─── GST math ─────────────────────────────────────────────────────────────────

/**
 * Given a GST-INCLUSIVE total (what the buyer paid) and a tax rate percentage,
 * derive the taxable value and GST breakdown.
 *
 * Formula:
 *   taxable = round(total / (1 + rate/100))   <- everything below the GST
 *   taxAmount = total - taxable                <- GST embedded in total
 *
 * Intra-state (sameState=true) -> CGST = SGST = taxAmount/2, IGST = 0
 * Inter-state  (sameState=false) -> IGST = taxAmount, CGST = SGST = 0
 * rate = 0 -> subtotal = total, all tax fields = 0 (valid zero-rate invoice)
 *
 * All amounts are in paise (integer) — never floats passed outside this file.
 */
export function computeGstSplit(
  totalPaise: number,
  taxRate: number,
  sameState: boolean,
): GstSplit {
  const total = Math.round(totalPaise); // guard against floats

  if (!taxRate || taxRate <= 0) {
    return {
      subtotalPaise: total,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      taxRatePct: 0,
    };
  }

  const subtotal = Math.round(total / (1 + taxRate / 100));
  const taxAmount = total - subtotal;

  if (sameState) {
    // Intra-state: CGST + SGST (each half of the total GST)
    const half = Math.floor(taxAmount / 2);
    const otherHalf = taxAmount - half; // absorb any rounding penny into SGST
    return {
      subtotalPaise: subtotal,
      cgstPaise: half,
      sgstPaise: otherHalf,
      igstPaise: 0,
      taxRatePct: taxRate,
    };
  } else {
    // Inter-state: full IGST
    return {
      subtotalPaise: subtotal,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: taxAmount,
      taxRatePct: taxRate,
    };
  }
}

// ─── Invoice creation ─────────────────────────────────────────────────────────

type StoreForInvoice = {
  id: string;
  gst_rate?: number | null;
  gstin?: string | null;
  legal_name?: string | null;
  /** stores.billing jsonb — onboarding-persisted seller details */
  billing?: {
    business_name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    tax_id?: string | null;
    full_name?: string | null;
  } | null;
};

type OrderForInvoice = {
  id: string;
  store_id: string;
  buyer_email: string | null;
  buyer_name: string | null;
  /** Buyer's state/UT — captured at checkout since 2026-06. Used for GST routing. */
  buyer_state?: string | null;
  amount: number;    // in paise
  currency: string;
  product_title?: string | null;
};

/**
 * Create a GST tax invoice row for a confirmed order.
 *
 * Tax-rate resolution (order invoices):
 *   stores.gst_rate (seller-set per-store rate) -> fallback 0
 *
 * sameState derivation:
 *   Seller state: stores.billing->>'state' (set during onboarding).
 *   Buyer state:  orders.buyer_state (captured at checkout since 2026-06).
 *   Both are trimmed and lowercased before comparison.
 *   If EITHER is missing/empty -> safe fallback sameState=true (CGST+SGST).
 *   When BOTH are present and differ -> sameState=false -> IGST (inter-state).
 *
 * Seller identity resolution (priority):
 *   1. stores.gstin / stores.legal_name (explicit column, set via settings)
 *   2. stores.billing.tax_id / stores.billing.business_name (onboarding data)
 *   3. null (still a valid invoice; GSTIN just won't print)
 *
 * Idempotent: if an invoice already exists for this order_id, returns it
 * without re-inserting (safe to call on a retried verify).
 */
export async function createInvoiceForOrder({
  adminClient,
  order,
  store,
}: {
  adminClient: SupabaseClient;
  order: OrderForInvoice;
  store: StoreForInvoice;
}): Promise<InvoiceRow | null> {
  try {
    // --- Idempotency check ---------------------------------------------------
    const { data: existing } = await adminClient
      .from("invoices")
      .select("*")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existing) return existing as InvoiceRow;

    // --- Resolve seller identity --------------------------------------------
    const billing = (store.billing ?? {}) as NonNullable<StoreForInvoice["billing"]>;
    const sellerGstin = store.gstin ?? billing.tax_id ?? null;
    const sellerLegalName =
      store.legal_name ??
      billing.business_name ??
      null;
    const sellerAddressParts = [
      billing.address,
      billing.city,
      billing.state,
      billing.postal_code,
    ].filter(Boolean);
    const sellerAddress = sellerAddressParts.length ? sellerAddressParts.join(", ") : null;

    // --- Tax rate & sameState derivation ------------------------------------
    // Use the seller's configured GST rate; default to 0 (valid zero-rate invoice).
    const taxRate = Number(store.gst_rate ?? 0) || 0;

    // Derive sameState from seller state (stores.billing->>'state') vs buyer state
    // (orders.buyer_state, captured at checkout since 2026-06).
    //
    // Normalisation: trim + lowercase both values before comparing so that
    // "Maharashtra" == "maharashtra" and leading/trailing whitespace is ignored.
    //
    // Safe fallback: if EITHER state is missing/empty, sameState=true (CGST+SGST)
    // — the same conservative default as before. This preserves prior behaviour
    // for old orders or checkouts where the buyer skipped the state field.
    //
    // When BOTH are present and differ -> sameState=false -> IGST (inter-state).
    const sellerState = (billing.state ?? "").trim().toLowerCase();
    const buyerStateRaw = (order.buyer_state ?? "").trim().toLowerCase();
    const sameState =
      sellerState && buyerStateRaw
        ? sellerState === buyerStateRaw
        : true; // conservative fallback — intra-state when either is unknown

    const gst = computeGstSplit(order.amount, taxRate, sameState);

    // --- Sequential invoice number ------------------------------------------
    const { data: numData, error: numErr } = await adminClient.rpc("next_invoice_number");
    if (numErr || !numData) {
      console.error("[invoice] next_invoice_number rpc failed", numErr);
      return null;
    }
    const invoiceNumber = numData as string;

    // --- Insert invoice row --------------------------------------------------
    const { data: inv, error: invErr } = await adminClient
      .from("invoices")
      .insert({
        store_id: order.store_id,
        order_id: order.id,
        invoice_number: invoiceNumber,
        buyer_name: order.buyer_name,
        buyer_email: order.buyer_email,
        currency: order.currency || "INR",
        subtotal_paise: gst.subtotalPaise,
        tax_rate: gst.taxRatePct,
        cgst_paise: gst.cgstPaise,
        sgst_paise: gst.sgstPaise,
        igst_paise: gst.igstPaise,
        total_paise: order.amount,
        gstin: sellerGstin,
        seller_legal_name: sellerLegalName,
        seller_address: sellerAddress,
        kind: "order",
        meta: { product_title: order.product_title ?? null },
      })
      .select("*")
      .single();

    if (invErr) {
      // A unique-violation on invoice_number or order_id means a concurrent
      // insert already succeeded — retry the idempotency fetch.
      if (invErr.code === "23505") {
        const { data: dup } = await adminClient
          .from("invoices")
          .select("*")
          .eq("order_id", order.id)
          .maybeSingle();
        return (dup as InvoiceRow | null) ?? null;
      }
      console.error("[invoice] insert failed", invErr);
      return null;
    }

    return inv as InvoiceRow;
  } catch (e) {
    console.error("[invoice] createInvoiceForOrder unexpected error", e);
    return null;
  }
}

/**
 * Create a GST tax invoice for a platform plan payment.
 *
 * Tax-rate resolution (plan invoices):
 *   platform_settings.default_tax_rate -> fallback 0
 *   If platform_settings.gstin is not set, tax_rate is forced to 0 and the
 *   invoice is still valid as a receipt (zero-rate).
 *
 * sameState: defaulted to true (same reasoning as order invoices).
 *
 * Idempotent on razorpay_order_id stored in meta.razorpay_order_id.
 */
export async function createInvoiceForPlan({
  adminClient,
  storeId,
  buyerEmail,
  buyerName,
  amountPaise,
  currency,
  planName,
  razorpayOrderId,
}: {
  adminClient: SupabaseClient;
  storeId: string;
  buyerEmail: string | null;
  buyerName?: string | null;
  amountPaise: number;
  currency?: string;
  planName: string;
  razorpayOrderId?: string | null;
}): Promise<InvoiceRow | null> {
  try {
    // --- Idempotency check on razorpay_order_id in meta ---------------------
    if (razorpayOrderId) {
      const { data: existing } = await adminClient
        .from("invoices")
        .select("*")
        .eq("kind", "plan")
        .contains("meta", { razorpay_order_id: razorpayOrderId })
        .maybeSingle();
      if (existing) return existing as InvoiceRow;
    }

    // --- Platform identity + tax rate ---------------------------------------
    const { data: ps } = await adminClient
      .from("platform_settings")
      .select("gstin, legal_name, registered_address, default_tax_rate")
      .limit(1)
      .maybeSingle();

    const platformGstin = ps?.gstin ?? null;
    const platformLegalName = ps?.legal_name ?? null;
    const platformAddress = ps?.registered_address ?? null;
    // If platform GSTIN is not set, use tax_rate=0 (note in code as promised).
    // NOTE: Platform has no GSTIN configured -> issuing zero-rate invoice (valid receipt).
    const taxRate = platformGstin ? Number(ps?.default_tax_rate ?? 0) || 0 : 0;
    const sameState = true; // same assumption as order invoices

    const gst = computeGstSplit(amountPaise, taxRate, sameState);

    // --- Sequential invoice number ------------------------------------------
    const { data: numData, error: numErr } = await adminClient.rpc("next_invoice_number");
    if (numErr || !numData) {
      console.error("[invoice] next_invoice_number rpc failed (plan)", numErr);
      return null;
    }
    const invoiceNumber = numData as string;

    // --- Insert invoice row --------------------------------------------------
    const { data: inv, error: invErr } = await adminClient
      .from("invoices")
      .insert({
        store_id: storeId,
        order_id: null,
        invoice_number: invoiceNumber,
        buyer_name: buyerName ?? null,
        buyer_email: buyerEmail,
        currency: currency || "INR",
        subtotal_paise: gst.subtotalPaise,
        tax_rate: gst.taxRatePct,
        cgst_paise: gst.cgstPaise,
        sgst_paise: gst.sgstPaise,
        igst_paise: gst.igstPaise,
        total_paise: amountPaise,
        gstin: platformGstin,
        seller_legal_name: platformLegalName,
        seller_address: platformAddress,
        kind: "plan",
        meta: {
          plan_name: planName,
          ...(razorpayOrderId ? { razorpay_order_id: razorpayOrderId } : {}),
        },
      })
      .select("*")
      .single();

    if (invErr) {
      if (invErr.code === "23505") {
        // concurrent insert — re-fetch if we have enough to match on
        if (razorpayOrderId) {
          const { data: dup } = await adminClient
            .from("invoices")
            .select("*")
            .eq("kind", "plan")
            .contains("meta", { razorpay_order_id: razorpayOrderId })
            .maybeSingle();
          return (dup as InvoiceRow | null) ?? null;
        }
        return null;
      }
      console.error("[invoice] plan insert failed", invErr);
      return null;
    }

    return inv as InvoiceRow;
  } catch (e) {
    console.error("[invoice] createInvoiceForPlan unexpected error", e);
    return null;
  }
}
