import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Platform surfaces are served by the normal app routes; every other host is a
// seller subdomain or connected custom domain and is rewritten to the renderer.
const PLATFORM_HOSTS = new Set([
  "invoxai.io",
  "www.invoxai.io",
  "app.invoxai.io",
  "admin.invoxai.io",
  "live.invoxai.io", // live agent QA / preview surface
  "localhost",
  "127.0.0.1",
]);

// ── Maintenance-mode in-process cache ─────────────────────────────────────────
// We cache the DB result for up to 45 seconds so we do not hit the database on
// every request.  The cache is process-local (single Node process), which is
// fine for a single-server deployment.  Fail-open: any read error leaves
// maintenanceOn=false so the site keeps serving normally.

const MAINTENANCE_TTL_MS = 45_000; // 45 s — toggle takes effect within ~1 min

let _maintenanceCache: {
  on: boolean;
  eta: string | null;
  fetchedAt: number;
} | null = null;

async function getMaintenanceMode(): Promise<{ on: boolean; eta: string | null }> {
  const now = Date.now();
  if (_maintenanceCache && now - _maintenanceCache.fetchedAt < MAINTENANCE_TTL_MS) {
    return { on: _maintenanceCache.on, eta: _maintenanceCache.eta };
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return { on: false, eta: null };

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await sb
      .from("platform_settings")
      .select("maintenance_mode, maintenance_eta")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) {
      // Fail open — never take the site down on a read error.
      _maintenanceCache = { on: false, eta: null, fetchedAt: now };
      return { on: false, eta: null };
    }

    const result = {
      on: !!(data as { maintenance_mode?: boolean }).maintenance_mode,
      eta: (data as { maintenance_eta?: string | null }).maintenance_eta ?? null,
    };
    _maintenanceCache = { ...result, fetchedAt: now };
    return result;
  } catch {
    // Fail open.
    _maintenanceCache = { on: false, eta: null, fetchedAt: Date.now() };
    return { on: false, eta: null };
  }
}

// ── Routes that are ALWAYS allowed through — even during maintenance ──────────
// admin.invoxai.io (the whole host) is always allowed so the admin can reach
// /admin to turn maintenance back off.  On other hosts we also allow /login,
// /auth/*, /api/*, /_next/*, and static assets.
function isAlwaysAllowed(host: string, pathname: string): boolean {
  // The entire admin + live-QA hosts are always open (QA must run even when the
  // platform is in maintenance mode).
  if (host === "admin.invoxai.io" || host === "live.invoxai.io") return true;

  // Internal / infra paths are always open regardless of host.
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/favicon.ico"
  );
}

// ── Simple HTML maintenance response (no JSX — middleware is Edge-compatible) ──
function maintenanceResponse(eta: string | null): NextResponse {
  const etaHtml = eta
    ? `<div class="eta"><span class="dot"></span>Estimated back by ${eta}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Maintenance — invoxai</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#f9fafb;--card:#fff;--text:#111827;--muted:#6b7280;--border:#e5e7eb;--grad:linear-gradient(135deg,#ff4d7d,#a855f7)}
@media(prefers-color-scheme:dark){:root{--bg:#0f1117;--card:#1c1f27;--text:#f3f4f6;--muted:#9ca3af;--border:#374151}}
body{min-height:100dvh;display:grid;place-items:center;background:var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text);padding:24px}
.box{max-width:440px;width:100%;text-align:center;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:40px 32px;box-shadow:0 4px 24px rgba(0,0,0,.07)}
.icon{width:80px;height:80px;border-radius:22px;background:var(--grad);display:grid;place-items:center;font-size:38px;margin:0 auto 24px;box-shadow:0 16px 40px -12px rgba(168,85,247,.4)}
h1{font-size:24px;font-weight:800;letter-spacing:-.02em;margin-bottom:12px}
p{color:var(--muted);font-size:15px;line-height:1.6}
.eta{display:inline-flex;align-items:center;gap:8px;margin-top:20px;font-size:13px;font-weight:600;color:var(--muted);border:1px solid var(--border);padding:9px 16px;border-radius:999px}
.dot{width:8px;height:8px;border-radius:50%;background:#a855f7;flex:none}
.link{margin-top:20px;font-size:12.5px;color:var(--muted)}
.link a{color:var(--muted);text-decoration:underline}
</style>
</head>
<body>
<div class="box">
  <div class="icon">🛠️</div>
  <h1>We'll be right back</h1>
  <p>invoxai is getting a quick upgrade. Your store &amp; data are safe — this won't take long.</p>
  ${etaHtml}
  <div class="link">Questions? <a href="https://status.invoxai.io" target="_blank" rel="noopener">status.invoxai.io</a></div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "60",
      "Cache-Control": "no-store",
    },
  });
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

  // ── Always-allowed: admin host + infra paths ─────────────────────────────
  const allowed = isAlwaysAllowed(host, pathname);

  // ── Maintenance gate (checked before domain rewrite) ─────────────────────
  if (!allowed) {
    const { on, eta } = await getMaintenanceMode();
    if (on) {
      return maintenanceResponse(eta);
    }
  }

  // --- Seller subdomain / custom domain → public site renderer ---
  const isInternal =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/sites") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth");

  if (host && !PLATFORM_HOSTS.has(host) && !isInternal) {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${host}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // --- Platform hosts: refresh the Supabase auth session cookies ---
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
