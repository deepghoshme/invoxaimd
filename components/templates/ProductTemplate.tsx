import {
  type OppContent,
  formatPrice,
  toMinorUnit,
  PAYMENT_BRANDS,
  DEFAULT_CURRENCY,
} from "@/lib/products";
import ImageSlider from "@/components/checkout/ImageSlider";
import CountdownTimer from "@/components/checkout/CountdownTimer";
import LiveProof from "@/components/checkout/LiveProof";
import InlineCheckout from "@/components/checkout/InlineCheckout";
import BuyBar from "@/components/checkout/BuyBar";
import FooterPolicies from "@/components/checkout/FooterPolicies";
import PDPTemplate from "@/components/templates/PDPTemplate";
import { resolveOppTheme } from "@/lib/oppTheme";
import { sanitizeHtml } from "@/lib/sanitize";

function Stars({ n }: { n: number }) {
  const r = Math.max(0, Math.min(5, Math.round(n)));
  return <span className="prod-stars" aria-label={`${r} of 5`}>{"★★★★★".slice(0, r)}{"☆☆☆☆☆".slice(0, 5 - r)}</span>;
}

/**
 * Public one-page product (opp), SuperProfile-style. Desktop: two columns —
 * left ≈65% product content (white), right ≈35% sticky checkout panel (blue,
 * hex pattern) with the on-page checkout form. Mobile: the checkout panel moves
 * to the top, then the content stacks below.
 */
