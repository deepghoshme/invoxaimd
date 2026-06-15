import type { CSSProperties } from "react";

/** Known social platforms (brand color + simple glyph). "custom" = user image. */
export const SOCIAL_PLATFORMS: { id: string; name: string; color: string }[] = [
  { id: "instagram", name: "Instagram", color: "#E1306C" },
  { id: "youtube", name: "YouTube", color: "#FF0000" },
  { id: "facebook", name: "Facebook", color: "#1877F2" },
  { id: "x", name: "X / Twitter", color: "#000000" },
  { id: "tiktok", name: "TikTok", color: "#000000" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
  { id: "whatsapp", name: "WhatsApp", color: "#25D366" },
  { id: "telegram", name: "Telegram", color: "#229ED9" },
  { id: "github", name: "GitHub", color: "#181717" },
  { id: "email", name: "Email", color: "#6A6A6A" },
  { id: "website", name: "Website", color: "#7B3FE4" },
];

function Glyph({ id }: { id: string }) {
  const stroke = { fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "instagram":
      return (
        <g {...stroke}>
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="16.5" cy="7.5" r="0.6" fill="#fff" stroke="none" />
        </g>
      );
    case "youtube":
      return (
        <g>
          <rect x="3" y="6" width="18" height="12" rx="4" fill="#fff" />
          <path d="M11 9.2v5.6l4-2.8z" fill="#FF0000" />
        </g>
      );
    case "facebook":
      return <text x="12" y="17" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="Georgia, serif">f</text>;
    case "x":
      return (
        <g {...stroke}>
          <path d="M6 6l12 12M18 6L6 18" />
        </g>
      );
    case "tiktok":
      return (
        <g {...stroke}>
          <path d="M14 5v9a3 3 0 1 1-3-3" />
          <path d="M14 7c1 1.4 2.4 2 3.5 2" />
        </g>
      );
    case "linkedin":
      return <text x="12" y="16.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff">in</text>;
    case "whatsapp":
      return (
        <g {...stroke}>
          <path d="M6 18l1-3a6 6 0 1 1 2 2z" />
        </g>
      );
    case "telegram":
      return (
        <g>
          <path d="M5 12l13-5-2 11-4-3-2 2-1-4z" fill="#fff" />
        </g>
      );
    case "github":
      return <circle cx="12" cy="12" r="6" fill="none" stroke="#fff" strokeWidth="2" />;
    case "email":
      return (
        <g {...stroke}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M4.5 7l7.5 6 7.5-6" />
        </g>
      );
    case "website":
    default:
      return (
        <g {...stroke}>
          <circle cx="12" cy="12" r="7" />
          <path d="M5 12h14M12 5c2.5 2.5 2.5 11.5 0 14M12 5c-2.5 2.5-2.5 11.5 0 14" />
        </g>
      );
  }
}

export default function SocialIcon({
  platform,
  iconUrl,
  size = 40,
}: {
  platform: string;
  iconUrl?: string;
  size?: number;
}) {
  const meta = SOCIAL_PLATFORMS.find((p) => p.id === platform);
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  if (iconUrl) {
    return (
      <span style={{ ...base, background: `center/cover url(${iconUrl})`, border: "1px solid rgba(0,0,0,0.08)" }} />
    );
  }

  return (
    <span style={{ ...base, background: meta?.color ?? "#7B3FE4" }}>
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-hidden>
        <Glyph id={platform} />
      </svg>
    </span>
  );
}
