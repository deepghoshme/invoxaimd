import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead } from "@/components/dx/ui";
import Pagination from "@/components/dx/Pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/** Format paise → ₹X,XX,XXX display string */
function inrFromPaise(paise: number): string {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

/** Format a ledger date */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // requireDashboardStore resolves the correct store under impersonation.
  const { store: baseStore } = await requireDashboardStore();

  // Re-fetch via admin client to get wallet_balance (not in the base select).
  const admin = createAdminClient();
  const { data: store, error: storeError } = await admin
    .from("stores")
    .select("id, wallet_balance")
    .eq("id", baseStore.id)
    .maybeSingle();

  // wallet_balance column may not exist yet (migration pending)
  const storeErrMsg = (storeError as { message?: string } | null)?.message ?? "";
  const migrationPending =
    storeErrMsg.includes("wallet_balance") ||
    storeErrMsg.includes("column") ||
    false;

  const balance = migrationPending ? 0 : Number((store as Record<string, unknown> | null)?.wallet_balance ?? 0);
  const isLow = balance < 50000; // below ₹500

  // Load recent ledger (paginated, 50/page)
  type LedgerRow = {
    id: string;
    type: string;
    amount: number;
    reason: string;
    gateway_payment_id: string | null;
    created_at: string;
    balance_after: number;
  };

  let ledger: LedgerRow[] = [];
  let ledgerTotal = 0;
  if (!migrationPending && store) {
    const { data: rows, error: ledgerError, count } = await admin
      .from("wallet_ledger")
      .select("id, type, amount, reason, gateway_payment_id, created_at, balance_after", { count: "exact" })
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (!ledgerError) {
      ledger = (rows ?? []) as LedgerRow[];
      ledgerTotal = count ?? 0;
    }
  }

  return (
    <>
      <Phead
        title="Wallet"
        sub="Commission wallet balance, recharge, and ledger."
        action={
          <Link href="/dashboard/wallet/recharge" className="wr-wallet-cta">
            + Recharge
          </Link>
        }
      />

      {migrationPending && (
        <div className="wr-migration-banner">
          <strong>Migration pending.</strong> Run{" "}
          <code>node scripts/db-apply.mjs supabase/migrations/20260618230000_wallet.sql</code> to
          enable the wallet.
        </div>
      )}

      <style>{`
        .wr-wallet-cta {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13.5px; font-weight: 700;
          padding: 9px 18px; border-radius: 10px;
          background: var(--grad); color: #fff;
          border: 0; cursor: pointer; text-decoration: none;
          font-family: var(--font-sora), "Sora", sans-serif;
        }
        .wr-wallet-cta:hover { opacity: .88; }
        .wr-migration-banner {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 18px; margin-bottom: 18px;
          font-size: 13px; line-height: 1.5;
        }
        .wr-migration-banner code {
          display: inline-block; background: var(--bg); border: 1px solid var(--border);
          border-radius: 6px; padding: 2px 7px; font-size: 12px; font-family: monospace;
        }
        .wr-balcard-ov {
          background: var(--grad); color: #fff; border-radius: 18px;
          padding: 24px 26px; position: relative; overflow: hidden; margin-bottom: 18px;
        }
        .wr-balcard-ov::after {
          content: ""; position: absolute; inset: 0;
          background: radial-gradient(60% 120% at 85% 0%, rgba(255,255,255,.26), transparent 60%);
        }
        .wr-balcard-ov > * { position: relative; z-index: 1; }
        .wr-balcard-ov .ov-label { font-size: 13px; opacity: .9; }
        .wr-balcard-ov .ov-val {
          font-family: var(--font-sora), "Sora", sans-serif;
          font-weight: 800; font-size: 42px; margin: 4px 0 7px; letter-spacing: -.03em;
        }
        .wr-balcard-ov .ov-hint { font-size: 13px; opacity: .9; }
        .wr-balcard-ov .ov-recharge {
          margin-top: 16px; display: inline-flex; align-items: center; gap: 7px;
          font-size: 13.5px; font-weight: 700; padding: 9px 20px; border-radius: 10px;
          background: rgba(255,255,255,.22); color: #fff;
          border: 1.5px solid rgba(255,255,255,.36); cursor: pointer; text-decoration: none;
          font-family: var(--font-sora), "Sora", sans-serif;
        }
        .wr-balcard-ov .ov-recharge:hover { background: rgba(255,255,255,.32); }
        .wr-ledger-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 20px;
          box-shadow: var(--shadow);
        }
        .wr-ledger-card h3 {
          font-size: 15px; margin-bottom: 16px;
          font-family: var(--font-sora), "Sora", sans-serif;
        }
        .wr-ledrow-ov {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 0; border-top: 1px solid var(--border); font-size: 13px;
        }
        .wr-ledrow-ov:first-of-type { border-top: 0; }
        .wr-ledrow-ov .ov-ic {
          width: 32px; height: 32px; border-radius: 9px;
          display: grid; place-items: center; flex: none; font-size: 14px;
        }
        .wr-ledrow-ov .ov-ic.credit {
          background: color-mix(in srgb, var(--green) 16%, transparent);
          color: var(--green);
        }
        .wr-ledrow-ov .ov-ic.debit {
          background: color-mix(in srgb, var(--primary) 14%, transparent);
          color: var(--primary);
        }
        .wr-ledrow-ov .ov-meta { flex: 1; }
        .wr-ledrow-ov .ov-meta b { font-size: 13.5px; font-weight: 600; }
        .wr-ledrow-ov .ov-meta p { color: var(--muted); font-size: 12px; margin-top: 1px; }
        .wr-ledrow-ov .ov-amt {
          font-weight: 700; font-size: 14px;
          font-family: var(--font-sora), "Sora", sans-serif;
        }
        .wr-ledrow-ov .ov-amt.credit { color: var(--green); }
        .wr-empty-ledger {
          text-align: center; color: var(--muted); font-size: 13px; padding: 28px 0;
        }
      `}</style>

      <div className="wr-balcard-ov">
        <div className="ov-label">Commission wallet balance</div>
        <div className="ov-val">{inrFromPaise(balance)}</div>
        <div className="ov-hint">
          {migrationPending
            ? "Enable wallet by applying migration"
            : isLow
              ? "Low — top up to keep selling active"
              : "Healthy · selling active"}
        </div>
        <Link href="/dashboard/wallet/recharge" className="ov-recharge">
          + Recharge wallet
        </Link>
      </div>

      <div className="wr-ledger-card">
        <h3>Transaction history</h3>
        {ledger.length === 0 ? (
          <div className="wr-empty-ledger">
            {migrationPending
              ? "Apply the wallet migration to see transactions."
              : "No transactions yet. Recharge to get started."}
          </div>
        ) : (
          <>
            {ledger.map((row) => {
              const label =
                row.reason === "recharge"
                  ? "Recharge"
                  : row.reason === "recharge_bonus"
                    ? "Recharge bonus"
                    : row.reason === "commission"
                      ? "Commission"
                      : row.reason;
              const sub = row.gateway_payment_id
                ? `${fmtDate(row.created_at)} · Razorpay`
                : fmtDate(row.created_at);
              const sign = row.type === "credit" ? "+" : "−";
              return (
                <div key={row.id} className="wr-ledrow-ov">
                  <span className={`ov-ic ${row.type}`}>{row.type === "credit" ? "↑" : "↓"}</span>
                  <div className="ov-meta">
                    <b>{label}</b>
                    <p>{sub}</p>
                  </div>
                  <span className={`ov-amt ${row.type}`}>
                    {sign}₹{Math.round(row.amount / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              );
            })}
            <Pagination page={page} pageSize={PAGE_SIZE} total={ledgerTotal} baseParams={sp} />
          </>
        )}
      </div>
    </>
  );
}
