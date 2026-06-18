import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Phead, Kpis, Card, AreaChart } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

const inr = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("stores")
    .select("id, store_name, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: paid } = await supabase
    .from("orders")
    .select("amount")
    .eq("store_id", store.id)
    .eq("status", "paid");
  const { count: orderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("store_id", store.id);
  const revenue = (paid ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);

  return (
    <>
      <Phead
        title={`${store.store_name || "Dashboard"} 👋`}
        sub="How your store is doing today."
        action={<a className="btn grad" href="/dashboard/pages/products">+ New page</a>}
      />

      <Kpis
        items={[
          { icon: "rupee", color: "var(--primary)", label: "Revenue (paid)", value: inr(revenue) },
          { icon: "bag", color: "var(--secondary)", label: "Orders", value: String(orderCount ?? 0) },
          { icon: "eye", color: "var(--accent)", label: "Visitors", value: "—" },
          { icon: "wallet", color: "var(--gold)", label: "Wallet", value: "₹0" },
        ]}
      />

      <div className="dx-grid dx-cols">
        <div>
          <Card title="Revenue" link="paid orders">
            <AreaChart />
          </Card>
        </div>
        <div>
          <div className="dx-card" style={{ background: "var(--grad)", color: "#fff", border: 0, marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, opacity: 0.85 }}>Wallet balance</div>
            <div style={{ fontFamily: "var(--font-sora), sans-serif", fontSize: 26, fontWeight: 700, marginTop: 3 }}>₹0</div>
            <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 8 }}>Commission billed via wallet. Daily invoice 11 PM.</div>
            <a className="btn" href="/dashboard/wallet" style={{ marginTop: 12, width: "100%", justifyContent: "center", background: "rgba(255,255,255,.95)", color: "#7a2f1c" }}>Recharge</a>
          </div>
          <Card title="Quick start">
            <div className="dx-mrow"><div className="tx"><b>Build your bio page</b><p>Link-in-bio with all your links.</p></div><a className="dx-editbtn" href="/dashboard/pages/bio">Open</a></div>
            <div className="dx-mrow"><div className="tx"><b>Create a product</b><p>One-page checkout in minutes.</p></div><a className="dx-editbtn" href="/dashboard/pages/products">Open</a></div>
            <div className="dx-mrow"><div className="tx"><b>Connect payments</b><p>Receive money via Razorpay.</p></div><a className="dx-editbtn" href="/dashboard/settings/payments">Open</a></div>
          </Card>
        </div>
      </div>
    </>
  );
}
