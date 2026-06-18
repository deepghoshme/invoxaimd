import { type BioTheme } from "@/lib/bioThemes";

/**
 * Small, modern floating "Built with InvoxAI" brand chip, pinned bottom-right of
 * public pages. Positioning + the lift above the mobile CTA bar (.has-cta) live in
 * CSS (.brand-badge); colors are passed in so the glass adapts to the active theme
 * (light themes → light glass + dark text, dark themes → dark glass + light text).
 */

/** hex → translucent rgba, so the glass tints to the theme's card color. */
function glass(hex: string, a = 0.72): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(255,255,255,${a})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function BrandBadge({ theme }: { theme?: BioTheme }) {
  const card = theme?.card ?? "#FFFFFF";
  const border = theme?.cardBorder ?? "rgba(255,255,255,0.6)";
  const muted = theme?.muted ?? "#7A6770";

  return (
    <a
      className="brand-badge"
      href="https://invoxai.io"
      target="_blank"
      rel="noreferrer"
      aria-label="Built with InvoxAI"
      style={{ background: glass(card), borderColor: border }}
    >
      <span className="brand-badge-mark">
        <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden>
          <path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="#fff" />
        </svg>
      </span>
      <span className="brand-badge-prefix" style={{ color: muted }}>
        Built with
      </span>
      <span className="brand-badge-text">InvoxAI</span>
    </a>
  );
}
