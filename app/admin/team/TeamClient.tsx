"use client";

import { useState, useTransition } from "react";
import { grantAdmin, revokeAdmin } from "./actions";
import { Phead, Card } from "@/components/dx/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminMember = {
  userId: string;
  email: string;
  fullName: string | null;
  grantedAt: string;
  isSelf: boolean;
};

// ── Scoped styles ─────────────────────────────────────────────────────────────

const S = `
  .tm-invite { display:flex; gap:9px; flex-wrap:wrap; }
  .tm-invite input {
    flex:1 1 260px; padding:11px 14px; font:inherit; font-size:14px;
    background:var(--bg,#fff9f4); border:1.5px solid var(--border,#f0e1d6);
    border-radius:11px; color:var(--text,#2b1b2e); outline:none;
  }
  .tm-invite input:focus { border-color:var(--primary,#ff6a3d); }
  .tm-invite button {
    background:var(--grad,linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4));
    color:#fff; border:0; border-radius:11px; padding:11px 20px;
    font-family:inherit; font-weight:700; font-size:14px; cursor:pointer;
    white-space:nowrap;
  }
  .tm-invite button:disabled { opacity:0.55; cursor:not-allowed; }
  .tm-hint { font-size:12px; color:var(--muted,#7a6770); margin-top:8px; }
  .tm-feedback { font-size:13px; font-weight:600; margin-top:10px;
    padding:9px 13px; border-radius:9px; }
  .tm-feedback.ok { background:color-mix(in srgb,#1fb57a 14%,transparent);
    color:#1fb57a; }
  .tm-feedback.err { background:color-mix(in srgb,#ff4d4d 14%,transparent);
    color:#c00; }
  .tm-feedback.warn { background:color-mix(in srgb,#ffb23e 14%,transparent);
    color:#b86a00; }

  .tm-mem { display:flex; align-items:center; gap:13px;
    padding:13px 0; border-top:1px solid var(--border,#f0e1d6); }
  .tm-mem:first-of-type { border-top:0; }
  .tm-av {
    width:38px; height:38px; border-radius:50%; flex:none;
    background:var(--grad,linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4));
    color:#fff; display:grid; place-items:center;
    font-weight:800; font-size:13px; font-family:var(--fh,Sora,sans-serif);
  }
  .tm-info .nm { font-weight:600; font-size:14px; }
  .tm-info .em { font-size:12.5px; color:var(--muted,#7a6770); }
  .tm-info .dt { font-size:11px; color:var(--muted,#7a6770); margin-top:1px; }
  .tm-you { margin-left:auto; font-size:12px; font-weight:700;
    color:var(--primary,#ff6a3d); padding:6px 11px;
    background:color-mix(in srgb,var(--primary,#ff6a3d) 12%,transparent);
    border-radius:99px; white-space:nowrap; }
  .tm-revoke {
    margin-left:auto; width:34px; height:34px; border:1px solid var(--border,#f0e1d6);
    background:var(--card,#fff); color:var(--muted,#7a6770);
    border-radius:9px; cursor:pointer; font-size:15px;
    display:grid; place-items:center;
  }
  .tm-revoke:hover { border-color:#ff4d4d; color:#ff4d4d; }
  .tm-revoke:disabled { opacity:0.35; cursor:not-allowed; }

  .tm-matrix { width:100%; border-collapse:collapse; font-size:13px; }
  .tm-matrix th {
    text-align:left; color:var(--muted,#7a6770); font-weight:600;
    font-size:11.5px; text-transform:uppercase; letter-spacing:.04em;
    padding:0 10px 12px;
  }
  .tm-matrix th.c, .tm-matrix td.c { text-align:center; }
  .tm-matrix td { padding:11px 10px; border-top:1px solid var(--border,#f0e1d6); }
  .tm-matrix .y { color:var(--green,#1fb57a); font-weight:800; }
  .tm-matrix .n { color:var(--muted,#7a6770); opacity:.5; }

  @media (max-width:640px) {
    .tm-invite { flex-direction:column; }
    .tm-matrix { font-size:12px; }
    .tm-mem { gap:9px; }
  }
`;

