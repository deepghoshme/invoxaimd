import { SELLER_PAGES } from "@/components/dx/sellerPages";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  return <>{await SELLER_PAGES.product()}</>;
}
