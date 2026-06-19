// Mint a real Supabase session cookie for an admin user, for LOCAL authenticated
// verification only. Uses the service-role key to generate a magic link, verifies
// it to obtain a session, then lets @supabase/ssr serialize the exact cookies the
// app expects. Prints a `Cookie:` header value on the last line.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// --- load .env.local ---
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.argv[2] || "iamdeep.mk@gmail.com";

const admin = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) generate a magic link to get a hashed_token we can verify
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
if (linkErr) { console.error("generateLink error:", linkErr.message); process.exit(1); }
const hashed = linkData?.properties?.hashed_token;
if (!hashed) { console.error("no hashed_token returned"); process.exit(1); }

// 2) verify the token_hash with the anon client to obtain a real session
const anon = createClient(URL_, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: vData, error: vErr } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: hashed });
if (vErr) { console.error("verifyOtp error:", vErr.message); process.exit(1); }
const session = vData.session;
const userId = vData.user.id;

// 3) confirm admin role
const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
const isAdmin = (roles ?? []).some((r) => r.role === "admin");

// 4) let @supabase/ssr serialize the cookies exactly as the app stores them
const jar = [];
const ssr = createServerClient(URL_, ANON, {
  cookies: {
    getAll: () => [],
    setAll: (toSet) => { for (const c of toSet) jar.push(c); },
  },
});
await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });

const cookieHeader = jar.map((c) => `${c.name}=${c.value}`).join("; ");
console.error(JSON.stringify({ email: EMAIL, userId, isAdmin, cookieCount: jar.length, names: jar.map((c) => c.name) }, null, 2));
process.stdout.write(cookieHeader);
