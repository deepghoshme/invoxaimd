import "server-only";
import { getPlatformMailer } from "@/lib/email";
import { EMAIL_ROUTES } from "@/lib/emailRoutes";
import type { InvoiceRow } from "@/lib/invoice";

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
  /** Seller's reply_to_email, if set. Used as Reply-To so buyer replies reach
   *  the seller. From remains the platform invoxai alias for deliverability. */
  sellerReplyTo?: string | null;
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
    await m.mailer.send({
      from: r.from,
      cc: r.cc,
      to: o.to,
      subject: `Your order is confirmed ✓ — ${o.productTitle || "Purchase"}`,
      html: shell("Payment successful", inner),
      // Reply-To: seller's address so buyer replies land with the seller.
      // From stays the platform alias — never the seller's address.
      ...(o.sellerReplyTo ? { replyTo: o.sellerReplyTo } : {}),
    });
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

/** Welcome email to a newly onboarded seller (from info@, copy to admin@). */
export async function sendWelcomeEmail(o: {
  to: string;
  name: string;
  storeName: string;
}): Promise<void> {
  if (!o.to) return;
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.welcome;
  const inner = `<p>Hi ${esc(o.name || "there")}, welcome to invoxai! Your store is ready.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
      ${row("Store", esc(o.storeName))}
    </table>
    <p style="margin-top:14px">Head to your dashboard to add products, customise your storefront, and start selling. If you have any questions the support team is always here.</p>
    <p>Happy selling!</p>`;
  try {
    await m.mailer.send({
      from: r.from,
      cc: r.cc,
      to: o.to,
      subject: `Welcome to invoxai — ${esc(o.storeName)} is live`,
      html: shell("Welcome to invoxai", inner),
    });
  } catch { /* non-fatal */ }
}

/** Internal admin notice that a new seller has joined (from info@, to admin@). */
export async function sendSignupAdminNotify(o: {
  email: string;
  name: string;
  storeName: string;
}): Promise<void> {
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.signup_admin_notify;
  if (!r.to?.length) return;
  const inner = `<p>A new seller has completed onboarding.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
      ${row("Name", esc(o.name))}
      ${row("Email", esc(o.email))}
      ${row("Store", esc(o.storeName))}
    </table>`;
  try {
    await m.mailer.send({
      from: r.from,
      to: r.to[0],
      subject: `New seller joined — ${esc(o.storeName)}`,
      html: shell("New seller joined", inner),
    });
  } catch { /* non-fatal */ }
}

/** Admin notice that a custom domain was verified or went live (from domains@, to admin@). */
export async function sendDomainNotify(o: {
  domain: string;
  storeName: string;
  event: "verified" | "live";
}): Promise<void> {
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.domain_notify;
  if (!r.to?.length) return;
  const label = o.event === "live" ? "Domain went live" : "Domain DNS verified";
  const inner = `<p>A custom domain event occurred on the platform.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px">
      ${row("Event", esc(label))}
      ${row("Domain", esc(o.domain))}
      ${row("Store", esc(o.storeName))}
    </table>`;
  try {
    await m.mailer.send({
      from: r.from,
      to: r.to[0],
      subject: `[domains] ${label} — ${esc(o.domain)}`,
      html: shell(label, inner),
    });
  } catch { /* non-fatal */ }
}

// ─── Audit report helpers ────────────────────────────────────────────────────

export type AuditLogRow = {
  actor_email?: string | null;
  actor_role?: string | null;
  action?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  created_at?: string | null;
};

