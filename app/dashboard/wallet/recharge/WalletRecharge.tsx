"use client";

import { useState, useCallback } from "react";

/* ─── types ─────────────────────────────────────────────────────────────── */
type Stage = "pick" | "paying" | "success" | "error";

/** Razorpay global (loaded from CDN). */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

/* ─── constants ─────────────────────────────────────────────────────────── */
const QUICK_AMOUNTS = [
  { paise: 50000, label: "₹500", bonus: null },
  { paise: 100000, label: "₹1,000", bonus: null },
  { paise: 200000, label: "₹2,000", bonus: "+₹50 bonus" },
  { paise: 500000, label: "₹5,000", bonus: "+₹250 bonus" },
  { paise: 1000000, label: "₹10,000", bonus: "+₹750 bonus" },
] as const;

const MIN_PAISE = 50000;   // ₹500
const MAX_PAISE = 10000000; // ₹1,00,000

function bonusFor(paise: number): number {
  if (paise >= 1000000) return 75000;
  if (paise >= 500000) return 25000;
  if (paise >= 200000) return 5000;
  return 0;
}

function inr(paise: number): string {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

/* ─── component ─────────────────────────────────────────────────────────── */
export default function WalletRecharge({
  initialBalancePaise,
  migrationPending,
}: {
  initialBalancePaise: number;
  migrationPending: boolean;
}) {
  const [stage, setStage] = useState<Stage>("pick");
  const [selectedPaise, setSelectedPaise] = useState<number | null>(200000); // default ₹2,000
  const [customMode, setCustomMode] = useState(false);
  const [customRupees, setCustomRupees] = useState("");
  const [autoRecharge, setAutoRecharge] = useState(false);
  const [lowBalanceAlert, setLowBalanceAlert] = useState(true);
  const [balance, setBalance] = useState(initialBalancePaise);
  const [bonusEarned, setBonusEarned] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const effectivePaise = customMode
    ? Math.round((parseInt(customRupees, 10) || 0) * 100)
    : (selectedPaise ?? 0);

  const amtLabel = effectivePaise > 0 ? inr(effectivePaise) : "₹0";
  const isLow = balance < 50000;
  const canPay = !migrationPending && effectivePaise >= MIN_PAISE && effectivePaise <= MAX_PAISE;

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomRupees(e.target.value.replace(/[^0-9]/g, ""));
  };

  const loadRazorpay = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handlePay = useCallback(async () => {
    if (!canPay || stage === "paying") return;
    setStage("paying");
    setErrorMsg("");

    try {
      // 1. Create Razorpay order server-side
      const createRes = await fetch("/api/wallet/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_paise: effectivePaise }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error ?? "Failed to create payment order");
      }

      // 2. Load Razorpay SDK
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Could not load Razorpay. Check your connection.");

      // 3. Open Razorpay checkout
      const RazorpayConstructor = window.Razorpay;
      if (!RazorpayConstructor) throw new Error("Razorpay SDK not loaded.");
      await new Promise<void>((resolve, reject) => {
        const rzp = new RazorpayConstructor({
          key: createData.key_id,
          amount: createData.amount_paise,
          currency: "INR",
          order_id: createData.razorpay_order_id,
          name: "invoxai Wallet",
          description: "Wallet Recharge",
          theme: { color: "#ff6a3d" },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // 4. Verify signature + credit wallet server-side
              const verifyRes = await fetch("/api/wallet/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  amount_paise: effectivePaise,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) {
                throw new Error(verifyData.error ?? "Payment verification failed");
              }
              setBalance(verifyData.new_balance_paise);
              setBonusEarned(verifyData.bonus_paise ?? 0);
              setStage("success");
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              // User closed Razorpay modal without paying
              reject(new Error("dismissed"));
            },
          },
        });
        rzp.open();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      if (msg === "dismissed") {
        setStage("pick");
      } else {
        setErrorMsg(msg);
        setStage("error");
      }
    }
  }, [canPay, stage, effectivePaise]);

  const handleReset = () => {
    setStage("pick");
    setCustomMode(false);
    setCustomRupees("");
    setSelectedPaise(200000);
    setBonusEarned(0);
    setErrorMsg("");
  };

  return (
    <>
      <style>{`
        .wr { --grad: linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4); }
        .wr-balcard {
          background: var(--grad); color: #fff;
          border-radius: 18px; padding: 22px;
          position: relative; overflow: hidden; margin-bottom: 18px;
        }
        .wr-balcard::after {
          content: ""; position: absolute; inset: 0;
          background: radial-gradient(60% 120% at 85% 0%, rgba(255,255,255,.28), transparent 60%);
        }
        .wr-balcard > * { position: relative; z-index: 1; }
        .wr-balcard .wbl { font-size: 13px; opacity: .9; }
        .wr-balcard .wbv {
          font-family: var(--font-sora),"Sora",sans-serif;
          font-weight: 800; font-size: 38px; margin: 4px 0 6px; letter-spacing: -.03em;
        }
        .wr-balcard .wbh { font-size: 12.5px; opacity: .9; }

        .wr-cols {
          display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; align-items: start;
        }
        @media (max-width: 820px) {
          .wr-cols { grid-template-columns: 1fr; }
          .wr-amts { grid-template-columns: repeat(2,1fr) !important; }
        }
        .wr-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 20px;
          box-shadow: var(--shadow);
        }
        .wr-ct {
          font-size: 15px; margin-bottom: 16px;
          font-family: var(--font-sora),"Sora",sans-serif;
        }
        .wr-amts { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
        .wr-amt {
          border: 1.5px solid var(--border); border-radius: 12px;
          padding: 14px 8px; text-align: center; cursor: pointer;
          background: var(--surface); transition: border-color .15s, background .15s;
        }
        .wr-amt:hover { border-color: var(--primary); }
        .wr-amt.on {
          border-color: var(--primary);
          background: color-mix(in srgb,var(--primary) 7%,transparent);
        }
        .wr-amt .wa { font-family: var(--font-sora),"Sora",sans-serif; font-weight: 800; font-size: 17px; }
        .wr-amt .wb { font-size: 11px; color: var(--green); margin-top: 3px; }
        .wr-custom {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg); border: 1.5px solid var(--border);
          border-radius: 12px; padding: 6px 16px; margin-top: 12px;
        }
        .wr-custom .wcur {
          font-family: var(--font-sora),"Sora",sans-serif;
          font-weight: 800; font-size: 24px; color: var(--muted);
        }
        .wr-custom input {
          flex: 1; border: 0; background: transparent;
          font-family: var(--font-sora),"Sora",sans-serif;
          font-weight: 800; font-size: 26px; color: var(--text); outline: none; width: 100%;
        }
        .wr-custom input::placeholder { color: var(--muted); opacity: .6; }
        .wr-pay {
          width: 100%; margin-top: 16px;
          background: var(--grad); color: #fff;
          border: 0; border-radius: 12px; padding: 15px;
          font-family: var(--font-sora),"Sora",sans-serif;
          font-weight: 800; font-size: 15.5px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity .15s;
        }
        .wr-pay:disabled { opacity: .5; cursor: not-allowed; }
        .wr-pay:not(:disabled):hover { opacity: .88; }
        @keyframes wr-spin { to { transform: rotate(360deg); } }
        .wr-spin {
          width: 17px; height: 17px;
          border: 2.5px solid rgba(255,255,255,.4);
          border-top-color: #fff; border-radius: 50%;
          animation: wr-spin .7s linear infinite;
        }
        .wr-secure {
          text-align: center; font-size: 11.5px; color: var(--muted); margin-top: 11px;
        }
        /* toggle switch */
        .wr-srow {
          display: flex; align-items: center; gap: 11px;
          padding: 12px 0; border-top: 1px solid var(--border);
        }
        .wr-srow:first-child { border-top: 0; }
        .wr-srow .wtx { flex: 1; }
        .wr-srow .wtx b { font-size: 13.5px; }
        .wr-srow .wtx p { font-size: 12px; color: var(--muted); }
        .wr-sw {
          width: 44px; height: 25px; border-radius: 999px;
          background: var(--border); border: 0; cursor: pointer;
          position: relative; flex: none; transition: background .18s;
        }
        .wr-sw.on { background: var(--grad); }
        .wr-sw i {
          position: absolute; top: 3px; left: 3px;
          width: 19px; height: 19px; border-radius: 50%;
          background: #fff; transition: transform .18s;
        }
        .wr-sw.on i { transform: translateX(19px); }
        /* kv rows */
        .wr-kv {
          display: flex; justify-content: space-between;
          font-size: 13px; padding: 9px 0;
          border-top: 1px solid var(--border);
        }
        .wr-kv:first-child { border-top: 0; }
        .wr-kv .wk { color: var(--muted); }
        /* ledger */
        .wr-ledrow {
          display: flex; align-items: center; gap: 11px;
          padding: 11px 0; border-top: 1px solid var(--border); font-size: 13px;
        }
        .wr-ledrow:first-of-type { border-top: 0; }
        .wr-ledrow .wlic {
          width: 30px; height: 30px; border-radius: 8px;
          display: grid; place-items: center; flex: none;
        }
        .wr-ledrow .wlam { margin-left: auto; font-weight: 700; font-family: var(--font-sora),"Sora",sans-serif; }
        /* success */
        @keyframes wr-pop { from { transform: scale(.92); } to { transform: scale(1); } }
        .wr-done {
          text-align: center; padding: 18px 6px;
          animation: wr-pop .4s cubic-bezier(.2,.8,.2,1);
        }
        .wr-check {
          width: 70px; height: 70px; border-radius: 50%;
          background: var(--grad); color: #fff;
          display: grid; place-items: center; font-size: 32px;
          margin: 0 auto 14px;
        }
        .wr-done h2 { font-size: 22px; }
        .wr-done p { color: var(--muted); font-size: 13.5px; margin-top: 7px; }
        .wr-newbal {
          font-family: var(--font-sora),"Sora",sans-serif;
          font-weight: 800; font-size: 30px; margin: 14px 0;
        }
        .wr-btn {
          font: inherit; font-family: var(--font-sora),"Sora",sans-serif;
          font-weight: 700; font-size: 14px;
          border: 1px solid var(--border); background: var(--surface);
          color: var(--text); padding: 12px 22px; border-radius: 11px; cursor: pointer;
        }
        .wr-btn:hover { border-color: var(--muted); }
        /* error */
        .wr-error {
          background: var(--redbg); border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
          border-radius: 12px; padding: 16px 18px; margin-top: 14px;
          font-size: 13px; color: var(--red);
        }
        .wr-migration-note {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 18px; margin-bottom: 18px;
          font-size: 13px; line-height: 1.55;
        }
        .wr-migration-note code {
          display: inline-block; background: var(--bg); border: 1px solid var(--border);
          border-radius: 6px; padding: 2px 7px; font-size: 12px; font-family: monospace;
        }
      `}</style>

      <div>
        {/* Balance card */}
        <div className="wr-balcard">
          <div className="wbl">Commission wallet balance</div>
          <div className="wbv">{inr(balance)}</div>
          <div className="wbh">
            {migrationPending
              ? "Apply migration to enable wallet"
              : isLow
                ? "Low — top up to keep selling active"
                : "Healthy · selling active"}
          </div>
        </div>

        {migrationPending && (
          <div className="wr-migration-note">
            <strong>Wallet not yet enabled.</strong> Apply the migration to activate the wallet:{" "}
            <code>node scripts/db-apply.mjs supabase/migrations/20260618230000_wallet.sql</code>
          </div>
        )}

        {/* Success screen */}
        {stage === "success" && (
          <div className="wr-card" style={{ maxWidth: 440, margin: "0 auto" }}>
            <div className="wr-done">
              <div className="wr-check">✓</div>
              <h2>Wallet recharged!</h2>
              <p>
                {amtLabel} added successfully
                {bonusEarned > 0 ? ` (incl. ${inr(bonusEarned)} bonus)` : ""}.
              </p>
              <div className="wr-newbal">New balance · {inr(balance)}</div>
              <button className="wr-btn" onClick={handleReset}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* Main recharge UI */}
        {stage !== "success" && (
          <div className="wr-cols">
            {/* Left — Add money */}
            <div className="wr-card">
              <h3 className="wr-ct">Add money</h3>

              <div className="wr-amts">
                {QUICK_AMOUNTS.map((q) => (
                  <div
                    key={q.paise}
                    className={`wr-amt${!customMode && selectedPaise === q.paise ? " on" : ""}`}
                    onClick={() => {
                      setCustomMode(false);
                      setSelectedPaise(q.paise);
                    }}
                  >
                    <div className="wa">{q.label}</div>
                    {q.bonus && <div className="wb">{q.bonus}</div>}
                  </div>
                ))}
                <div
                  className={`wr-amt${customMode ? " on" : ""}`}
                  onClick={() => {
                    setCustomMode(true);
                    setSelectedPaise(null);
                  }}
                >
                  <div className="wa">Custom</div>
                </div>
              </div>

              {customMode && (
                <div className="wr-custom">
                  <span className="wcur">₹</span>
                  <input
                    inputMode="numeric"
                    placeholder="Enter amount"
                    value={customRupees}
                    onChange={handleCustomInput}
                    autoFocus
                  />
                </div>
              )}

              <button
                className="wr-pay"
                onClick={handlePay}
                disabled={!canPay || stage === "paying"}
              >
                {stage === "paying" ? (
                  <>
                    <span className="wr-spin" />
                    Processing…
                  </>
                ) : (
                  <>🔒 Recharge {amtLabel}</>
                )}
              </button>

              {stage === "error" && (
                <div className="wr-error">
                  {errorMsg || "Something went wrong. Please try again."}
                </div>
              )}

              <div className="wr-secure">
                Powered by Razorpay · UPI · cards · netbanking
              </div>
            </div>

            {/* Right — Auto-recharge + Recent */}
            <div>
              <div className="wr-card" style={{ marginBottom: 16 }}>
                <h3 className="wr-ct">Auto-recharge</h3>
                <div className="wr-srow">
                  <div className="wtx">
                    <b>Auto top-up</b>
                    <p>Recharge when balance is low</p>
                  </div>
                  <button
                    className={`wr-sw${autoRecharge ? " on" : ""}`}
                    onClick={() => setAutoRecharge((v) => !v)}
                    aria-label="Toggle auto top-up"
                  >
                    <i />
                  </button>
                </div>
                <div className="wr-kv">
                  <span className="wk">When below</span>
                  <span style={{ fontWeight: 600 }}>₹500</span>
                </div>
                <div className="wr-kv">
                  <span className="wk">Top up by</span>
                  <span style={{ fontWeight: 600 }}>₹2,000</span>
                </div>
                <div className="wr-srow">
                  <div className="wtx">
                    <b>Low-balance email</b>
                    <p>Alert before selling pauses</p>
                  </div>
                  <button
                    className={`wr-sw${lowBalanceAlert ? " on" : ""}`}
                    onClick={() => setLowBalanceAlert((v) => !v)}
                    aria-label="Toggle low-balance alert"
                  >
                    <i />
                  </button>
                </div>
              </div>

              <div className="wr-card">
                <h3 className="wr-ct">Recent</h3>
                {/* Ledger is shown from server-rendered parent; here we show placeholder */}
                <div
                  className="wr-ledrow"
                  style={{ borderTop: 0, color: "var(--muted)", fontSize: 13 }}
                >
                  Recent transactions appear on the{" "}
                  <a
                    href="/dashboard/wallet"
                    style={{ color: "var(--primary)", textDecoration: "none" }}
                  >
                    Wallet overview
                  </a>
                  .
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
