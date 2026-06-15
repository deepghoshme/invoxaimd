import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Platform surfaces are served by the normal app routes; every other host is a
// seller subdomain or connected custom domain and is rewritten to the renderer.
const PLATFORM_HOSTS = new Set([
  "invoxai.io",
  "www.invoxai.io",
  "app.invoxai.io",
  "admin.invoxai.io",
  "localhost",
  "127.0.0.1",
]);

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

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
