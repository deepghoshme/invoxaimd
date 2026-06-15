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
  hiSize: "s" | "m" | "l";
  hiTextSize: "s" | "m" | "l";
};

const PAD_V = { s: "11px", m: "16px", l: "22px" } as const;
const FONT = { s: "0.92rem", m: "1.05rem", l: "1.22rem" } as const;

function LinkButton({
  l,
  st,
  className,
  cta,
}: {
  l: BioLink;
  st: LinkStyle;
  className?: string;
  cta?: boolean;
}) {
  const hi = !!l.highlight;
  const centerInner = cta || st.iconPos === "center";
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
  if (centerInner) {
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
      className={`bio-btn${hi ? " bio-btn-featured" : ""}${className ? " " + className : ""}`}
      href={l.url}
      target="_blank"
      rel="noreferrer"
      style={{
        position: "relative",
        overflow: "hidden",
        display: "block",
        width: "100%",
        textAlign: "center",
        padding: `${hi || cta ? PAD_V[st.hiSize] : "14px"} ${cta ? "18px" : hi ? "46px" : "44px"}`,
        borderRadius: cta ? 0 : st.radius,
        background: bg,
        color,
        border: cta ? "none" : border,
        fontWeight: hi || cta ? 800 : 600,
        fontSize: hi || cta ? FONT[st.hiTextSize] : undefined,
        letterSpacing: "0.01em",
        fontFamily: "var(--font-heading), sans-serif",
        textDecoration: "none",
        boxShadow: cta
          ? "0 -8px 24px -10px rgba(0,0,0,0.3)"
          : hi
            ? `0 14px 34px -12px ${bg}, inset 0 1px 0 rgba(255,255,255,0.25)`
            : "0 2px 8px -4px rgba(0,0,0,0.22)",
      }}
    >
      {hi && (
        <span
          className="btn-shine"
          style={{ background: `linear-gradient(90deg, transparent, ${st.stripeColor || "#ffffff"}, transparent)` }}
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
    hiSize: content.highlight_size ?? "m",
    hiTextSize: content.highlight_text_size ?? "m",
  };

  const featured = links.find((l) => l.highlight);
  const rootClass = `${forceMobile ? "force-mobile " : ""}${featured ? "has-cta " : ""}`.trim();

  const avatarPos = content.avatar_position ?? "center";
  const justify = avatarPos === "left" ? "flex-start" : avatarPos === "right" ? "flex-end" : "center";

  return (
    <div
      className={`bio-root ${rootClass}`.trim()}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: backgroundCss(content, theme),
        color: theme.text,
        overflow: "hidden",
        fontFamily: "var(--font-body), system-ui, sans-serif",
      }}
    >
      <BioBackgroundFX motion={content.bg_motion} theme={theme} />

      {/* Centered column on web (background fills the sides); full width on mobile */}
      <div className="bio-shell">

      {/* Cover (bottom corners curved) + positioned avatar */}
      <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
        <div
          style={{
            width: "100%",
            height: "clamp(140px, 28vw, 210px)",
            borderRadius: "0 0 28px 28px",
            background: content.cover_url
              ? `center/cover no-repeat url(${content.cover_url})`
              : `linear-gradient(135deg, ${theme.primary}, ${theme.bg})`,
            boxShadow: "0 16px 36px -24px rgba(0,0,0,0.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: -48,
            width: "min(540px, 100%)",
            display: "flex",
            justifyContent: justify,
            padding: "0 26px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: content.avatar_url ? `center/cover url(${content.avatar_url})` : theme.primary,
              border: `4px solid ${theme.bg}`,
              boxShadow: "0 12px 28px -14px rgba(0,0,0,0.55)",
            }}
          />
        </div>
      </div>

      <div
        className="bio-content"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "66px 20px 48px",
        }}
      >
        {/* margin-auto centers when short, but collapses on overflow so the page
            stays scrollable and nothing hides behind the fixed mobile CTA */}
        <div className={anim} style={{ width: "min(480px, 100%)", textAlign: avatarPos, marginTop: "auto", marginBottom: "auto" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.6rem", fontFamily: "var(--font-heading), sans-serif", color: theme.text }}>
            {name}
          </h1>
          {content.headline && <p style={{ margin: "0 0 12px", color: theme.muted, fontWeight: 600 }}>{content.headline}</p>}
          {content.bio && <p style={{ margin: "0 0 22px", maxWidth: "32rem", color: theme.text, opacity: 0.9 }}>{content.bio}</p>}

          {socials.length > 0 && (
            <div style={{ display: "flex", justifyContent: justify, flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
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
      </div>

      {featured && (
        <div className="bio-mobile-cta">
          <LinkButton l={featured} st={st} cta />
        </div>
      )}

      <BrandBadge />
    </div>
  );
}
