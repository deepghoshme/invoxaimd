import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStore } from "@/lib/auth";
import VipBuilder from "@/components/vip/VipBuilder";
import { type VipContent, DEFAULT_VIP_CONTENT } from "@/lib/vip";
import "../../../dashboard/dx.css";
import "../../../website.css";

export const dynamic = "force-dynamic";

export default async function StudioVip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { store, impersonating } = await getCurrentStore();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, title, public_id, content, seo, status, store_id, page_type")
    .eq("id", id)
    .maybeSingle();

  if (!page || page.store_id !== store.id || page.page_type !== "vip") notFound();

  // Resolve payment gateway
  const { data: gw } = await admin
    .from("payment_gateways")
    .select("is_enabled, key_id, key_secret")
    .eq("store_id", store.id)
    .maybeSingle();
  const payEnabled = !!(gw?.is_enabled && gw.key_id && gw.key_secret);

  // Member count for this page (graceful — table may not exist yet)
  let memberCount = 0;
  try {
    const { count } = await admin
      .from("vip_members")
      .select("*", { count: "exact", head: true })
      .eq("page_id", page.id);
    memberCount = count ?? 0;
  } catch {
    memberCount = 0;
  }

  const publicUrl = store.subdomain && page.public_id
    ? `https://${store.subdomain}.invoxai.io/vip/${page.public_id}`
    : null;

  const content: VipContent = {
    ...DEFAULT_VIP_CONTENT,
    ...((page.content ?? {}) as VipContent),
  };

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard">
          <span className="dot" /> invoxai <em>VIP Builder</em>
        </a>
        <a className="studio-exit" href="/dashboard/vip">Exit ✕</a>
      </div>
      <div className="studio-wrap">
        <VipBuilder
          initial={content}
          pageId={page.id}
          publicUrl={publicUrl}
          initialStatus={page.status ?? "draft"}
          storeName={store.store_name ?? "Store"}
          memberCount={memberCount}
          payEnabled={payEnabled}
          readOnly={!!impersonating}
        />
      </div>
    </div>
  );
}
