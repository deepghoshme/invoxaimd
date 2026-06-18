import { ADMIN_PAGES } from "@/components/dx/adminPages";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  return <>{await ADMIN_PAGES.overview()}</>;
}
