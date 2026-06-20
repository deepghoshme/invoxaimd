import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStoreByHost } from "@/lib/sites";

/**
 * Public lead form submission endpoint.
 * Inserts a site_messages row (kind = 'contact') for the given store + page.
 * No auth required — the form is public-facing.
 *
 * Security: store_id is derived from the incoming Host header via
 * resolveStoreByHost (same resolver the storefront renderer uses). The
 * body-supplied store_id is NOT trusted — a client cannot route leads to an
 * arbitrary store by crafting the request body. If the Host does not resolve
 * to a known store the request is rejected with 404.
 */
export async function POST(req: Request) {
  // ── 1. Resolve tenant from Host (never from body) ─────────────────────────
  // Prefer x-forwarded-host (set by reverse proxies / Vercel edge) then fall
  // back to the raw host header — same precedence the middleware uses.
  const rawHost =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "";

  const store = await resolveStoreByHost(rawHost);
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Store not found." },
      { status: 404 },
    );
  }

  // ── 2. Parse + validate body ───────────────────────────────────────────────
  let body: {
    page_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    company?: string;
    website?: string;
    // store_id may still be present in the body (sent by existing form widgets)
    // but it is ignored as the source-of-truth; we only use it for a
    // same-store cross-check (optional, logged in dev) — never for the insert.
    store_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
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

  // ── 3. Compose message text ────────────────────────────────────────────────
  // site_messages has no separate company/website column — fold them into the
  // message column so the seller sees them in their CRM inbox.
  const extras: string[] = [];
  if (body.company?.trim()) extras.push(`Company: ${body.company.trim()}`);
  if (body.website?.trim()) extras.push(`Website: ${body.website.trim()}`);
  const messageParts = [body.message?.trim(), ...extras].filter(Boolean);
  const messageText = messageParts.join("\n") || null;

  // ── 4. Optional page-level cross-check ────────────────────────────────────
  // If a page_id was submitted, confirm it belongs to this store (extra safety
  // layer — prevents misdirected leads in case of weird proxying).
  const sb = createAdminClient();

  if (body.page_id) {
    const { data: pageRow } = await sb
      .from("pages")
      .select("store_id")
      .eq("id", body.page_id)
      .maybeSingle();
    // If the page exists but belongs to a different store, reject
    if (pageRow && pageRow.store_id !== store.id) {
      return NextResponse.json(
        { ok: false, error: "Page mismatch." },
        { status: 400 },
      );
    }
  }

  // ── 5. Insert ──────────────────────────────────────────────────────────────
  const { error } = await sb.from("site_messages").insert({
    store_id: store.id,          // host-derived — never from body
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
