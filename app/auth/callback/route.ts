import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) + magic-link return handler. Supabase redirects here with a
 * `code`; we exchange it for a session (cookies are written by the SSR client)
 * and send the user on to onboarding/dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin, hostname } = new URL(request.url);
  const code = searchParams.get("code");
  // Honor an explicit ?next; otherwise default by surface (admin host → /admin).
  const next =
    searchParams.get("next") ??
    (hostname.startsWith("admin.") ? "/admin" : "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
