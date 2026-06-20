import "server-only";
import type { InvoiceRow } from "@/lib/invoice";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Money formatting — must match transactional.ts money() exactly.
// Amounts come only from the stored InvoiceRow (server-trusted). Never
// recomputed or accepted from client input.
// ---------------------------------------------------------------------------
function money(paise: number, currency = "INR"): string {
  const major = Math.round(paise) / 100;
  const n = major.toLocaleString("en-IN", {
    minimumFractionDigits: major % 1 ? 2 : 0,
  });
  return (currency || "INR").toUpperCase() === "INR" ? `₹${n}` : `${currency} ${n}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Build the A4 invoice HTML from a stored InvoiceRow.
// All monetary values come exclusively from the InvoiceRow — never
// recomputed or derived from user input.
// ---------------------------------------------------------------------------
// Default platform sunset gradient for the invoice accent bar.
const DEFAULT_ACCENT_GRADIENT = "linear-gradient(135deg, #ffb23e, #ff6a3d 40%, #ff4d7d 72%, #7b3fe4)";

/** Validate a #rgb / #rrggbb hex string. Returns the lowercased hex or null. */
function safeHex(c: string | null | undefined): string | null {
  if (!c) return null;
  const v = c.trim().toLowerCase();
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(v) ? v : null;
}

function buildInvoiceHtml(
  invoice: InvoiceRow,
  opts: {
    sellerLegalName?: string | null;
    sellerGstin?: string | null;
    sellerAddress?: string | null;
    /** Seller-side invoice branding (store-level). Applies to order/custom invoices. */
    seller?: {
      logoUrl?: string | null;
      accentColor?: string | null;
      footer?: string | null;
    } | null;
    platform?: {
      legalName?: string | null;
      gstin?: string | null;
      address?: string | null;
      footer?: string | null;
      logoUrl?: string | null;
      pan?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
    } | null;
    invoiceFooter?: string | null;
  } = {},
): string {
  const cur = invoice.currency || "INR";
  const invDate = new Date(invoice.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Resolve seller/issuer identity from the stored snapshot fields.
  // For order invoices: stored seller_legal_name / gstin / seller_address.
  // Opts can override (e.g. for plan invoices passing platform identity).
  const issuerName =
    opts.sellerLegalName ??
    opts.platform?.legalName ??
    invoice.seller_legal_name ??
    null;
  const issuerGstin =
    opts.sellerGstin ??
    opts.platform?.gstin ??
    invoice.gstin ??
    null;
  const issuerAddress =
    opts.sellerAddress ??
    opts.platform?.address ??
    invoice.seller_address ??
    null;

  // Line item description from meta snapshot.
  const meta = (invoice.meta ?? {}) as Record<string, unknown>;
  // Custom invoices may carry an explicit array of line items in meta.line_items.
  const customLineItems = Array.isArray(meta.line_items)
    ? (meta.line_items as { description?: string; amount_paise?: number }[])
    : null;
  let lineItem = "Service";
  if (invoice.kind === "order") {
    lineItem = (meta.product_title as string) || "Product purchase";
  } else if (invoice.kind === "custom") {
    lineItem = (meta.title as string) || "Custom invoice";
  } else if (invoice.kind === "plan") {
    lineItem = (meta.plan_name as string)
      ? `${meta.plan_name as string} — Platform Subscription`
      : "Platform Subscription";
  } else if (invoice.kind === "wallet") {
    lineItem = "Wallet top-up";
  }

  // GST breakdown — read exclusively from stored columns.
  const rate = Number(invoice.tax_rate ?? 0);
  const cgst = Number(invoice.cgst_paise ?? 0);
  const sgst = Number(invoice.sgst_paise ?? 0);
  const igst = Number(invoice.igst_paise ?? 0);

  let gstRows = "";
  if (rate > 0) {
    if (cgst > 0 || sgst > 0) {
      const halfRate = rate / 2;
      gstRows += `
        <tr>
          <td class="label">CGST @ ${halfRate}%</td>
          <td class="amount">${esc(money(cgst, cur))}</td>
        </tr>
        <tr>
          <td class="label">SGST @ ${halfRate}%</td>
          <td class="amount">${esc(money(sgst, cur))}</td>
        </tr>`;
    } else if (igst > 0) {
      gstRows += `
        <tr>
          <td class="label">IGST @ ${rate}%</td>
          <td class="amount">${esc(money(igst, cur))}</td>
        </tr>`;
    }
  }

  const kindLabel =
    invoice.kind === "order"
      ? "TAX INVOICE"
      : invoice.kind === "custom"
      ? "INVOICE"
      : invoice.kind === "plan"
      ? "TAX INVOICE — PLATFORM SUBSCRIPTION"
      : "TAX INVOICE — WALLET";

  // Seller branding applies to order/custom invoices (seller is the issuer).
  // Plan/wallet invoices are platform-issued, so they ignore seller branding.
  const isSellerIssued = invoice.kind === "order" || invoice.kind === "custom";
  const sellerAccent = isSellerIssued ? safeHex(opts.seller?.accentColor) : null;
  const sellerLogoUrl = isSellerIssued ? (opts.seller?.logoUrl ?? null) : null;

  // Footer priority: explicit opts.invoiceFooter > seller footer (seller-issued)
  // > platform footer > default.
  const footer =
    opts.invoiceFooter?.trim() ||
    (isSellerIssued ? opts.seller?.footer?.trim() : "") ||
    opts.platform?.footer?.trim() ||
    "This is a computer-generated tax invoice. No physical signature is required.";

  // Accent bar: seller-set solid colour (seller-issued) else platform gradient.
  const accentBackground = sellerAccent
    ? sellerAccent
    : DEFAULT_ACCENT_GRADIENT;
  // Header brand: seller logo (seller-issued) takes priority over platform logo.
  const platformLogoUrl = opts.platform?.logoUrl ?? null;
  const platformPan = opts.platform?.pan ?? null;
  const platformContactEmail = opts.platform?.contactEmail ?? null;
  const platformContactPhone = opts.platform?.contactPhone ?? null;

  // Contact line shown in the issuer block for plan/wallet invoices (platform is
  // the issuer) and as a platform-branding header line on order invoices.
  const contactParts: string[] = [];
  if (platformContactEmail) contactParts.push(`Email: ${esc(platformContactEmail)}`);
  if (platformContactPhone) contactParts.push(`Phone: ${esc(platformContactPhone)}`);
  const contactLine = contactParts.join(" &nbsp;&middot;&nbsp; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Invoice ${esc(invoice.invoice_number)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    font-size: 13px;
    color: #1c1320;
    background: #fff;
    padding: 36px 40px;
    max-width: 794px; /* A4 width at 96 dpi */
    margin: 0 auto;
  }

  /* Accent bar — seller-set solid colour (order/custom) or platform gradient */
  .brand-bar {
    height: 7px;
    border-radius: 99px;
    background: ${accentBackground};
    margin-bottom: 28px;
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 28px;
  }
  .invoice-title {
    font-size: 22px;
    font-weight: 700;
    color: #1c1320;
    letter-spacing: -0.3px;
  }
  .invoice-kind {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #8a8088;
    margin-top: 3px;
  }
  .invoice-meta {
    text-align: right;
    font-size: 12px;
    color: #4a3f47;
    line-height: 1.7;
  }
  .invoice-meta .inv-number {
    font-weight: 700;
    font-size: 14px;
    font-family: monospace;
    color: #1c1320;
  }

  /* Two-column party block */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 28px;
    padding: 18px 20px;
    background: #f9f7fb;
    border-radius: 10px;
    border: 1px solid #ede9f3;
  }
  .party-block h4 {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    color: ${sellerAccent ?? "#7b3fe4"};
    margin-bottom: 6px;
  }
  .party-block p {
    font-size: 12.5px;
    color: #1c1320;
    line-height: 1.55;
  }
  .party-block .gstin {
    font-family: monospace;
    font-size: 11px;
    color: #4a3f47;
    margin-top: 3px;
    display: block;
  }

  /* Line-items table */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
  }
  .items-table thead tr {
    background: #1c1320;
    color: #fff;
  }
  .items-table thead th {
    padding: 9px 12px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-align: left;
  }
  .items-table thead th.right { text-align: right; }
  .items-table tbody tr {
    border-bottom: 1px solid #f0ecf4;
  }
  .items-table tbody tr:last-child {
    border-bottom: none;
  }
  .items-table td {
    padding: 9px 12px;
    font-size: 12.5px;
    vertical-align: top;
  }
  .items-table td.label { color: #4a3f47; }
  .items-table td.amount { text-align: right; font-variant-numeric: tabular-nums; }

  /* Totals section */
  .totals-section {
    margin-top: 0;
    display: flex;
    justify-content: flex-end;
  }
  .totals-table {
    width: 300px;
    border-collapse: collapse;
    margin-top: 12px;
    font-size: 12.5px;
  }
  .totals-table td {
    padding: 5px 8px;
  }
  .totals-table td.label { color: #7a6770; }
  .totals-table td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  .totals-table .total-row td {
    font-weight: 700;
    font-size: 14px;
    color: #1c1320;
    border-top: 2px solid #1c1320;
    padding-top: 8px;
  }

  /* Footer */
  .invoice-footer {
    margin-top: 36px;
    padding-top: 14px;
    border-top: 1px solid #ede9f3;
    font-size: 10px;
    color: #9a8898;
    line-height: 1.6;
    text-align: center;
  }
</style>
</head>
<body>
  <!-- Sunset gradient bar matching email brand -->
  <div class="brand-bar"></div>

  <!-- Header: seller logo/name (order/custom) or platform brand + Invoice No + Date -->
  <div class="header-row">
    <div>
      ${
        // Seller-issued invoices: prefer seller logo, else seller business name text.
        isSellerIssued && sellerLogoUrl
          ? `<img src="${esc(sellerLogoUrl)}" alt="${esc(issuerName || "Seller")}" style="max-height:48px;max-width:180px;object-fit:contain;display:block;margin-bottom:4px" />`
          : isSellerIssued && issuerName
          ? `<div class="invoice-title">${esc(issuerName)}</div>`
          : platformLogoUrl
          ? `<img src="${esc(platformLogoUrl)}" alt="invoxai" style="max-height:48px;max-width:180px;object-fit:contain;display:block;margin-bottom:4px" />`
          : `<div class="invoice-title">invoxai</div>`
      }
      <div class="invoice-kind">${esc(kindLabel)}</div>
      ${contactLine ? `<div style="font-size:10.5px;color:#7a6770;margin-top:4px">${contactLine}</div>` : ""}
    </div>
    <div class="invoice-meta">
      <div class="inv-number">${esc(invoice.invoice_number)}</div>
      <div>Date: ${esc(invDate)}</div>
    </div>
  </div>

  <!-- Seller / Buyer parties -->
  <div class="parties">
    <div class="party-block">
      <h4>${invoice.kind === "order" ? "Seller" : "Issuer"}</h4>
      ${issuerName ? `<p><strong>${esc(issuerName)}</strong></p>` : `<p><em>invoxai</em></p>`}
      ${issuerGstin ? `<span class="gstin">GSTIN: ${esc(issuerGstin)}</span>` : ""}
      ${platformPan ? `<span class="gstin">PAN: ${esc(platformPan)}</span>` : ""}
      ${issuerAddress ? `<p style="font-size:11.5px;color:#7a6770;margin-top:3px">${esc(issuerAddress)}</p>` : ""}
      ${invoice.kind !== "order" && contactLine ? `<p style="font-size:11px;color:#7a6770;margin-top:4px">${contactLine}</p>` : ""}
    </div>
    <div class="party-block">
      <h4>Bill To</h4>
      ${invoice.buyer_name ? `<p><strong>${esc(invoice.buyer_name)}</strong></p>` : ""}
      ${invoice.buyer_email ? `<p style="color:#7a6770">${esc(invoice.buyer_email)}</p>` : ""}
    </div>
  </div>

  <!-- Line items table -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Taxable Value</th>
        ${rate > 0 ? `<th class="right">GST</th>` : ""}
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${
        // Custom invoices with explicit line items: render each item row (no
        // per-line GST split — GST shown only in the totals section). The sum of
        // the listed item amounts equals subtotal_paise (computed server-side).
        customLineItems && customLineItems.length > 0
          ? customLineItems
              .map(
                (li) => `<tr>
        <td>${esc(String(li.description ?? "Item"))}</td>
        <td class="amount">${esc(money(Number(li.amount_paise ?? 0), cur))}</td>
        ${rate > 0 ? `<td class="amount"></td>` : ""}
        <td class="amount">${esc(money(Number(li.amount_paise ?? 0), cur))}</td>
      </tr>`,
              )
              .join("")
          : `<tr>
        <td>${esc(lineItem)}</td>
        <td class="amount">${esc(money(Number(invoice.subtotal_paise), cur))}</td>
        ${rate > 0 ? `<td class="amount">${esc(money(Number(invoice.total_paise) - Number(invoice.subtotal_paise), cur))}</td>` : ""}
        <td class="amount"><strong>${esc(money(Number(invoice.total_paise), cur))}</strong></td>
      </tr>`
      }
    </tbody>
  </table>

  <!-- Totals breakdown -->
  <div class="totals-section">
    <table class="totals-table">
      <tbody>
        <tr>
          <td class="label">Taxable Value</td>
          <td class="amount">${esc(money(Number(invoice.subtotal_paise), cur))}</td>
        </tr>
        ${gstRows}
        <tr class="total-row">
          <td class="label">Total</td>
          <td class="amount">${esc(money(Number(invoice.total_paise), cur))}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="invoice-footer">
    ${esc(footer)}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type InvoicePdfOpts = {
  sellerLegalName?: string | null;
  sellerGstin?: string | null;
  sellerAddress?: string | null;
  /**
   * Seller-side invoice branding (store-level). When omitted, renderInvoicePdf
   * auto-loads it from the invoice's store for order/custom invoices. Pass
   * `seller: null` explicitly to skip the auto-load (e.g. plan/wallet invoices).
   */
  seller?: {
    logoUrl?: string | null;
    accentColor?: string | null;
    footer?: string | null;
  } | null;
  platform?: {
    legalName?: string | null;
    gstin?: string | null;
    address?: string | null;
    footer?: string | null;
    logoUrl?: string | null;
    pan?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  } | null;
};

/**
 * Render a professional A4 TAX INVOICE PDF for the given InvoiceRow.
 *
 * Uses Playwright/Chromium (already installed) to render a branded HTML
 * invoice to PDF — giving pixel-faithful output that reuses the same sunset
 * gradient accent as the email template.
 *
 * All monetary values in the PDF come exclusively from the stored InvoiceRow
 * columns (subtotal_paise, cgst_paise, sgst_paise, igst_paise, total_paise).
 * Nothing is recomputed or accepted from client input.
 *
 * Reads platform_settings.invoice_footer for the footer text if not supplied
 * via opts; falls back to a default "computer-generated" notice.
 *
 * Server-only: this module imports "server-only".
 */
export async function renderInvoicePdf(
  invoice: InvoiceRow,
  opts: InvoicePdfOpts = {},
): Promise<Buffer> {
  // Fetch platform_settings (best-effort; never fatal). One query covers all
  // fields needed: invoice_footer, logo_url, pan, contact_phone, support_email,
  // gstin, legal_name, registered_address.
  type PlatformSettingsRow = {
    logo_url?: string | null;
    pan?: string | null;
    contact_phone?: string | null;
    support_email?: string | null;
    gstin?: string | null;
    legal_name?: string | null;
    registered_address?: string | null;
    invoice_footer?: string | null;
  };
  let invoiceFooter: string | null = null;
  let platformSettings: PlatformSettingsRow | null = null;
  try {
    const admin = createAdminClient();
    const { data: ps } = await admin
      .from("platform_settings")
      .select("invoice_footer, logo_url, pan, contact_phone, support_email, gstin, legal_name, registered_address")
      .maybeSingle();
    platformSettings = ps as PlatformSettingsRow | null;
    invoiceFooter = platformSettings?.invoice_footer ?? null;
  } catch {
    // platform_settings read failure is non-fatal; use default footer.
  }

  // Auto-load seller invoice branding for order/custom invoices, unless the
  // caller already supplied (or explicitly nulled) opts.seller. Plan/wallet
  // invoices are platform-issued and don't use seller branding.
  let sellerBranding = opts.seller;
  const sellerIssued = invoice.kind === "order" || invoice.kind === "custom";
  if (sellerBranding === undefined && sellerIssued && invoice.store_id) {
    try {
      const admin = createAdminClient();
      const { data: store } = await admin
        .from("stores")
        .select("logo_url, invoice_accent_color, invoice_footer")
        .eq("id", invoice.store_id)
        .maybeSingle();
      if (store) {
        const s = store as {
          logo_url?: string | null;
          invoice_accent_color?: string | null;
          invoice_footer?: string | null;
        };
        sellerBranding = {
          logoUrl: s.logo_url ?? null,
          accentColor: s.invoice_accent_color ?? null,
          footer: s.invoice_footer ?? null,
        };
      }
    } catch {
      // Non-fatal — fall back to platform defaults.
    }
  }

  // Merge fetched platform fields into opts.platform so the HTML builder has
  // the full picture. Caller-supplied opts.platform values take priority.
  const mergedPlatform = {
    legalName: opts.platform?.legalName ?? platformSettings?.legal_name ?? null,
    gstin: opts.platform?.gstin ?? platformSettings?.gstin ?? null,
    address: opts.platform?.address ?? platformSettings?.registered_address ?? null,
    footer: opts.platform?.footer ?? platformSettings?.invoice_footer ?? null,
    logoUrl: opts.platform?.logoUrl ?? platformSettings?.logo_url ?? null,
    pan: opts.platform?.pan ?? platformSettings?.pan ?? null,
    contactEmail: opts.platform?.contactEmail ?? platformSettings?.support_email ?? null,
    contactPhone: opts.platform?.contactPhone ?? platformSettings?.contact_phone ?? null,
  };

  const html = buildInvoiceHtml(invoice, {
    ...opts,
    seller: sellerBranding ?? null,
    platform: mergedPlatform,
    invoiceFooter,
  });

  // Use Playwright Chromium — confirmed launchable on this server.
  const { chromium } = await import("playwright");
  // --no-sandbox keeps PDF rendering robust across server/user contexts
  // (the chromium browser must be installed for the runtime user — see memory).
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    // Wait for the network to settle so the remote platform logo <img> actually
    // loads before we snapshot — with "domcontentloaded" the logo is still
    // fetching when page.pdf() runs, leaving a blank logo. networkidle waits for
    // the image; the timeout caps total wait so PDF generation never hangs.
    await page.setContent(html, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    // Belt-and-suspenders: explicitly wait for every <img> to finish decoding
    // (best-effort, capped) in case networkidle settled before the image painted.
    await page
      .evaluate(async () => {
        const imgs = Array.from(document.images);
        await Promise.all(
          imgs.map((img) =>
            img.complete && img.naturalWidth > 0
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  const done = () => resolve();
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                  setTimeout(done, 8000);
                }),
          ),
        );
      })
      .catch(() => {});
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
