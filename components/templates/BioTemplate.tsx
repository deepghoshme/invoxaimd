import type { SiteStore } from "@/lib/sites";

export type BioContent = {
  display_name?: string;
  headline?: string;
  avatar_url?: string;
  bio?: string;
  links?: { label?: string; url?: string }[];
};

/** Sunset-themed link-in-bio template. Pure presentational; data is JSONB content. */
export default function BioTemplate({
  content,
  store,
}: {
  content: BioContent;
  store: SiteStore;
}) {
  const name = content.display_name || store.store_name || "My page";
  const links = (content.links ?? []).filter((l) => l?.url);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--color-bg)",
        padding: "var(--space-5) var(--space-3)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "min(520px, 100%)", textAlign: "center" }}>
        <div
          style={{
            width: 104,
            height: 104,
            margin: "0 auto var(--space-2)",
            borderRadius: "50%",
            background: content.avatar_url
              ? `center/cover url(${content.avatar_url})`
              : "var(--brand-gradient)",
            boxShadow: "0 10px 30px -12px rgba(43,27,46,0.4)",
          }}
        />
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.7rem" }}>{name}</h1>
        {content.headline && (
          <p style={{ margin: "0 0 var(--space-2)", color: "var(--color-muted)", fontWeight: 600 }}>
            {content.headline}
          </p>
        )}
        {content.bio && (
          <p style={{ margin: "0 auto var(--space-4)", maxWidth: "34rem", color: "var(--color-text)" }}>
            {content.bio}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {links.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                padding: "0.95rem 1.25rem",
                borderRadius: "var(--radius)",
                background: "var(--color-card)",
                border: "1.5px solid var(--color-border)",
                color: "var(--color-text)",
                fontWeight: 600,
                fontFamily: "var(--font-heading)",
                transition: "transform 0.12s ease, border-color 0.12s ease",
              }}
            >
              {l.label || l.url}
            </a>
          ))}
        </div>

        <p style={{ marginTop: "var(--space-5)", fontSize: "0.75rem", color: "var(--color-muted)" }}>
          Made with{" "}
          <a href="https://invoxai.io" style={{ color: "var(--color-primary)" }}>
            invoxai.io
          </a>
        </p>
      </div>
    </main>
  );
}
