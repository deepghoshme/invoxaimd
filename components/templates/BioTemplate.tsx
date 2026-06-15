import {
  backgroundCss,
  getBioTheme,
  BUTTON_RADIUS,
  type BioContent,
  type BioLink,
  type BioTheme,
} from "@/lib/bioThemes";
import SocialIcon from "@/components/SocialIcon";
import BioBackgroundFX from "@/components/BioBackgroundFX";
import BrandBadge from "@/components/BrandBadge";

export type { BioContent };

type LinkStyle = {
  theme: BioTheme;
  outline: boolean;
  radius: string;
  iconPos: "left" | "center" | "right";
  highlightColor?: string;
  stripeColor?: string;
};

function LinkButton({
  l,
  st,
  className,
}: {
  l: BioLink;
  st: LinkStyle;
  className?: string;
}) {
  const hi = !!l.highlight;
  const bg = hi
    ? st.highlightColor || st.theme.primary
    : st.outline
      ? "transparent"
      : st.theme.card;
  const color = hi ? "#fff" : st.theme.text;
  const border = hi ? "none" : `1.5px solid ${st.outline ? st.theme.primary : st.theme.cardBorder}`;

  const icon = l.icon_url ? (
    <span style={{ width: 24, height: 24, borderRadius: 6, background: `center/cover url(${l.icon_url})`, flexShrink: 0, display: "inline-block" }} />
  ) : null;
  const label = l.label || l.url;

  let inner: React.ReactNode;
  if (st.iconPos === "center") {
    inner = (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {icon}
        {label}
      </span>
    );
  } else if (icon) {
    inner = (
      <>
        <span style={{ position: "absolute", [st.iconPos]: 16, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          {icon}
        </span>
        <span style={{ display: "block", textAlign: "center" }}>{label}</span>
      </>
    );
  } else {
    inner = <span style={{ display: "block", textAlign: "center" }}>{label}</span>;
  }

  return (
    <a
      className={className}
      href={l.url}
      target="_blank"
      rel="noreferrer"
      style={{
        position: "relative",
        overflow: "hidden",
        display: "block",
        padding: "14px 44px",
        borderRadius: st.radius,
        background: bg,
        color,
        border,
        fontWeight: 700,
        fontFamily: "var(--font-heading), sans-serif",
        textDecoration: "none",
      }}
    >
      {hi && (
        <span
          className="btn-shine"
          style={{ background: `linear-gradient(90deg, transparent, ${st.stripeColor || "#ffffff"}99, transparent)` }}
        />
      )}
      {inner}
    </a>
  );
}

export default function BioTemplate({
  content,
  fallbackName,
  forceMobile,
}: {
  content: BioContent;
  fallbackName?: string;
  forceMobile?: boolean;
}) {
  const theme = getBioTheme(content.theme);
  const name = content.display_name || fallbackName || "My page";
  const links = (content.links ?? []).filter((l) => l?.url);
  const socials = (content.socials ?? []).filter((s) => s?.url);
  const anim = content.animation && content.animation !== "none" ? `bio-${content.animation}` : undefined;

  const st: LinkStyle = {
    theme,
    outline: content.button_style === "outline",
    radius: BUTTON_RADIUS[content.button_style ?? "rounded"],
    iconPos: content.icon_position ?? "left",
    highlightColor: content.highlight_color,
    stripeColor: content.stripe_color,
  };

  const featured = links.find((l) => l.highlight);
  const rootClass = `${forceMobile ? "force-mobile " : ""}${featured ? "has-cta " : ""}`.trim();

  return (
    <div
      className={rootClass || undefined}
      style={{
        position: "relative",
        minHeight: "100%",
        background: backgroundCss(content, theme),
        color: theme.text,
        overflow: "hidden",
        fontFamily: "var(--font-body), system-ui, sans-serif",
      }}
    >
      <BioBackgroundFX motion={content.bg_motion} theme={theme} />

      <div
        className="bio-content"
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "safe center",
          alignItems: "center",
          padding: "48px 20px",
        }}
      >
        <div className={anim} style={{ width: "min(480px, 100%)", textAlign: "center" }}>
          <div
            style={{
              width: 100,
              height: 100,
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: content.avatar_url ? `center/cover url(${content.avatar_url})` : theme.primary,
              boxShadow: "0 12px 30px -14px rgba(0,0,0,0.5)",
            }}
          />
          <h1 style={{ margin: "0 0 4px", fontSize: "1.6rem", fontFamily: "var(--font-heading), sans-serif", color: theme.text }}>
            {name}
          </h1>
          {content.headline && <p style={{ margin: "0 0 12px", color: theme.muted, fontWeight: 600 }}>{content.headline}</p>}
          {content.bio && <p style={{ margin: "0 auto 22px", maxWidth: "32rem", color: theme.text, opacity: 0.9 }}>{content.bio}</p>}

          {socials.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
              {socials.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" aria-label={s.platform}>
                  <SocialIcon platform={s.platform} />
                </a>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {links.map((l, i) => (
              <LinkButton key={i} l={l} st={st} className={l === featured ? "bio-featured-inlist" : undefined} />
            ))}
          </div>
        </div>
      </div>

      {featured && (
        <div className="bio-mobile-cta">
          <LinkButton l={featured} st={st} />
        </div>
      )}

      <BrandBadge />
    </div>
  );
}
