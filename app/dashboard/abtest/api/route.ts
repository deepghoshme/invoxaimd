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
    const { data: tests } = await sb
      .from("ab_tests")
      .select("*, ab_variants(*)")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    const shaped = (tests ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      variants: t.ab_variants ?? [],
    }));

    return NextResponse.json(shaped);
  } catch {
    return NextResponse.json([]);
  }
}
