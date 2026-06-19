import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreGateway } from "@/lib/sites";
import { DEFAULT_EVENT, type EventContent } from "@/lib/event";
import EventBuilder from "@/components/event/EventBuilder";
import "../../../dashboard/dx.css";
import "../../../website.css";

export const dynamic = "force-dynamic";

/**
 * Full-screen Event Builder (no dashboard chrome).
 * URL: /studio/event/[id]
 * Opened when creating or editing an event page.
 */
export default async function StudioEvent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createClient();

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await sb
    .from("stores")
    .select("id, subdomain, store_name, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: page } = await sb
    .from("pages")
    .select("id, title, public_id, content, status, store_id, page_type")
    .eq("id", id)
    .maybeSingle();

  if (!page || page.store_id !== store.id || page.page_type !== "event") notFound();

  const gateway = await getStoreGateway(store.id);
  const payEnabled = !!(gateway?.is_enabled && gateway.key_id && gateway.key_secret);

  const publicUrl = store.subdomain
    ? `https://${store.subdomain}.invoxai.io`
    : null;

  const content: EventContent = {
    ...DEFAULT_EVENT,
    ...((page.content ?? {}) as EventContent),
  };

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard/events">
          <span className="dot" /> invoxai <em>Event Builder</em>
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {payEnabled ? (
            <span
              style={{
                fontSize: 12,
                color: "var(--green)",
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "4px 10px",
              }}
            >
              Payments ready
            </span>
          ) : (
            <a
              href="/dashboard/settings/payments"
              style={{
                fontSize: 12,
                color: "var(--secondary)",
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "4px 10px",
                textDecoration: "none",
              }}
            >
              Connect payments →
            </a>
          )}
          <a className="studio-exit" href="/dashboard/events">
            Exit ✕
          </a>
        </div>
      </div>

      <div className="studio-wrap">
        <EventBuilder
          pageId={page.id}
          initial={content}
          initialStatus={page.status}
          publicUrl={publicUrl}
          payEnabled={payEnabled}
        />
      </div>
    </div>
  );
}
