import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreCommissionRate, createOrderRecord, getProductById } from "@/lib/sites";
import { type OppContent, toMinorUnit, DEFAULT_CURRENCY } from "@/lib/products";

/**
 * Create an internal order for either a published one-page (`opp`) page OR a
 * store catalog product (`product_id`). Amount is taken from the DB (never
 * trusted from the client). Returns the order id for the checkout flow.
 */
export async function POST(req: Request) {
  let body: { page_id?: string; product_id?: string; qty?: number; variant?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // ── Store catalog product checkout ────────────────────────────────────────
  if (body.product_id) {
    const product = await getProductById(body.product_id);
    if (!product || product.store_visible === false) {
      return NextResponse.json({ error: "Product not available" }, { status: 404 });
    }
    if (product.stock != null && Number(product.stock) <= 0) {
      return NextResponse.json({ error: "This product is sold out" }, { status: 409 });
    }
    const currency = ((product.currency as string) || DEFAULT_CURRENCY).toUpperCase();
    const qty = Math.max(1, Math.min(99, Math.round(Number(body.qty) || 1)));
    const unit = toMinorUnit(Number(product.price ?? 0), currency);
    const amount = unit * qty;
    if (amount <= 0) {
      return NextResponse.json({ error: "This product has no price set" }, { status: 400 });
    }
    const variant = typeof body.variant === "string" ? body.variant.slice(0, 120).trim() : "";
    const baseTitle = (product.name as string) || "Product";
    const title = `${baseTitle}${variant ? ` (${variant})` : ""}${qty > 1 ? ` ×${qty}` : ""}`;
    const storeId = product.store_id as string;
    const rate = await getStoreCommissionRate(storeId);
    const order = await createOrderRecord({
      store_id: storeId,
      page_id: null,
      product_id: product.id as string,
      page_type: "store",
      product_title: title,
      amount,
      currency,
      commission_rate: rate,
      commission_amount: Math.round(amount * rate),
    });
    if (!order) return NextResponse.json({ error: "Could not create order" }, { status: 500 });
    return NextResponse.json({ order_id: order.id, page_type: "store" });
  }

  const pageId = body.page_id;
  if (!pageId) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: page } = await supabase
    .from("pages")
    .select("id, store_id, page_type, title, content, status")
    .eq("id", pageId)
    .maybeSingle();

  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Product not available" }, { status: 404 });
  }
  if (page.page_type !== "opp") {
    return NextResponse.json({ error: "Unsupported page type" }, { status: 400 });
  }

  const content = (page.content ?? {}) as OppContent;
  const currency = (content.currency || DEFAULT_CURRENCY).toUpperCase();
  const amount = toMinorUnit(content.price ?? 0, currency);
  if (amount <= 0) {
    return NextResponse.json({ error: "This product has no price set" }, { status: 400 });
  }

  const rate = await getStoreCommissionRate(page.store_id);
  const order = await createOrderRecord({
    store_id: page.store_id,
    page_id: page.id,
    page_type: page.page_type,
    product_title: content.headline || page.title || "Product",
    amount,
    currency,
    commission_rate: rate,
    commission_amount: Math.round(amount * rate),
  });

  if (!order) return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  return NextResponse.json({ order_id: order.id, page_type: page.page_type });
}
