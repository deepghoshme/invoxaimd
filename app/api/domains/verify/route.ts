import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import dns from "dns";
import { promisify } from "util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The CNAME target sellers must point their apex/www record to.
const CNAME_TARGET = "cname.invoxai.io";

const resolveCname = promisify(dns.resolveCname);
const resolveTxt   = promisify(dns.resolveTxt);

function err(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** Check whether the table exists — used for graceful degradation. */
async function tableExists(): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("custom_domains")
    .select("id")
    .limit(1)
    .maybeSingle();
  // PostgREST returns a 42P01 code when the relation doesn't exist.
  if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
    return false;
  }
  return true;
}

/**
 * POST /api/domains/verify
 *
 * Body: { domain: string, store_id: string }
 *
 * Performs real DNS lookups:
 *   1. CNAME check  — resolves the domain's CNAME and verifies it points to
 *                     cname.invoxai.io (exact or trailing-dot form).
 *   2. TXT check    — looks for an "invoxai-verify=<token>" record on the domain.
 *
 * Persists/updates the row in custom_domains with the result status:
 *   dns      — both checks passed; SSL will be issued by Caddy on first HTTPS hit
 *   pending  — checks failed (returns ok:false with details)
 *
 * SSL issuance is NOT confirmed here — Caddy handles it on-demand when the
 * first real HTTPS request arrives after DNS resolves. We honestly report this.
 */
export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Unauthorized", 401);

  // ── Migration guard ───────────────────────────────────────────────
  const migrated = await tableExists();
  if (!migrated) {
    return NextResponse.json(
      {
        ok: false,
        migrationPending: true,
        error: "The custom_domains table does not exist yet. Apply migration 20260618220000_custom_domains.sql first.",
      },
      { status: 503 },
    );
  }

  // ── Input validation ──────────────────────────────────────────────
  let body: { domain?: unknown; store_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body");
  }

  const rawDomain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
  const storeId   = typeof body.store_id === "string" ? body.store_id.trim() : "";

  if (!rawDomain || rawDomain.length < 4) return err("domain is required");
  if (!storeId)                           return err("store_id is required");

  // Sanitise: strip protocol/path if accidentally included
  const domain = rawDomain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "");

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return err("Invalid domain format");
  }

  // ── Tenancy check — the store must belong to this user ───────────
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (storeErr || !store) return err("Store not found or access denied", 403);

  // ── Fetch or create the custom_domains row ────────────────────────
  const admin = createAdminClient();

  // Look for an existing row (same domain, same store)
  const { data: existing } = await admin
    .from("custom_domains")
    .select("id, txt_token, domain")
    .eq("store_id", storeId)
    .eq("domain", domain)
    .maybeSingle();

  // Generate a stable token so the seller can keep it in DNS across retries.
  // Format: invoxai-verify=<16-char hex>
  const token: string =
    existing?.txt_token ??
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Upsert the row so a re-verify attempt doesn't create duplicates.
  const { data: domainRow, error: upsertErr } = await admin
    .from("custom_domains")
    .upsert(
      { store_id: storeId, domain, txt_token: token, status: "pending" },
      { onConflict: "domain", ignoreDuplicates: false },
    )
    .select("id, txt_token")
    .single();

  if (upsertErr || !domainRow) {
    console.error("[domains/verify] upsert error", upsertErr);
    return err("Failed to save domain record", 500);
  }

  // ── DNS checks ────────────────────────────────────────────────────
  const checks = { cname: false, txt: false };
  const details: { cname?: string; cnameError?: string; txtRecords?: string[]; txtError?: string } = {};

  // 1. CNAME
  try {
    const cnames = await resolveCname(domain);
    details.cname = cnames.join(", ");
    // Accept "cname.invoxai.io" or "cname.invoxai.io." (trailing dot)
    checks.cname = cnames.some(
      (c) => c.toLowerCase().replace(/\.$/, "") === CNAME_TARGET.replace(/\.$/, ""),
    );
  } catch (e: unknown) {
    details.cnameError = e instanceof Error ? e.message : "CNAME lookup failed";
  }

  // 2. TXT verification token
  const expectedTxt = `invoxai-verify=${token}`;
  try {
    const txtSets = await resolveTxt(domain);
    // resolveTxt returns string[][] — each record is an array of chunks
    const flat = txtSets.map((chunks) => chunks.join(""));
    details.txtRecords = flat;
    checks.txt = flat.some((r) => r === expectedTxt);
  } catch (e: unknown) {
    details.txtError = e instanceof Error ? e.message : "TXT lookup failed";
  }

  // ── Persist result ────────────────────────────────────────────────
  const newStatus = checks.cname && checks.txt ? "dns" : "pending";

  await admin
    .from("custom_domains")
    .update({ status: newStatus })
    .eq("id", domainRow.id);

  // ── Response ──────────────────────────────────────────────────────
  if (checks.cname && checks.txt) {
    return NextResponse.json({
      ok: true,
      domain,
      token,
      checks,
      status: "dns",
      // Honest SSL note: Caddy on-demand will issue a cert the first time a
      // real HTTPS request arrives — we cannot confirm issuance from here.
      sslNote: "SSL will be provisioned by Caddy automatically once DNS is fully propagated. It typically completes within seconds of the first HTTPS request.",
    });
  }

  return NextResponse.json(
    {
      ok: false,
      domain,
      token,
      checks,
      status: "pending",
      details,
      hint: checks.cname
        ? "CNAME found but TXT record not yet visible. DNS can take a few minutes."
        : checks.txt
        ? "TXT found but CNAME not pointing to cname.invoxai.io yet."
        : "Neither CNAME nor TXT found yet. DNS propagation can take a few minutes.",
    },
    { status: 422 },
  );
}

