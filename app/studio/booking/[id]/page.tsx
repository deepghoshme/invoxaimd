import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStore } from "@/lib/auth";
import BookingBuilder from "@/components/booking/BookingBuilder";
import type { BookingContent } from "@/lib/booking";
import "../../../dashboard/dx.css";
import "../../../website.css";
import "../../../booking.css";

export const dynamic = "force-dynamic";

/**
 * Full-screen Booking Builder studio — opened in a new tab from the dashboard.
 *
 * Uses the same .dx.studio shell pattern as /studio/product/[id]/page.tsx.
 * Read-only when an admin is impersonating.
 */
export default async function StudioBooking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Impersonation-aware store resolution.
  const { store, impersonating } = await getCurrentStore();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  // Use admin client to fetch the page (covers impersonation: the page belongs
  // to the impersonated store, not the admin's store).
  const sb = createAdminClient();
  const { data: page } = await sb
    .from("pages")
    .select("id, title, public_id, content, seo, status, store_id, page_type")
    .eq("id", id)
    .maybeSingle();

  if (!page || page.store_id !== store.id || page.page_type !== "booking") notFound();

  const publicUrl = store.subdomain && page.public_id
    ? `https://${store.subdomain}.invoxai.io/book/${page.public_id}`
    : null;

  const readOnly = !!impersonating;

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard">
          <span className="dot" /> invoxai <em>Booking Builder</em>
        </a>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {readOnly && (
            <span style={{ fontSize: 11, fontWeight: 700, background: "var(--surface2)", color: "var(--muted)", padding: "4px 10px", borderRadius: 99 }}>
              Read-only
            </span>
          )}
          {publicUrl && page.status === "published" && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="studio-exit">
              View live ↗
            </a>
          )}
          <a className="studio-exit" href="/dashboard/booking">Exit ✕</a>
        </div>
      </div>
      <div className="studio-wrap">
        <BookingBuilder
          page={{
            id: page.id,
            title: page.title,
            public_id: page.public_id,
            content: (page.content ?? {}) as BookingContent,
            seo: (page.seo ?? {}) as Record<string, string>,
            status: page.status,
          }}
          publicUrl={publicUrl}
          storeName={store.store_name ?? "Store"}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
