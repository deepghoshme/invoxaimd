import { createClient } from "@/lib/supabase/server";
import PlansAdmin, { type Plan } from "./PlansAdmin";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const sb = await createClient();
  const { data } = await sb
    .from("plans")
    .select("id, name, price, page_limit, contact_limit, features, is_popular, interval, is_recommended")
    .order("sort_order");
  return <PlansAdmin plans={(data ?? []) as Plan[]} />;
}
