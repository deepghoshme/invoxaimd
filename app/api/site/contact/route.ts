import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public website contact form + newsletter signup. Inserts via service role. */
export async function POST(req: Request) {
  let body: { store_id?: string; page_id?: string; kind?: string; name?: string; email?: string; phone?: string; message?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!body.store_id) return NextResponse.json({ ok: false }, { status: 400 });
  const kind = body.kind === "newsletter" ? "newsletter" : "contact";
  if (!body.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }

  const sb = createAdminClient();
  const { error } = await sb.from("site_messages").insert({
    store_id: body.store_id,
    page_id: body.page_id ?? null,
    kind,
    name: body.name?.slice(0, 120) ?? null,
    email: body.email.slice(0, 200),
    phone: body.phone?.slice(0, 40) ?? null,
    message: body.message?.slice(0, 2000) ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
