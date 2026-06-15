import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Root router by host:
 *  - app.invoxai.io    → the seller app (dashboard guard sends to login/onboarding)
 *  - admin.invoxai.io  → admin panel (not built yet → login for now)
 *  - everything else   → the marketing landing (invoxai.io)
 */
export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  const sub = host.split(":")[0].split(".")[0];

  if (sub === "app") redirect("/dashboard");
  if (sub === "admin") redirect("/login");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-muted)",
        }}
      >
        Foundation · Phase 1
      </span>

      <h1
        style={{
          fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
          margin: 0,
          background: "var(--brand-gradient)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        invoxai.io
      </h1>

      <p
        style={{
          maxWidth: "32rem",
          fontSize: "1.15rem",
          color: "var(--color-muted)",
          margin: 0,
        }}
      >
        All-in-one creator &amp; business platform. Pages, stores, courses,
        bookings and paid communities — on your own subdomain or custom domain.
      </p>

      <a
        href="https://app.invoxai.io"
        style={{
          marginTop: "var(--space-2)",
          padding: "0.85rem 1.75rem",
          borderRadius: "var(--radius)",
          background: "var(--brand-gradient)",
          color: "#fff",
          fontWeight: 600,
          fontFamily: "var(--font-heading)",
        }}
      >
        Open dashboard
      </a>
    </main>
  );
}
