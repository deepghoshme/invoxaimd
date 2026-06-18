"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { inviteMember, updateMemberRole, removeMember } from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────
export interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "editor" | "viewer";
  status: "invited" | "active";
  invited_at: string;
}

interface Props {
  storeId: string;
  ownerEmail: string;
  ownerName: string | null;
  members: TeamMember[];
  seatLimit: number;
  tableExists: boolean;
}

// ── Permissions matrix data ────────────────────────────────────────────────
const MATRIX: { label: string; admin: boolean; editor: boolean; viewer: boolean }[] = [
  { label: "Build & edit pages",   admin: true,  editor: true,  viewer: false },
  { label: "Publish / unpublish",  admin: true,  editor: true,  viewer: false },
  { label: "View orders & CRM",    admin: true,  editor: true,  viewer: true  },
  { label: "Refunds & payouts",    admin: true,  editor: false, viewer: false },
  { label: "Wallet & billing",     admin: true,  editor: false, viewer: false },
  { label: "Manage team",          admin: true,  editor: false, viewer: false },
];

// ── Avatar initials helper ──────────────────────────────────────────────────
function getInitials(name: string | null, email: string) {
  const src = name?.trim() || email;
  const parts = src.split(/[\s@]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="tr-toast" role="status" aria-live="polite">
      <span className="tr-toast-dot" />
      {msg}
    </div>
  );
}

