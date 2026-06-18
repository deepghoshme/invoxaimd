import { ADMIN_PAGES } from "@/components/dx/adminPages";
import { ComingSoon } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function AdminCatchAll({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const render = ADMIN_PAGES[slug[0] ?? ""];
  if (render) return <>{await render()}</>;
  const title = (slug[0] ?? "Page").charAt(0).toUpperCase() + (slug[0] ?? "").slice(1);
  return <ComingSoon title={title} />;
}