// ── Permissions matrix data ───────────────────────────────────────────────────

type MatrixRow = [string, boolean | null, boolean | null, boolean | null];
const N = null as null;
const MATRIX: MatrixRow[] = [
  ["View platform dashboard",          true,  N,     N    ],
  ["Manage sellers & suspend stores",  true,  N,     N    ],
  ["Manage plans & billing config",    true,  N,     N    ],
  ["View all orders & revenue",        true,  N,     N    ],
  ["Configure branding & domains",     true,  N,     N    ],
  ["Manage platform team (this page)", true,  N,     N    ],
  ["Seller dashboard access",          N,     true,  N    ],
  ["Build & publish pages",            N,     true,  N    ],
  ["View own orders & CRM",            N,     true,  true ],
  ["Checkout & purchase",              N,     N,     true ],
];

// Helpers ─────────────────────────────────────────────────────────────────────

function initial(name: string | null, email: string) {
  const src = name ?? email;
  return (src[0] ?? "?").toUpperCase();
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function cellVal(v: boolean | null) {
  if (v === true)  return <td className="c y">✓</td>;
  if (v === false) return <td className="c n">—</td>;
  // null = not applicable to this role
  return <td className="c n">—</td>;
}

// ── MemberRow ─────────────────────────────────────────────────────────────────

function MemberRow({
  m,
  onRevoke,
  pending,
}: {
  m: AdminMember;
  onRevoke: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div className="tm-mem">
      <span className="tm-av">{initial(m.fullName, m.email)}</span>
      <div className="tm-info">
        <div className="nm">{m.fullName || m.email}</div>
        {m.fullName && <div className="em">{m.email}</div>}
        <div className="dt">Admin since {fmtDate(m.grantedAt)}</div>
      </div>
      {m.isSelf ? (
        <span className="tm-you">You</span>
      ) : (
        <button
          className="tm-revoke"
          title="Revoke admin access"
          disabled={pending}
          onClick={() => onRevoke(m.userId)}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

export default function TeamClient({
  members,
  currentUserId,
}: {
  members: AdminMember[];
  currentUserId: string;
}) {
  const [email, setEmail] = useState("");
  const [grantMsg, setGrantMsg] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);
  const [revokeMsg, setRevokeMsg] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);
  const [isPendingGrant, startGrant] = useTransition();
  const [isPendingRevoke, startRevoke] = useTransition();

  // Confirm self-revoke with a browser confirm (safety UX).
  const [confirmSelf, setConfirmSelf] = useState<string | null>(null);

  function handleGrant() {
    setGrantMsg(null);
    startGrant(async () => {
      const res = await grantAdmin(email);
      if (res.ok) {
        setGrantMsg({ kind: "ok", text: `Admin access granted to ${email}.` });
        setEmail("");
      } else {
        setGrantMsg({ kind: "err", text: res.error ?? "Unknown error." });
      }
    });
  }

  function handleRevoke(userId: string) {
    const isSelf = userId === currentUserId;
    if (isSelf) {
      setConfirmSelf(userId);
      return;
    }
    doRevoke(userId);
  }

  function doRevoke(userId: string) {
    setConfirmSelf(null);
    setRevokeMsg(null);
    startRevoke(async () => {
      const res = await revokeAdmin(userId);
      if (res.ok) {
        if (res.warn) {
          setRevokeMsg({ kind: "warn", text: res.warn });
        } else {
          setRevokeMsg({ kind: "ok", text: "Admin access revoked." });
        }
      } else {
        setRevokeMsg({ kind: "err", text: res.error ?? "Unknown error." });
      }
    });
  }

  const adminCount = members.length;

  return (
    <>
      <style>{S}</style>

      <Phead
        title="Team & Roles"
        sub="Manage who has platform-admin access to admin.invoxai.io."
        action={
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--muted)",
              border: "1px solid var(--border)",
              padding: "7px 14px",
              borderRadius: 999,
            }}
          >
            {adminCount} platform admin{adminCount !== 1 ? "s" : ""}
          </span>
        }
      />

      {/* ── Grant section ───────────────────────────────────────────────── */}
      <Card title="Grant admin access">
        <div className="tm-invite">
          <input
            type="email"
            placeholder="user@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGrant()}
            autoComplete="off"
          />
          <button onClick={handleGrant} disabled={isPendingGrant || !email.trim()}>
            {isPendingGrant ? "Granting…" : "Grant admin"}
          </button>
        </div>
        <p className="tm-hint">
          The user must already have an invoxai account (i.e. have signed up). Admin access
          grants full platform control — use with care.
        </p>
        {grantMsg && (
          <div className={`tm-feedback ${grantMsg.kind}`}>{grantMsg.text}</div>
        )}
      </Card>

      {/* ── Members list ───────────────────────────────────────────────── */}
      <Card title="Platform admins">
        {members.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>
            No admins found. This should not happen — at least one admin is required.
          </p>
        ) : (
          members.map((m) => (
            <MemberRow
              key={m.userId}
              m={m}
              onRevoke={handleRevoke}
              pending={isPendingRevoke}
            />
          ))
        )}
        {revokeMsg && (
          <div className={`tm-feedback ${revokeMsg.kind}`} style={{ marginTop: 12 }}>
            {revokeMsg.text}
          </div>
        )}
      </Card>

      {/* ── Self-revoke confirmation modal ──────────────────────────────── */}
      {confirmSelf && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "var(--card,#fff)",
              border: "1px solid var(--border,#f0e1d6)",
              borderRadius: 16,
              padding: "28px 24px",
              maxWidth: 380,
              width: "calc(100% - 40px)",
              boxShadow: "0 20px 60px -20px rgba(0,0,0,.4)",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px",
                fontFamily: "var(--fh,Sora,sans-serif)",
                fontSize: 17,
              }}
            >
              Revoke your own access?
            </h3>
            <p
              style={{
                fontSize: 13.5,
                color: "var(--muted,#7a6770)",
                margin: "0 0 20px",
                lineHeight: 1.5,
              }}
            >
              You are about to remove your own admin role. You will lose access to this
              admin panel immediately. Are you sure?
            </p>
            <div style={{ display: "flex", gap: 9 }}>
              <button
                style={{
                  flex: 1,
                  padding: "10px 0",
                  border: "1.5px solid var(--border,#f0e1d6)",
                  borderRadius: 10,
                  background: "var(--card,#fff)",
                  color: "var(--text,#2b1b2e)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onClick={() => setConfirmSelf(null)}
              >
                Cancel
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "10px 0",
                  border: 0,
                  borderRadius: 10,
                  background: "#ff4d4d",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onClick={() => doRevoke(confirmSelf)}
              >
                Yes, revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Permissions matrix ─────────────────────────────────────────── */}
      <Card title="What each role can do">
        <table className="tm-matrix">
          <thead>
            <tr>
              <th>Permission</th>
              <th className="c">Platform Admin</th>
              <th className="c">Seller</th>
              <th className="c">Buyer</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map(([label, admin, seller, buyer]) => (
              <tr key={label}>
                <td>{label}</td>
                {cellVal(admin)}
                {cellVal(seller)}
                {cellVal(buyer)}
              </tr>
            ))}
          </tbody>
        </table>
        <p
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          Platform admins are users with role=&apos;admin&apos; in user_roles. They are entirely
          separate from seller-side team members. Seller and buyer permissions are shown
          for reference.
        </p>
      </Card>
    </>
  );
}
