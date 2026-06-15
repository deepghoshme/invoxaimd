import {
  backgroundCss,
  getBioTheme,
  BUTTON_RADIUS,
  type BioContent,
} from "@/lib/bioThemes";
import SocialIcon from "@/components/SocialIcon";

export type { BioContent };

/**
 * Sunset-family bio/link-in-bio template. Pure presentational + theme-driven, no
 * server deps — rendered both by the public site and the editor's live preview.
 */
export default function BioTemplate({
  content,
  fallbackName,
}: {
  content: BioContent;
  fallbackName?: string;
}) {
  const theme = getBioTheme(content.theme);
  const name = content.display_name || fallbackName || "My page";
  const links = (content.links ?? []).filter((l) => l?.url);
  const socials = (content.socials ?? []).filter((s) => s?.url);
  const radius = BUTTON_RADIUS[content.button_style ?? "rounded"];
  const outline = content.button_style === "outline";
  const anim = content.animation && content.animation !== "none" ? `bio-${content.animation}` : undefined;

  return (
    <div
      style={{
        minHeight: "100%",
        background: backgroundCss(content, theme),
        color: theme.text,
        padding: "56px 20px",
        display: "flex",
        justifyContent: "center",
        fontFamily: "var(--font-body), system-ui, sans-serif",
      }}
    >
      <div
        className={anim}
        style={{ width: "min(480px, 100%)", textAlign: "center" }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: content.avatar_url
              ? `center/cover url(${content.avatar_url})`
              : theme.primary,
            boxShadow: "0 12px 30px -14px rgba(0,0,0,0.5)",
          }}
        />
        <h1 style={{ margin: "0 0 4px", fontSize: "1.6rem", fontFamily: "var(--font-heading), sans-serif", color: theme.text }}>
          {name}
        </h1>
        {content.headline && (
          <p style={{ margin: "0 0 12px", color: theme.muted, fontWeight: 600 }}>{content.headline}</p>
        )}
        {content.bio && (
          <p style={{ margin: "0 auto 22px", maxWidth: "32rem", color: theme.text, opacity: 0.9 }}>{content.bio}</p>
        )}

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
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderRadius: radius,
                background: outline ? "transparent" : theme.card,
                border: `1.5px solid ${outline ? theme.primary : theme.cardBorder}`,
                color: theme.text,
                fontWeight: 600,
                fontFamily: "var(--font-heading), sans-serif",
                textDecoration: "none",
              }}
            >
              {l.icon_url ? (
                <span style={{ width: 24, height: 24, borderRadius: 6, background: `center/cover url(${l.icon_url})`, flexShrink: 0 }} />
              ) : (
                <span style={{ width: 24, flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, textAlign: "center" }}>{l.label || l.url}</span>
              <span style={{ width: 24, flexShrink: 0 }} />
            </a>
          ))}
        </div>

        <p style={{ marginTop: 48, fontSize: "0.75rem", color: theme.muted }}>
          Made with{" "}
          <a href="https://invoxai.io" style={{ color: theme.primary }}>
            invoxai.io
          </a>
        </p>
      </div>
    </div>
  );
}
