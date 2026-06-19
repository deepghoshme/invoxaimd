import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PaymentRedirect() {
  redirect("/dashboard/pages/products");
}
