/**
 * One-off migration runner for the hosted Supabase DB.
 *
 *   node scripts/db-apply.mjs supabase/migrations/<file>.sql
 *
 * Reads DATABASE_URL from .env.local and runs the given .sql file in a single
 * connection. Idempotent migrations (create ... if not exists / drop policy if
 * exists) are safe to re-run. Used because there is no psql / supabase CLI on
 * the VPS. Guarded behind an explicit Bash permission rule in settings.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Prefer a project-local pg; fall back to the throwaway /tmp install.
let pg;
try {
  pg = require("pg");
} catch {
  pg = require("/tmp/invox-mig/node_modules/pg");
}
const { Client } = pg;

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/db-apply.mjs <path/to/migration.sql>");
  process.exit(1);
}

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
if (!url) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied: ${file}`);
  await client.end();
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
}
