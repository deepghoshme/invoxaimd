import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Save VIP page content (and optionally publish/unpublish).
 * Only the authenticated store owner may save their own VIP page.
 */
export async function POST(req: Request) {
  let body: { page_id?: string; content?: unknown; publish?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { page_id, content, publish } = body;
  if (!page_id) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });

  // Auth: require a session
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve the store
  const { data: store } = await sb
    .from("stores")
    .select("id, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store?.onboarding_completed) return NextResponse.json({ error: "Store not ready" }, { status: 403 });

  const admin = createAdminClient();

  // Verify page ownership
  const { data: page } = await admin
    .from("pages")
    .select("id, store_id, page_type, status")
    .eq("id", page_id)
    .maybeSingle();
  if (!page || page.store_id !== store.id || page.page_type !== "vip") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { content };
  if (publish === true) patch.status = "published";
  if (publish === false) patch.status = "draft";

  const { error } = await admin.from("pages").update(patch).eq("id", page_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
