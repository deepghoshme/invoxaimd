"use client";

/**
 * TemplateGallery — client component for /dashboard/templates.
 *
 * Handles:
 *  - Filter bar: by type + tag (client-side, no round-trip).
 *  - Responsive grid of template cards.
 *  - Preview modal: thumbnail + metadata summary.
 *  - Apply button logic:
 *      free / owned  → applyTemplate() → router.push(redirect).
 *      premium unowned → rail chooser:
 *          Wallet  → startTemplatePurchase(id, pageType, targetPageId, {rail:'wallet'})
 *                     on {ok:true}        → router.push(redirect)
 *                     on {needsRecharge}  → show message + link to /dashboard/wallet/recharge
 *                     on error            → toast
 *          Razorpay → POST /api/templates/buy/start → open Razorpay checkout
 *                     handler → POST /api/templates/buy/verify → router.push(redirect)
 *  - Scope decision (Phase D): singleton types (website/store/bio/courses) get
 *    direct Apply. Many-types (product/payment/booking/lead/vip/event) show
 *    "Open in builder to apply" linking to the relevant builder page — no picker
 *    needed for v1 since singleton apply works end-to-end right now.
 */

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { applyTemplate } from "./actions";
import { startTemplatePurchase } from "./gallery-actions";
import { SINGLETON_PAGE_TYPES, TYPE_TO_PAGE, type TemplateType, type PageTypeEnum } from "@/lib/templates-apply";
import Icon from "@/components/dx/Icon";

// Razorpay global type declaration (mirrors BillingClient.tsx)
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type GalleryTemplate = {
  id: string;
  name: string;
  type: string;
  tier: "free" | "premium";
  price_paise: number;
  thumbnail_url: string | null;
  description: string | null;
  tags: string[];
  license_model: "per_store" | "per_page" | "all_access";
  sales_count: number;
  // Theme tokens from the templates.theme column (preview only)
  theme: Record<string, unknown> | null;
  // Applied = free or already owned or all_access plan
  owned: boolean;
  included: boolean; // templates_all_access plan feature active
};

type Props = {
  templates: GalleryTemplate[];
  hasAllAccess: boolean;
};

// ── Builder hrefs for many-types (Phase D: no direct apply, link to builder) ─

const BUILDER_HREF: Partial<Record<string, string>> = {
  product:  "/dashboard/pages/products",
  payment:  "/dashboard/pages/products",
  booking:  "/dashboard/booking",
  lead:     "/dashboard/leadform",
  vip:      "/dashboard/vip",
  event:    "/dashboard/events",
};

// Human-readable type labels
const TYPE_LABELS: Record<string, string> = {
  website:  "Website",
  store:    "Store",
  bio:      "Bio page",
  courses:  "Course",
  product:  "Product",
  payment:  "Payment",
  booking:  "Booking",
  lead:     "Lead form",
  vip:      "VIP community",
  event:    "Event",
};

// Accent colour per type (for placeholder thumbnails)
const TYPE_COLOR: Record<string, string> = {
  website:  "var(--primary)",
  store:    "var(--secondary)",
  bio:      "var(--accent)",
  courses:  "var(--gold)",
  product:  "var(--primary)",
  payment:  "var(--green)",
  booking:  "var(--secondary)",
  lead:     "var(--accent)",
  vip:      "var(--gold)",
  event:    "var(--primary)",
};

