import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/auth";
import { getStoreNotifications, getPlatformNotifications } from "@/lib/notifications";

/**
 * GET /api/notifications?scope=seller|admin
 *
 * Lightweight poll endpoint for the in-dashboard notification chime.
 * Reuses the SAME derivation as the server-rendered bell dropdown
 * (getStoreNotifications / getPlatformNotifications) — no duplicate query.
 *
 * Returns only what the client needs to detect "something new arrived":
 *   { ids: string[], count: number }
 * The client compares the newest id against its last-seen id (per scope) and
 * plays a chime when a previously-unseen id appears. Read/unread state still
 * lives entirely in localStorage on the client (invox_notif_read /
 * invox_admin_notif_read) — this route is purely a freshness signal.
 *
 * Scope is validated against the caller's real privileges:
 *  - admin scope requires an `admin` user_role
 *  - seller scope resolves the caller's own (or impersonated) store
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = new URL(req.url).searchParams.get("scope") === "admin" ? "admin" : "seller";

  if (scope === "admin") {
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const items = await getPlatformNotifications();
    return NextResponse.json(
      { ids: items.map((i) => i.id), count: items.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { store } = await getCurrentStore();
  const items = store ? await getStoreNotifications(store.id) : [];
  return NextResponse.json(
    { ids: items.map((i) => i.id), count: items.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
