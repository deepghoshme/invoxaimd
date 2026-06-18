import { getPlansWithLimits } from "./actions";
import LimitsClient from "./LimitsClient";

export const dynamic = "force-dynamic";

export default async function AdminLimitsPage() {
  const plans = await getPlansWithLimits();
  return <LimitsClient plans={plans} />;
}
