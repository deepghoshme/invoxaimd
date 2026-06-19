/**
 * Buyer order detail — /account/orders/[id]
 * Phase 5, Wave 3.
 *
 * - Loads getBuyerOrder (RLS: returns null if not this buyer's order).
 * - Renders an order summary card.
 * - Dispatches to DeliverablePanel by order.page_type.
 * - Printable receipt via "Print receipt" button (window.print()).
 */

import { createClient } from "@/lib/supabase/server";
import {
  getBuyerOrder,
  getBuyerEventTicket,
  getBuyerVipMembership,
  getBuyerCourseEnrollment,
  getBuyerBooking,
  getBuyerDownload,
  type BuyerOrder,
  type BuyerEventTicket,
  type BuyerVipMembership,
  type BuyerCourseEnrollment,
  type BuyerBooking,
  type BuyerDownload,
} from "@/lib/buyer";
import Link from "next/link";
import QRCode from "react-qr-code";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Order ${id.slice(-6).toUpperCase()}` };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatAmount(amount: number, currency: string): string {
  const code = (currency || "INR").toUpperCase();
  const major = amount / 100;
  if (code === "INR") {
    return "₹" + major.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return major.toLocaleString("en-US", { style: "currency", currency: code });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string): string {
  return id.slice(-8).toUpperCase();
}

const PAGE_TYPE_LABEL: Record<string, string> = {
  event: "Event",
  vip: "VIP Community",
  course: "Course",
  booking: "Booking",
  opp: "Digital Product",
  pay: "Pay Link",
  store: "Store",
  website: "Website",
  bio: "Bio Page",
};

// ── Deliverable panels ─────────────────────────────────────────────────────

/** Event: render compact ticket card(s) with real QR + link to full ticket view. */
function EventPanel({ tickets }: { tickets: BuyerEventTicket[] }) {
  if (tickets.length === 0) {
    return <PendingNote note="Your event ticket is being processed. Check back shortly or contact the organiser." />;
  }
  return (
    <div className="od-section">
      <h3 className="od-section-title">Your Ticket{tickets.length > 1 ? "s" : ""}</h3>
      {tickets.map((t) => (
        <div key={t.id} className="od-ticket-card">
          <div className="od-ticket-qr">
            <div className="od-qr-wrap">
              <QRCode value={t.ticket_url} size={96} level="M" bgColor="#ffffff" fgColor="#111111" />
            </div>
          </div>
          <div className="od-ticket-body">
            <div className="od-ticket-tier">{t.tier_name}</div>
            <div className="od-ticket-code">{t.code}</div>
            <div className="od-ticket-meta">
              <span>{t.buyer_name || "Guest"}</span>
              {t.qty > 1 && <span> · {t.qty} admits</span>}
            </div>
            {t.status === "used" ? (
              <span className="badge-pill t-pend">Used</span>
            ) : t.status === "cancelled" ? (
              <span className="badge-pill t-pend">Cancelled</span>
            ) : (
              <span className="badge-pill t-paid">Confirmed</span>
            )}
            <div style={{ marginTop: 10 }}>
              <a
                href={t.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-gradient btn-sm"
              >
                View full ticket ↗
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** VIP: show membership status + invite link if available. */
function VipPanel({ membership }: { membership: BuyerVipMembership | null }) {
  if (!membership) {
    return <PendingNote note="Your VIP membership is being set up. Check back shortly or contact the seller." />;
  }
  const planLabel = membership.plan === "monthly" ? "Monthly" : membership.plan === "yearly" ? "Yearly" : "Lifetime";
  const statusOk = membership.status === "active";

  return (
    <div className="od-section">
      <h3 className="od-section-title">VIP Membership</h3>
      <div className="od-vip-card">
        <div className="od-vip-icon">⭐</div>
        <div>
          <div className="od-vip-plan">{planLabel} member</div>
          <div className="od-vip-meta">
            {statusOk ? (
              <span className="badge-pill t-paid">Active</span>
            ) : (
              <span className="badge-pill t-pend">Expired</span>
            )}
            {membership.expires_at && (
              <span style={{ fontSize: 12, color: "var(--color-muted)", marginLeft: 8 }}>
                Expires {new Date(membership.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          {membership.invite_link ? (
            <div className="od-vip-invite">
              <span className="od-vip-link">{membership.invite_link}</span>
              <a
                href={membership.invite_link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-gradient btn-sm"
              >
                Join community ↗
              </a>
            </div>
          ) : (
            <p className="od-pending-text">
              Invite link not set yet — please contact the seller to get your access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Course: confirm enrollment + link to the course page. */
function CoursePanel({
  enrollment,
  order,
}: {
  enrollment: BuyerCourseEnrollment | null;
  order: BuyerOrder;
}) {
  if (!enrollment) {
    return <PendingNote note="Your course enrollment is being confirmed. Check back shortly or contact the seller." />;
  }
  const courseUrl = order.store_subdomain
    ? `https://${order.store_subdomain}.invoxai.io/p/${order.page_id}`
    : `https://invoxai.io/p/${order.page_id}`;

  return (
    <div className="od-section">
      <h3 className="od-section-title">Course Access</h3>
      <div className="od-generic-card">
        <div style={{ fontSize: 36, marginBottom: 14 }}>🎓</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
          {"You're enrolled"}
        </div>
        <p className="od-pending-text">
          Your enrollment is confirmed. Visit the course page to start learning.
        </p>
        <div style={{ marginTop: 14 }}>
          <a
            href={courseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-gradient btn-sm"
          >
            Go to course ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/** Booking: show slot, status, and notes. */
function BookingPanel({ booking }: { booking: BuyerBooking | null }) {
  if (!booking) {
    return <PendingNote note="Your booking is being confirmed. Check back shortly or contact the seller." />;
  }
  const start = new Date(booking.slot_start);
  const end = new Date(booking.slot_end);
  const dateStr = start.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    + " – " + end.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="od-section">
      <h3 className="od-section-title">Booking Confirmation</h3>
      <div className="od-booking-card">
        <div className="od-booking-icon">📅</div>
        <div>
          <div className="od-booking-date">{dateStr}</div>
          <div className="od-booking-time">{timeStr}</div>
          <div style={{ marginTop: 8 }}>
            {booking.status === "confirmed" ? (
              <span className="badge-pill t-paid">Confirmed</span>
            ) : booking.status === "cancelled" ? (
              <span className="badge-pill t-pend">Cancelled</span>
            ) : (
              <span className="badge-pill t-neu">Pending</span>
            )}
          </div>
          {booking.status === "cancelled" && (
            <p className="od-pending-text" style={{ marginTop: 8 }}>
              This booking has been cancelled. Please contact the seller to reschedule.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** OPP / Pay: digital download or link to seller page. */
function DownloadPanel({ dl }: { dl: BuyerDownload | null }) {
  if (!dl) {
    return <PendingNote note="Your download is being prepared. Check back shortly or contact the seller." />;
  }

  const hasDirectUrl = dl.url && dl.url !== dl.page_url;

  return (
    <div className="od-section">
      <h3 className="od-section-title">Your Download</h3>
      <div className="od-generic-card">
        <div style={{ fontSize: 36, marginBottom: 14 }}>⬇️</div>
        {hasDirectUrl ? (
          <>
            <p className="od-pending-text">
              {dl.kind === "file" ? "Your file is ready to download." : "Your access link is ready."}
            </p>
            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href={dl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-gradient btn-sm"
              >
                {dl.kind === "file" ? "Download file ↓" : "Access link ↗"}
              </a>
              {dl.page_url && dl.page_url !== dl.url && (
                <a
                  href={dl.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  View product page
                </a>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="od-pending-text">
              This product may require manual delivery. Visit the seller&apos;s page to access your purchase
              or contact the seller directly.
            </p>
            <div style={{ marginTop: 14 }}>
              <a
                href={dl.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                View product page ↗
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Default: link to the store/product page. */
function DefaultPanel({ order }: { order: BuyerOrder }) {
  const url = order.store_subdomain
    ? `https://${order.store_subdomain}.invoxai.io/p/${order.page_id}`
    : `https://invoxai.io/p/${order.page_id}`;
  return (
    <div className="od-section">
      <h3 className="od-section-title">Your Purchase</h3>
      <div className="od-generic-card">
        <p className="od-pending-text">
          Your order is confirmed. Visit the seller&apos;s page for details about your purchase.
        </p>
        <div style={{ marginTop: 14 }}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            View product page ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/** Graceful pending note for any deliverable with no data yet. */
function PendingNote({ note }: { note: string }) {
  return (
    <div className="od-section">
      <div className="od-pending-card">
        <div className="od-pending-icon">⏳</div>
        <p>{note}</p>
      </div>
    </div>
  );
}

// ── DeliverablePanel dispatcher ────────────────────────────────────────────

async function DeliverablePanel({ order }: { order: BuyerOrder }) {
  const pt = order.page_type;

  if (pt === "event") {
    const tickets = await getBuyerEventTicket(order);
    return <EventPanel tickets={tickets} />;
  }

  if (pt === "vip") {
    const membership = await getBuyerVipMembership(order);
    return <VipPanel membership={membership} />;
  }

  if (pt === "course") {
    const enrollment = await getBuyerCourseEnrollment(order);
    return <CoursePanel enrollment={enrollment} order={order} />;
  }

  if (pt === "booking") {
    const booking = await getBuyerBooking(order);
    return <BookingPanel booking={booking} />;
  }

  if (pt === "opp" || pt === "pay") {
    const dl = await getBuyerDownload(order);
    return <DownloadPanel dl={dl} />;
  }

  // store / website / bio / unknown: link to the product page
  return <DefaultPanel order={order} />;
}

// ── Receipt printable section ──────────────────────────────────────────────

function ReceiptSection({ order }: { order: BuyerOrder }) {
  const title = order.product_title || order.page_title || "Order";
  const date = formatDate(order.paid_at ?? order.created_at);

  return (
    <div className="od-receipt" id="printable-receipt">
      <div className="od-receipt-header">
        <div className="od-receipt-brand">invoxai</div>
        <div className="od-receipt-title">Payment Receipt</div>
      </div>
      <div className="od-receipt-row">
        <span className="od-receipt-label">Store</span>
        <span className="od-receipt-value">{order.store_name || "—"}</span>
      </div>
      <div className="od-receipt-row">
        <span className="od-receipt-label">Product</span>
        <span className="od-receipt-value">{title}</span>
      </div>
      <div className="od-receipt-row">
        <span className="od-receipt-label">Buyer name</span>
        <span className="od-receipt-value">{order.buyer_name || "—"}</span>
      </div>
      <div className="od-receipt-row">
        <span className="od-receipt-label">Buyer email</span>
        <span className="od-receipt-value">{order.buyer_email || "—"}</span>
      </div>
      <div className="od-receipt-row">
        <span className="od-receipt-label">Amount</span>
        <span className="od-receipt-value od-receipt-amount">
          {formatAmount(order.amount, order.currency)} {order.currency.toUpperCase()}
        </span>
      </div>
      <div className="od-receipt-row">
        <span className="od-receipt-label">Date</span>
        <span className="od-receipt-value">{date}</span>
      </div>
      <div className="od-receipt-row">
        <span className="od-receipt-label">Order ID</span>
        <span className="od-receipt-value od-receipt-mono">{order.id}</span>
      </div>
      <div className="od-receipt-footer">
        Issued by invoxai.io · {date}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Auth gate
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    return (
      <>
        <style>{ORDER_CSS}</style>
        <div className="od-outer">
          <div className="od-not-found">
            <h2>Sign in required</h2>
            <p>Please <Link href="/login">sign in</Link> to view your order.</p>
          </div>
        </div>
      </>
    );
  }

  // Load order (RLS: returns null if not owned by this buyer)
  const order = await getBuyerOrder(id);

  if (!order) {
    return (
      <>
        <style>{ORDER_CSS}</style>
        <div className="od-outer">
          <div className="od-not-found">
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔒</div>
            <h2>Order not found</h2>
            <p>This order doesn&apos;t exist or doesn&apos;t belong to your account.</p>
            <Link href="/account" className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>
              ← Back to My Orders
            </Link>
          </div>
        </div>
      </>
    );
  }

  const title = order.product_title || order.page_title || "Order";
  const ptLabel = PAGE_TYPE_LABEL[order.page_type] ?? order.page_type;

  return (
    <>
      <style>{ORDER_CSS}</style>
      <div className="od-outer">
        <div className="od-page">
          {/* Breadcrumb */}
          <div className="od-breadcrumb">
            <Link href="/account" className="od-back">← My Orders</Link>
          </div>

          {/* Order summary card */}
          <div className="od-summary-card">
            <div className="od-summary-top">
              <div>
                <h1 className="od-h1">{title}</h1>
                <div className="od-summary-meta">
                  {order.store_name && <span>{order.store_name}</span>}
                  {order.store_name && <span className="ac-dot" />}
                  <span>{formatDate(order.paid_at ?? order.created_at)}</span>
                </div>
              </div>
              <div className="od-summary-amount">
                {formatAmount(order.amount, order.currency)}
              </div>
            </div>

            <div className="od-summary-pills">
              {order.status === "paid" ? (
                <span className="badge-pill t-paid">Paid</span>
              ) : order.status === "failed" ? (
                <span className="badge-pill t-pend">Failed</span>
              ) : (
                <span className="badge-pill t-neu">Pending</span>
              )}
              <span className="cat-pill">{ptLabel}</span>
            </div>

            <div className="od-summary-ids">
              <div className="od-id-row">
                <span className="od-id-label">Order ID</span>
                <span className="od-id-value od-mono">{order.id}</span>
              </div>
            </div>

            <div className="od-print-row no-print">
              <PrintButton />
            </div>
          </div>

          {/* Deliverable panel — dispatches by page_type */}
          <DeliverablePanel order={order} />

          {/* Printable receipt (hidden on screen, shown on print) */}
          <ReceiptSection order={order} />
        </div>
      </div>
    </>
  );
}

// ── Scoped CSS ─────────────────────────────────────────────────────────────

const ORDER_CSS = `
  .od-outer {
    min-height: 100dvh;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-body);
    padding: 28px 20px 80px;
  }
  .od-page {
    max-width: 720px;
    margin: 0 auto;
  }
  .od-breadcrumb {
    margin-bottom: 20px;
  }
  .od-back {
    color: var(--color-muted);
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
  }
  .od-back:hover { color: var(--color-text); }
  .od-h1 {
    font-family: var(--font-heading);
    font-size: clamp(20px, 3.5vw, 26px);
    font-weight: 800;
    margin: 0 0 6px;
  }
  .od-summary-card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: var(--shadow);
    margin-bottom: 20px;
  }
  .od-summary-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }
  .od-summary-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--color-muted);
    margin-top: 4px;
  }
  .ac-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--color-border);
    flex-shrink: 0;
  }
  .od-summary-amount {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 26px;
    flex-shrink: 0;
  }
  .od-summary-pills {
    display: flex;
    gap: 7px;
    align-items: center;
    margin-top: 14px;
  }
  .od-summary-ids {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .od-id-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .od-id-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-muted);
    min-width: 80px;
    flex-shrink: 0;
  }
  .od-id-value {
    font-size: 12.5px;
    color: var(--color-text);
    word-break: break-all;
  }
  .od-mono {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
  }
  .od-print-row {
    margin-top: 16px;
  }
  /* ── Sections ── */
  .od-section {
    margin-bottom: 18px;
  }
  .od-section-title {
    font-family: var(--font-heading);
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 12px;
  }
  /* ── Ticket card ── */
  .od-ticket-card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
    display: flex;
    gap: 18px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .od-ticket-qr { flex-shrink: 0; }
  .od-qr-wrap {
    background: #fff;
    border-radius: 10px;
    padding: 8px;
    width: 112px;
    height: 112px;
    display: grid;
    place-items: center;
  }
  .od-ticket-body { flex: 1; min-width: 0; }
  .od-ticket-tier {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 16px;
    margin-bottom: 4px;
  }
  .od-ticket-code {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
    color: var(--color-muted);
    margin-bottom: 6px;
  }
  .od-ticket-meta {
    font-size: 13px;
    color: var(--color-muted);
    margin-bottom: 10px;
  }
  /* ── VIP card ── */
  .od-vip-card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .od-vip-icon { font-size: 36px; flex-shrink: 0; }
  .od-vip-plan {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 16px;
    margin-bottom: 8px;
  }
  .od-vip-meta {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 6px;
  }
  .od-vip-invite {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--color-surface2);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 10px 12px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .od-vip-link {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: var(--color-accent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  /* ── Booking card ── */
  .od-booking-card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .od-booking-icon { font-size: 36px; flex-shrink: 0; }
  .od-booking-date {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 16px;
    margin-bottom: 4px;
  }
  .od-booking-time {
    font-size: 14px;
    color: var(--color-muted);
    margin-bottom: 8px;
  }
  /* ── Generic / course card ── */
  .od-generic-card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 24px;
    box-shadow: var(--shadow);
    text-align: center;
  }
  /* ── Pending card ── */
  .od-pending-card {
    background: var(--color-surface2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px 24px;
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .od-pending-icon { font-size: 24px; flex-shrink: 0; }
  .od-pending-card p {
    margin: 0;
    font-size: 14px;
    color: var(--color-muted);
    line-height: 1.5;
  }
  .od-pending-text {
    font-size: 13.5px;
    color: var(--color-muted);
    line-height: 1.5;
    margin: 0;
  }
  /* ── Not-found / error ── */
  .od-not-found {
    max-width: 440px;
    margin: 60px auto;
    text-align: center;
    padding: 40px 28px;
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .od-not-found h2 { margin: 0 0 10px; }
  .od-not-found p { color: var(--color-muted); font-size: 14px; }

  /* ── Printable receipt (screen: hidden; print: shown) ── */
  .od-receipt { display: none; }

  @media print {
    .no-print { display: none !important; }
    .od-outer { padding: 0; background: #fff; color: #000; }
    .od-summary-card, .od-section, .od-breadcrumb { display: none; }
    .od-receipt { display: block; }
  }

  /* ── Receipt layout ── */
  .od-receipt {
    max-width: 520px;
    margin: 0 auto;
    font-family: Georgia, serif;
    font-size: 13px;
    color: #000;
    padding: 32px;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  .od-receipt-header {
    text-align: center;
    border-bottom: 2px solid #000;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .od-receipt-brand {
    font-size: 22px;
    font-weight: 700;
    font-family: var(--font-heading), sans-serif;
    background: linear-gradient(135deg, #ff6a3d, #ff4d7d, #7b3fe4);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .od-receipt-title {
    font-size: 16px;
    font-weight: 600;
    margin-top: 6px;
    color: #333;
    font-family: sans-serif;
  }
  .od-receipt-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px solid #eee;
    gap: 16px;
  }
  .od-receipt-label {
    font-weight: 600;
    color: #555;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    min-width: 110px;
    flex-shrink: 0;
  }
  .od-receipt-value {
    text-align: right;
    word-break: break-all;
  }
  .od-receipt-amount {
    font-weight: 700;
    font-size: 15px;
  }
  .od-receipt-mono {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
  }
  .od-receipt-footer {
    margin-top: 20px;
    text-align: center;
    color: #888;
    font-size: 11px;
  }

  /* Mobile */
  @media (max-width: 540px) {
    .od-outer { padding: 16px 12px 60px; }
    .od-summary-top { flex-direction: column; }
    .od-ticket-card { flex-direction: column; }
    .od-summary-ids { gap: 6px; }
    .od-id-row { flex-direction: column; gap: 2px; }
  }
`;
