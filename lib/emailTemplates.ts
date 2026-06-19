/**
 * Built-in transactional email templates, rendered to standalone HTML so they
 * can be previewed in the admin (and later sent for real). Each returns a
 * subject + full HTML document with inline styles (email-client safe).
 *
 * Sample data is used for previews; the send path can pass real values via the
 * optional `data` arg once email delivery is wired.
 */

export type EmailKey =
  | "otp"
  | "welcome"
  | "receipt"
  | "invoice"
  | "wallet"
  | "report";

export const EMAIL_KEYS: EmailKey[] = ["otp", "welcome", "receipt", "invoice", "wallet", "report"];

const BRAND = "InvoxAI";
const GRAD = "linear-gradient(135deg,#ff6a3d,#ff5a7a,#ffb23e)";

function shell(brand: string, inner: string, preheader = ""): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f1ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
${preheader ? `<span style="display:none;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preheader}</span>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,.06);">
<tr><td style="background:${GRAD};padding:22px 28px;">
<span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-.02em;">${brand}</span>
</td></tr>
<tr><td style="padding:30px 28px 8px;">${inner}</td></tr>
<tr><td style="padding:18px 28px 28px;border-top:1px solid #efe9e3;color:#9a9088;font-size:12px;line-height:1.6;">
You're receiving this because you have an account on ${brand}.<br>© ${brand}. All rights reserved.
</td></tr>
</table></td></tr></table></body></html>`;
}

const btn = (label: string) =>
  `<a href="#" style="display:inline-block;background:${GRAD};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">${label}</a>`;

const h = (t: string) => `<h1 style="font-size:21px;font-weight:800;margin:0 0 12px;letter-spacing:-.02em;">${t}</h1>`;
const p = (t: string) => `<p style="font-size:14.5px;line-height:1.65;color:#44403c;margin:0 0 16px;">${t}</p>`;
const row = (k: string, v: string) =>
  `<tr><td style="padding:8px 0;color:#78716c;font-size:13.5px;">${k}</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:13.5px;">${v}</td></tr>`;

export function renderEmailTemplate(
  key: string,
  brand: string = BRAND,
): { subject: string; html: string } | null {
  switch (key as EmailKey) {
    case "otp":
      return {
        subject: `Your ${brand} code`,
        html: shell(brand, `${h("Your verification code")}${p("Use this code to finish signing in. It expires in 10 minutes.")}
<div style="font-size:34px;font-weight:800;letter-spacing:10px;background:#faf6f2;border:1px dashed #e7ddd3;border-radius:12px;padding:18px;text-align:center;margin:8px 0 18px;">284913</div>
${p("If you didn't request this, you can safely ignore this email.")}`, "Your one-time code"),
      };
    case "welcome":
      return {
        subject: `Welcome to ${brand} — let's get you live`,
        html: shell(brand, `${h(`Welcome aboard, Deep 👋`)}${p(`Your ${brand} account is ready. Build your bio, store, courses or community on your own subdomain and start selling in minutes.`)}
<div style="margin:6px 0 18px;">${btn("Open your dashboard")}</div>
${p("Need a hand? Just reply to this email.")}`, "Your account is ready"),
      };
    case "receipt":
      return {
        subject: "Your order is confirmed ✓",
        html: shell(brand, `${h("Payment successful ✓")}${p("Thanks for your purchase! Here's your receipt.")}
<table role="presentation" width="100%" style="border-top:1px solid #efe9e3;border-bottom:1px solid #efe9e3;margin:4px 0 16px;">
${row("Product", "Premium Notion Template")}${row("Order ID", "INV-8F3A21")}${row("Amount paid", "₹499")}</table>
${p("Your download / access link is below.")}<div style="margin:0 0 6px;">${btn("Access your purchase")}</div>`, "Your order is confirmed"),
      };
    case "invoice":
      return {
        subject: "Invoice — Pro plan",
        html: shell(brand, `${h("Plan invoice 🧾")}${p("Thanks for subscribing. Here's your invoice.")}
<table role="presentation" width="100%" style="border-top:1px solid #efe9e3;border-bottom:1px solid #efe9e3;margin:4px 0 16px;">
${row("Plan", "Pro (monthly)")}${row("Invoice #", "INV-2026-0619")}${row("Billing period", "19 Jun – 19 Jul 2026")}${row("Total", "₹1,999")}</table>
<div style="margin:0 0 6px;">${btn("Download PDF invoice")}</div>`, "Your plan invoice"),
      };
    case "wallet":
      return {
        subject: "Your daily wallet invoice",
        html: shell(brand, `${h("Daily wallet summary 👛")}${p("Here's a summary of today's commission activity on your wallet.")}
<table role="presentation" width="100%" style="border-top:1px solid #efe9e3;border-bottom:1px solid #efe9e3;margin:4px 0 16px;">
${row("Sales today", "7 orders · ₹4,930")}${row("Commission deducted", "− ₹246")}${row("Wallet balance", "₹1,254")}</table>
${p("Top up your wallet to avoid any interruption to your sales.")}<div style="margin:0 0 6px;">${btn("Recharge wallet")}</div>`, "Your daily wallet invoice"),
      };
    case "report":
      return {
        subject: `Your week on ${brand} 📊`,
        html: shell(brand, `${h("Your week in review 📊")}${p("Here's how your store performed over the last 7 days.")}
<table role="presentation" width="100%" style="border-top:1px solid #efe9e3;border-bottom:1px solid #efe9e3;margin:4px 0 16px;">
${row("Revenue", "₹18,400")}${row("Orders", "32")}${row("Page views", "1,902")}${row("New customers", "21")}</table>
<div style="margin:0 0 6px;">${btn("View full analytics")}</div>`, "Your weekly performance report"),
      };
    default:
      return null;
  }
}