export default function ProductTemplate({
  content,
  pageId,
  fallbackTitle,
  payEnabled,
  showBrand = true,
  preview = false,
  forceMobile = false,
  sold = 0,
  storeName = "Store",
}: {
  content: OppContent;
  pageId: string;
  fallbackTitle?: string;
  payEnabled: boolean;
  showBrand?: boolean;
  preview?: boolean;
  forceMobile?: boolean;
  sold?: number;
  storeName?: string;
}) {
  // Catalog product-detail layout → delegate to PDPTemplate (reuses checkout).
  if (content.layout === "pdp") {
    return <PDPTemplate content={content} pageId={pageId} fallbackTitle={fallbackTitle} payEnabled={payEnabled} showBrand={showBrand} preview={preview} storeName={storeName} sold={sold} />;
  }
  const currency = (content.currency || DEFAULT_CURRENCY).toUpperCase();
  const title = content.headline || fallbackTitle || "Product";
  const price = content.price ?? 0;
  const hasPrice = price > 0;
  const compareAt = content.compare_at_price ?? 0;
  const hasDiscount = compareAt > price && price > 0;
  const pctOff = hasDiscount ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const amount = toMinorUnit(price, currency);

  const gallery = (content.gallery ?? []).filter(Boolean);
  const heroImage = content.image_url || gallery[0];
  const featureItems = (
    content.feature_items?.length
      ? content.feature_items
      : (content.features ?? []).map((t) => ({ text: t, icon: undefined }))
  ).filter((f) => f.text?.trim());
  const badges = (content.badges ?? []).filter(Boolean);
  const testimonials = (content.testimonials ?? []).filter((t) => t?.text);
  const faqs = (content.faqs ?? []).filter((f) => f?.q);
  const policies = content.policies ?? {};
  const policyItems = [
    { key: "privacy", label: "Privacy Policy", body: policies.privacy },
    { key: "terms", label: "Terms & Conditions", body: policies.terms },
    { key: "refund", label: "Refund Policy", body: policies.refund },
  ].filter((p) => p.body && p.body.trim());
  const showLogos = content.show_payment_logos !== false;
  const payIcons = (content.payment_icons ?? []).filter(Boolean);
  const titleAlign = content.title_align ?? "left";
  const autoplay = !!content.gallery_autoplay;
  const intervalMs = Math.max(1.5, content.gallery_interval ?? 4) * 1000;

  // Urgency
  const cdEnd = content.countdown_enabled && content.countdown_end ? new Date(content.countdown_end).getTime() : 0;
  const seatsTotal = content.seats_enabled ? content.seats_total ?? 0 : 0;
  const seatsLeft = Math.max(0, seatsTotal - sold);
  const soldOut = content.seats_enabled && seatsTotal > 0 && seatsLeft <= 0;
  const cdAlign = content.countdown_align ?? "left";
  // When the seller chose to lock purchases after the countdown ends, disable
  // the buy action once the deadline has passed (server-rendered, same time
  // source as the expired-countdown message below — no hydration mismatch).
  const buyDisabled = !!content.countdown_disable_buy && cdEnd > 0 && cdEnd < Date.now();

  // Sold-out → contact button (custom URL/label/icon, else WhatsApp, else email)
  const waNum = (content.contact_whatsapp || "").replace(/[^0-9]/g, "");
  const contactHref =
    content.contact_url?.trim() || (waNum ? `https://wa.me/${waNum}` : content.contact_email ? `mailto:${content.contact_email}` : null);
  const contactLabel = content.contact_label?.trim() || (waNum ? "Contact on WhatsApp" : "Contact seller");
  const contactIcon = content.contact_icon?.trim() || (waNum ? "💬" : "✉️");

  const ctaLabel = content.cta_label || "BUY NOW";

  // Page theme (accent / dark / font / width / background)
  const th = resolveOppTheme(content.theme);
  const themeStyle: React.CSSProperties = {
    ["--color-primary" as string]: th.solid,
    ["--brand-gradient" as string]: th.gradient,
    ...(th.fontFam ? { ["--font-heading" as string]: th.fontFam, ["--font-sora" as string]: th.fontFam } : {}),
  };
  const cardStyle: React.CSSProperties = th.widthPx ? { maxWidth: th.widthPx } : {};

  const purchase = soldOut ? (
    contactHref ? (
      <a className="btn co-buy" href={contactHref} target="_blank" rel="noreferrer">
        {contactIcon} {contactLabel}
      </a>
    ) : (
      <button className="btn co-buy" disabled>Sold Out</button>
    )
  ) : buyDisabled ? (
    <button className="btn co-buy" disabled>
      {content.countdown_expire_msg || "This offer has ended."}
    </button>
  ) : (
    /* Web only: embedded checkout form (hidden on mobile via .co-web) */
    <div className="co-web">
      <InlineCheckout
        pageId={pageId}
        amount={amount}
        currency={currency}
        storeName={storeName}
        productTitle={title}
        ctaLabel={ctaLabel}
        payEnabled={payEnabled}
        preview={preview}
      />
    </div>
  );

  return (
    <main className={`prod-page2${forceMobile ? " force-mobile" : ""}${th.dark ? " prod-dark" : ""}`} style={themeStyle}>
      {th.googleHref && <link rel="stylesheet" href={th.googleHref} />}
      {th.bg !== "none" && (
        <div className={`aurora bg-${th.bg}`} aria-hidden>
          <span className="aurora-blob b1" />
          <span className="aurora-blob b2" />
          <span className="aurora-blob b3" />
          <span className="aurora-blob b4" />
        </div>
      )}

      {/* Mobile-only sticky top announcement strip — carries the countdown */}
      {content.countdown_enabled && content.countdown_end && (
        <div className="prod2-strip">
          <CountdownTimer endIso={content.countdown_end} expireMsg={content.countdown_expire_msg} />
        </div>
      )}

      <div className="prod2-card" style={cardStyle}>
      <div className="prod2">
        <header className="prod2-head" style={{ textAlign: titleAlign }}>
          <h1 className="prod2-title">
            {content.title_icon && <span className="prod-title-ico">{content.title_icon}</span>}
            {title}
          </h1>
          {content.subheadline && <p className="prod2-subtitle">{content.subheadline}</p>}
        </header>

        {/* Mobile-only hero image — shows right after the title, before the urgency panel */}
        {heroImage && (
          <div className="prod2-imgm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt={title} />
          </div>
        )}

        {/* LEFT — product content */}
        <div className="prod2-left">
          {heroImage && (
            <div className="prod2-banner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt={title} />
            </div>
          )}

          {(content.description_html || content.description || featureItems.length > 0) && (
            <section className="prod2-section">
              <h2 className="prod2-h2">Description</h2>
              {content.description_html ? (
                <div className="prod-desc rte-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.description_html) }} />
              ) : (
                content.description && <p className="prod-desc">{content.description}</p>
              )}
              {featureItems.length > 0 && (
                <ul className="prod-features">
                  {featureItems.map((f, i) => (
                    <li key={i}>
                      <span className="prod-tick">{f.icon?.trim() || "✓"}</span>
                      {f.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {gallery.length > 0 && (
            <section className="prod2-section">
              <h2 className="prod2-h2">Gallery</h2>
              <div className="prod-slider-wrap">
                <ImageSlider images={gallery} alt={title} autoplay={autoplay} intervalMs={intervalMs} />
              </div>
            </section>
          )}

          {testimonials.length > 0 && (
            <section className="prod2-section">
              <h2 className="prod2-h2">Testimonials</h2>
              <div className="prod-testis grid2">
                {testimonials.map((t, i) => (
                  <figure className="prod-testi" key={i}>
                    {typeof t.rating === "number" && t.rating > 0 && <Stars n={t.rating} />}
                    <blockquote>{t.text}</blockquote>
                    <figcaption>
                      {t.avatar_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="prod-testi-av" src={t.avatar_url} alt="" />
                      )}
                      <span>{t.name || "Happy customer"}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {faqs.length > 0 && (
            <section className="prod2-section">
              <h2 className="prod2-h2">Frequently Asked Questions (FAQs)</h2>
              <div className="prod-faqs">
                {faqs.map((f, i) => (
                  <details className="prod-faq" key={i}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <footer className="prod-footer">
            {payIcons.length > 0 && (
              <div className="prod-pay-icons">
                {payIcons.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="pay-icon" key={i} src={src} alt="" />
                ))}
              </div>
            )}
            {showLogos && (
              <div className="prod-pay-logos">
                {PAYMENT_BRANDS.map((b) => <span className="pay-logo" key={b}>{b}</span>)}
              </div>
            )}
            {(content.seller_email || content.seller_phone) && (
              <p className="prod-contact muted">
                Contact: {content.seller_email}
                {content.seller_email && content.seller_phone ? " · " : ""}
                {content.seller_phone}
              </p>
            )}
            {policyItems.length > 0 && <FooterPolicies items={policyItems} />}
            {showBrand && (
              <p className="prod-powered">
                Powered by{" "}
                <a href="https://invoxai.io" target="_blank" rel="noreferrer"><strong>InvoxAI</strong></a>
              </p>
            )}
          </footer>
        </div>

        {/* RIGHT — sticky checkout panel (web). Mobile shows only urgency. */}
        <aside
          className={`prod2-right${
            (content.seats_enabled && seatsTotal > 0) || badges.length > 0 || (cdEnd > 0 && cdEnd < Date.now())
              ? ""
              : " no-mob"
          }`}
          id="prod-checkout"
        >
          <div className="prod2-right-inner">
            {content.countdown_enabled && content.countdown_end && (
              <div className={`prod2-urgency cd-align-${cdAlign}`}>
                <CountdownTimer endIso={content.countdown_end} expireMsg={content.countdown_expire_msg} />
              </div>
            )}
            {content.seats_enabled && seatsTotal > 0 && (
              <div className={`seats-mini on-blue${soldOut ? " out" : ""}`}>
                {soldOut ? <span>Sold out</span> : (
                  <>
                    <span className="seats-mini-label">🔥 Only {seatsLeft} left</span>
                    <div className="seats-bar"><div className="seats-fill" style={{ width: `${Math.min(100, (seatsLeft / seatsTotal) * 100)}%` }} /></div>
                  </>
                )}
              </div>
            )}
            {badges.length > 0 && (
              <div className="prod-badges on-blue">
                {badges.map((b, i) => (
                  <span className="prod-badge" key={i}><span className="prod-badge-ico">✓</span>{b}</span>
                ))}
              </div>
            )}
            {hasPrice && cdEnd > 0 && cdEnd < Date.now() && (
              <div className="cd-expired" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                {content.countdown_expire_msg || "This offer has ended."}
              </div>
            )}
            {purchase}
          </div>
        </aside>
      </div>
      </div>

      {content.liveproof_enabled && !preview && (
        <LiveProof items={content.liveproof_items} intervalSec={content.liveproof_interval} product={title} />
      )}

      {/* Fixed bottom buy bar — same design web + mobile, shows price + offer + % off.
          Web scrolls to the inline form; mobile creates the order (form is hidden). */}
      {!preview && !soldOut && !buyDisabled && hasPrice && content.sticky_buy !== false && (
        <>
          <div className="float-web">
            <BuyBar label={ctaLabel} priceText={formatPrice(price, currency)} compareText={hasDiscount ? formatPrice(compareAt, currency) : undefined} off={pctOff} mode="scroll" targetId="prod-checkout" reveal />
          </div>
          <div className="float-mobile">
            <BuyBar label={ctaLabel} priceText={formatPrice(price, currency)} compareText={hasDiscount ? formatPrice(compareAt, currency) : undefined} off={pctOff} mode="order" pageId={pageId} />
          </div>
        </>
      )}
    </main>
  );
}
