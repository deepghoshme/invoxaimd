import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import NotificationsFeed from "./NotificationsFeed";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notifications — invoxai" };

// ──────────────────────────────────────────────────────────────────────────────
// Shape that the client feed expects
// ──────────────────────────────────────────────────────────────────────────────
export interface NotifItem {
  id: string;
  cat: "orders" | "money" | "reviews" | "system";
  icon: string;       // emoji
  title: string;
  sub: string;
  ts: string;         // ISO timestamp — client formats it
}

// ──────────────────────────────────────────────────────────────────────────────
// Server component — fetch real data, map to NotifItem[]
// ──────────────────────────────────────────────────────────────────────────────
export default async function NotificationsPage() {
  const { store } = await requireDashboardStore();
  const supabase = createAdminClient();

  // ── 1. Paid orders → Orders + Money notifications ──────────────────────────
  const { data: orders } = await supabase
    .from("orders")
    .select("id, product_title, buyer_name, buyer_email, amount, currency, paid_at, created_at")
    .eq("store_id", store.id)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(30);

  // ── 2. Site messages (contact / newsletter leads) → System notifications ───
  const { data: messages } = await supabase
    .from("site_messages")
    .select("id, kind, name, email, message, created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const items: NotifItem[] = [];

  // Map paid orders → "orders" notifications (one per order)
  for (const o of orders ?? []) {
    const inr = (paise: number) =>
      "₹" + Math.round(paise / 100).toLocaleString("en-IN");
    const buyer = o.buyer_name || o.buyer_email || "Someone";
    const product = o.product_title || "your product";
    items.push({
      id: `order-${o.id}`,
      cat: "orders",
      icon: "🛒",
      title: `New sale · ${product}`,
      sub: `${buyer} paid ${inr(o.amount)}`,
      ts: o.paid_at ?? o.created_at,
    });
  }

  // Map site_messages → "system" notifications (contact leads)
  for (const m of messages ?? []) {
    const sender = m.name || m.email || "Someone";
    if (m.kind === "newsletter") {
      items.push({
        id: `msg-${m.id}`,
        cat: "system",
        icon: "📬",
        title: "New newsletter subscriber",
        sub: `${sender} joined your list`,
        ts: m.created_at,
      });
    } else {
      const preview = m.message ? `"${m.message.slice(0, 60)}${m.message.length > 60 ? "…" : ""}"` : "No message body";
      items.push({
        id: `msg-${m.id}`,
        cat: "system",
        icon: "✉️",
        title: `New message from ${sender}`,
        sub: preview,
        ts: m.created_at,
      });
    }
  }

  // Sort all by timestamp descending
  items.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );

  return <NotificationsFeed items={items} storeName={store.store_name ?? "Your store"} />;
}
