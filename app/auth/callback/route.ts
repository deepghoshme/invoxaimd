import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) + magic-link return handler. Supabase redirects here with a
 * `code`; we exchange it for a session (cookies are written by the SSR client)
 * and send the user on to onboarding/dashboard/admin.
 *
 * Behind Caddy, `request.url` resolves to the internal upstream (localhost:3000),
 * so we build the public origin from the X-Forwarded-* headers Caddy sets.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  // Honor an explicit ?next; otherwise default by surface (admin host → /admin).
  const next =
    url.searchParams.get("next") ??
    (host.startsWith("admin.") ? "/admin" : "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
