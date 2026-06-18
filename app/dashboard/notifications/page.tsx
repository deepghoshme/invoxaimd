import { requireDashboardStore } from "@/lib/auth";
import { getStoreNotifications } from "@/lib/notifications";
import NotificationsFeed from "./NotificationsFeed";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notifications — invoxai" };

// Re-export the shared type so NotificationsFeed can still import it from here
// (backward-compat with its existing `import type { NotifItem } from "./page"`)
export type { NotifItem } from "@/lib/notifications";

export default async function NotificationsPage() {
  const { store } = await requireDashboardStore();
  const items = await getStoreNotifications(store.id);
  return <NotificationsFeed items={items} storeName={store.store_name ?? "Your store"} />;
}
