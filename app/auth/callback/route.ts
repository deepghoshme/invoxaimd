import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimOrdersForUser } from "@/lib/claim";

/**
 * OAuth (Google) + magic-link return handler. Supabase redirects here with a
 * `code`; we exchange it for a session (cookies are written by the SSR client)
 * and send the user on to onboarding/dashboard/admin.
 *
 * After a successful exchange we also claim any historical orders/purchases
 * that share the verified email — buyer order claiming (Phase 5, Wave 2).
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
      // ── Buyer order claiming ────────────────────────────────────────────────
      // Attempt to link any historical purchases to this user by email.
      // This is intentionally non-fatal: a claim failure must never block login.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.id && user.email) {
          // Use the admin client to confirm email_confirmed_at server-side —
          // never trust the client-supplied claim about verification status.
          const admin = createAdminClient();
          const { data: authUser } = await admin.auth.admin.getUserById(user.id);
          const verified = !!authUser?.user?.email_confirmed_at;

          if (verified) {
            // Fire-and-forget: don't await — we don't want to delay the redirect.
            // claimOrdersForUser is idempotent so a repeat run is harmless.
            claimOrdersForUser(user.id, user.email, verified).catch(() => {
              // Swallow errors — claim failures are non-fatal.
            });
          }
        }
      } catch {
        // Non-fatal: claim errors must not block the auth flow.
      }
      // ───────────────────────────────────────────────────────────────────────

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
