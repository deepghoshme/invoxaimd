import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// SECURITY: never trust a client-supplied storeId (IDOR / cross-tenant read).
// Resolve the caller's OWN store from their session and scope to it.
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const { data: store } = await sb
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return NextResponse.json([], { status: 403 });

  try {
    const { data, error } = await sb
      .from("upsell_offers")
      .select("*")
      .eq("store_id", store.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json([]);
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
