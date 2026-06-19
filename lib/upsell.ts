import { toMinorUnit } from "@/lib/products";

/** A bump offer row (subset of upsell_offers) needed to price the bump. */
export type BumpOffer = {
  id: string;
  store_id: string;
  name: string | null;
  trigger_type: "any" | "product";
  trigger_product_id: string | null;
  offer_product_id: string;
  offer_kind: "bump" | "post_purchase";
  discount_type: "percent" | "flat" | "none";
  discount_value: number;
  is_active: boolean;
  sort_order: number;
};

/**
 * Price of a bump = the offer product's price minus the offer discount.
 * `discount_value` is a percentage for "percent", or a flat amount in MAJOR
 * currency units (e.g. rupees) for "flat". Returns paise, floored at 1 (gateway
 * minimum). This is the single source of truth — both the display API and the
 * authoritative checkout/create route price the bump through here.
 */
export function bumpPricePaise(
  offer: Pick<BumpOffer, "discount_type" | "discount_value">,
  originalPaise: number,
  currency: string,
): number {
  let bump = originalPaise;
  if (offer.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, offer.discount_value || 0));
    bump = Math.round(originalPaise * (1 - pct / 100));
  } else if (offer.discount_type === "flat") {
    bump = originalPaise - toMinorUnit(offer.discount_value || 0, currency);
  }
  return Math.max(1, bump);
}

/** Does this offer fire for the product currently in the cart? */
export function bumpApplies(offer: BumpOffer, cartProductId: string | null): boolean {
  if (offer.offer_kind !== "bump" || !offer.is_active) return false;
  // Never offer the exact product already being bought.
  if (offer.offer_product_id === cartProductId) return false;
  if (offer.trigger_type === "any") return true;
  return offer.trigger_type === "product" && offer.trigger_product_id === cartProductId;
}
