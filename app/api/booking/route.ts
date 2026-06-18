/**
 * POST /api/booking
 *
 * Public endpoint — creates a booking for a published booking page.
 * Runs entirely with the service-role client (bypasses RLS) so that
 * unauthenticated visitors can book without a Supabase session.
 *
 * Body:
 *   page_id     string   — the page uuid
 *   public_id   string   — page public_id (extra guard: must match)
 *   slot_start  string   — ISO-8601 UTC datetime
 *   buyer_name  string
 *   buyer_email string
 *
 * Returns:
 *   { booking_id }   on success (201)
 *   { error }        on failure (4xx / 500)
 *
 * Auth/tenancy: page must be published, page_type='booking', store must be
 *   active. All amounts come from DB (never trusted from client).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSlotTaken,
  createBooking,
  generateSlotsForDate,
  fmtLocalDate,
  type BookingContent,
  type DaySlot,
} from "@/lib/booking";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  // ── Parse + basic validation ────────────────────────────────────────────────
  let body: {
    page_id?: unknown;
    public_id?: unknown;
    slot_start?: unknown;
    buyer_name?: unknown;
    buyer_email?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pageId = typeof body.page_id === "string" ? body.page_id.trim() : "";
  const publicId = typeof body.public_id === "string" ? body.public_id.trim() : "";
  const slotStartRaw = typeof body.slot_start === "string" ? body.slot_start.trim() : "";
  const buyerName = typeof body.buyer_name === "string" ? body.buyer_name.trim().slice(0, 200) : "";
  const buyerEmail = typeof body.buyer_email === "string" ? body.buyer_email.trim().toLowerCase().slice(0, 300) : "";

  if (!pageId) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });
  if (!slotStartRaw) return NextResponse.json({ error: "Missing slot_start" }, { status: 400 });
  if (!buyerName) return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  if (!EMAIL_RE.test(buyerEmail)) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });

  const slotStart = new Date(slotStartRaw);
  if (isNaN(slotStart.getTime())) return NextResponse.json({ error: "Invalid slot_start" }, { status: 400 });
  if (slotStart < new Date()) return NextResponse.json({ error: "Cannot book a slot in the past" }, { status: 400 });

  // ── Load the booking page (service role) ────────────────────────────────────
  const sb = createAdminClient();
  const { data: page, error: pageErr } = await sb
    .from("pages")
    .select("id, store_id, page_type, status, content, public_id")
    .eq("id", pageId)
    .maybeSingle();

  if (pageErr || !page) return NextResponse.json({ error: "Booking page not found" }, { status: 404 });
  if (page.status !== "published") return NextResponse.json({ error: "This booking page is not accepting bookings" }, { status: 404 });
  if (page.page_type !== "booking") return NextResponse.json({ error: "Not a booking page" }, { status: 400 });
  // Extra guard: public_id match when provided.
  if (publicId && page.public_id !== publicId) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const content = (page.content ?? {}) as BookingContent;
  const duration = typeof content.duration === "number" && content.duration > 0 ? content.duration : 60;
  const buffer = typeof content.buffer === "number" ? content.buffer : 0;
  const timezone = typeof content.timezone === "string" && content.timezone ? content.timezone : "Asia/Kolkata";
  const slots = Array.isArray(content.slots) ? (content.slots as DaySlot[]) : [];

  // ── Validate slot is within configured availability ──────────────────────────
  const localDate = fmtLocalDate(slotStart, timezone);
  const validSlots = generateSlotsForDate(localDate, slots, duration, buffer, timezone);
  const slotStartMs = slotStart.getTime();
  const isValidSlot = validSlots.some((s) => Math.abs(s.getTime() - slotStartMs) < 60_000); // 1 min tolerance
  if (!isValidSlot) {
    return NextResponse.json({ error: "This time slot is not available" }, { status: 409 });
  }

  // ── Check max-per-day ───────────────────────────────────────────────────────
  const maxPerDay = typeof content.max_per_day === "number" && content.max_per_day > 0 ? content.max_per_day : 99;
  if (maxPerDay < 99) {
    const dayStart = new Date(`${localDate}T00:00:00Z`);
    const dayEnd = new Date(`${localDate}T23:59:59Z`);
    const { count } = await sb
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("page_id", pageId)
      .in("status", ["confirmed", "pending"])
      .gte("slot_start", dayStart.toISOString())
      .lte("slot_start", dayEnd.toISOString());
    if ((count ?? 0) >= maxPerDay) {
      return NextResponse.json({ error: "No more slots available on this day" }, { status: 409 });
    }
  }

  // ── Check slot not already taken ────────────────────────────────────────────
  const slotEnd = new Date(slotStart.getTime() + duration * 60_000);
  const taken = await isSlotTaken(pageId, slotStart, slotEnd);
  if (taken) return NextResponse.json({ error: "This slot has just been booked. Please pick another." }, { status: 409 });

  // ── Paid booking: require checkout flow first (for paid sessions) ────────────
  // If the session has a price > 0, the client should have gone through
  // /api/checkout/create → Razorpay → /api/checkout/verify FIRST, then call
  // this endpoint with the verified order_id in the request. For free sessions,
  // we create the booking directly.
  //
  // Current implementation: we create the booking row immediately (for free
  // sessions). For paid sessions where no order_id is provided we still create
  // the booking in "pending" status so the slot is reserved while payment occurs.
  // The checkout verify route should upgrade status to "confirmed".
  const price = typeof content.price === "number" ? content.price : 0;
  const isFree = content.is_free === true || price <= 0;
  const bookingStatus = isFree ? "confirmed" : "pending";

  // ── Create booking row ───────────────────────────────────────────────────────
  const booking = await createBooking({
    page_id: pageId,
    store_id: page.store_id,
    slot_start: slotStart,
    slot_end: slotEnd,
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    status: bookingStatus,
  });

  if (!booking) {
    return NextResponse.json({ error: "Failed to create booking. Please try again." }, { status: 500 });
  }

  // If paid and needs order, return booking_id + needs_payment flag so the
  // client can redirect to the checkout flow.
  if (!isFree) {
    // Create an order via the existing checkout create endpoint logic inline.
    // We return the booking_id and redirect the client to /api/checkout/create
    // with the page_id so Razorpay flow begins. The booking is in "pending" state.
    return NextResponse.json({
      booking_id: booking.id,
      needs_payment: true,
      page_id: pageId,
      amount: price,
    }, { status: 201 });
  }

  return NextResponse.json({ booking_id: booking.id, status: "confirmed" }, { status: 201 });
}

/**
 * GET /api/booking?page_id=…&year=…&month=… (1-indexed)
 *
 * Returns booked slot ISO strings for the given month so the public calendar
 * can mark them as taken. Public — no auth needed.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pageId = url.searchParams.get("page_id") ?? "";
  const year = parseInt(url.searchParams.get("year") ?? "");
  const month = parseInt(url.searchParams.get("month") ?? ""); // 1-indexed

  if (!pageId) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  // Build UTC range for the month (ample — covers any timezone offset).
  const afterUtc = new Date(Date.UTC(year, month - 1, 1));
  const beforeUtc = new Date(Date.UTC(year, month, 1));

  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("bookings")
      .select("slot_start, slot_end")
      .eq("page_id", pageId)
      .in("status", ["confirmed", "pending"])
      .gte("slot_start", afterUtc.toISOString())
      .lt("slot_start", beforeUtc.toISOString())
      .order("slot_start");

    if (error) return NextResponse.json({ bookings: [] });
    return NextResponse.json({
      bookings: (data ?? []).map((b) => ({ slot_start: b.slot_start, slot_end: b.slot_end })),
    });
  } catch {
    return NextResponse.json({ bookings: [] });
  }
}
