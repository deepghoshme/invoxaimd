/**
 * Small, modern floating invoxai brand chip, pinned bottom-right of public pages.
 * Positioning + styling live in CSS (.brand-badge) so it can auto-lift above the
 * mobile CTA bar (.has-cta) and stay contained to the editor preview frame.
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
      <span className="brand-badge-mark">
        <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden>
          <path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#fff" />
        </svg>
      </span>
      <span className="brand-badge-text">invoxai</span>
    </a>
  );
}
