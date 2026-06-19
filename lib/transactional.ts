import "server-only";
import { getPlatformMailer } from "@/lib/email";
import { EMAIL_ROUTES } from "@/lib/emailRoutes";

// All senders are NON-FATAL: a mail hiccup must never block a payment response.
// Each is called from a verify route AFTER the payment is confirmed, and those
// routes early-return on already-processed payments, so a mail fires once.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(paise: number, currency = "INR"): string {
  const major = Math.round(paise) / 100;
  const n = major.toLocaleString("en-IN", { minimumFractionDigits: major % 1 ? 2 : 0 });
  return (currency || "INR").toUpperCase() === "INR" ? `₹${n}` : `${currency} ${n}`;
}

function shell(heading: string, inner: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1c1320">
    <div style="height:6px;border-radius:99px;background:linear-gradient(135deg,#ffb23e,#ff6a3d 40%,#ff4d7d 72%,#7b3fe4);margin-bottom:18px"></div>
    <h2 style="margin:0 0 10px;font-size:19px">${esc(heading)}</h2>
    ${inner}
    <p style="color:#8a8088;font-size:12px;margin-top:22px;border-top:1px solid #eee;padding-top:12px">invoxai · this is an automated message.</p>
  </div>`;
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:4px 0;color:#7a6770">${esc(label)}</td><td style="padding:4px 0;text-align:right;font-weight:600">${value}</td></tr>`;

/** Buyer order receipt (from hello@, record copy to admin@). */
export async function sendOrderReceipt(o: {
  to: string | null;
  buyerName: string | null;
  productTitle: string | null;
  amountPaise: number;
  currency: string;
  orderId: string;
}): Promise<void> {
  if (!o.to) return;
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.order_receipt;
  const inner = `<p>Hi ${esc(o.buyerName || "there")}, your payment is confirmed. 🎉</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
      ${row("Item", esc(o.productTitle || "Your purchase"))}
      ${row("Amount paid", money(o.amountPaise, o.currency))}
      ${row("Order ref", esc(o.orderId.slice(-8).toUpperCase()))}
    </table>
    <p style="margin-top:14px">Access / details will follow by email. Thank you!</p>`;
  try {
    await m.mailer.send({ from: r.from, cc: r.cc, to: o.to, subject: `Your order is confirmed ✓ — ${o.productTitle || "Purchase"}`, html: shell("Payment successful", inner) });
  } catch { /* non-fatal */ }
}

/** Seller wallet-recharge receipt (from wallet@, copy to admin@). */
export async function sendWalletReceipt(o: {
  to: string | null;
  creditedPaise: number;
  balancePaise: number;
  currency?: string;
}): Promise<void> {
  if (!o.to) return;
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.wallet_txn;
  const cur = o.currency || "INR";
  const inner = `<p>Your wallet has been topped up.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
      ${row("Credited", money(o.creditedPaise, cur))}
      ${row("New balance", money(o.balancePaise, cur))}
    </table>`;
  try {
    await m.mailer.send({ from: r.from, cc: r.cc, to: o.to, subject: `Wallet recharged — ${money(o.creditedPaise, cur)} added`, html: shell("Wallet recharged", inner) });
  } catch { /* non-fatal */ }
}

/** Seller plan-subscription receipt (from billing@, copy to admin@). */
export async function sendPlanReceipt(o: {
  to: string | null;
  planName: string;
  amountPaise: number;
  currency?: string;
  periodEnd?: string;
}): Promise<void> {
  if (!o.to) return;
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.plan_billing;
  const cur = o.currency || "INR";
  const inner = `<p>Your <b>${esc(o.planName)}</b> plan is now active. 🚀</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
      ${row("Plan", esc(o.planName))}
      ${row("Amount", money(o.amountPaise, cur))}
      ${o.periodEnd ? row("Renews", esc(o.periodEnd)) : ""}
    </table>`;
  try {
    await m.mailer.send({ from: r.from, cc: r.cc, to: o.to, subject: `Invoice — ${o.planName} plan`, html: shell("Plan activated", inner) });
  } catch { /* non-fatal */ }
}
