import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ──────────────────────────────────────────────────────────────────────────────
// Shared notification shape — used by bell dropdown + full feed pages
// ──────────────────────────────────────────────────────────────────────────────
export interface NotifItem {
  id: string;
  cat: "orders" | "money" | "reviews" | "system";
  icon: string;    // emoji
  title: string;
  sub: string;
  ts: string;      // ISO timestamp — client formats it
  href?: string;   // optional deep-link
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────────────────────────────────────
function inr(paise: number): string {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

// ──────────────────────────────────────────────────────────────────────────────
// getStoreNotifications
// Derives notifications for ONE seller store from orders + site_messages.
// No new table — all derived at query time.
// ──────────────────────────────────────────────────────────────────────────────
export async function getStoreNotifications(storeId: string): Promise<NotifItem[]> {
  const supabase = createAdminClient();

  const [{ data: orders }, { data: messages }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, product_title, buyer_name, buyer_email, amount, currency, paid_at, created_at")
      .eq("store_id", storeId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(30),

    supabase
      .from("site_messages")
      .select("id, kind, name, email, message, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const items: NotifItem[] = [];

  for (const o of orders ?? []) {
    const buyer = o.buyer_name || o.buyer_email || "Someone";
    const product = o.product_title || "your product";
    items.push({
      id: `order-${o.id}`,
      cat: "orders",
      icon: "🛒",
      title: `New sale · ${product}`,
      sub: `${buyer} paid ${inr(o.amount)}`,
      ts: o.paid_at ?? o.created_at,
      href: "/dashboard/orders",
    });
  }

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
        href: "/dashboard/crm",
      });
    } else {
      const preview = m.message
        ? `"${m.message.slice(0, 60)}${m.message.length > 60 ? "…" : ""}"`
        : "No message body";
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

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return items;
}

// ──────────────────────────────────────────────────────────────────────────────
// getPlatformNotifications
// Derives platform-wide notifications for admin: new orders (any seller),
// new store sign-ups, new contact messages, new custom-domain requests.
// Sorted desc, limit 50.
// ──────────────────────────────────────────────────────────────────────────────
export async function getPlatformNotifications(): Promise<NotifItem[]> {
  const supabase = createAdminClient();

  const [
    { data: orders },
    { data: stores },
    { data: messages },
    { data: domains },
  ] = await Promise.all([
    // Recent paid orders across ALL stores — join store name
    supabase
      .from("orders")
      .select("id, product_title, buyer_name, buyer_email, amount, currency, paid_at, created_at, store_id, stores(store_name)")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(20),

    // New store sign-ups (newest first)
    supabase
      .from("stores")
      .select("id, store_name, created_at, owner_id")
      .order("created_at", { ascending: false })
      .limit(20),

    // All contact messages (platform-wide)
    supabase
      .from("site_messages")
      .select("id, kind, name, email, message, created_at, store_id, stores(store_name)")
      .order("created_at", { ascending: false })
      .limit(15),

    // Custom domain requests
    supabase
      .from("custom_domains")
      .select("id, domain, status, created_at, store_id, stores(store_name)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const items: NotifItem[] = [];

  for (const o of orders ?? []) {
    const storeName =
      (o.stores as { store_name?: string | null } | null)?.store_name ?? "a store";
    const buyer = o.buyer_name || o.buyer_email || "Someone";
    const product = o.product_title || "a product";
    items.push({
      id: `platform-order-${o.id}`,
      cat: "orders",
      icon: "🛒",
      title: `New sale on ${storeName}`,
      sub: `${buyer} bought "${product}" · ${inr(o.amount)}`,
      ts: o.paid_at ?? o.created_at,
      href: "/admin/sellers",
    });
  }

  for (const s of stores ?? []) {
    items.push({
      id: `platform-store-${s.id}`,
      cat: "system",
      icon: "🏪",
      title: `New seller joined`,
      sub: s.store_name ? `"${s.store_name}" just signed up` : "New store created",
      ts: s.created_at,
      href: "/admin/sellers",
    });
  }

  for (const m of messages ?? []) {
    const storeName =
      (m.stores as { store_name?: string | null } | null)?.store_name ?? "a store";
    const sender = m.name || m.email || "Someone";
    if (m.kind === "newsletter") {
      items.push({
        id: `platform-msg-${m.id}`,
        cat: "system",
        icon: "📬",
        title: `Newsletter signup on ${storeName}`,
        sub: `${sender} joined ${storeName}'s list`,
        ts: m.created_at,
      });
    } else {
      const preview = m.message
        ? `"${m.message.slice(0, 55)}${m.message.length > 55 ? "…" : ""}"`
        : "No body";
      items.push({
        id: `platform-msg-${m.id}`,
        cat: "system",
        icon: "✉️",
        title: `Message to ${storeName}`,
        sub: `${sender}: ${preview}`,
        ts: m.created_at,
      });
    }
  }

  for (const d of domains ?? []) {
    const storeName =
      (d.stores as { store_name?: string | null } | null)?.store_name ?? "a store";
    items.push({
      id: `platform-domain-${d.id}`,
      cat: "system",
      icon: "🌐",
      title: `Domain request: ${d.domain}`,
      sub: `${storeName} · status: ${d.status}`,
      ts: d.created_at,
      href: "/admin/domains",
    });
  }

  items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return items.slice(0, 50);
}
