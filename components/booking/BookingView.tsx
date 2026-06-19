"use client";

/**
 * BookingView — public-facing booking page component.
 *
 * Renders the host card, interactive month calendar, time-slot grid,
 * buyer name + email fields, and the Book button. Implements the full
 * design spec from /lcdesign/Booking Public.dc.html.
 *
 * All state is client-side. The slot availability is computed from the
 * BookingContent config (availability windows) minus already-booked slots
 * fetched from GET /api/booking?page_id=…&year=…&month=….
 */

import { useState, useEffect, useCallback } from "react";
import type { BookingContent, DaySlot } from "@/lib/booking";

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fmtPrice(paise: number, currency = "INR"): string {
  if (currency === "INR") return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
  return (paise / 100).toLocaleString("en-US", { style: "currency", currency });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local date "YYYY-MM-DD" string for a Date in the booking timezone. */
function toLocalDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "HH:MM" in timezone. */
function toLocalTime(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Convert a local "YYYY-MM-DDTHH:MM:00" string in `tz` to a UTC Date.
 * Uses the Intl round-trip offset approach for DST correctness.
 */
function localIsoToUtc(localIso: string, tz: string): Date {
  const roughUtc = new Date(localIso + "Z");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(roughUtc);
  const p = Object.fromEntries(parts.map((pt) => [pt.type, pt.value]));
  const tzLocal = `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
  const offset = new Date(localIso).getTime() - new Date(tzLocal).getTime();
  return new Date(roughUtc.getTime() + offset);
}

/** Generate slot UTC dates for a local date string from weekly availability. */
function generateSlots(localDate: string, slots: DaySlot[], duration: number, buffer: number, tz: string): Date[] {
  const refDate = new Date(`${localDate}T12:00:00`);
  const dowStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(refDate);
  const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = DOW[dowStr] ?? -1;
  const daySlots = slots.filter((s) => s.day === dow);
  if (!daySlots.length) return [];

  const result: Date[] = [];
  const step = duration + buffer;
  for (const ds of daySlots) {
    const [sh, sm] = ds.start.split(":").map(Number);
    const [eh, em] = ds.end.split(":").map(Number);
    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (cur + duration <= endMin) {
      const hh = pad(Math.floor(cur / 60)), mm = pad(cur % 60);
      const utc = localIsoToUtc(`${localDate}T${hh}:${mm}:00`, tz);
      if (!isNaN(utc.getTime())) result.push(utc);
      cur += step;
    }
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}

// ── Booked-slots fetcher ──────────────────────────────────────────────────────

type SlotRange = { slot_start: string; slot_end: string };

async function fetchBookedSlots(pageId: string, year: number, month: number): Promise<SlotRange[]> {
  try {
    const res = await fetch(`/api/booking?page_id=${encodeURIComponent(pageId)}&year=${year}&month=${month}`);
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j.bookings) ? j.bookings : [];
  } catch {
    return [];
  }
}

// ── Month navigation helpers ──────────────────────────────────────────────────

function getMonthDays(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDow(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── BookingView ──────────────────────────────────────────────────────────────

export default function BookingView({
  content,
  pageId,
  publicUrl,
  storeName,
}: {
  content: BookingContent;
  pageId: string;
  publicUrl?: string;
  storeName?: string;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // "YYYY-MM-DD"
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(content.theme ?? "light");
  const [bookedSlots, setBookedSlots] = useState<SlotRange[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const duration = content.duration ?? 60;
  const buffer = content.buffer ?? 0;
  const tz = content.timezone ?? "Asia/Kolkata";
  const slots = content.slots ?? [];
  const price = content.price ?? 0;
  const isFree = content.is_free === true || price <= 0;
  const currency = content.currency ?? "INR";

  // Fetch booked slots whenever the viewed month changes.
  useEffect(() => {
    setLoadingSlots(true);
    fetchBookedSlots(pageId, viewYear, viewMonth).then((bs) => {
      setBookedSlots(bs);
      setLoadingSlots(false);
    });
  }, [pageId, viewYear, viewMonth]);

  // Determine which days in this month have available slots.
  const daysInMonth = getMonthDays(viewYear, viewMonth);
  const firstDow = getFirstDow(viewYear, viewMonth);
  const todayStr = toLocalDate(now, tz);

  const availableDays = new Set<number>();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(d)}`;
    if (dateStr < todayStr) continue;
    const candidates = generateSlots(dateStr, slots, duration, buffer, tz);
    if (candidates.length > 0) availableDays.add(d);
  }

  // Slots for the selected date, filtered against booked.
  const slotsForDay = selectedDate
    ? generateSlots(selectedDate, slots, duration, buffer, tz).filter((slot) => {
        if (slot < now) return false;
        const slotEnd = new Date(slot.getTime() + duration * 60_000);
        return !bookedSlots.some((b) => {
          const bs = new Date(b.slot_start);
          const be = new Date(b.slot_end);
          return bs < slotEnd && be > slot;
        });
      })
    : [];

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null); setSelectedSlot(null);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null); setSelectedSlot(null);
  };

  const canPrevMonth = !(viewYear === now.getFullYear() && viewMonth <= now.getMonth() + 1);

  const book = useCallback(async () => {
    if (booking || !selectedSlot || !buyerName.trim() || !EMAIL_RE.test(buyerEmail)) return;
    setError(null);
    setBooking(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          slot_start: selectedSlot.toISOString(),
          buyer_name: buyerName.trim(),
          buyer_email: buyerEmail.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Something went wrong. Please try again.");
        setBooking(false);
        return;
      }
      if (j.needs_payment && j.page_id) {
        // Paid booking: create an order (price read from DB server-side — never
        // trusted from client) and redirect to the standard checkout URL.
        // The booking row is already in "pending" status; /api/checkout/verify
        // will flip it to "confirmed" after successful payment.
        // Pass buyer_email so the order row stores it — verify uses it to match
        // the exact pending booking row (avoids ambiguity across concurrent bookings).
        const orderRes = await fetch("/api/checkout/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: j.page_id, buyer_email: buyerEmail.trim(), buyer_name: buyerName.trim() }),
        });
        const orderJ = await orderRes.json();
        if (!orderRes.ok) {
          setError(orderJ.error ?? "Payment initialization failed.");
          setBooking(false);
          return;
        }
        // /book/checkout/{orderId} is dispatched by the sites router to <CheckoutForm>.
        window.location.href = `/book/checkout/${orderJ.order_id}`;
        return;
      }
      const slotLabel = selectedDate
        ? `${selectedDate} at ${toLocalTime(selectedSlot, tz)}`
        : toLocalTime(selectedSlot, tz);
      setDoneMsg(slotLabel);
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setBooking(false);
  }, [booking, selectedSlot, buyerName, buyerEmail, pageId, publicUrl, selectedDate, tz, duration]);

  const bookDisabled = !selectedSlot || !buyerName.trim() || !EMAIL_RE.test(buyerEmail) || booking;
  const accentColor = content.accent_color ?? "#ff6a3d";

  const selLabel = selectedSlot
    ? `${isFree ? "Free session" : fmtPrice(price, currency)} · ${toLocalTime(selectedSlot, tz)} · ${selectedDate}`
    : `${isFree ? "Free" : fmtPrice(price, currency)} · ${duration} min session`;

  const bookLabel = selectedSlot && buyerName && EMAIL_RE.test(buyerEmail)
    ? (isFree ? "Book session" : `Book · ${fmtPrice(price, currency)}`)
    : "Pick a date, time & fill details";

  return (
    <div className="bk" data-theme={theme} style={{ "--accent-override": accentColor } as React.CSSProperties}>
      {/* Animated background blob */}
      <div className="bk-bg"><div className="bk-blob"></div></div>
      {/* Theme toggle */}
      <button className="bk-tgl" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} aria-label="Toggle theme">
        {theme === "dark" ? "☀" : "☾"}
      </button>

      <div className="bk-wrap">
        {done ? (
          <div className="bk-card">
            <div className="bk-done">
              <div className="bk-check">✓</div>
              <h2>Session booked!</h2>
              <p>A confirmation is on the way to {buyerEmail}.</p>
              <div className="bk-when">{doneMsg}</div>
              <div className="bk-pixel">
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block" }}></span>
                Booking confirmed
              </div>
            </div>
          </div>
        ) : (
          <div className="bk-card">
            <div className="bk-grid">
              {/* ── Sidebar ── */}
              <aside className="bk-side">
                <div className="bk-host">
                  {content.host_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={content.host_avatar} alt={content.host_name ?? "Host"} className="av" style={{ objectFit: "cover" }} />
                  ) : (
                    <span className="av">
                      {(content.host_name ?? storeName ?? "H")[0].toUpperCase()}
                    </span>
                  )}
                  <div>
                    <b>{content.host_name ?? storeName ?? "Host"}</b>
                    {storeName && content.host_name && storeName !== content.host_name && (
                      <p>{storeName}</p>
                    )}
                  </div>
                </div>
                <h1>{content.title ?? "Book a session"}</h1>
                {content.description && <p className="sub">{content.description}</p>}
                <div className="bk-facts">
                  <div className="bk-fact"><span className="e">⏱</span>{duration} minutes</div>
                  {content.meeting_type && (
                    <div className="bk-fact">
                      <span className="e">
                        {content.meeting_type.toLowerCase().includes("meet") ? "🎥"
                          : content.meeting_type.toLowerCase().includes("zoom") ? "🎥"
                          : content.meeting_type.toLowerCase().includes("phone") ? "📞" : "📍"}
                      </span>
                      {content.meeting_detail ?? content.meeting_type}
                    </div>
                  )}
                  <div className="bk-fact"><span className="e">🌐</span>{tz.replace("_", " ")}</div>
                </div>
                <div className="bk-price">
                  {isFree ? <span style={{ color: "var(--green)" }}>Free</span> : (
                    <>{fmtPrice(price, currency)} <small>/ session</small></>
                  )}
                </div>
                {content.host_bio && (
                  <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14, lineHeight: 1.6 }}>
                    {content.host_bio}
                  </p>
                )}
              </aside>

              {/* ── Main calendar + booking form ── */}
              <div className="bk-main">
                <h3 className="bk-ct">Pick a date</h3>
                <div className="bk-calhead">
                  <span className="m">{MONTH_NAMES[viewMonth - 1]} {viewYear}</span>
                  <button onClick={prevMonth} disabled={!canPrevMonth} aria-label="Previous month">‹</button>
                  <button onClick={nextMonth} aria-label="Next month">›</button>
                </div>
                <div className="bk-dow">
                  {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="bk-days">
                  {Array.from({ length: firstDow }, (_, i) => <span key={`b${i}`}></span>)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(day)}`;
                    const isPast = dateStr < todayStr;
                    const hasSlots = availableDays.has(day);
                    const isSelected = dateStr === selectedDate;
                    const disabled = isPast || !hasSlots || loadingSlots;
                    return (
                      <button
                        key={day}
                        className={`bk-day${isSelected ? " on" : ""}${hasSlots && !isPast ? " has" : ""}`}
                        disabled={disabled}
                        onClick={() => {
                          setSelectedDate(dateStr);
                          setSelectedSlot(null);
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <h3 className="bk-ct" style={{ marginTop: 18 }}>Pick a time</h3>
                {selectedDate ? (
                  slotsForDay.length === 0 ? (
                    <div className="bk-empty">No available slots on this day.</div>
                  ) : (
                    <div className="bk-slots">
                      {slotsForDay.map((slot) => {
                        const isOn = selectedSlot?.getTime() === slot.getTime();
                        return (
                          <div
                            key={slot.toISOString()}
                            className={`bk-slot${isOn ? " on" : ""}`}
                            onClick={() => setSelectedSlot(slot)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && setSelectedSlot(slot)}
                          >
                            {toLocalTime(slot, tz)}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="bk-empty">Select a date to see available times.</div>
                )}

                <label className="bk-label" htmlFor="bk-name">Your name</label>
                <input
                  id="bk-name"
                  className="bk-input"
                  type="text"
                  placeholder="Your full name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  autoComplete="name"
                />

                <label className="bk-label" htmlFor="bk-email">Your email</label>
                <input
                  id="bk-email"
                  className="bk-input"
                  type="email"
                  placeholder="you@email.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  autoComplete="email"
                />

                {error && (
                  <div style={{ marginTop: 10, padding: "10px 13px", background: "color-mix(in srgb, var(--red, #e5476f) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--red, #e5476f) 30%, transparent)", borderRadius: 10, fontSize: 13, color: "var(--red, #e5476f)" }}>
                    {error}
                  </div>
                )}

                <button
                  className="bk-go"
                  onClick={book}
                  disabled={bookDisabled}
                >
                  {booking ? (
                    <><span className="bk-spin"></span>Booking…</>
                  ) : bookLabel}
                </button>
                <div className="bk-sel">{selLabel}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
