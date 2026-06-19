import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import TeamClient, { type TeamMember } from "./TeamClient";
import Pagination from "@/components/dx/Pagination";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team & Roles — invoxai" };

// ── Plan seat limits (placeholder until billing integration) ──────────────────
// TODO: derive from store's active plan once billing is wired.
const DEFAULT_SEAT_LIMIT = 8;
const PAGE_SIZE = 50;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // For team we still need the logged-in user's email for the owner display.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // ── Fetch team members — degrade gracefully if table doesn't exist ────────
  let members: TeamMember[] = [];
  let memberTotal = 0;
  let tableExists = true;

  try {
    const { data, error, count } = await sb
      .from("team_members")
      .select("id, email, full_name, avatar_url, role, status, invited_at", { count: "exact" })
      .eq("store_id", store.id)
      .order("invited_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      // PostgREST returns code 42P01 (undefined table) as a PGRST116-style error
      // or wraps it in the message. Treat both as "table not yet applied".
      const msg = error.message ?? "";
      if (
        msg.includes("relation") ||
        msg.includes("does not exist") ||
        error.code === "42P01" ||
        (error as { code?: string }).code === "PGRST200"
      ) {
        tableExists = false;
      } else {
        // A real, unexpected error — log server-side, show empty state
        console.error("[team/page] team_members query error:", error);
        tableExists = false;
      }
    } else {
      members = (data ?? []) as TeamMember[];
      memberTotal = count ?? 0;
    }
  } catch (err) {
    // Structural / network error — don't crash the page
    console.error("[team/page] unexpected error fetching team_members:", err);
    tableExists = false;
  }

  // ── Owner identity (from auth metadata — verified server-side) ───────────
  // Note: we use the logged-in user's metadata here, not the impersonated store's owner.
  // The team page shows the CALLER's identity as "owner" for display purposes.
  const meta = (user?.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
  };
  const ownerName = meta.full_name ?? meta.name ?? null;

  return (
    <>
      <TeamClient
        storeId={store.id}
        ownerEmail={user?.email ?? ""}
        ownerName={ownerName}
        members={members}
        seatLimit={DEFAULT_SEAT_LIMIT}
        tableExists={tableExists}
      />
      {memberTotal > PAGE_SIZE && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={memberTotal} baseParams={sp} />
      )}
    </>
  );
}
