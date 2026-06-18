import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function device(ua: string): string {
  const u = ua.toLowerCase();
  if (/ipad|tablet/.test(u)) return "tablet";
  if (/mobi|android|iphone/.test(u)) return "mobile";
  return "desktop";
}

/** Record a link click, then redirect to the target. /api/bio/go?p=&s=&u=&t= */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pageId = url.searchParams.get("p");
  const storeId = url.searchParams.get("s");
  const to = url.searchParams.get("u") || "";
  const label = url.searchParams.get("t") || "";

  // Only allow http(s) or same-origin relative redirects.
  let dest = "/";
  if (/^https?:\/\//i.test(to)) dest = to;
  else if (to.startsWith("/")) dest = to;

  if (pageId) {
    const sb = createAdminClient();
    await sb.from("page_events").insert({
      page_id: pageId,
      store_id: storeId || null,
      kind: "click",
      link_label: label.slice(0, 120),
      device: device(req.headers.get("user-agent") ?? ""),
    });
  }
  return NextResponse.redirect(dest, 302);
}