/**
 * GET /api/domains/verify?store_id=<uuid>
 *
 * Returns all custom domains for the authenticated user's store.
 * Used by the dashboard to show existing domain status.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Unauthorized", 401);

  const migrated = await tableExists();
  if (!migrated) {
    return NextResponse.json({ ok: true, domains: [], migrationPending: true });
  }

  const storeId = new URL(request.url).searchParams.get("store_id") ?? "";
  if (!storeId) return err("store_id is required");

  // Verify ownership
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) return err("Store not found or access denied", 403);

  const { data: domains } = await supabase
    .from("custom_domains")
    .select("id, domain, txt_token, status, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ok: true, domains: domains ?? [] });
}

/**
 * PATCH /api/domains/verify
 *
 * Body: { id: string, action: "set_live" | "remove" }
 *
 * set_live — promotes a "dns"-status domain to "live" (after Caddy has
 *            issued the cert, the seller confirms the domain is working).
 * remove   — deletes the domain row entirely.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Unauthorized", 401);

  const migrated = await tableExists();
  if (!migrated) return err("Migration pending", 503);

  let body: { id?: unknown; action?: unknown };
  try { body = await request.json(); } catch { return err("Invalid JSON"); }

  const id     = typeof body.id     === "string" ? body.id.trim()     : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";

  if (!id)     return err("id is required");
  if (!action) return err("action is required");

  const admin = createAdminClient();

  // Ownership: join through stores
  const { data: row } = await admin
    .from("custom_domains")
    .select("id, store_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!row) return err("Domain record not found", 404);

  // Verify this store belongs to the calling user
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", row.store_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) return err("Access denied", 403);

  if (action === "set_live") {
    if (row.status !== "dns" && row.status !== "verified") {
      return err("Domain must pass DNS verification before going live", 422);
    }
    await admin.from("custom_domains").update({ status: "live" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "live" });
  }

  if (action === "remove") {
    await admin.from("custom_domains").delete().eq("id", id);
    return NextResponse.json({ ok: true, removed: true });
  }

  return err("Unknown action — expected set_live or remove");
}
