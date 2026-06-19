import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LEADFORM, type LeadFormContent } from "@/lib/leadform";
import LeadFormBuilder from "@/components/leadform/LeadFormBuilder";
import "../../../dashboard/dx.css";
import "../../../website.css";

export const dynamic = "force-dynamic";

/**
 * Full-screen Lead Form Builder (no dashboard chrome).
 * URL: /studio/leadform/[id]
 */
export default async function StudioLeadForm({
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

  if (!page || page.store_id !== store.id || page.page_type !== "ldf") notFound();

  const publicUrl = store.subdomain
    ? `https://${store.subdomain}.invoxai.io`
    : null;

  const content: LeadFormContent = {
    ...DEFAULT_LEADFORM,
    ...((page.content ?? {}) as LeadFormContent),
  };

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard/leadform">
          <span className="dot" /> invoxai <em>Lead Form Builder</em>
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {publicUrl && page.status === "published" && (
            <a
              href={`${publicUrl}/ldf/${page.public_id}`}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12,
                color: "var(--green)",
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "4px 10px",
                textDecoration: "none",
              }}
            >
              View live ↗
            </a>
          )}
          <a className="studio-exit" href="/dashboard/leadform">
            Exit ✕
          </a>
        </div>
      </div>

      <div className="studio-wrap">
        <LeadFormBuilder
          pageId={page.id}
          publicId={page.public_id ?? ""}
          initial={content}
          initialStatus={page.status}
          publicUrl={publicUrl}
          storeId={store.id}
        />
      </div>
    </div>
  );
}
