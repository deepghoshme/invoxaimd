/**
 * Event page types and helpers.
 * Event content lives in pages.content (JSONB); tickets in the event_tickets table.
 */

/** One ticket tier as stored in pages.content */
export type EventTier = {
  name: string;       // e.g. "General", "VIP · Q&A"
  desc?: string;      // short description shown to buyers
  price: number;      // in major units (e.g. 799 for ₹799)
  qty: number;        // max seats for this tier (0 = unlimited)
};

/** The JSONB shape stored in pages.content for page_type = 'event' */
export type EventContent = {
  // Event info
  title?: string;
  tagline?: string;
  description?: string;
  event_date?: string;   // ISO date string, e.g. "2026-06-28"
  event_time?: string;   // e.g. "18:00"
  timezone?: string;     // e.g. "Asia/Kolkata"
  is_online?: boolean;
  location?: string;     // venue name or Zoom/Meet link
  poster_url?: string;

  // Ticket tiers array
  tiers?: EventTier[];

  // Currency (ISO, uppercase)
  currency?: string;

  // Theme
  theme?: "light" | "dark";
  accent?: number;
  accentColor?: string;

  // SEO
  seo_title?: string;
  seo_description?: string;
  og_image?: string;
};

export const DEFAULT_TIER: EventTier = {
  name: "General",
  desc: "Live access + recording",
  price: 799,
  qty: 100,
};

export const DEFAULT_EVENT: EventContent = {
  title: "My Event",
  tagline: "Join us for an unforgettable experience",
  description: "",
  event_date: "",
  event_time: "",
  timezone: "Asia/Kolkata",
  is_online: true,
  location: "",
  poster_url: "",
  tiers: [
    { name: "General", desc: "Live access + recording", price: 799, qty: 100 },
    { name: "VIP · Q&A", desc: "+ 30-min live Q&A & project files", price: 1499, qty: 30 },
  ],
  currency: "INR",
  theme: "light",
};

/** Format a date + time string for display */
export function formatEventDate(date?: string, time?: string, tz?: string): string {
  if (!date) return "";
  try {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!time) return dateStr;
    const tzLabel = tz === "Asia/Kolkata" ? "IST" : tz ?? "";
    return `${dateStr} · ${time}${tzLabel ? " " + tzLabel : ""}`;
  } catch {
    return date;
  }
}

/** Generate a unique, human-readable ticket code */
export function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function seg(n: number) {
    let out = "";
    const arr = typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(n))
      : Array.from({ length: n }, () => Math.floor(Math.random() * 256));
    for (let i = 0; i < n; i++) out += chars[(arr as unknown as number[])[i] % chars.length];
    return out;
  }
  return `INVX-${seg(4)}-${seg(4)}`;
}
