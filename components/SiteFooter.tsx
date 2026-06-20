"use client";

/**
 * SiteFooter — reusable public-facing footer.
 *
 * Theming: consumes CSS custom properties (var(--text) / var(--muted) /
 * var(--bg) / var(--primary) / var(--border)) so it adapts to whichever
 * component wraps it (CourseView uses .cu variables; the marketing landing
 * and store each set their own tokens).  Where none are set it falls back
 * to safe neutral values via the inline fallback syntax.
 *
 * Layout: constrained centered column on ≥768 px (3-column link grid),
 * stacked single-column on mobile.
 */

const FOOTER_CSS = `
.sf-root {
  border-top: 1px solid var(--border, #e5e7eb);
  padding: 48px 24px 32px;
  background: var(--bg, #f9fafb);
  color: var(--muted, #6b7280);
  font-size: 13.5px;
  line-height: 1.6;
}
.sf-inner {
  max-width: 1080px;
  margin: 0 auto;
}
.sf-top {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  gap: 32px 24px;
}
.sf-brand-col {}
.sf-brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--fh, var(--font-heading, inherit));
  font-weight: 800;
  font-size: 18px;
  color: var(--text, #111827);
  text-decoration: none;
  letter-spacing: -.02em;
}
.sf-logo-dot {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--grad, var(--brand-gradient, linear-gradient(135deg,#ff6a3d,#ff4d7d 60%,#7b3fe4)));
  flex: none;
  display: inline-block;
}
.sf-tagline {
  margin-top: 12px;
  font-size: 13px;
  max-width: 26em;
  color: var(--muted, #6b7280);
}
.sf-col h5 {
  font-family: var(--fh, var(--font-heading, inherit));
  font-weight: 700;
  font-size: 12.5px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--text, #111827);
  margin: 0 0 13px;
}
.sf-col a, .sf-col span.sf-na {
  display: block;
  padding: 4px 0;
  color: var(--muted, #6b7280);
  text-decoration: none;
  font-size: 13.5px;
  transition: color .14s;
}
.sf-col a:hover { color: var(--primary, #ff6a3d); }
.sf-col span.sf-na { opacity: .5; cursor: default; }
.sf-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 40px;
  padding-top: 22px;
  border-top: 1px solid var(--border, #e5e7eb);
  font-size: 12.5px;
  color: var(--muted, #6b7280);
}
.sf-bottom a { color: inherit; text-decoration: underline; }
.sf-bottom a:hover { color: var(--primary, #ff6a3d); }
.sf-powered { opacity: .7; }

@media (max-width: 760px) {
  .sf-top { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .sf-top { grid-template-columns: 1fr; }
  .sf-root { padding: 36px 20px 28px; }
}
`;

export type SiteFooterProps = {
  /** Store / course / brand name to show as sub-brand. If omitted only the invoxai brand shows. */
  brandName?: string;
  /** Contact email to render in the Legal column. Defaults to iamdeep.mk@gmail.com */
  contactEmail?: string;
  /** Extra CSS class on the root element (e.g. to scope within a theme wrapper) */
  className?: string;
};

export default function SiteFooter({
  brandName,
  contactEmail = "iamdeep.mk@gmail.com",
  className = "",
}: SiteFooterProps) {
  const year = 2026;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FOOTER_CSS }} />
      <footer className={`sf-root${className ? ` ${className}` : ""}`} aria-label="Site footer">
        <div className="sf-inner">
          <div className="sf-top">
            {/* Brand col */}
            <div className="sf-brand-col">
              <a href="/" className="sf-brand">
                <span className="sf-logo-dot" aria-hidden="true" />
                {brandName ? brandName : "invoxai"}
              </a>
              {brandName ? (
                <p className="sf-tagline">
                  Powered by invoxai — sell anything on your own domain.
                </p>
              ) : (
                <p className="sf-tagline">
                  The all-in-one platform to sell on your own domain.
                  India-first, built for the world.
                </p>
              )}
            </div>

            {/* Product */}
            <div className="sf-col">
              <h5>Product</h5>
              <a href="/#surfaces">Page builders</a>
              <a href="/#types">Page types</a>
              <a href="/#features">Payments</a>
              <a href="/#pricing">Pricing</a>
              <a href="/onboarding">Get started</a>
            </div>

            {/* Company */}
            <div className="sf-col">
              <h5>Company</h5>
              <span className="sf-na">About</span>
              <span className="sf-na">Help center</span>
              <span className="sf-na">Status</span>
              <a href="/contact">Contact</a>
            </div>

            {/* Legal */}
            <div className="sf-col">
              <h5>Legal</h5>
              <a href="/privacy">Privacy policy</a>
              <a href="/terms">Terms of service</a>
              <a href="/refund">Refund policy</a>
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </div>
          </div>

          <div className="sf-bottom">
            <span>© {year} {brandName ? `${brandName} · Powered by ` : ""}<a href="https://invoxai.io">invoxai.io</a></span>
            <span className="sf-powered">
              <a href="/privacy">Privacy</a>
              {" · "}
              <a href="/terms">Terms</a>
              {" · "}
              <a href="/refund">Refund</a>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
