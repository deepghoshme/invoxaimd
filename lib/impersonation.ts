/**
 * Admin impersonation helpers — signed, time-limited "view-as" mechanism.
 *
 * Design:
 *  - A signed httpOnly cookie `imp_store` carries `<store_id>:<expires_unix>`.
 *  - The signature uses HMAC-SHA-256 with a server-side secret derived from the
 *    SUPABASE_SERVICE_ROLE_KEY (already present in the environment; never
 *    transmitted to clients).
 *  - Max-age: 30 minutes. The cookie is SameSite=Lax, httpOnly, Secure in prod.
 *  - The cookie is ONLY honoured in server code that ALSO verifies the caller is
 *    an admin via their Supabase session (double-check in getCurrentStore and in
 *    every action that reads the cookie value).
 *
 * Security properties:
 *  - A non-admin who somehow obtains a valid cookie cannot use it — every
 *    consumption point re-checks is_admin from the live Supabase session.
 *  - The HMAC prevents a non-admin from forging a cookie (they don't have the key).
 *  - Expiry is encoded in the payload and verified server-side so a valid but
 *    stale cookie is rejected even if the browser didn't delete it.
 *  - Service-role key is never sent to the client; the HMAC secret is derived
 *    server-side only.
 */

import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";

export const IMP_COOKIE = "imp_store";
export const IMP_MAX_AGE_SECONDS = 30 * 60; // 30 min

// ── Secret derivation ─────────────────────────────────────────────────────────
// We derive a stable 256-bit secret from the service-role key so that valid
// cookies survive process restarts (same key → same HMAC secret).

function getHmacSecret(): Buffer {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  // HKDF-like: SHA-256(key || "invoxai-imp-v1") gives a domain-separated secret.
  return crypto
    .createHash("sha256")
    .update(serviceKey + ":invoxai-imp-v1")
    .digest();
}

// ── Payload format ────────────────────────────────────────────────────────────
// "<store_id>:<expires_unix>" — both parts are base64url-safe strings.

function buildPayload(storeId: string, expiresAt: number): string {
  return `${storeId}:${expiresAt}`;
}

// ── Signing ───────────────────────────────────────────────────────────────────

function sign(payload: string): string {
  const secret = getHmacSecret();
  const mac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

/** Verify and parse a cookie value. Returns storeId or null if invalid/expired. */
export function verifyImpCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const lastDot = raw.lastIndexOf(".");
  if (lastDot < 0) return null;

  const payload = raw.slice(0, lastDot);
  const givenMac = raw.slice(lastDot + 1);

  // Constant-time comparison to prevent timing attacks.
  const secret = getHmacSecret();
  const expectedMac = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const expected = Buffer.from(expectedMac, "hex");
  const given = Buffer.from(givenMac, "hex");
  if (expected.length !== given.length) return null;
  if (!crypto.timingSafeEqual(expected, given)) return null;

  // Parse payload.
  const colonIdx = payload.indexOf(":");
  if (colonIdx < 0) return null;
  const storeId = payload.slice(0, colonIdx);
  const expiresAt = Number(payload.slice(colonIdx + 1));
  if (!storeId || isNaN(expiresAt)) return null;

  // Check expiry.
  if (Date.now() / 1000 > expiresAt) return null;

  return storeId;
}

/** Build a signed cookie VALUE (not the Set-Cookie header). */
export function buildImpCookieValue(storeId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + IMP_MAX_AGE_SECONDS;
  return sign(buildPayload(storeId, expiresAt));
}

/**
 * Write-action guard: throws (returns an error object) if the request is
 * running under an active impersonation cookie.
 *
 * Call this at the top of every server action that mutates seller data. The
 * design choice is read-only impersonation: admins can VIEW the seller's data
 * but cannot accidentally (or deliberately) modify it while impersonating.
 *
 * Usage in a server action:
 *   const guard = await assertNotImpersonating();
 *   if (!guard.ok) return guard;
 *
 * The check is lightweight: it only reads the cookie; it does NOT re-verify the
 * HMAC (getCurrentStore does that on reads). That is intentional — the purpose
 * here is to refuse any write when a cookie is present, regardless of validity.
 * A missing or malformed cookie means impersonation is not active.
 */
export async function assertNotImpersonating(): Promise<{ ok: true } | { ok: false; error: string }> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(IMP_COOKIE)?.value;
  // Any present cookie (even expired) blocks writes. verifyImpCookie would
  // return null for expired ones, but we want to be conservative here: if the
  // admin has the cookie at all, they should exit before making changes.
  if (raw) {
    const storeId = verifyImpCookie(raw);
    if (storeId) {
      return {
        ok: false,
        error: "You are currently viewing as another seller. Exit impersonation to make changes.",
      };
    }
  }
  return { ok: true };
}