// ── Main client component ──────────────────────────────────────────────────
export default function TeamClient({
  storeId,
  ownerEmail,
  ownerName,
  members: initial,
  seatLimit,
  tableExists,
}: Props) {
  const [members, setMembers] = useState<TeamMember[]>(initial);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "admin" | "viewer">("editor");
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);

  const totalSeats = members.length + 1; // +1 for owner
  const seatLabel = `${totalSeats} of ${seatLimit} seats used`;

  function fire(msg: string) {
    setToast(msg);
  }

  // ── Invite ──────────────────────────────────────────────────────────────
  function handleInvite() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      fire("Enter a valid email address");
      return;
    }
    if (trimmed === ownerEmail.toLowerCase()) {
      fire("That's your own email — you're already the owner");
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === trimmed)) {
      fire("This person is already in your team");
      return;
    }
    if (!tableExists) {
      fire("Apply the pending migration to enable invites");
      return;
    }

    const optimistic: TeamMember = {
      id: `temp-${Date.now()}`,
      email: trimmed,
      full_name: null,
      avatar_url: null,
      role,
      status: "invited",
      invited_at: new Date().toISOString(),
    };
    setMembers((prev) => [...prev, optimistic]);
    setEmail("");

    startTransition(async () => {
      const result = await inviteMember(storeId, trimmed, role);
      if (result.error) {
        setMembers((prev) => prev.filter((m) => m.id !== optimistic.id));
        fire(result.error);
      } else {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === optimistic.id ? { ...optimistic, id: result.id ?? optimistic.id } : m,
          ),
        );
        fire(`Invite sent to ${trimmed}`);
      }
    });
  }

  // ── Update role ─────────────────────────────────────────────────────────
  function handleRoleChange(id: string, newRole: "admin" | "editor" | "viewer") {
    const prev = members.find((m) => m.id === id);
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, role: newRole } : m)));
    if (!tableExists) return;

    startTransition(async () => {
      const result = await updateMemberRole(storeId, id, newRole);
      if (result.error) {
        // revert
        if (prev) setMembers((ms) => ms.map((m) => (m.id === id ? prev : m)));
        fire(result.error);
      }
    });
  }

  // ── Remove member ────────────────────────────────────────────────────────
  function handleRemove(id: string) {
    const removed = members.find((m) => m.id === id);
    setMembers((ms) => ms.filter((m) => m.id !== id));
    if (!tableExists) return;

    startTransition(async () => {
      const result = await removeMember(storeId, id);
      if (result.error) {
        if (removed) setMembers((ms) => [...ms, removed]);
        fire(result.error);
      } else {
        fire("Member removed");
      }
    });
  }

  return (
    <div className="tr-root">
      <style>{`
        .tr-root {
          --tr-bg: var(--bg, #fff9f4);
          --tr-card: var(--card, #fff);
          --tr-primary: var(--primary, #ff6a3d);
          --tr-secondary: var(--secondary, #ff4d7d);
          --tr-accent: var(--accent, #7b3fe4);
          --tr-gold: var(--gold, #ffb23e);
          --tr-text: var(--text, #2b1b2e);
          --tr-muted: var(--muted, #7a6770);
          --tr-border: var(--border, #f0e1d6);
          --tr-green: var(--green, #1fb57a);
          --tr-grad: var(--brand-gradient, linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4));
          --tr-shadow: var(--shadow, 0 1px 2px rgba(43,27,46,.04), 0 14px 34px -20px rgba(43,27,46,.26));
          --tr-fh: var(--font-heading, "Sora", system-ui, sans-serif);
          --tr-fb: var(--font-body, "Inter", system-ui, sans-serif);
          font-family: var(--tr-fb);
          color: var(--tr-text);
        }

        /* Page header */
        .tr-phead {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .tr-phead h1 {
          font-family: var(--tr-fh);
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -.02em;
          margin: 0;
        }
        .tr-phead p {
          margin: 3px 0 0;
          font-size: 13.5px;
          color: var(--tr-muted);
        }
        .tr-seats {
          margin-left: auto;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--tr-muted);
          border: 1px solid var(--tr-border);
          padding: 8px 14px;
          border-radius: 999px;
          white-space: nowrap;
        }

        /* Cards */
        .tr-card {
          background: var(--tr-card);
          border: 1px solid var(--tr-border);
          border-radius: 16px;
          padding: 20px;
          box-shadow: var(--tr-shadow);
          margin-bottom: 16px;
        }
        .tr-card-title {
          font-family: var(--tr-fh);
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -.01em;
          margin: 0 0 16px;
        }

        /* Invite row */
        .tr-invite {
          display: flex;
          gap: 8px;
        }
        .tr-invite input {
          flex: 1;
          padding: 11px 14px;
          font-family: inherit;
          font-size: 14px;
          background: var(--tr-bg);
          border: 1.5px solid var(--tr-border);
          border-radius: 11px;
          color: var(--tr-text);
          outline: none;
          transition: border-color .15s;
          min-width: 0;
        }
        .tr-invite input:focus { border-color: var(--tr-primary); }
        .tr-invite input::placeholder { color: var(--tr-muted); }
        .tr-invite select {
          padding: 11px 12px;
          font-family: inherit;
          font-size: 13px;
          background: var(--tr-bg);
          border: 1.5px solid var(--tr-border);
          border-radius: 11px;
          color: var(--tr-text);
          cursor: pointer;
        }
        .tr-invite-btn {
          background: var(--tr-grad);
          color: #fff;
          border: 0;
          border-radius: 11px;
          padding: 11px 20px;
          font-family: var(--tr-fh);
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity .15s;
        }
        .tr-invite-btn:disabled { opacity: .55; cursor: not-allowed; }
        .tr-invite-hint {
          font-size: 12px;
          color: var(--tr-muted);
          margin-top: 10px;
        }

        /* Members list */
        .tr-mem {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 0;
          border-top: 1px solid var(--tr-border);
          animation: tr-in .3s ease;
        }
        .tr-mem:first-of-type { border-top: 0; }

        @keyframes tr-in {
          from { opacity: .4; transform: translateY(5px); }
          to   { opacity: 1; transform: none; }
        }

        .tr-av {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--tr-grad);
          color: #fff;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 13px;
          font-family: var(--tr-fh);
          flex: none;
          letter-spacing: .01em;
        }
        .tr-av img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        .tr-mem-info { min-width: 0; flex: 1; }
        .tr-mem-name {
          font-weight: 600;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tr-mem-email {
          font-size: 12.5px;
          color: var(--tr-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tr-mem-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          flex: none;
        }
        .tr-pending {
          font-size: 11px;
          font-weight: 700;
          color: var(--tr-gold);
          background: color-mix(in srgb, var(--tr-gold) 18%, transparent);
          padding: 4px 9px;
          border-radius: 99px;
        }
        .tr-owner-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--tr-primary);
          padding: 7px 11px;
        }
        .tr-rolesel {
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          background: var(--tr-bg);
          border: 1px solid var(--tr-border);
          border-radius: 9px;
          padding: 7px 10px;
          color: var(--tr-text);
          cursor: pointer;
        }
        .tr-remove-btn {
          width: 34px;
          height: 34px;
          border: 1px solid var(--tr-border);
          background: var(--tr-card);
          color: var(--tr-muted);
          border-radius: 9px;
          cursor: pointer;
          display: grid;
          place-items: center;
          font-size: 13px;
          transition: color .15s, border-color .15s;
        }
        .tr-remove-btn:hover {
          color: #e5476f;
          border-color: #e5476f;
        }

        /* Permissions matrix */
        .tr-matrix {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .tr-matrix th {
          text-align: left;
          color: var(--tr-muted);
          font-weight: 600;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: .04em;
          padding: 0 10px 12px;
        }
        .tr-matrix th.c { text-align: center; }
        .tr-matrix td {
          padding: 11px 10px;
          border-top: 1px solid var(--tr-border);
        }
        .tr-matrix td.c { text-align: center; }
        .tr-matrix .y { color: var(--tr-green); font-weight: 800; }
        .tr-matrix .n { color: var(--tr-muted); opacity: .45; }
        .tr-role-head {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 12px;
          color: var(--tr-text);
        }

        /* Empty / migration-pending state */
        .tr-empty {
          padding: 32px 0 8px;
          text-align: center;
          color: var(--tr-muted);
          font-size: 14px;
        }
        .tr-empty .tr-empty-icon {
          font-size: 32px;
          margin-bottom: 10px;
        }
        .tr-migration-banner {
          margin-bottom: 16px;
          padding: 14px 18px;
          background: color-mix(in srgb, var(--tr-gold) 14%, transparent);
          border: 1px solid color-mix(in srgb, var(--tr-gold) 35%, transparent);
          border-radius: 12px;
          font-size: 13.5px;
          color: var(--tr-text);
          line-height: 1.5;
        }
        .tr-migration-banner code {
          font-size: 12px;
          background: color-mix(in srgb, var(--tr-text) 8%, transparent);
          padding: 2px 6px;
          border-radius: 5px;
          font-family: monospace;
        }

        /* Toast */
        .tr-toast {
          position: fixed;
          left: 50%;
          bottom: 28px;
          transform: translateX(-50%);
          z-index: 9999;
          background: #18121f;
          color: #fff;
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 20px 50px -20px rgba(0,0,0,.6);
          display: flex;
          align-items: center;
          gap: 9px;
          animation: tr-toast-in .4s ease;
          white-space: nowrap;
        }
        @keyframes tr-toast-in {
          from { transform: translate(-50%, 150%); opacity: 0; }
          to   { transform: translate(-50%, 0);    opacity: 1; }
        }
        .tr-toast-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #36c98e;
          flex: none;
        }

        @media (max-width: 600px) {
          .tr-invite { flex-wrap: wrap; }
          .tr-invite input { flex: 1 1 100%; }
          .tr-matrix { font-size: 11.5px; }
          .tr-matrix th, .tr-matrix td { padding: 9px 7px; }
        }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="tr-phead">
        <div>
          <h1>Team &amp; roles</h1>
          <p>Invite teammates and control what they can do.</p>
        </div>
        <span className="tr-seats">{seatLabel}</span>
      </div>

      {/* ── Migration-pending banner ──────────────────────────────────── */}
      {!tableExists && (
        <div className="tr-migration-banner">
          <strong>Team management is pending a database migration.</strong> Run{" "}
          <code>node scripts/db-apply.mjs supabase/migrations/20260618210000_team_members.sql</code>{" "}
          to enable invites and member management. The page displays in read-only mode until then.
        </div>
      )}

      {/* ── Invite card ──────────────────────────────────────────────── */}
      <div className="tr-card">
        <h3 className="tr-card-title">Invite a teammate</h3>
        <div className="tr-invite">
          <input
            ref={emailRef}
            type="email"
            placeholder="teammate@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            disabled={isPending}
          />
          <select
            className="tr-rolesel"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            disabled={isPending}
          >
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            className="tr-invite-btn"
            onClick={handleInvite}
            disabled={isPending}
          >
            Send invite
          </button>
        </div>
        <p className="tr-invite-hint">
          They&apos;ll get an email to join your store. Invites count toward your plan&apos;s seats.
        </p>
      </div>

      {/* ── Members card ─────────────────────────────────────────────── */}
      <div className="tr-card">
        <h3 className="tr-card-title">Members</h3>

        {/* Owner row — always present, non-editable */}
        <div className="tr-mem">
          <div className="tr-av">{getInitials(ownerName, ownerEmail)}</div>
          <div className="tr-mem-info">
            <div className="tr-mem-name">{ownerName || ownerEmail.split("@")[0]}</div>
            <div className="tr-mem-email">{ownerEmail}</div>
          </div>
          <div className="tr-mem-right">
            <span className="tr-owner-label">Owner</span>
          </div>
        </div>

        {/* Team member rows */}
        {members.map((m) => (
          <div className="tr-mem" key={m.id}>
            <div className="tr-av">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" />
              ) : (
                getInitials(m.full_name, m.email)
              )}
            </div>
            <div className="tr-mem-info">
              <div className="tr-mem-name">{m.full_name || m.email.split("@")[0]}</div>
              <div className="tr-mem-email">{m.email}</div>
            </div>
            <div className="tr-mem-right">
              {m.status === "invited" && <span className="tr-pending">Pending</span>}
              <select
                className="tr-rolesel"
                value={m.role}
                onChange={(e) => handleRoleChange(m.id, e.target.value as typeof m.role)}
                disabled={isPending}
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                className="tr-remove-btn"
                onClick={() => handleRemove(m.id)}
                disabled={isPending}
                title="Remove member"
                aria-label={`Remove ${m.email}`}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* Empty state (no teammates yet, only owner) */}
        {members.length === 0 && (
          <div className="tr-empty">
            <div className="tr-empty-icon">👥</div>
            <div>No teammates yet — invite someone above.</div>
          </div>
        )}
      </div>

      {/* ── Permissions matrix card ───────────────────────────────────── */}
      <div className="tr-card" style={{ marginBottom: 0 }}>
        <h3 className="tr-card-title">What each role can do</h3>
        <table className="tr-matrix">
          <thead>
            <tr>
              <th>Permission</th>
              <th className="c"><span className="tr-role-head"><b>Admin</b></span></th>
              <th className="c"><span className="tr-role-head"><b>Editor</b></span></th>
              <th className="c"><span className="tr-role-head"><b>Viewer</b></span></th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className={`c ${row.admin  ? "y" : "n"}`}>{row.admin  ? "✓" : "—"}</td>
                <td className={`c ${row.editor ? "y" : "n"}`}>{row.editor ? "✓" : "—"}</td>
                <td className={`c ${row.viewer ? "y" : "n"}`}>{row.viewer ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
