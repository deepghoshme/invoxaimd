import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import { DEFAULT_VIP_CONTENT } from "@/lib/vip";

/**
 * Create a new VIP community page row in `pages` and return the page id
 * so the dashboard can redirect to /studio/vip/[id].
 */
export async function POST(req: Request) {
  // Auth
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: store } = await sb
    .from("stores")
    .select("id, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store?.onboarding_completed) return NextResponse.json({ error: "Store not ready" }, { status: 403 });

  const admin = createAdminClient();

  const { data: page, error } = await admin
    .from("pages")
    .insert({
      store_id: store.id,
      page_type: "vip",
      title: "My VIP Community",
      public_id: publicId(),
      content: DEFAULT_VIP_CONTENT,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !page) {
    return NextResponse.json({ error: error?.message ?? "Could not create page" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, page_id: page.id });
}
