import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public lead form submission endpoint.
 * Inserts a site_messages row (kind = 'contact') for the given store + page.
 * No auth required — the form is public-facing.
 * Validates inputs server-side before writing.
 */
export async function POST(req: Request) {
  let body: {
    store_id?: string;
    page_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    company?: string;
    website?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!body.store_id) {
    return NextResponse.json({ ok: false, error: "Missing store." }, { status: 400 });
  }

  // Require at least an email or a name
  const hasContact = !!(body.email?.trim() || body.name?.trim());
  if (!hasContact) {
    return NextResponse.json(
      { ok: false, error: "Please provide at least your name or email." },
      { status: 400 },
    );
  }

  // Validate email format if provided
  if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email.trim())) {
    return NextResponse.json(
      { ok: false, error: "A valid email is required." },
      { status: 400 },
    );
  }

  // Compose the message body — include company/website in the message column
  // (site_messages has no separate company/website column)
  const extras: string[] = [];
  if (body.company?.trim()) extras.push(`Company: ${body.company.trim()}`);
  if (body.website?.trim()) extras.push(`Website: ${body.website.trim()}`);
  const messageParts = [body.message?.trim(), ...extras].filter(Boolean);
  const messageText = messageParts.join("\n") || null;

  const sb = createAdminClient();

  // Verify the store_id actually exists (prevents noise inserts from bots)
  const { data: storeRow } = await sb
    .from("stores")
    .select("id")
    .eq("id", body.store_id)
    .maybeSingle();
  if (!storeRow) {
    return NextResponse.json({ ok: false, error: "Store not found." }, { status: 404 });
  }

  const { error } = await sb.from("site_messages").insert({
    store_id: body.store_id,
    page_id: body.page_id ?? null,
    kind: "contact",
    name: body.name?.trim().slice(0, 120) ?? null,
    email: body.email?.trim().slice(0, 200) ?? null,
    phone: body.phone?.trim().slice(0, 40) ?? null,
    message: messageText?.slice(0, 2000) ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
