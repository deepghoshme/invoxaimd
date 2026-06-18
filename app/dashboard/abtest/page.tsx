import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis } from "@/components/dx/ui";
import ABTestClient, { type ABTest } from "./ABTestClient";

export const dynamic = "force-dynamic";

export default async function ABTestPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  /* graceful degradation: tables may not exist yet */
  let tests: ABTest[] = [];
  let migrationPending = false;

  try {
    const { data: testRows, error } = await sb
      .from("ab_tests")
      .select("*, ab_variants(*)")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    if (error) {
      // relation does not exist → migration not applied
      if (
        error.message.includes("relation") ||
        error.message.includes("does not exist") ||
        error.code === "42P01"
      ) {
        migrationPending = true;
      }
    } else {
      tests = (testRows ?? []).map(
        (t: Record<string, unknown>): ABTest => ({
          id: t.id as string,
          name: t.name as string,
          status: t.status as "running" | "done" | "paused",
          traffic_split: t.traffic_split as number,
          winner: (t.winner as "A" | "B" | null) ?? null,
          created_at: t.created_at as string,
          ended_at: (t.ended_at as string | null) ?? null,
          page_id: (t.page_id as string | null) ?? null,
          variants: ((t.ab_variants as unknown[]) ?? []).map(
            (v: unknown) => {
              const vr = v as Record<string, unknown>;
              return {
                id: vr.id as string,
                key: vr.key as "A" | "B",
                headline: (vr.headline as string) ?? "",
                visitors: (vr.visitors as number) ?? 0,
                conversions: (vr.conversions as number) ?? 0,
                revenue_paise: (vr.revenue_paise as number) ?? 0,
              };
            }
          ),
        })
      );
    }
  } catch {
    migrationPending = true;
  }

  /* analytics KPIs (computed from loaded data, not fake) */
  const running = tests.filter((t) => t.status === "running").length;
  const done = tests.filter((t) => t.status === "done").length;
  const totalVisitors = tests.reduce(
    (acc, t) =>
      acc + t.variants.reduce((s, v) => s + v.visitors, 0),
    0
  );
  const testsWithWinner = tests.filter((t) => t.winner).length;

  return (
    <>
      <Phead
        title="A/B Tests"
        sub="Split-test headlines and page variants to maximise conversions."
      />

      {!migrationPending && (
        <Kpis
          items={[
            {
              icon: "chart",
              color: "var(--primary)",
              label: "Running",
              value: String(running),
            },
            {
              icon: "eye",
              color: "var(--secondary)",
              label: "Total visitors",
              value: totalVisitors.toLocaleString("en-IN"),
            },
            {
              icon: "bag",
              color: "var(--green)",
              label: "Completed",
              value: String(done),
            },
            {
              icon: "tag",
              color: "var(--accent)",
              label: "Winners declared",
              value: String(testsWithWinner),
            },
          ]}
        />
      )}

      <ABTestClient
        storeId={store.id}
        initial={tests}
        migrationPending={migrationPending}
      />
    </>
  );
}
