/**
 * Verification script for 20260619170000_buyer_side.sql
 * Run: node scripts/verify-buyer-side.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pg;
try { pg = require("pg"); } catch { pg = require("/tmp/invox-mig/node_modules/pg"); }
const { Client } = pg;

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

async function q(label, sql, params=[]) {
  const r = await client.query(sql, params);
  console.log(`\n=== ${label} ===`);
  console.table(r.rows);
  return r.rows;
}

// (a) orders.buyer_id column
await q("orders.buyer_id column", `
  select column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public' and table_name = 'orders' and column_name = 'buyer_id'
`);

// (b) course_enrollments exists + RLS enabled
await q("course_enrollments table + RLS", `
  select t.table_name, c.relrowsecurity as rls_enabled
  from information_schema.tables t
  join pg_class c on c.relname = t.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where t.table_schema = 'public' and t.table_name = 'course_enrollments'
`);

// (c) All new policies
await q("All buyer-related policies created by this migration", `
  select schemaname, tablename, policyname, cmd, qual
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'orders_buyer_read',
      'course_enrollments_seller_read',
      'course_enrollments_buyer_read',
      'event_tickets_buyer_read',
      'vip_members_buyer_read',
      'bookings_buyer_read'
    )
  order by tablename, policyname
`);

// (d) buyer_id columns across all tables
await q("buyer_id columns on all purchase tables", `
  select table_name, column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and column_name = 'buyer_id'
    and table_name in ('orders', 'course_enrollments', 'event_tickets', 'vip_members', 'bookings')
  order by table_name
`);

// (e) jwt_verified_email function exists
await q("jwt_verified_email() function", `
  select routine_name, security_type, routine_type
  from information_schema.routines
  where routine_schema = 'public' and routine_name = 'jwt_verified_email'
`);

// (f) Indexes created
await q("New buyer_id indexes", `
  select indexname, tablename, indexdef
  from pg_indexes
  where schemaname = 'public'
    and indexname in (
      'orders_buyer_id_idx',
      'course_enrollments_buyer_id_idx',
      'course_enrollments_store_id_idx',
      'course_enrollments_page_buyer_uniq',
      'course_enrollments_page_email_uniq',
      'event_tickets_buyer_id_idx',
      'vip_members_buyer_id_idx',
      'bookings_buyer_id_idx'
    )
  order by tablename, indexname
`);

// (g) RLS enabled on all relevant tables
await q("RLS enabled on all purchase tables", `
  select relname as table_name, relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and relname in ('orders', 'course_enrollments', 'event_tickets', 'vip_members', 'bookings')
  order by relname
`);

// (h) course_enrollments unique indexes
await q("course_enrollments unique indexes", `
  select indexname, indexdef
  from pg_indexes
  where schemaname = 'public' and tablename = 'course_enrollments'
  order by indexname
`);

await client.end();
console.log("\n--- Verification complete ---");
