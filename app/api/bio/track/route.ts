import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function device(ua: string): string {
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "tablet";
  if (/mobi|android|iphone/.test(u)) return "mobile";
  return "desktop";
}

/** Record a page view (service role; public, no session). */
export async function POST(req: Request) {
  let body: { page_id?: string; store_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body.page_id) return NextResponse.json({ ok: false }, { status: 400 });

  const sb = createAdminClient();
  await sb.from("page_events").insert({
    page_id: body.page_id,
    store_id: body.store_id ?? null,
    kind: "view",
    device: device(req.headers.get("user-agent") ?? ""),
  });
  return NextResponse.json({ ok: true });
}
