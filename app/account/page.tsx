/**
 * Buyer Corner — /account
 * Phase 5, Wave 3: order history, claim guest orders, entry to order detail.
 *
 * Auth:    uses lib/supabase/server.ts (session-bound RLS client).
 * Claiming: calls claimOrdersForUser server-side BEFORE getBuyerOrders so that
 *           any guest orders matched by verified email show up immediately.
 * Data:    getBuyerOrders (lib/buyer.ts) — RLS-enforced, paid orders only.
 */

import { createClient } from "@/lib/supabase/server";
import { claimOrdersForUser } from "@/lib/claim";
import { getBuyerOrders, type BuyerOrder } from "@/lib/buyer";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Orders" };

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
    month: "short",
    year: "numeric",
  });
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

function pageTypeLabel(pt: string): string {
  return PAGE_TYPE_LABEL[pt] ?? pt;
}

// ── Status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BuyerOrder["status"] }) {
  if (status === "paid") {
    return (
      <span className="badge-pill t-paid">Paid</span>
    );
  }
  if (status === "failed") {
    return (
      <span className="badge-pill t-pend">Failed</span>
    );
  }
  return (
    <span className="badge-pill t-neu">Pending</span>
  );
}

// ── Not-logged-in CTA ──────────────────────────────────────────────────────

function SignInCta() {
  return (
    <div className="ac-outer">
      <div className="ac-center">
        <div className="ac-hero-icon">🛍️</div>
        <h1 className="ac-h1">Your orders, all in one place</h1>
        <p className="ac-sub">
          Sign in to view your event tickets, course enrollments, VIP memberships,
          bookings and digital downloads.
        </p>
        <Link href="/login" className="btn btn-gradient btn-lg">
          Sign in to continue
        </Link>
        <p className="ac-guest-note">
          Bought as a guest? Sign in with the same email you used at checkout —
          your orders will be linked automatically. Your email receipt is your record
          in the meantime.
        </p>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyOrders() {
  return (
    <div className="ac-empty">
      <div style={{ fontSize: 42, marginBottom: 14 }}>🧾</div>
      <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>No orders yet</h2>
      <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 14 }}>
        Your paid orders will appear here. Browse a store or event to get started.
      </p>
    </div>
  );
}

// ── Order row ──────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: BuyerOrder }) {
  const title = order.product_title || order.page_title || "Order";
  const store = order.store_name || "Store";
  const date = formatDate(order.paid_at ?? order.created_at);
  const amountStr = formatAmount(order.amount, order.currency);
  const ptLabel = pageTypeLabel(order.page_type);

  return (
    <Link href={`/account/orders/${order.id}`} className="ac-order-row">
      <div className="ac-order-main">
        <div className="ac-order-title">{title}</div>
        <div className="ac-order-meta">
          <span>{store}</span>
          <span className="ac-dot" />
          <span>{date}</span>
        </div>
      </div>
      <div className="ac-order-right">
        <div className="ac-order-amount">{amountStr}</div>
        <div className="ac-order-badges">
          <StatusBadge status={order.status} />
          <span className="cat-pill">{ptLabel}</span>
        </div>
      </div>
      <div className="ac-order-chevron">›</div>
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function AccountPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    return (
      <>
        <style>{ACCOUNT_CSS}</style>
        <SignInCta />
      </>
    );
  }

  // Claim any guest orders BEFORE fetching so they show immediately.
  // claimOrdersForUser is idempotent — safe to run on every page load.
  const emailConfirmed = !!user.email_confirmed_at;
  if (user.email && emailConfirmed) {
    await claimOrdersForUser(user.id, user.email, true).catch(() => {
      // Non-fatal: if claiming fails (e.g. admin client issue), still show orders.
    });
  }

  const orders = await getBuyerOrders();
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Buyer";

  return (
    <>
      <style>{ACCOUNT_CSS}</style>
      <div className="ac-outer">
        <div className="ac-page">
          {/* Header */}
          <div className="ac-header">
            <div>
              <h1 className="ac-h1">My Orders</h1>
              <p className="ac-sub-sm">Welcome back, {displayName}</p>
            </div>
          </div>

          {/* Order list */}
          {orders.length === 0 ? (
            <EmptyOrders />
          ) : (
            <div className="ac-orders-card">
              <div className="ac-orders-head">
                <span>{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="ac-orders-list">
                {orders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Scoped CSS ─────────────────────────────────────────────────────────────

const ACCOUNT_CSS = `
  .ac-outer {
    min-height: 100dvh;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-body);
    padding: 32px 20px 80px;
  }
  .ac-center {
    max-width: 480px;
    margin: 0 auto;
    text-align: center;
    padding-top: 60px;
  }
  .ac-hero-icon {
    font-size: 52px;
    margin-bottom: 20px;
  }
  .ac-page {
    max-width: 720px;
    margin: 0 auto;
  }
  .ac-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 28px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .ac-h1 {
    font-family: var(--font-heading);
    font-size: clamp(24px, 4vw, 32px);
    font-weight: 800;
    margin: 0 0 6px;
  }
  .ac-sub {
    color: var(--color-muted);
    font-size: 16px;
    margin: 0 0 28px;
    line-height: 1.5;
    max-width: 38ch;
    margin-left: auto;
    margin-right: auto;
  }
  .ac-sub-sm {
    color: var(--color-muted);
    font-size: 14px;
    margin: 0;
  }
  .ac-guest-note {
    margin-top: 20px;
    font-size: 12.5px;
    color: var(--color-muted);
    line-height: 1.55;
    max-width: 34ch;
    margin-left: auto;
    margin-right: auto;
  }
  .ac-orders-card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .ac-orders-head {
    padding: 14px 20px;
    border-bottom: 1px solid var(--color-border);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-muted);
  }
  .ac-orders-list {
    display: flex;
    flex-direction: column;
  }
  .ac-order-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
    text-decoration: none;
    color: inherit;
    transition: background 0.12s;
  }
  .ac-order-row:last-child {
    border-bottom: 0;
  }
  .ac-order-row:hover {
    background: var(--color-surface2);
  }
  .ac-order-main {
    flex: 1;
    min-width: 0;
  }
  .ac-order-title {
    font-weight: 600;
    font-size: 14.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ac-order-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--color-muted);
    margin-top: 3px;
  }
  .ac-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--color-border);
    flex-shrink: 0;
  }
  .ac-order-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 5px;
    flex-shrink: 0;
  }
  .ac-order-amount {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 15px;
  }
  .ac-order-badges {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .ac-order-chevron {
    color: var(--color-muted);
    font-size: 20px;
    flex-shrink: 0;
    margin-left: 2px;
  }
  .ac-empty {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 52px 28px;
    text-align: center;
    box-shadow: var(--shadow);
  }

  /* Mobile: tighten padding + stack order row */
  @media (max-width: 540px) {
    .ac-outer { padding: 20px 12px 60px; }
    .ac-order-row { flex-wrap: wrap; }
    .ac-order-right { flex-direction: row; align-items: center; gap: 8px; }
    .ac-order-chevron { display: none; }
  }

  /* Print: hide nav decoration */
  @media print {
    .ac-outer { padding: 0; }
  }
`;
