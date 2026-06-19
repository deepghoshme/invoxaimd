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
  interval: "monthly" | "annual";
  is_recommended: boolean;
};

type CurrentSub = {
  plan_id: string;
  status: string;
  amount_paise: number;
  current_period_end: string;
  plan: { name: string; price: number; interval: string };
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
  const perLabel = plan.interval === "annual" ? "/yr" : "/mo";
  return (
    <div
      className={`bl-plan${plan.is_popular ? " feat" : ""}${plan.is_recommended ? " recommended" : ""}${isCurrent ? " current" : ""}`}
    >
      {plan.is_popular && <span className="dx-ribbon">Popular</span>}
      {plan.is_recommended && !plan.is_popular && (
        <span className="dx-ribbon bl-ribbon-rec">Recommended</span>
      )}
      {isCurrent && <span className="bl-cur-badge">Current plan</span>}
      <div className="bl-plan-name">{plan.name}</div>
      <div className="bl-plan-price">
        {plan.price === 0 ? (
          <span className="bl-free">Free</span>
        ) : (
          <>
            <span className="bl-amount">
              {"₹"}{plan.price.toLocaleString("en-IN")}
            </span>
            <span className="bl-per"> {perLabel}</span>
          </>
        )}
      </div>
      <ul className="bl-flist">
        {plan.features
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
        {isCurrent
          ? "Current plan"
          : busy
          ? "Switching..."
          : plan.price === 0
          ? "Downgrade to Free"
          : "Select plan"}
      </button>
    </div>
  );
}

type IntervalToggle = "monthly" | "annual";

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

  // Determine whether to show the toggle based on whether there are any annual plans
  const hasAnnual = plans.some((p) => p.interval === "annual");
  const hasMonthly = plans.some((p) => p.interval === "monthly");
  const showToggle = hasAnnual && hasMonthly;

  // Default to the interval of the current subscription if available, else monthly
  const defaultInterval: IntervalToggle =
    currentSub?.plan?.interval === "annual" ? "annual" : "monthly";
  const [selectedInterval, setSelectedInterval] = useState<IntervalToggle>(defaultInterval);

  // Filter plans by selected interval (free plans show under monthly)
  const filteredPlans = plans.filter((p) => {
    if (p.price === 0) return selectedInterval === "monthly";
    return p.interval === selectedInterval;
  });

  // Annual savings hint: if any monthly plan has a corresponding annual plan,
  // we can show a savings percentage. We derive this by comparing the cheapest
  // paid monthly vs. annual per-month equivalent price.
  const cheapestMonthlyPaid = plans.filter((p) => p.interval === "monthly" && p.price > 0)
    .reduce<Plan | null>((acc, p) => (!acc || p.price < acc.price ? p : acc), null);
  const cheapestAnnualPaid = plans.filter((p) => p.interval === "annual" && p.price > 0)
    .reduce<Plan | null>((acc, p) => (!acc || p.price < acc.price ? p : acc), null);

  let annualSavingsHint: string | null = null;
  if (cheapestMonthlyPaid && cheapestAnnualPaid) {
    const monthlyPerYear = cheapestMonthlyPaid.price * 12;
    const annualCost = cheapestAnnualPaid.price;
    if (annualCost < monthlyPerYear) {
      const savePct = Math.round(((monthlyPerYear - annualCost) / monthlyPerYear) * 100);
      if (savePct > 0) annualSavingsHint = `Save up to ${savePct}% with annual billing`;
    }
  }

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
      return setMsg({ text: "Couldn't load the payment library. Check your connection.", ok: false });
    }
    try {
      const sRes = await fetch("/api/plans/subscribe/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const start = await sRes.json();
      if (!sRes.ok) throw new Error(start.error || "Couldn't start payment.");

      // Zero-charge path: the upgrade credit fully covers the new plan price.
      // /start has already activated the plan — skip the payment modal.
      if (start.zero_charge) {
        setMsg({ text: "Plan upgraded (credit applied — no charge).", ok: true });
        router.refresh();
        setTimeout(() => setMsg(null), 4000);
        setBusy(false);
        return;
      }

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
            setMsg({ text: "Plan activated", ok: true });
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
        /* Interval toggle */
        .bl-toggle-wrap {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 18px; flex-wrap: wrap;
        }
        .bl-toggle {
          display: inline-flex; background: var(--surface2);
          border: 1px solid var(--border); border-radius: 10px; padding: 3px;
        }
        .bl-toggle button {
          padding: 6px 18px; border-radius: 8px; border: none; cursor: pointer;
          font-size: 13px; font-weight: 600; background: transparent;
          color: var(--muted); transition: background .15s, color .15s;
        }
        .bl-toggle button.active {
          background: var(--surface); color: var(--text);
          box-shadow: 0 1px 4px rgba(0,0,0,.1);
        }
        .bl-savings-hint {
          font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
          background: color-mix(in srgb, var(--green, #22c55e) 15%, transparent);
          color: var(--green, #16a34a);
        }
        /* Plan grid */
        .bl-plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
        .bl-plan {
          background: var(--surface); border: 1.5px solid var(--border);
          border-radius: 16px; padding: 20px; position: relative; overflow: hidden;
          display: flex; flex-direction: column; gap: 6px;
          box-shadow: var(--shadow);
        }
        .bl-plan.feat { border-color: var(--primary); }
        .bl-plan.recommended { border-color: #22c55e; }
        .bl-plan.current { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
        /* Recommended ribbon — distinct from Popular (orange) */
        .bl-ribbon-rec {
          background: #22c55e !important; color: #fff !important;
        }
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
              : `₹${currentSub.plan.price.toLocaleString("en-IN")} / ${currentSub.plan.interval === "annual" ? "year" : "month"}`}
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

      {/* Monthly / Annual toggle */}
      {showToggle && (
        <div className="bl-toggle-wrap">
          <div className="bl-toggle">
            <button
              className={selectedInterval === "monthly" ? "active" : ""}
              onClick={() => setSelectedInterval("monthly")}
            >
              Monthly
            </button>
            <button
              className={selectedInterval === "annual" ? "active" : ""}
              onClick={() => setSelectedInterval("annual")}
            >
              Annual
            </button>
          </div>
          {selectedInterval === "annual" && annualSavingsHint && (
            <span className="bl-savings-hint">{annualSavingsHint}</span>
          )}
        </div>
      )}

      {/* Plan cards filtered by selected interval */}
      <div className="bl-plans-grid">
        {filteredPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={
              !migrationPending &&
              currentSub?.plan_id === plan.id &&
              currentSub?.status === "active"
            }
            onSelect={handleSelect}
            busy={busy}
          />
        ))}
        {filteredPlans.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            No {selectedInterval} plans available yet.
          </div>
        )}
      </div>

      {/* Feedback message */}
      {msg && (
        <div className={`bl-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>
      )}

      {!migrationPending && (
        <p className="bl-note">
          Free plans switch instantly. Paid plans are charged securely via
          Razorpay and activate as soon as payment succeeds. Upgrading mid-cycle
          credits your unused balance toward the new plan price.
        </p>
      )}
    </>
  );
}
