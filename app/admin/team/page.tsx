import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TeamClient, { type AdminMember } from "./TeamClient";
import Pagination from "@/components/dx/Pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // ── Auth: verify caller is admin ─────────────────────────────────────────
  // The layout already guards this route, but we re-check here so this page
  // is safe even if accessed via a direct server fetch (belt + suspenders).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: selfRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (selfRoles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) redirect("/admin");

  // ── Data: all admin role rows + their profiles ───────────────────────────
  // Use the admin client (service-role) so we can read all user_roles rows
  // regardless of whose profile they belong to.
  const sb = createAdminClient();

  const { data: adminRoles, error: rolesErr, count: adminCount } = await sb
    .from("user_roles")
    .select("user_id, created_at", { count: "exact" })
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (rolesErr) {
    console.error("[admin/team] Failed to load admin roles:", rolesErr.message);
  }

  const rows = adminRoles ?? [];
  const memberTotal = adminCount ?? 0;

  // Fetch profiles for all admin user_ids in one query.
  const adminIds = rows.map((r) => r.user_id as string);
  const { data: profileRows } =
    adminIds.length > 0
      ? await sb
          .from("profiles")
          .select("id, email, full_name")
          .in("id", adminIds)
      : { data: [] };

  const profileMap = Object.fromEntries(
    (profileRows ?? []).map((p: { id: string; email: string; full_name: string | null }) => [
      p.id,
      p,
    ])
  );

  const members: AdminMember[] = rows.map((r) => {
    const profile = profileMap[r.user_id as string] as
      | { id: string; email: string; full_name: string | null }
      | undefined;
    return {
      userId: r.user_id as string,
      email: profile?.email ?? "(email missing)",
      fullName: profile?.full_name ?? null,
      grantedAt: r.created_at as string,
      isSelf: r.user_id === user.id,
    };
  });

  return (
    <>
      <TeamClient members={members} currentUserId={user.id} />
      {memberTotal > PAGE_SIZE && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={memberTotal} baseParams={sp} />
      )}
    </>
  );
}
