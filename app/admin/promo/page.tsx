import { createClient } from "@/lib/supabase/server";
import { getPromoCodes } from "./actions";
import PromoClient from "./PromoClient";

export const dynamic = "force-dynamic";

export default async function AdminPromoPage() {
  const [codes, plans] = await Promise.all([
    getPromoCodes(),
    (async () => {
      const sb = await createClient();
      const { data } = await sb
        .from("plans")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data ?? []) as { id: string; name: string }[];
    })(),
  ]);
  return <PromoClient codes={codes} plans={plans} />;
}
