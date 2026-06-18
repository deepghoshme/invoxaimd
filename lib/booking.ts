/**
 * Booking page type — shared types and server-side helpers.
 *
 * Availability config is stored in pages.content as BookingContent (JSONB).
 * The `bookings` table holds each confirmed slot.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Content type ─────────────────────────────────────────────────────────────

export type DaySlot = {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sun, 6 = Sat
  start: string; // "HH:MM" 24h
  end: string;   // "HH:MM" 24h
};

export type BookingContent = {
  // Session info
  title?: string;
  description?: string;
  host_name?: string;
  host_bio?: string;
  host_avatar?: string;
  meeting_type?: string; // "Google Meet" | "Zoom" | "In person" | "Phone"
  meeting_detail?: string; // "Link sent on booking" or actual URL
  // Pricing
  price?: number;     // in smallest currency unit (paise for INR)
  currency?: string;  // "INR"
  is_free?: boolean;
  // Availability
  duration?: number;  // session minutes, e.g. 30 | 45 | 60 | 90
  buffer?: number;    // buffer minutes between slots, e.g. 0 | 15 | 30
  max_per_day?: number; // max bookings per calendar day
  timezone?: string;  // IANA timezone, e.g. "Asia/Kolkata"
  slots?: DaySlot[];  // weekly recurring availability
  // Theme
  theme?: "light" | "dark";
  accent_color?: string;
  // SEO
  seo_title?: string;
  seo_description?: string;
};

// ── Booking row type ─────────────────────────────────────────────────────────

export type BookingRow = {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch confirmed/pending bookings for a page within a UTC date range.
 * Returns empty array gracefully if the bookings table doesn't exist yet.
 */
export async function getBookingsForPage(
  pageId: string,
  afterUtc: Date,
  beforeUtc: Date,
): Promise<BookingRow[]> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("bookings")
      .select("id, page_id, store_id, slot_start, slot_end, buyer_name, buyer_email, status, order_id, created_at")
      .eq("page_id", pageId)
      .in("status", ["confirmed", "pending"])
      .gte("slot_start", afterUtc.toISOString())
      .lt("slot_start", beforeUtc.toISOString())
      .order("slot_start");
    if (error) return [];
    return (data ?? []) as BookingRow[];
  } catch {
    return [];
  }
}

/**
 * Get all upcoming bookings for a store (for the dashboard list).
 * Returns empty array gracefully if table is missing.
 */
export async function getUpcomingBookingsForStore(
  storeId: string,
  limit = 50,
): Promise<BookingRow[]> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("bookings")
      .select("id, page_id, store_id, slot_start, slot_end, buyer_name, buyer_email, status, order_id, created_at")
      .eq("store_id", storeId)
      .in("status", ["confirmed", "pending"])
      .gte("slot_start", new Date().toISOString())
      .order("slot_start")
      .limit(limit);
    if (error) return [];
    return (data ?? []) as BookingRow[];
  } catch {
    return [];
  }
}

/**
 * Check whether a specific slot is already taken.
 * A slot is taken if any confirmed/pending booking overlaps [slotStart, slotEnd).
 */
export async function isSlotTaken(
  pageId: string,
  slotStart: Date,
  slotEnd: Date,
): Promise<boolean> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("bookings")
      .select("id")
      .eq("page_id", pageId)
      .in("status", ["confirmed", "pending"])
      .lt("slot_start", slotEnd.toISOString())
      .gt("slot_end", slotStart.toISOString())
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Create a booking row (service-role, bypasses RLS).
 * Returns the created row or null on failure.
 */
export async function createBooking(params: {
  page_id: string;
  store_id: string;
  slot_start: Date;
  slot_end: Date;
  buyer_name: string;
  buyer_email: string;
  order_id?: string | null;
  status?: "confirmed" | "pending";
}): Promise<BookingRow | null> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("bookings")
      .insert({
        page_id: params.page_id,
        store_id: params.store_id,
        slot_start: params.slot_start.toISOString(),
        slot_end: params.slot_end.toISOString(),
        buyer_name: params.buyer_name,
        buyer_email: params.buyer_email,
        status: params.status ?? "confirmed",
        order_id: params.order_id ?? null,
      })
      .select()
      .single();
    if (error) return null;
    return data as BookingRow;
  } catch {
    return null;
  }
}

// ── Availability utils (pure, no DB) ─────────────────────────────────────────

/**
 * Generate all candidate slot starts for a given date (in the booking's timezone)
 * from the weekly availability config.
 *
 * Returns an array of UTC Date objects for slots that START on `localDate`
 * (day-of-week aware).
 *
 * @param localDate   The date in the booking page's timezone (yyyy-mm-dd)
 * @param slots       Weekly DaySlot[] from pages.content
 * @param duration    Session duration in minutes
 * @param buffer      Buffer in minutes between slots
 * @param timezone    IANA timezone string
 */
export function generateSlotsForDate(
  localDate: string, // "YYYY-MM-DD"
  slots: DaySlot[],
  duration: number,
  buffer: number,
  timezone: string,
): Date[] {
  // Parse localDate in the given timezone.
  // We use Intl to determine the day-of-week for that date.
  const [y, m, d] = localDate.split("-").map(Number);
  // Build a reference date at noon local time to determine dow reliably.
  const refDate = new Date(`${localDate}T12:00:00`);
  // Get the weekday in the booking timezone.
  const dowInTz = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(refDate);
  const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = DOW_MAP[dowInTz] ?? -1;

  // Find matching availability windows for this day.
  const daySlots = slots.filter((s) => s.day === dow);
  if (daySlots.length === 0) return [];

  const result: Date[] = [];
  const step = duration + buffer;

  for (const ds of daySlots) {
    const [sh, sm] = ds.start.split(":").map(Number);
    const [eh, em] = ds.end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    let cur = startMin;
    while (cur + duration <= endMin) {
      // Build an ISO datetime string in the booking timezone, then convert to UTC.
      const hh = String(Math.floor(cur / 60)).padStart(2, "0");
      const mm = String(cur % 60).padStart(2, "0");
      // Create UTC Date from local time string via Intl trick.
      const localIso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${hh}:${mm}:00`;
      const utcMs = localIsoToUtcMs(localIso, timezone);
      if (!isNaN(utcMs)) result.push(new Date(utcMs));
      cur += step;
    }
  }

  return result.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Convert a local date-time string ("YYYY-MM-DDTHH:MM:SS") in a given IANA
 * timezone to UTC milliseconds.
 *
 * Strategy: Use the Intl offset for that instant to compute UTC.
 * This handles DST correctly for any IANA zone.
 */
function localIsoToUtcMs(localIso: string, timezone: string): number {
  // First assume it's UTC to get a rough timestamp, then compute the offset.
  const roughUtc = new Date(localIso + "Z");
  if (isNaN(roughUtc.getTime())) return NaN;

  // Format the rough UTC time in the target timezone to see what local time it maps to.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(roughUtc);
  const p = Object.fromEntries(parts.map((pt) => [pt.type, pt.value]));
  const tzLocal = `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;

  // Offset = localIso - tzLocal (in ms).
  const offset = new Date(localIso).getTime() - new Date(tzLocal).getTime();
  return roughUtc.getTime() + offset;
}

/** Format a UTC Date as "HH:MM" in the given IANA timezone. */
export function fmtTime(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(utcDate);
}

/** Format a UTC Date as "YYYY-MM-DD" in the given timezone. */
export function fmtLocalDate(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utcDate);
}
