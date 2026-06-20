import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Caddy on-demand TLS "ask" endpoint.
 *
 * Before Caddy issues a certificate for an arbitrary incoming hostname (a seller
 * subdomain like `name.invoxai.io`, or a connected custom domain), it calls:
 *     GET /api/tls-check?domain=<sni-host>
 * We return 200 only if that host is one we actually serve. Anything else → 403,
 * so nobody can point junk DNS at us and burn our Let's Encrypt rate limit.
 */

const ROOT = "invoxai.io";

// Platform surfaces always get a cert.
const PLATFORM_HOSTS = new Set([
  ROOT,
  `www.${ROOT}`,
  `app.${ROOT}`,
  `admin.${ROOT}`,
  `live.${ROOT}`,
]);

function deny() {
  return new NextResponse("not allowed", { status: 403 });
}

function allow() {
  return new NextResponse("ok", { status: 200 });
}

export async function GET(request: Request) {
  const host = new URL(request.url).searchParams
    .get("domain")
    ?.trim()
    .toLowerCase();

  if (!host) return deny();
  if (PLATFORM_HOSTS.has(host)) return allow();

  const supabase = createAdminClient();

  if (host.endsWith(`.${ROOT}`)) {
    // Seller subdomain: the label must be a claimed store subdomain.
    const label = host.slice(0, -1 * (ROOT.length + 1));
    if (!label || label.includes(".")) return deny();

    // Primary subdomain: check stores.subdomain (fast, indexed).
    const { data: primary } = await supabase
      .from("stores")
      .select("id")
      .eq("subdomain", label)
      .maybeSingle();
    if (primary) return allow();

    // Extra alias subdomain: check store_subdomains table.
    // Sellers can add extra *.invoxai.io aliases that resolve to their store —
    // these need TLS certs just like the primary subdomain.
    // Gracefully skip if the table doesn't exist yet (migration unapplied).
    try {
      const { data: alias, error: aliasErr } = await supabase
        .from("store_subdomains")
        .select("id")
        .eq("subdomain", label)
        .maybeSingle();
      // Only allow if no error (e.g. table exists) AND a row was found.
      if (!aliasErr && alias) return allow();
    } catch {
      // Unexpected JS exception — fail closed (deny).
    }

    return deny();
  }

  // Otherwise treat it as a custom domain — must exist AND be verified.
  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("custom_domain", host)
    .eq("custom_domain_verified", true)
    .maybeSingle();

  return data ? allow() : deny();
}
