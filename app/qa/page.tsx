import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live QA", robots: { index: false, follow: false } };

type Target = {
  name: string;
  url: string;
  status: number | null;
  finalUrl?: string;
  ok: boolean;
  screenshot?: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedResponses: { status: number; url: string }[];
};
type Summary = { ranAt: string; total: number; passed: number; failed: number; targets: Target[] };

async function loadResults(): Promise<Summary | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "public/_qa/results.json"), "utf8");
    return JSON.parse(raw) as Summary;
  } catch {
    return null;
  }
}

export default async function QaDashboard() {
  // Admin-gated: the screenshots can show real account data.
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  if (!isAdmin) {
    return <Shell><p style={{ color: "#9aa0ab" }}>Admins only.</p></Shell>;
  }

  const data = await loadResults();

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Live agent QA</h1>
        {data && (
          <span style={{ color: "#9aa0ab", fontSize: 13 }}>
            last run {new Date(data.ranAt).toLocaleString()} ·{" "}
            <b style={{ color: "#16a34a" }}>{data.passed} passed</b>
            {data.failed > 0 && <> · <b style={{ color: "#ef4444" }}>{data.failed} failed</b></>}
          </span>
        )}
      </div>

      {!data ? (
        <p style={{ color: "#9aa0ab" }}>
          No QA run yet. Trigger one by asking the assistant to “run a full browser QA sweep”, or run{" "}
          <code style={{ background: "#1c1f26", padding: "2px 7px", borderRadius: 6 }}>node scripts/qa-sweep.mjs</code>.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {data.targets.map((t) => (
            <div key={t.name} style={{ background: "#1c1f26", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, overflow: "hidden" }}>
              <a href={`/qa/shot/${t.name}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/qa/shot/${t.name}`} alt={t.name} style={{ width: "100%", height: 170, objectFit: "cover", objectPosition: "top", display: "block", background: "#0f1115" }} />
              </a>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 9, background: t.ok ? "#16a34a" : "#ef4444", flex: "none" }} />
                  <strong style={{ fontSize: 14 }}>{t.name}</strong>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#9aa0ab" }}>{t.status ?? "—"}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#7a828f", marginTop: 4, wordBreak: "break-all" }}>{t.finalUrl || t.url}</div>
                {(t.consoleErrors.length > 0 || t.pageErrors.length > 0 || t.failedResponses.length > 0) && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 11.5, color: "#f59e0b" }}>
                    {t.pageErrors.map((e, i) => <li key={`p${i}`}>page: {e}</li>)}
                    {t.consoleErrors.map((e, i) => <li key={`c${i}`}>console: {e}</li>)}
                    {t.failedResponses.map((r, i) => <li key={`r${i}`}>{r.status} {r.url}</li>)}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", background: "#0f1115", color: "#f2f3f5", padding: "32px 24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
    </main>
  );
}
