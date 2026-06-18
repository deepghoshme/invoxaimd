"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertNotImpersonating } from "@/lib/impersonation";

export async function updateSplit(testId: string, split: number) {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return;
  const sb = await createClient();
  await sb
    .from("ab_tests")
    .update({ traffic_split: split })
    .eq("id", testId);
  revalidatePath("/dashboard/abtest");
}

export async function declareWinner(testId: string, winner: "A" | "B") {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return;
  const sb = await createClient();
  await sb
    .from("ab_tests")
    .update({ winner, status: "done", ended_at: new Date().toISOString() })
    .eq("id", testId);
  revalidatePath("/dashboard/abtest");
}

export async function createTest(
  storeId: string,
  name: string,
  headlineA: string,
  headlineB: string
): Promise<{ error?: string }> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { error: guard.error };
  const sb = await createClient();

  const { data: test, error: testErr } = await sb
    .from("ab_tests")
    .insert({ store_id: storeId, name, status: "running", traffic_split: 50 })
    .select("id")
    .single();

  if (testErr || !test) {
    return { error: testErr?.message ?? "Failed to create test" };
  }

  const { error: varErr } = await sb.from("ab_variants").insert([
    { test_id: test.id, key: "A", headline: headlineA },
    { test_id: test.id, key: "B", headline: headlineB },
  ]);

  if (varErr) {
    return { error: varErr.message };
  }

  revalidatePath("/dashboard/abtest");
  return {};
}