// Icon per type
const TYPE_ICON: Record<string, string> = {
  website:  "site",
  store:    "bag",
  bio:      "link",
  courses:  "book",
  product:  "tag",
  payment:  "card",
  booking:  "cal",
  lead:     "form",
  vip:      "crown",
  event:    "cal",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSingleton(type: string): boolean {
  const mapped = TYPE_TO_PAGE[type as TemplateType];
  if (!mapped) return false;
  return SINGLETON_PAGE_TYPES.has(mapped);
}

function fmtPrice(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

function licenseLabel(model: string): string {
  if (model === "per_page") return "per page";
  if (model === "per_store") return "per store";
  return model;
}

// ── Rail chooser state ────────────────────────────────────────────────────────

type RailChooserState = {
  tmpl: GalleryTemplate;
  mapped: PageTypeEnum;
} | null;

// ── Sub-components ────────────────────────────────────────────────────────────

function Thumbnail({ tmpl }: { tmpl: GalleryTemplate }) {
  const color = TYPE_COLOR[tmpl.type] ?? "var(--primary)";
  const icon = TYPE_ICON[tmpl.type] ?? "layers";

  if (tmpl.thumbnail_url) {
    return (
      <div className="tg-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tmpl.thumbnail_url} alt={tmpl.name} loading="lazy" />
      </div>
    );
  }

  // Graceful placeholder using type colour + icon
  return (
    <div
      className="tg-thumb tg-thumb-placeholder"
      style={{
        background: `color-mix(in srgb, ${color} 18%, var(--surface2))`,
        color,
      }}
    >
      <Icon name={icon} size={32} />
      <span>{TYPE_LABELS[tmpl.type] ?? tmpl.type}</span>
    </div>
  );
}

function PremiumBadge() {
  return <span className="tg-badge tg-badge-prem">Premium</span>;
}

function FreeBadge() {
  return <span className="tg-badge tg-badge-free">Free</span>;
}

function OwnedBadge({ included }: { included?: boolean }) {
  return (
    <span className="tg-badge tg-badge-owned">
      {included ? "Included" : "Owned"}
    </span>
  );
}

// ── Rail Chooser Modal ────────────────────────────────────────────────────────

function RailChooserModal({
  tmpl,
  onClose,
  onWallet,
  onRazorpay,
  busy,
  rechargeMsg,
}: {
  tmpl: GalleryTemplate;
  onClose: () => void;
  onWallet: () => void;
  onRazorpay: () => void;
  busy: boolean;
  rechargeMsg: string | null;
}) {
  const perNote = tmpl.license_model === "per_page" ? " (per page)" : "";

  return (
    <div className="tg-modal-backdrop" onClick={onClose}>
      <div className="tg-modal tg-rail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tg-modal-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <div className="tg-modal-body">
          <h2 className="tg-modal-title" style={{ fontSize: 17 }}>Buy &amp; Apply — {tmpl.name}</h2>
          <p className="tg-modal-desc">
            {fmtPrice(tmpl.price_paise)}{perNote} &middot; {licenseLabel(tmpl.license_model)}
          </p>

          {rechargeMsg && (
            <div className="tg-recharge-msg">
              {rechargeMsg}
              {" "}
              <a href="/dashboard/wallet/recharge" className="tg-recharge-link">
                Top up wallet
              </a>
            </div>
          )}

          <div className="tg-rail-btns">
            <button
              className="btn grad tg-rail-btn"
              onClick={onWallet}
              disabled={busy}
            >
              {busy ? "Processing..." : `Pay with Wallet — ${fmtPrice(tmpl.price_paise)}`}
            </button>
            <button
              className="btn tg-rail-btn"
              onClick={onRazorpay}
              disabled={busy}
            >
              {busy ? "Processing..." : `Pay with Card / UPI (Razorpay)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  tmpl,
  onClose,
  onApply,
  applying,
}: {
  tmpl: GalleryTemplate;
  onClose: () => void;
  onApply: (t: GalleryTemplate) => void;
  applying: boolean;
}) {
  const color = TYPE_COLOR[tmpl.type] ?? "var(--primary)";
  const icon = TYPE_ICON[tmpl.type] ?? "layers";
  const singleton = isSingleton(tmpl.type);
  const builderHref = BUILDER_HREF[tmpl.type];
  const canApplyDirectly = singleton;
  const isPremiumUnowned = tmpl.tier === "premium" && !tmpl.owned && !tmpl.included;

  // Theme tokens from templates.theme (display-only)
  const theme = tmpl.theme ?? {};
  const themeTokens = Object.entries(theme).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="tg-modal-backdrop" onClick={onClose}>
      <div className="tg-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tg-modal-close" onClick={onClose} aria-label="Close">
          <Icon name="eye" size={16} />
          &times;
        </button>

        {/* Thumbnail */}
        {tmpl.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tmpl.thumbnail_url} alt={tmpl.name} className="tg-modal-thumb" />
        ) : (
          <div
            className="tg-modal-thumb tg-modal-thumb-ph"
            style={{ background: `color-mix(in srgb, ${color} 18%, var(--surface2))`, color }}
          >
            <Icon name={icon} size={48} />
          </div>
        )}

        {/* Meta */}
        <div className="tg-modal-body">
          <div className="tg-modal-row">
            <h2 className="tg-modal-title">{tmpl.name}</h2>
            <span className="tg-type-badge" style={{ background: `color-mix(in srgb, ${color} 16%, var(--surface2))`, color }}>
              {TYPE_LABELS[tmpl.type] ?? tmpl.type}
            </span>
          </div>

          {tmpl.description && (
            <p className="tg-modal-desc">{tmpl.description}</p>
          )}

          {/* Badges */}
          <div className="tg-modal-badges">
            {tmpl.tier === "free" ? <FreeBadge /> : <PremiumBadge />}
            {(tmpl.owned || tmpl.included) && <OwnedBadge included={tmpl.included} />}
            {tmpl.tier === "premium" && !tmpl.owned && !tmpl.included && (
              <>
                <span className="tg-badge tg-badge-price">{fmtPrice(tmpl.price_paise)}</span>
                {tmpl.license_model === "per_page" && (
                  <span className="tg-badge tg-badge-perpage">per page</span>
                )}
              </>
            )}
          </div>

          {/* Tags */}
          {tmpl.tags.length > 0 && (
            <div className="tg-tags">
              {tmpl.tags.map((tag) => (
                <span key={tag} className="tg-tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Theme tokens summary */}
          {themeTokens.length > 0 && (
            <div className="tg-theme-summary">
              <div className="tg-theme-label">Theme tokens</div>
              <div className="tg-theme-tokens">
                {themeTokens.slice(0, 8).map(([k, v]) => (
                  <span key={k} className="tg-theme-token">
                    <b>{k}:</b> {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="tg-modal-stats">
            <span>{tmpl.sales_count.toLocaleString("en-IN")} applied</span>
            <span>{tmpl.license_model.replace("_", " ")}</span>
          </div>

          {/* Action */}
          <div className="tg-modal-actions">
            {canApplyDirectly ? (
              isPremiumUnowned ? (
                <button
                  className="btn grad"
                  onClick={() => onApply(tmpl)}
                  disabled={applying}
                >
                  {applying ? "Processing..." : `Buy & Apply — ${fmtPrice(tmpl.price_paise)}`}
                </button>
              ) : (
                <button
                  className="btn grad"
                  onClick={() => onApply(tmpl)}
                  disabled={applying}
                >
                  {applying ? "Applying..." : "Apply template"}
                </button>
              )
            ) : builderHref ? (
              <a href={builderHref} className="btn">
                Open in builder to apply
              </a>
            ) : null}
          </div>

          {/* Many-type notice */}
          {!canApplyDirectly && (
            <p className="tg-many-notice">
              {TYPE_LABELS[tmpl.type] ?? tmpl.type} templates are applied per-page inside the builder.
              Open the builder, then browse templates from the studio panel.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({
  tmpl,
  onPreview,
  onApply,
  applying,
}: {
  tmpl: GalleryTemplate;
  onPreview: (t: GalleryTemplate) => void;
  onApply: (t: GalleryTemplate) => void;
  applying: boolean;
}) {
  const color = TYPE_COLOR[tmpl.type] ?? "var(--primary)";
  const singleton = isSingleton(tmpl.type);
  const builderHref = BUILDER_HREF[tmpl.type];
  const isPremiumUnowned = tmpl.tier === "premium" && !tmpl.owned && !tmpl.included;

  return (
    <div className="tg-card">
      {/* Thumbnail */}
      <button className="tg-thumb-btn" onClick={() => onPreview(tmpl)} aria-label={`Preview ${tmpl.name}`}>
        <Thumbnail tmpl={tmpl} />
        <div className="tg-thumb-overlay">
          <Icon name="eye" size={20} />
          Preview
        </div>
      </button>

      {/* Card body */}
      <div className="tg-card-body">
        {/* Header row */}
        <div className="tg-card-header">
          <span
            className="tg-type-badge"
            style={{ background: `color-mix(in srgb, ${color} 16%, var(--surface2))`, color }}
          >
            {TYPE_LABELS[tmpl.type] ?? tmpl.type}
          </span>
          <div className="tg-card-badges">
            {tmpl.tier === "free" ? <FreeBadge /> : <PremiumBadge />}
            {(tmpl.owned || tmpl.included) && <OwnedBadge included={tmpl.included} />}
          </div>
        </div>

        <h3 className="tg-card-name">{tmpl.name}</h3>

        {/* Tags */}
        {tmpl.tags.length > 0 && (
          <div className="tg-tags">
            {tmpl.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tg-tag">{tag}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="tg-card-footer">
          <span className="tg-sales">{tmpl.sales_count.toLocaleString("en-IN")} applied</span>

          {singleton ? (
            isPremiumUnowned ? (
              <button
                className="btn btn-sm grad"
                onClick={() => onApply(tmpl)}
                disabled={applying}
              >
                {applying ? "..." : `Buy & Apply ${fmtPrice(tmpl.price_paise)}`}
                {tmpl.license_model === "per_page" && <span className="tg-perpage-note"> /pg</span>}
              </button>
            ) : (
              <button
                className="btn btn-sm"
                onClick={() => onApply(tmpl)}
                disabled={applying}
              >
                {applying ? "..." : "Apply"}
              </button>
            )
          ) : builderHref ? (
            <a href={builderHref} className="btn btn-sm">
              Open builder
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main Gallery ──────────────────────────────────────────────────────────────

export default function TemplateGallery({ templates }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filterType, setFilterType] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [preview, setPreview] = useState<GalleryTemplate | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  // Rail chooser state: shown when a premium-unowned template is clicked.
  const [railChooser, setRailChooser] = useState<RailChooserState>(null);
  const [railBusy, setRailBusy] = useState(false);
  const [rechargeMsg, setRechargeMsg] = useState<string | null>(null);

  // Derived filter options
  const allTypes = Array.from(new Set(templates.map((t) => t.type))).sort();
  const allTags = Array.from(new Set(templates.flatMap((t) => t.tags))).sort();

  const filtered = templates.filter((t) => {
    if (filterType && t.type !== filterType) return false;
    if (filterTag && !t.tags.includes(filterTag)) return false;
    return true;
  });

  const showToast = useCallback((msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Wallet rail ─────────────────────────────────────────────────────────────
  const handleWalletPurchase = useCallback(() => {
    if (!railChooser) return;
    const { tmpl, mapped } = railChooser;

    setRailBusy(true);
    setRechargeMsg(null);

    startTransition(async () => {
      try {
        const result = await startTemplatePurchase(tmpl.id, mapped, undefined, { rail: "wallet" });
        if (result.ok) {
          setRailChooser(null);
          showToast("Template purchased and applied! Opening builder...", "ok");
          router.push(result.redirect);
        } else if ("needsRecharge" in result && result.needsRecharge) {
          const balRs = result.balance != null ? fmtPrice(result.balance) : null;
          const priceRs = result.price_paise != null ? fmtPrice(result.price_paise) : "";
          setRechargeMsg(
            `Wallet balance${balRs ? ` (${balRs})` : ""} is too low for ${priceRs}.`,
          );
        } else {
          showToast(result.error ?? "Purchase failed. Please try again.", "err");
          setRailChooser(null);
        }
      } catch (err) {
        showToast(String(err instanceof Error ? err.message : err), "err");
        setRailChooser(null);
      } finally {
        setRailBusy(false);
      }
    });
  }, [railChooser, router, showToast]);

  // ── Razorpay rail ────────────────────────────────────────────────────────────
  const handleRazorpayPurchase = useCallback(async () => {
    if (!railChooser) return;
    const { tmpl, mapped } = railChooser;

    setRailBusy(true);
    setRechargeMsg(null);

    if (!(await loadRazorpay())) {
      setRailBusy(false);
      showToast("Couldn't load the payment library. Check your connection.", "err");
      return;
    }

    try {
      const startRes = await fetch("/api/templates/buy/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: tmpl.id,
          page_type: mapped,
          target_page_id: undefined,
        }),
      });
      const start = await startRes.json();

      if (!startRes.ok) {
        throw new Error(start.error || "Couldn't start payment.");
      }

      // already_owned: this can happen if the license was granted between the
      // user opening the chooser and clicking Pay. Just apply directly.
      if (start.already) {
        setRailChooser(null);
        setRailBusy(false);
        // Trigger normal apply flow.
        setApplyingId(tmpl.id);
        startTransition(async () => {
          try {
            const result = await (await import("./actions")).applyTemplate(tmpl.id, { pageType: mapped });
            if (result.ok) {
              showToast("Template applied! Opening builder...", "ok");
              router.push(result.redirect);
            } else {
              showToast((result as { error: string }).error ?? "Failed to apply.", "err");
            }
          } finally {
            setApplyingId(null);
          }
        });
        return;
      }

      const chargedRupees = Math.round((start.amount as number) / 100).toLocaleString("en-IN");

      const rzp = new window.Razorpay!({
        key: start.key_id,
        order_id: start.razorpay_order_id,
        amount: start.amount,
        currency: start.currency,
        name: "invoxai",
        description: `${start.template_name} template — ₹${chargedRupees}`,
        theme: { color: "#FF6A3D" },
        modal: {
          ondismiss: () => {
            setRailBusy(false);
          },
        },
        handler: async (resp: Record<string, string>) => {
          try {
            const vRes = await fetch("/api/templates/buy/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            const v = await vRes.json();

            if (!vRes.ok || !v.ok) {
              throw new Error(v.error || "Verification failed");
            }

            setRailChooser(null);
            showToast("Template purchased and applied! Opening builder...", "ok");
            router.push(v.redirect);
          } catch (e) {
            showToast(e instanceof Error ? e.message : "Verification failed", "err");
          } finally {
            setRailBusy(false);
          }
        },
      });
      rzp.open();
    } catch (e) {
      setRailBusy(false);
      showToast(e instanceof Error ? e.message : "Payment failed", "err");
      setRailChooser(null);
    }
  }, [railChooser, router, showToast]);

  // ── Main apply handler ───────────────────────────────────────────────────────
  const handleApply = useCallback(
    (tmpl: GalleryTemplate) => {
      const mapped = TYPE_TO_PAGE[tmpl.type as TemplateType];
      if (!mapped) {
        showToast("This template type cannot be applied directly.", "err");
        return;
      }

      const isPremiumUnowned = tmpl.tier === "premium" && !tmpl.owned && !tmpl.included;

      if (preview?.id === tmpl.id) setPreview(null);

      if (isPremiumUnowned) {
        // Open the rail chooser instead of immediately purchasing.
        setRechargeMsg(null);
        setRailChooser({ tmpl, mapped: mapped as PageTypeEnum });
        return;
      }

      // Free or owned: call apply action directly.
      setApplyingId(tmpl.id);
      startTransition(async () => {
        try {
          const result = await applyTemplate(tmpl.id, { pageType: mapped as PageTypeEnum });
          if (result.ok) {
            showToast("Template applied! Opening builder...", "ok");
            router.push(result.redirect);
          } else {
            showToast((result as { error: string }).error ?? "Failed to apply template.", "err");
          }
        } catch (err) {
          showToast(String(err instanceof Error ? err.message : err), "err");
        } finally {
          setApplyingId(null);
        }
      });
    },
    [preview, router, showToast],
  );

  return (
    <>
      <style>{`
        /* ── Gallery grid + filter bar ──────────────────────── */
        .tg-filter {
          display: flex; gap: 10px; flex-wrap: wrap;
          margin-bottom: 22px; align-items: center;
        }
        .tg-filter select {
          height: 36px; padding: 0 10px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--surface2);
          color: var(--text); font-size: 13px; cursor: pointer;
          min-width: 140px;
        }
        .tg-filter-clear {
          background: none; border: none; color: var(--muted);
          font-size: 13px; cursor: pointer; padding: 4px 6px;
          text-decoration: underline;
        }
        .tg-count { font-size: 13px; color: var(--muted); margin-left: auto; }

        .tg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 18px;
        }
        @media (max-width: 500px) { .tg-grid { grid-template-columns: 1fr 1fr; gap: 12px; } }

        /* ── Template card ──────────────────────────────────── */
        .tg-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
          display: flex; flex-direction: column;
          transition: box-shadow 0.18s, transform 0.18s;
        }
        .tg-card:hover {
          box-shadow: 0 6px 24px color-mix(in srgb, var(--primary) 12%, transparent);
          transform: translateY(-2px);
        }

        /* ── Thumbnail ──────────────────────────────────────── */
        .tg-thumb-btn {
          background: none; border: none; padding: 0; cursor: pointer;
          display: block; width: 100%; position: relative;
        }
        .tg-thumb {
          width: 100%; aspect-ratio: 16/9; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: var(--surface2);
        }
        .tg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .tg-thumb-placeholder {
          flex-direction: column; gap: 8px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase;
        }
        .tg-thumb-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.45);
          color: #fff; font-size: 13px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          opacity: 0; transition: opacity 0.18s;
        }
        .tg-thumb-btn:hover .tg-thumb-overlay,
        .tg-thumb-btn:focus-visible .tg-thumb-overlay { opacity: 1; }

        /* ── Card body ──────────────────────────────────────── */
        .tg-card-body {
          padding: 13px 14px 14px; display: flex; flex-direction: column; gap: 8px; flex: 1;
        }
        .tg-card-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .tg-card-badges { display: flex; gap: 4px; flex-wrap: wrap; }
        .tg-card-name { font-size: 14px; font-weight: 700; margin: 0; line-height: 1.3; }
        .tg-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 6px; }
        .tg-sales { font-size: 11.5px; color: var(--muted); }
        .tg-perpage-note { font-size: 10px; opacity: 0.75; }

        /* ── Type badge ─────────────────────────────────────── */
        .tg-type-badge {
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em;
          text-transform: uppercase; padding: 2px 7px; border-radius: 20px;
          white-space: nowrap;
        }

        /* ── Tier/owned badges ──────────────────────────────── */
        .tg-badge {
          font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .tg-badge-free    { background: color-mix(in srgb, var(--green) 18%, var(--surface2)); color: var(--green); }
        .tg-badge-prem    { background: color-mix(in srgb, var(--gold) 20%, var(--surface2)); color: var(--gold); }
        .tg-badge-owned   { background: color-mix(in srgb, var(--primary) 18%, var(--surface2)); color: var(--primary); }
        .tg-badge-price   { background: color-mix(in srgb, var(--gold) 14%, var(--surface2)); color: var(--gold); font-size: 11px; }
        .tg-badge-perpage { background: color-mix(in srgb, var(--muted) 14%, var(--surface2)); color: var(--muted); font-size: 10px; }

        /* ── Tags ───────────────────────────────────────────── */
        .tg-tags { display: flex; gap: 4px; flex-wrap: wrap; }
        .tg-tag {
          font-size: 10.5px; padding: 1px 7px; border-radius: 8px;
          background: var(--surface2); color: var(--muted); border: 1px solid var(--border);
        }

        /* ── Button size variant ────────────────────────────── */
        .btn-sm { font-size: 12px; padding: 5px 12px; height: auto; min-height: unset; }

        /* ── Preview modal ──────────────────────────────────── */
        .tg-modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1000;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .tg-modal {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 18px; width: 100%; max-width: 520px; max-height: 90vh;
          overflow-y: auto; position: relative; box-shadow: 0 24px 64px rgba(0,0,0,0.28);
        }
        .tg-rail-modal { max-width: 400px; }
        .tg-modal-close {
          position: absolute; top: 12px; right: 12px; z-index: 2;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 8px; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--muted); font-size: 18px; font-weight: 700;
          line-height: 1; transition: color 0.15s;
        }
        .tg-modal-close:hover { color: var(--text); }
        .tg-modal-thumb {
          width: 100%; aspect-ratio: 16/9; object-fit: cover;
          border-radius: 18px 18px 0 0; display: block;
        }
        .tg-modal-thumb-ph {
          width: 100%; aspect-ratio: 16/9;
          display: flex; align-items: center; justify-content: center;
          border-radius: 18px 18px 0 0;
        }
        .tg-modal-body { padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 12px; }
        .tg-modal-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .tg-modal-title { font-size: 19px; font-weight: 800; margin: 0; line-height: 1.2; }
        .tg-modal-desc { font-size: 13.5px; color: var(--muted); margin: 0; line-height: 1.5; }
        .tg-modal-badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .tg-modal-stats {
          display: flex; gap: 14px; font-size: 12px; color: var(--muted);
          padding-top: 8px; border-top: 1px solid var(--border);
        }
        .tg-modal-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .tg-modal-actions .btn { flex: 1; text-align: center; justify-content: center; }
        .tg-many-notice {
          font-size: 12.5px; color: var(--muted); margin: 0;
          padding: 10px 12px; background: var(--surface2);
          border-radius: 8px; border: 1px solid var(--border); line-height: 1.5;
        }

        /* ── Rail chooser ───────────────────────────────────── */
        .tg-rail-btns { display: flex; flex-direction: column; gap: 10px; }
        .tg-rail-btn { width: 100%; justify-content: center; text-align: center; }
        .tg-recharge-msg {
          font-size: 13px; color: #e44; background: color-mix(in srgb, #f55 10%, var(--surface2));
          border: 1px solid color-mix(in srgb, #f55 30%, var(--border));
          border-radius: 8px; padding: 10px 12px; line-height: 1.5;
        }
        .tg-recharge-link {
          color: var(--primary); font-weight: 600; text-decoration: underline;
        }

        /* ── Theme summary ──────────────────────────────────── */
        .tg-theme-summary { background: var(--surface2); border-radius: 10px; padding: 10px 12px; }
        .tg-theme-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .tg-theme-tokens { display: flex; flex-wrap: wrap; gap: 5px; }
        .tg-theme-token { font-size: 11.5px; color: var(--text); }
        .tg-theme-token b { color: var(--muted); font-weight: 600; }

        /* ── Empty state ────────────────────────────────────── */
        .tg-empty { text-align: center; padding: 60px 20px; color: var(--muted); font-size: 14px; }
        .tg-empty b { display: block; font-size: 17px; color: var(--text); margin-bottom: 6px; font-weight: 700; }

        /* ── Toast ──────────────────────────────────────────── */
        .tg-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          z-index: 2000; background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 12px 18px; font-size: 13.5px; font-weight: 600;
          box-shadow: 0 8px 32px rgba(0,0,0,0.22);
          display: flex; align-items: center; gap: 8px; white-space: nowrap;
          animation: tg-toast-in 0.2s ease;
        }
        .tg-toast.ok { border-color: var(--green); color: var(--green); }
        .tg-toast.err { border-color: color-mix(in srgb, #f55 50%, var(--border)); color: #e44; }
        @keyframes tg-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`tg-toast ${toast.kind}`}>
          {toast.kind === "ok" ? "+" : "!"} {toast.msg}
        </div>
      )}

      {/* Rail chooser modal */}
      {railChooser && (
        <RailChooserModal
          tmpl={railChooser.tmpl}
          onClose={() => {
            if (!railBusy) {
              setRailChooser(null);
              setRechargeMsg(null);
            }
          }}
          onWallet={handleWalletPurchase}
          onRazorpay={handleRazorpayPurchase}
          busy={railBusy || isPending}
          rechargeMsg={rechargeMsg}
        />
      )}

      {/* Filter bar */}
      <div className="tg-filter">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {allTypes.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>

        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          aria-label="Filter by tag"
          disabled={allTags.length === 0}
        >
          <option value="">All tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        {(filterType || filterTag) && (
          <button
            className="tg-filter-clear"
            onClick={() => { setFilterType(""); setFilterTag(""); }}
          >
            Clear filters
          </button>
        )}

        <span className="tg-count">
          {filtered.length} template{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="tg-empty">
          <b>No templates found</b>
          {filterType || filterTag ? "Try removing filters or check back later." : "No published templates yet."}
        </div>
      ) : (
        <div className="tg-grid">
          {filtered.map((tmpl) => (
            <TemplateCard
              key={tmpl.id}
              tmpl={tmpl}
              onPreview={setPreview}
              onApply={handleApply}
              applying={isPending && applyingId === tmpl.id}
            />
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <PreviewModal
          tmpl={preview}
          onClose={() => setPreview(null)}
          onApply={handleApply}
          applying={isPending && applyingId === preview.id}
        />
      )}
    </>
  );
}
