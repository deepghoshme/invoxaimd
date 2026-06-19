/**
 * Buyer data-access library — Phase 5, Wave 3 foundation.
 *
 * ALL reads use the session-bound server (anon) client from lib/supabase/server.ts
 * so RLS is enforced by the buyer's own JWT. The admin/service-role client is
 * deliberately NOT imported here. See the cross-tenant buyer-read RLS policies
 * installed by 20260619170000_buyer_side.sql.
 *
 * This file is READ-ONLY. Writes (claiming, enrollment creation) live in
 * lib/claim.ts (service-role, separate concern).
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";

// ── Canonical page_type values relevant to buyer deliverables ──────────────

export type PageType =
  | "opp"    // one-page product (digital / physical / service / subscription)
  | "event"
  | "vip"
  | "course"
  | "booking"
  | "pay"
  | "store"
  | "website"
  | "bio"
  | string;  // forward-compat: future types won't break callers

// ── Core order type (history list) ────────────────────────────────────────

export type BuyerOrder = {
  id: string;
  store_id: string;
  page_id: string;
  page_type: PageType;
  /** Product / page title from the order row itself (snapshot at purchase time). */
  product_title: string | null;
  /** Amount in smallest currency unit (paise for INR). */
  amount: number;
  currency: string;
  status: "created" | "paid" | "failed";
  created_at: string;
  paid_at: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  // Enriched from stores + pages
  store_name: string | null;
  store_subdomain: string | null;
  page_title: string | null;
};

// ── Single-order detail (includes page_type for DeliverablePanel dispatch) ─

export type BuyerOrderDetail = BuyerOrder;

// ── Deliverable types — shaped to feed the existing view components ─────────

/**
 * Event ticket row.
 * Feeds: app/event/ticket/[code]/page.tsx (uses code, tier_name, buyer_name,
 * buyer_email, qty, order_id, status, page_id, store_id, created_at).
 */
export type BuyerEventTicket = {
  id: string;
  page_id: string;
  store_id: string;
  tier_name: string;
  buyer_name: string | null;
  buyer_email: string | null;
  qty: number;
  /** Human-readable ticket code, e.g. "INVX-ABCD-1234". QR encodes the verify URL. */
  code: string;
  order_id: string | null;
  status: "issued" | "cancelled" | "used";
  created_at: string;
  /** Absolute URL to the public ticket view — rendered as the QR payload. */
  ticket_url: string;
};

/**
 * VIP membership row.
 * Feeds: components/vip/VipView.tsx (needs invite_link, plan, status, expires_at).
 */
export type BuyerVipMembership = {
  id: string;
  page_id: string;
  store_id: string;
  buyer_name: string | null;
  buyer_email: string;
  plan: "monthly" | "yearly" | "lifetime";
  status: "active" | "expired";
  /** The actual invite URL (Telegram / Discord / WhatsApp), shown post-payment. */
  invite_link: string | null;
  order_id: string | null;
  joined_at: string;
  expires_at: string | null;
};

/**
 * Course enrollment row.
 * Feeds: components/course/CourseView.tsx (needs page_id to gate lesson access).
 */
export type BuyerCourseEnrollment = {
  id: string;
  buyer_id: string | null;
  buyer_email: string | null;
  page_id: string;
  store_id: string;
  order_id: string | null;
  created_at: string;
};

/**
 * Booking row.
 * Feeds: lib/booking.ts BookingRow shape (slot_start, slot_end, status, etc.).
 */
export type BuyerBooking = {
  id: string;
  page_id: string;
  store_id: string;
  slot_start: string;
  slot_end: string;
  buyer_name: string;
  buyer_email: string;
  status: "confirmed" | "pending" | "cancelled";
  order_id: string | null;
  created_at: string;
};

/**
 * Digital download reference.
 * Sourced from the OPP page's content JSONB (OppContent.digital).
 * Feeds: the download panel in the buyer account UI.
 */
export type BuyerDownload = {
  /** "file" = a stored file URL (Supabase Storage or CDN); "url" = external URL. */
  kind: "file" | "url";
  /** Direct download URL (for kind="file") or the access URL (for kind="url"). */
  url: string;
  /** Fallback: the public page URL on the seller's subdomain, always present. */
  page_url: string;
};

// ── Internal DB row shapes (not exported) ──────────────────────────────────

type OrderRow = {
  id: string;
  store_id: string;
  page_id: string;
  page_type: string;
  product_title: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
};

type StoreRow = {
  id: string;
  name: string | null;
  subdomain: string | null;
};

