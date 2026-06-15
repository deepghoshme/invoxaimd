/**
 * Centralized, validated access to environment variables.
 * Public vars are inlined by Next at build time; server-only vars are read lazily
 * so importing this file in a Client Component never leaks the service-role key.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/** Supabase project URL — safe in browser. */
export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

/**
 * The anon/publishable key for client-side use (RLS still applies).
 * Prefers the new `sb_publishable_…` key, falls back to the legacy anon JWT.
 */
export const SUPABASE_ANON_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Service-role key — BYPASSES RLS. Server-only. Never import into client code.
 * Read lazily so a stray import in a Client Component throws at call time,
 * not at module load (which would crash the browser bundle build).
 */
export function getServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
