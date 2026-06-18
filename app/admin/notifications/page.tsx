import { getPlatformNotifications } from "@/lib/notifications";
import AdminNotificationsFeed from "./AdminNotificationsFeed";

export const dynamic = "force-dynamic";

export const metadata = { title: "Platform Notifications — invoxai Admin" };

export default async function AdminNotificationsPage() {
  const items = await getPlatformNotifications();
  return <AdminNotificationsFeed items={items} />;
}