/** Build a compact HTML table summarising recent audit_log rows. */
export function buildAuditReportHtml(rows: AuditLogRow[], kind: "admin" | "user"): string {
  const title = kind === "admin" ? "Admin audit report" : "User activity report";
  if (!rows.length) {
    return shell(title, `<p style="color:#8a8088">No audit events in this period.</p>`);
  }
  const trs = rows
    .map((r) => {
      const ts = r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "";
      return `<tr>
        <td style="padding:4px 6px;font-size:12px;color:#7a6770;white-space:nowrap">${esc(ts)}</td>
        <td style="padding:4px 6px;font-size:12px">${esc(r.actor_email ?? "—")}</td>
        <td style="padding:4px 6px;font-size:12px">${esc(r.actor_role ?? "—")}</td>
        <td style="padding:4px 6px;font-size:12px;font-weight:600">${esc(r.action ?? "—")}</td>
        <td style="padding:4px 6px;font-size:12px">${esc(r.target_type ?? "—")}</td>
        <td style="padding:4px 6px;font-size:12px;color:#7a6770">${esc((r.target_id ?? "").slice(-8))}</td>
      </tr>`;
    })
    .join("");
  const table = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
    <thead>
      <tr style="background:#f5f3f7">
        <th style="padding:5px 6px;text-align:left;font-size:11px;color:#7a6770">Time</th>
        <th style="padding:5px 6px;text-align:left;font-size:11px;color:#7a6770">Actor</th>
        <th style="padding:5px 6px;text-align:left;font-size:11px;color:#7a6770">Role</th>
        <th style="padding:5px 6px;text-align:left;font-size:11px;color:#7a6770">Action</th>
        <th style="padding:5px 6px;text-align:left;font-size:11px;color:#7a6770">Target</th>
        <th style="padding:5px 6px;text-align:left;font-size:11px;color:#7a6770">ID (last 8)</th>
      </tr>
    </thead>
    <tbody>${trs}</tbody>
  </table>`;
  return shell(title, `<p>${rows.length} event(s) in this period.</p>${table}`);
}

/** Send a recent-events audit report to the admin log inbox. */
export async function sendAdminAuditReport(rows: AuditLogRow[]): Promise<void> {
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.admin_audit_report;
  if (!r.to?.length) return;
  try {
    await m.mailer.send({
      from: r.from,
      to: r.to[0],
      subject: `Admin audit report — ${new Date().toLocaleDateString("en-IN")} (${rows.length} events)`,
      html: buildAuditReportHtml(rows, "admin"),
    });
  } catch { /* non-fatal */ }
}

/** Send a recent-events audit report for user activity to the user-log inbox. */
export async function sendUserAuditReport(rows: AuditLogRow[]): Promise<void> {
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.user_audit_report;
  if (!r.to?.length) return;
  try {
    await m.mailer.send({
      from: r.from,
      to: r.to[0],
      subject: `User activity report — ${new Date().toLocaleDateString("en-IN")} (${rows.length} events)`,
      html: buildAuditReportHtml(rows, "user"),
    });
  } catch { /* non-fatal */ }
}

// ─── Tax invoice emails ───────────────────────────────────────────────────────

/**
 * Send a proper GST tax invoice to the buyer (from hello@, copy to admin@).
 * Mirrors the sendOrderReceipt style but includes full GST line-item breakdown.
 * Non-fatal: any error is caught and swallowed so invoice email failure
 * never blocks payment confirmation.
 */
export async function sendTaxInvoiceEmail(o: {
  to: string | null;
  invoice: InvoiceRow;
  productTitle: string | null;
  sellerName: string | null;
  replyTo?: string | null;
}): Promise<void> {
  if (!o.to) return;
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.order_receipt;
  const cur = o.invoice.currency || "INR";
  const invDate = new Date(o.invoice.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Build GST breakdown rows
  const taxRows: string[] = [];
  const rate = Number(o.invoice.tax_rate ?? 0);
  if (rate > 0) {
    if (Number(o.invoice.cgst_paise) > 0 || Number(o.invoice.sgst_paise) > 0) {
      const halfRate = rate / 2;
      taxRows.push(row(`CGST @ ${halfRate}%`, money(Number(o.invoice.cgst_paise), cur)));
      taxRows.push(row(`SGST @ ${halfRate}%`, money(Number(o.invoice.sgst_paise), cur)));
    } else if (Number(o.invoice.igst_paise) > 0) {
      taxRows.push(row(`IGST @ ${rate}%`, money(Number(o.invoice.igst_paise), cur)));
    }
  }

  const inner = `
    <p style="font-size:12px;color:#8a8088;margin:0 0 12px">TAX INVOICE</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px">
      ${row("Invoice No.", esc(o.invoice.invoice_number))}
      ${row("Invoice Date", invDate)}
      ${o.sellerName ? row("Seller", esc(o.sellerName)) : ""}
      ${o.invoice.gstin ? row("Seller GSTIN", esc(o.invoice.gstin)) : ""}
      ${o.invoice.seller_address ? row("Seller Address", esc(o.invoice.seller_address)) : ""}
      ${o.invoice.buyer_name ? row("Bill To", esc(o.invoice.buyer_name)) : ""}
      ${o.to ? row("Buyer Email", esc(o.to)) : ""}
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:13px;border-top:1px solid #eee;padding-top:10px;margin-top:10px">
      ${row("Item", esc(o.productTitle || "Your purchase"))}
      ${row("Taxable Value", money(Number(o.invoice.subtotal_paise), cur))}
      ${taxRows.join("")}
      <tr style="border-top:1px solid #eee">
        <td style="padding:6px 0;color:#1c1320;font-weight:700">Total Paid</td>
        <td style="padding:6px 0;text-align:right;font-weight:700">${money(Number(o.invoice.total_paise), cur)}</td>
      </tr>
    </table>
    <p style="font-size:11px;color:#8a8088;margin-top:10px">This is a computer-generated tax invoice. No signature required.</p>`;

  try {
    await m.mailer.send({
      from: r.from,
      cc: r.cc,
      to: o.to,
      subject: `Tax Invoice ${esc(o.invoice.invoice_number)} — ${o.productTitle || "Purchase"}`,
      html: shell("Tax Invoice", inner),
      ...(o.replyTo ? { replyTo: o.replyTo } : {}),
    });
  } catch { /* non-fatal */ }
}

/**
 * Send a GST tax invoice for a platform plan subscription (from billing@, copy to admin@).
 * Non-fatal.
 */
export async function sendPlanInvoiceEmail(o: {
  to: string | null;
  invoice: InvoiceRow;
  planName: string;
}): Promise<void> {
  if (!o.to) return;
  const m = await getPlatformMailer();
  if (!m.ok) return;
  const r = EMAIL_ROUTES.plan_billing;
  const cur = o.invoice.currency || "INR";
  const invDate = new Date(o.invoice.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const taxRows: string[] = [];
  const rate = Number(o.invoice.tax_rate ?? 0);
  if (rate > 0) {
    if (Number(o.invoice.cgst_paise) > 0 || Number(o.invoice.sgst_paise) > 0) {
      const halfRate = rate / 2;
      taxRows.push(row(`CGST @ ${halfRate}%`, money(Number(o.invoice.cgst_paise), cur)));
      taxRows.push(row(`SGST @ ${halfRate}%`, money(Number(o.invoice.sgst_paise), cur)));
    } else if (Number(o.invoice.igst_paise) > 0) {
      taxRows.push(row(`IGST @ ${rate}%`, money(Number(o.invoice.igst_paise), cur)));
    }
  }

  const inner = `
    <p style="font-size:12px;color:#8a8088;margin:0 0 12px">TAX INVOICE — PLATFORM SUBSCRIPTION</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px">
      ${row("Invoice No.", esc(o.invoice.invoice_number))}
      ${row("Invoice Date", invDate)}
      ${o.invoice.seller_legal_name ? row("Issuer", esc(o.invoice.seller_legal_name)) : ""}
      ${o.invoice.gstin ? row("GSTIN", esc(o.invoice.gstin)) : ""}
      ${o.invoice.seller_address ? row("Address", esc(o.invoice.seller_address)) : ""}
      ${o.invoice.buyer_name ? row("Bill To", esc(o.invoice.buyer_name)) : ""}
      ${o.to ? row("Email", esc(o.to)) : ""}
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:13px;border-top:1px solid #eee;padding-top:10px;margin-top:10px">
      ${row("Plan", esc(o.planName))}
      ${row("Taxable Value", money(Number(o.invoice.subtotal_paise), cur))}
      ${taxRows.join("")}
      <tr style="border-top:1px solid #eee">
        <td style="padding:6px 0;color:#1c1320;font-weight:700">Total</td>
        <td style="padding:6px 0;text-align:right;font-weight:700">${money(Number(o.invoice.total_paise), cur)}</td>
      </tr>
    </table>
    <p style="font-size:11px;color:#8a8088;margin-top:10px">This is a computer-generated tax invoice. No signature required.</p>`;

  try {
    await m.mailer.send({
      from: r.from,
      cc: r.cc,
      to: o.to,
      subject: `Tax Invoice ${esc(o.invoice.invoice_number)} — ${o.planName} plan`,
      html: shell("Plan Tax Invoice", inner),
    });
  } catch { /* non-fatal */ }
}
