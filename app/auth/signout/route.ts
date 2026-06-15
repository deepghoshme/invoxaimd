import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Sign out (POST from the sidebar form) and return to login on the same host. */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const host = request.headers.get("x-forwarded-host") ?? new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return NextResponse.redirect(`${proto}://${host}/login`, { status: 303 });
}
