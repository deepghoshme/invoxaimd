import { analyticsPage } from "@/components/dx/sellerPages";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ pg?: string }>;
}) {
  const sp = await searchParams;
  return <>{await analyticsPage(sp.pg)}</>;
}