type PageRow = {
  id: string;
  title: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const PLATFORM_HOST = "invoxai.io";

function buildTicketUrl(code: string): string {
  return `https://${PLATFORM_HOST}/event/ticket/${code}`;
}

function buildPageUrl(subdomain: string | null, pageId: string): string {
  if (!subdomain) return `https://${PLATFORM_HOST}/p/${pageId}`;
  return `https://${subdomain}.${PLATFORM_HOST}/p/${pageId}`;
}

function toTypedOrder(
  row: OrderRow,
  store: StoreRow | null,
  page: PageRow | null,
): BuyerOrder {
  return {
    id: row.id,
    store_id: row.store_id,
    page_id: row.page_id,
    page_type: row.page_type as PageType,
    product_title: row.product_title,
    amount: row.amount,
    currency: row.currency,
    status: row.status as BuyerOrder["status"],
    created_at: row.created_at,
    paid_at: row.paid_at,
    buyer_email: row.buyer_email,
    buyer_name: row.buyer_name,
    buyer_phone: row.buyer_phone,
    store_name: store?.name ?? null,
    store_subdomain: store?.subdomain ?? null,
    page_title: page?.title ?? null,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns the current buyer's PAID orders across all sellers, newest first.
 * Uses the session-bound RLS client — returns [] for unauthenticated callers.
 *
 * @param includeAll - When true, returns orders of ALL statuses (created/paid/failed).
 *                     Defaults to false (paid only).
 */
export async function getBuyerOrders(
  includeAll = false,
): Promise<BuyerOrder[]> {
  const sb = await createClient();

  let query = sb
    .from("orders")
    .select(
      "id, store_id, page_id, page_type, product_title, amount, currency, status, created_at, paid_at, buyer_email, buyer_name, buyer_phone",
    )
    .order("created_at", { ascending: false });

  if (!includeAll) {
    query = query.eq("status", "paid");
  }

  const { data: orders, error } = await query;
  if (error || !orders || orders.length === 0) return [];

  // Collect unique store_ids and page_ids for enrichment
  const storeIds = [...new Set(orders.map((o) => o.store_id).filter(Boolean))];
  const pageIds = [...new Set(orders.map((o) => o.page_id).filter(Boolean))];

  // Parallel enrichment queries — still RLS-enforced (stores/pages have their own policies
  // but the admin client is NOT used; the server client can read public store/page data).
  const [storesResult, pagesResult] = await Promise.all([
    storeIds.length > 0
      ? sb.from("stores").select("id, name, subdomain").in("id", storeIds)
      : Promise.resolve({ data: [] as StoreRow[], error: null }),
    pageIds.length > 0
      ? sb.from("pages").select("id, title").in("id", pageIds)
      : Promise.resolve({ data: [] as PageRow[], error: null }),
  ]);

  const storeMap = new Map<string, StoreRow>(
    (storesResult.data ?? []).map((s) => [s.id, s as StoreRow]),
  );
  const pageMap = new Map<string, PageRow>(
    (pagesResult.data ?? []).map((p) => [p.id, p as PageRow]),
  );

  return (orders as OrderRow[]).map((row) =>
    toTypedOrder(
      row,
      storeMap.get(row.store_id) ?? null,
      pageMap.get(row.page_id) ?? null,
    ),
  );
}

/**
 * Returns a single order the buyer owns, enriched with store + page metadata.
 * RLS returns 0 rows if the order doesn't belong to this buyer, so returns null.
 */
export async function getBuyerOrder(
  orderId: string,
): Promise<BuyerOrderDetail | null> {
  if (!orderId) return null;
  const sb = await createClient();

  const { data: row, error } = await sb
    .from("orders")
    .select(
      "id, store_id, page_id, page_type, product_title, amount, currency, status, created_at, paid_at, buyer_email, buyer_name, buyer_phone",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !row) return null;

  const orderRow = row as OrderRow;

  const [storeRes, pageRes] = await Promise.all([
    sb.from("stores").select("id, name, subdomain").eq("id", orderRow.store_id).maybeSingle(),
    sb.from("pages").select("id, title").eq("id", orderRow.page_id).maybeSingle(),
  ]);

  return toTypedOrder(
    orderRow,
    (storeRes.data as StoreRow | null) ?? null,
    (pageRes.data as PageRow | null) ?? null,
  );
}

/**
 * Returns the event ticket(s) for this buyer's order.
 * Feeds: app/event/ticket/[code]/page.tsx (ticket code, QR payload, tier, qty, status).
 *
 * Multiple tickets can be returned when a buyer purchased qty > 1 in separate
 * rows, but typically there is one row per order.
 */
export async function getBuyerEventTicket(
  order: Pick<BuyerOrder, "id" | "page_id" | "store_subdomain">,
): Promise<BuyerEventTicket[]> {
  const sb = await createClient();

  const { data, error } = await sb
    .from("event_tickets")
    .select(
      "id, page_id, store_id, tier_name, buyer_name, buyer_email, qty, code, order_id, status, created_at",
    )
    .eq("page_id", order.page_id)
    .eq("order_id", order.id);

  if (error || !data) return [];

  return data.map((t) => ({
    id: t.id as string,
    page_id: t.page_id as string,
    store_id: t.store_id as string,
    tier_name: t.tier_name as string,
    buyer_name: (t.buyer_name as string | null) ?? null,
    buyer_email: (t.buyer_email as string | null) ?? null,
    qty: t.qty as number,
    code: t.code as string,
    order_id: (t.order_id as string | null) ?? null,
    status: t.status as BuyerEventTicket["status"],
    created_at: t.created_at as string,
    ticket_url: buildTicketUrl(t.code as string),
  }));
}

/**
 * Returns the VIP membership for this buyer's order.
 * Feeds: components/vip/VipView.tsx (invite_link, plan, status, expires_at).
 */
export async function getBuyerVipMembership(
  order: Pick<BuyerOrder, "id" | "page_id">,
): Promise<BuyerVipMembership | null> {
  const sb = await createClient();

  const { data, error } = await sb
    .from("vip_members")
    .select(
      "id, page_id, store_id, buyer_name, buyer_email, plan, status, invite_link, order_id, joined_at, expires_at",
    )
    .eq("page_id", order.page_id)
    .eq("order_id", order.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    page_id: data.page_id as string,
    store_id: data.store_id as string,
    buyer_name: (data.buyer_name as string | null) ?? null,
    buyer_email: data.buyer_email as string,
    plan: data.plan as BuyerVipMembership["plan"],
    status: data.status as BuyerVipMembership["status"],
    invite_link: (data.invite_link as string | null) ?? null,
    order_id: (data.order_id as string | null) ?? null,
    joined_at: data.joined_at as string,
    expires_at: (data.expires_at as string | null) ?? null,
  };
}

/**
 * Returns the course enrollment for this buyer's order.
 * Feeds: components/course/CourseView.tsx (page_id gates lesson access).
 */
export async function getBuyerCourseEnrollment(
  order: Pick<BuyerOrder, "id" | "page_id">,
): Promise<BuyerCourseEnrollment | null> {
  const sb = await createClient();

  const { data, error } = await sb
    .from("course_enrollments")
    .select("id, buyer_id, buyer_email, page_id, store_id, order_id, created_at")
    .eq("page_id", order.page_id)
    .eq("order_id", order.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    buyer_id: (data.buyer_id as string | null) ?? null,
    buyer_email: (data.buyer_email as string | null) ?? null,
    page_id: data.page_id as string,
    store_id: data.store_id as string,
    order_id: (data.order_id as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

/**
 * Returns the booking for this buyer's order.
 * Feeds: lib/booking.ts BookingRow shape (slot_start, slot_end, status).
 */
export async function getBuyerBooking(
  order: Pick<BuyerOrder, "id" | "page_id">,
): Promise<BuyerBooking | null> {
  const sb = await createClient();

  const { data, error } = await sb
    .from("bookings")
    .select(
      "id, page_id, store_id, slot_start, slot_end, buyer_name, buyer_email, status, order_id, created_at",
    )
    .eq("page_id", order.page_id)
    .eq("order_id", order.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    page_id: data.page_id as string,
    store_id: data.store_id as string,
    slot_start: data.slot_start as string,
    slot_end: data.slot_end as string,
    buyer_name: data.buyer_name as string,
    buyer_email: data.buyer_email as string,
    status: data.status as BuyerBooking["status"],
    order_id: (data.order_id as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

/**
 * Returns the digital download reference for an OPP (one-page product) order.
 *
 * Delivery mechanism: OppContent.digital in pages.content JSONB.
 *   - digital.kind = "file": direct download URL from storage
 *   - digital.kind = "url":  access URL (e.g. Google Drive, Gumroad mirror)
 *
 * If neither is present (non-digital product type or no delivery configured),
 * returns a fallback BuyerDownload pointing to the seller's page URL so the
 * buyer can contact the seller. The page_url is always populated.
 *
 * Feeds: the download panel in the buyer /account/orders/[id] UI.
 *
 * NOTE: The OPP page content is read from `pages` via the server (anon) client.
 * The anon role can SELECT from pages for published pages (public storefront RLS).
 * If for some reason the page is unpublished and anon cannot read it, the
 * function returns a page_url fallback rather than throwing.
 */
export async function getBuyerDownload(
  order: Pick<BuyerOrder, "page_id" | "store_subdomain">,
): Promise<BuyerDownload | null> {
  const sb = await createClient();

  const { data, error } = await sb
    .from("pages")
    .select("id, content")
    .eq("id", order.page_id)
    .maybeSingle();

  const page_url = buildPageUrl(order.store_subdomain, order.page_id);

  if (error || !data) {
    // Can't read the page — return page_url so the buyer can access it directly
    return { kind: "url", url: page_url, page_url };
  }

  type DigitalField = {
    kind?: "file" | "url";
    file?: string;
    url?: string;
  } | undefined | null;

  const content = (data.content ?? {}) as Record<string, unknown>;
  const digital = content.digital as DigitalField;

  if (!digital) {
    // Not a digital product or no delivery configured — fall back to page URL
    return { kind: "url", url: page_url, page_url };
  }

  const kind = digital.kind === "file" ? "file" : "url";
  const rawUrl = kind === "file" ? digital.file : digital.url;

  if (!rawUrl) {
    return { kind, url: page_url, page_url };
  }

  return { kind, url: rawUrl, page_url };
}
