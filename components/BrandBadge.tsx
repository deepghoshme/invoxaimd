/**
 * Small floating invoxai brand button, pinned bottom-right of public pages.
 * Positioning lives in CSS (.brand-badge) so it can auto-lift above the mobile
 * CTA bar when one is present (.has-cta). In the editor preview it is contained
 * to the device frame (the frame uses a CSS transform).
 */
export default function BrandBadge() {
  return (
    <a
      className="brand-badge"
      href="https://invoxai.io"
      target="_blank"
      rel="noreferrer"
      aria-label="Built with invoxai.io"
    >
      <span className="brand-badge-dot" />
      invoxai
    </a>
  );
}
