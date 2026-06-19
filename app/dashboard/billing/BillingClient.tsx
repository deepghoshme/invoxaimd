"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { selectPlan } from "./actions";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

type Plan = {
  id: string;
  name: string;
  price: number;
  contact_limit: number | null;
  features: string[];
  is_popular: boolean;
};

type CurrentSub = {
  plan_id: string;
  status: string;
  amount_paise: number;
  current_period_end: string;
  plan: { name: string; price: number };
} | null;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PlanCard({
  plan,
  isCurrent,
  onSelect,
  busy,
}: {
  plan: Plan;
  isCurrent: boolean;
  onSelect: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className={`bl-plan${plan.is_popular ? " feat" : ""}${isCurrent ? " current" : ""}`}>
      {plan.is_popular && <span className="dx-ribbon">Popular</span>}
      {isCurrent && <span className="bl-cur-badge">Current plan</span>}
      <div className="bl-plan-name">{plan.name}</div>
      <div className="bl-plan-price">
        {plan.price === 0 ? (
          <span className="bl-free">Free</span>
        ) : (
          <>
            <span className="bl-amount">
              ₹{plan.price.toLocaleString("en-IN")}
            </span>
            <span className="bl-per"> /mo</span>
          </>
        )}
      </div>
      <ul className="bl-flist">
        {plan.features
          // Drop any feature that just restates the contact count — it's
          // rendered once as the dedicated line below (avoids the duplicate
          // "N contacts" bullet on every plan card).
          .filter((f) => !/^[\d,]+\s+contacts$/i.test(f.trim()))
          .map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        {plan.contact_limit != null && (
          <li>{plan.contact_limit.toLocaleString("en-IN")} contacts</li>
        )}
      </ul>
      <button
        className={`btn${isCurrent ? " ghost" : " grad"}`}
        style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
        disabled={isCurrent || busy}
        onClick={() => !isCurrent && onSelect(plan.id)}
      >
        {isCurrent ? "Current plan" : busy ? "Switching…" : plan.price === 0 ? "Downgrade to Free" : "Select plan"}
      </button>
    </div>
  );
}

export default function BillingClient({
  plans,
  currentSub,
  migrationPending,
}: {
  plans: Plan[];
  currentSub: CurrentSub;
  migrationPending: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSelect(planId: string) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    setBusy(true);
    setMsg(null);

    // Free plan → switch immediately, no charge.
    if (!plan.price || plan.price <= 0) {
      const res = await selectPlan(planId);
      setBusy(false);
      if (res.ok) {
        setMsg({ text: "Plan updated.", ok: true });
        router.refresh();
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg({ text: res.error ?? "Failed to update plan.", ok: false });
      }
      return;
    }

    // Paid plan → charge via the platform Razorpay gateway, then activate.
    if (!(await loadRazorpay())) {
      setBusy(false);
      return setMsg({ text: "Couldn’t load the payment library. Check your connection.", ok: false });
    }
    try {
      const sRes = await fetch("/api/plans/subscribe/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const start = await sRes.json();
      if (!sRes.ok) throw new Error(start.error || "Couldn’t start payment.");

      const rzp = new window.Razorpay!({
        key: start.key_id,
        order_id: start.razorpay_order_id,
        amount: start.amount,
        currency: start.currency,
        name: "invoxai",
        description: `${start.plan_name} plan`,
        theme: { color: "#FF6A3D" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (resp: Record<string, string>) => {
          try {
            const vRes = await fetch("/api/plans/subscribe/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan_id: planId,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            const v = await vRes.json();
            if (!vRes.ok || !v.ok) throw new Error(v.error || "Verification failed");
            setMsg({ text: "Plan activated ✓", ok: true });
            router.refresh();
            setTimeout(() => setMsg(null), 3000);
          } catch (e) {
            setMsg({ text: e instanceof Error ? e.message : "Verification failed", ok: false });
          } finally {
            setBusy(false);
          }
        },
      });
      rzp.open();
    } catch (e) {
      setBusy(false);
      setMsg({ text: e instanceof Error ? e.message : "Payment failed", ok: false });
    }
  }

  return (
    <>
      <style>{`
        .bl-migration-banner {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 18px; margin-bottom: 18px;
          font-size: 13px; line-height: 1.5;
        }
        .bl-migration-banner code {
          display: inline-block; background: var(--bg); border: 1px solid var(--border);
          border-radius: 6px; padding: 2px 7px; font-size: 12px; font-family: monospace;
        }
        .bl-cur-card {
          background: var(--grad); color: #fff; border-radius: 18px;
          padding: 22px 24px; position: relative; overflow: hidden; margin-bottom: 20px;
        }
        .bl-cur-card::after {
          content: ""; position: absolute; inset: 0;
          background: radial-gradient(60% 120% at 85% 0%, rgba(255,255,255,.22), transparent 60%);
        }
        .bl-cur-card > * { position: relative; z-index: 1; }
        .bl-cur-card .cc-label { font-size: 12.5px; opacity: .85; }
        .bl-cur-card .cc-name {
          font-family: var(--font-sora, Sora, sans-serif); font-weight: 800;
          font-size: 26px; margin: 3px 0 6px; letter-spacing: -.02em;
        }
        .bl-cur-card .cc-sub { font-size: 13px; opacity: .9; }
        .bl-cur-card .cc-renew { font-size: 12px; opacity: .75; margin-top: 4px; }
        .bl-no-sub {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px 22px; margin-bottom: 20px;
          font-size: 13.5px; color: var(--muted); text-align: center;
        }
        .bl-plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
        .bl-plan {
          background: var(--surface); border: 1.5px solid var(--border);
          border-radius: 16px; padding: 20px; position: relative; overflow: hidden;
          display: flex; flex-direction: column; gap: 6px;
          box-shadow: var(--shadow);
        }
        .bl-plan.feat { border-color: var(--primary); }
        .bl-plan.current { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
        .bl-cur-badge {
          position: absolute; top: 10px; right: 12px;
          font-size: 11px; font-weight: 700; color: var(--accent);
          background: color-mix(in srgb, var(--accent) 14%, transparent);
          border-radius: 6px; padding: 2px 8px;
        }
        .bl-plan-name { font-weight: 700; font-size: 16px; font-family: var(--font-sora, Sora, sans-serif); }
        .bl-plan-price { margin: 4px 0 8px; }
        .bl-free { font-size: 22px; font-weight: 800; font-family: var(--font-sora, Sora, sans-serif); }
        .bl-amount { font-size: 24px; font-weight: 800; font-family: var(--font-sora, Sora, sans-serif); letter-spacing: -.02em; }
        .bl-per { font-size: 13px; color: var(--muted); }
        .bl-flist { list-style: none; padding: 0; margin: 0 0 4px; display: flex; flex-direction: column; gap: 5px; }
        .bl-flist li { font-size: 13px; color: var(--text); display: flex; align-items: center; gap: 7px; }
        .bl-flist li::before { content: "✓"; color: var(--primary); font-weight: 700; font-size: 12px; flex: none; }
        .bl-msg { margin-top: 14px; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; }
        .bl-msg.ok { background: color-mix(in srgb, var(--green) 14%, transparent); color: var(--green); }
        .bl-msg.err { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary); }
        .bl-note { font-size: 12px; color: var(--muted); margin-top: 14px; line-height: 1.6; }
        @media (max-width: 480px) { .bl-plans-grid { grid-template-columns: 1fr; } }
      `}</style>

      {migrationPending && (
        <div className="bl-migration-banner">
          <strong>Subscriptions table not applied yet.</strong> Admin: run{" "}
          <code>node scripts/db-apply.mjs supabase/migrations/20260618310000_subscriptions.sql</code>{" "}
          to enable real plan selection. Plan cards are shown below for preview.
        </div>
      )}

      {/* Current subscription status card */}
      {!migrationPending && currentSub ? (
        <div className="bl-cur-card">
          <div className="cc-label">Current plan</div>
          <div className="cc-name">{currentSub.plan.name}</div>
          <div className="cc-sub">
            {currentSub.plan.price === 0
              ? "Free plan"
              : `₹${currentSub.plan.price.toLocaleString("en-IN")} / month`}
            {" · "}
            <span style={{ textTransform: "capitalize" }}>{currentSub.status}</span>
          </div>
          {currentSub.current_period_end && (
            <div className="cc-renew">
              Renews {fmtDate(currentSub.current_period_end)}
            </div>
          )}
        </div>
      ) : !migrationPending ? (
        <div className="bl-no-sub">
          No active plan selected. Pick one below to get started.
        </div>
      ) : null}

      {/* Plan cards */}
      <div className="bl-plans-grid">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={!migrationPending && currentSub?.plan_id === plan.id && currentSub?.status === "active"}
            onSelect={handleSelect}
            busy={busy}
          />
        ))}
      </div>

      {/* Feedback message */}
      {msg && (
        <div className={`bl-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>
      )}

      {!migrationPending && (
        <p className="bl-note">
          Free plans switch instantly. Paid plans are charged securely via
          Razorpay and activate as soon as payment succeeds.
        </p>
      )}
    </>
  );
}
