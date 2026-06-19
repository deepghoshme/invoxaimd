import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductById } from "@/lib/sites";
import { toMinorUnit, DEFAULT_CURRENCY } from "@/lib/products";
import { bumpApplies, bumpPricePaise, type BumpOffer } from "@/lib/upsell";

export const dynamic = "force-dynamic";

/**
 * Public: list the order-bump offers that apply to a given checkout, with the
 * server-computed (discounted) bump price for display. Accepts page_id (opp /
 * course / booking) or product_id (store catalog). Returns [] for anything not
 * resolvable. Prices shown here are display-only — checkout/create re-computes
 * the authoritative amount, so a tampered response cannot change what's charged.
 */
export async function POST(req: Request) {
  let body: { page_id?: string; product_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ offers: [] });
  }

  const sb = createAdminClient();
  let storeId: string | null = null;
  let cartProductId: string | null = null;
  let currency = DEFAULT_CURRENCY;

  if (body.product_id) {
    const product = await getProductById(body.product_id);
    if (!product) return NextResponse.json({ offers: [] });
    storeId = product.store_id as string;
    cartProductId = product.id as string;
    currency = (((product.currency as string) || DEFAULT_CURRENCY)).toUpperCase();
  } else if (body.page_id) {
    const { data: page } = await sb
      .from("pages")
      .select("store_id, status, content")
      .eq("id", body.page_id)
      .maybeSingle();
    if (!page || page.status !== "published") return NextResponse.json({ offers: [] });
    storeId = page.store_id as string;
    const content = (page.content ?? {}) as { currency?: string };
    currency = ((content.currency as string) || DEFAULT_CURRENCY).toUpperCase();
  } else {
    return NextResponse.json({ offers: [] });
  }

  const { data: rawOffers } = await sb
    .from("upsell_offers")
    .select("*")
    .eq("store_id", storeId)
    .eq("offer_kind", "bump")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const applicable = (rawOffers ?? []).filter((o) => bumpApplies(o as BumpOffer, cartProductId));
  if (!applicable.length) return NextResponse.json({ offers: [] });

  const productIds = [...new Set(applicable.map((o) => o.offer_product_id as string))];
  const { data: prods } = await sb
    .from("products")
    .select("id, name, price, currency, stock, store_visible")
    .in("id", productIds);
  const byId = new Map((prods ?? []).map((p) => [p.id as string, p]));

  const offers = [];
  for (const o of applicable) {
    const p = byId.get(o.offer_product_id as string);
    if (!p || p.store_visible === false) continue;
    if (p.stock != null && Number(p.stock) <= 0) continue;
    const cur = (((p.currency as string) || currency)).toUpperCase();
    const originalPaise = toMinorUnit(Number(p.price ?? 0), cur);
    if (originalPaise <= 0) continue;
    const bumpPaise = bumpPricePaise(o as BumpOffer, originalPaise, cur);
    offers.push({
      offer_id: o.id as string,
      name: (o.name as string) || "Add-on offer",
      product_name: (p.name as string) || "Add-on",
      original_paise: originalPaise,
      bump_paise: bumpPaise,
      currency: cur,
    });
  }

  return NextResponse.json({ offers });
}
