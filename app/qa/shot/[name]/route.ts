import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Serve a QA screenshot from the non-served .qa-out/<name>.png via this
 * admin-gated handler (QA captures contain real account data, so they must NOT
 * live under public/). name is sanitised to block path traversal.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r) => r.role === "admin")) return new NextResponse("Forbidden", { status: 403 });

  const { name } = await params;
  const safe = name.replace(/[^a-z0-9_-]/gi, "");
  if (!safe) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await readFile(path.join(process.cwd(), ".qa-out", `${safe}.png`));
    return new NextResponse(buf, {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
