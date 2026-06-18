import { getCategories } from "./actions";
import CommissionClient from "./CommissionClient";

export const dynamic = "force-dynamic";

export default async function AdminCommissionPage() {
  const cats = await getCategories();
  return <CommissionClient categories={cats} />;
}
