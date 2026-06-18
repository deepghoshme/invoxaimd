import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  if (!storeId) {
    return NextResponse.json([], { status: 400 });
  }

  const sb = await createClient();

  try {
    const { data: tests } = await sb
      .from("ab_tests")
      .select("*, ab_variants(*)")
      .eq("store_id", storeId)
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
