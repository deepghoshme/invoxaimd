import { getPromoCodes } from "./actions";
import PromoClient from "./PromoClient";

export const dynamic = "force-dynamic";

export default async function AdminPromoPage() {
  const codes = await getPromoCodes();
  return <PromoClient codes={codes} />;
}
