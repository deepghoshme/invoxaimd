"use client";

import { useState, useTransition } from "react";
import { saveDraft, sendCampaign, deleteCampaign } from "./actions";
import type { AudienceCounts } from "./actions";

type Campaign = {
  id: string;
  subject: string;
  body_html: string;
  audience: "all_buyers" | "subscribers" | "all";
  status: "draft" | "sent";
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
};

type Props = {
  counts: AudienceCounts;
  campaigns: Campaign[];
  platformEmailReady: boolean;
  storeName: string;
};

const AUDIENCE_LABELS: Record<string, string> = {
  all_buyers: "Buyers",
  subscribers: "Subscribers",
  all: "Everyone",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

const MERGE_TAGS = [
  { tag: "{first_name}", desc: "Recipient's first name" },
  { tag: "{store}", desc: "Your store name" },
  { tag: "{unsubscribe_url}", desc: "Unsubscribe link (placeholder)" },
];

const DEFAULT_BODY = `<p>Hi {first_name},</p>

<p>We have something new for you from {store}.</p>

<p>[Your message here]</p>

<p>Thanks,<br/>{store}</p>

<p style="font-size:11px;color:#999;">
  You received this because you signed up or made a purchase at {store}.
  <a href="{unsubscribe_url}">Unsubscribe</a>
</p>`;

export default function CampaignComposer({
  counts,
  campaigns: initialCampaigns,
  platformEmailReady,
  storeName,
}: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_BODY);
  const [audience, setAudience] = useState<"all_buyers" | "subscribers" | "all">("all");

  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(text: string, ok: boolean) {
    setToastMsg({ text, ok });
    setTimeout(() => setToastMsg(null), 4000);
  }

  function openNew() {
    setEditingId(undefined);
    setSubject("");
    setBodyHtml(DEFAULT_BODY);
    setAudience("all");
    setComposerOpen(true);
  }

  function openEdit(c: Campaign) {
    setEditingId(c.id);
    setSubject(c.subject);
    setBodyHtml(c.body_html);
    setAudience(c.audience);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditingId(undefined);
  }

  function audienceCount() {
    if (audience === "all_buyers") return counts.buyers;
    if (audience === "subscribers") return counts.subscribers;
    return counts.all;
  }

  function handleSaveDraft() {
    startTransition(async () => {
      const res = await saveDraft({ id: editingId, subject, body_html: bodyHtml, audience });
      if (res.ok) {
        showToast("Draft saved.", true);
        // Refresh the list via a page reload signal
        window.location.reload();
      } else {
        showToast(res.error ?? "Save failed.", false);
      }
    });
  }

  function handleSend() {
    startTransition(async () => {
      const res = await sendCampaign({ id: editingId, subject, body_html: bodyHtml, audience });
      if (res.ok) {
        showToast(
          platformEmailReady
            ? `Campaign queued for ${audienceCount()} recipient${audienceCount() !== 1 ? "s" : ""}.`
            : `Campaign recorded (${audienceCount()} recipients). Delivery requires the platform email service to be connected by your admin.`,
          true,
        );
        window.location.reload();
      } else {
        showToast(res.error ?? "Send failed.", false);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this draft?")) return;
    startTransition(async () => {
      const res = await deleteCampaign(id);
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        showToast("Draft deleted.", true);
      } else {
        showToast(res.error ?? "Delete failed.", false);
      }
    });
  }

  function insertMergeTag(tag: string) {
    setBodyHtml((prev) => prev + tag);
  }

  const drafts = campaigns.filter((c) => c.status === "draft");
  const sent = campaigns.filter((c) => c.status === "sent");

  return (
    <>
      <style>{`
        .ec-warn {
          background: color-mix(in srgb, var(--gold, #ffb23e) 10%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--gold, #ffb23e) 30%, var(--border));
          border-radius: 12px; padding: 13px 16px; margin-bottom: 16px;
          font-size: 13px; color: var(--text); display: flex; gap: 10px; align-items: flex-start;
        }
        .ec-warn svg { flex: none; color: #9a6b00; margin-top: 1px; }
        .ec-warn strong { display: block; font-weight: 700; margin-bottom: 3px; }
        .ec-warn p { margin: 0; color: var(--muted); font-size: 12.5px; }

        .ec-audience-bar {
          display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
        }
        .ec-aud-card {
          flex: 1; min-width: 120px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 13px 16px; cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .ec-aud-card.active {
          border-color: var(--primary);
          background: color-mix(in srgb, var(--primary) 7%, var(--surface));
        }
        .ec-aud-card .num {
          font-size: 22px; font-weight: 800; color: var(--text);
        }
        .ec-aud-card.active .num { color: var(--primary); }
        .ec-aud-card .lbl {
          font-size: 11.5px; color: var(--muted); margin-top: 2px; text-transform: uppercase;
          letter-spacing: .04em; font-weight: 600;
        }

        .ec-composer {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px; margin-bottom: 16px;
        }
        .ec-composer h3 {
          font-size: 15px; margin: 0 0 16px; font-weight: 700;
        }
        .ec-field { margin-bottom: 13px; }
        .ec-field label {
          display: block; font-size: 12px; font-weight: 600;
          color: var(--muted); margin-bottom: 5px; text-transform: uppercase;
          letter-spacing: .04em;
        }
        .ec-field input, .ec-field select {
          width: 100%; padding: 9px 12px; border: 1px solid var(--border);
          border-radius: 9px; background: var(--bg); color: var(--text);
          font: inherit; font-size: 13.5px; outline: none; box-sizing: border-box;
        }
        .ec-field input:focus, .ec-field select:focus {
          border-color: var(--primary);
        }
        .ec-field textarea {
          width: 100%; padding: 10px 12px; border: 1px solid var(--border);
          border-radius: 9px; background: var(--bg); color: var(--text);
          font: inherit; font-size: 13px; outline: none; resize: vertical;
          min-height: 240px; box-sizing: border-box; line-height: 1.55;
          font-family: 'SF Mono', ui-monospace, monospace;
        }
        .ec-field textarea:focus { border-color: var(--primary); }

        .ec-merge-tags {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
        }
        .ec-merge-tag {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 7px; padding: 3px 9px; font-size: 12px;
          font-family: monospace; cursor: pointer; color: var(--text);
          transition: background 0.1s;
        }
        .ec-merge-tag:hover { background: color-mix(in srgb, var(--primary) 10%, var(--surface2)); }

        .ec-actions {
          display: flex; gap: 8px; margin-top: 18px; align-items: center; flex-wrap: wrap;
        }
        .ec-actions .ec-reach {
          font-size: 12.5px; color: var(--muted); margin-left: auto;
        }
        .ec-actions .ec-reach strong { color: var(--text); }

        .ec-table { width: 100%; border-collapse: collapse; }
        .ec-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 9px 12px;
          border-bottom: 1px solid var(--border);
        }
        .ec-table td {
          padding: 11px 12px; border-bottom: 1px solid var(--border);
          font-size: 13px; vertical-align: middle;
        }
        .ec-table tr:last-child td { border-bottom: 0; }
        .ec-table tr:hover td { background: var(--surface2); }
        .ec-subject { font-weight: 600; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ec-empty { text-align: center; padding: 40px; color: var(--muted); font-size: 13.5px; }

        .ec-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700;
        }
        .ec-badge.sent { background: var(--greenbg, #d0fbe9); color: var(--green, #1fb57a); }
        .ec-badge.draft { background: var(--surface2); color: var(--muted); }

        .ec-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 12px 20px; font-size: 13.5px;
          box-shadow: 0 6px 28px rgba(0,0,0,.18); z-index: 9999;
          max-width: 420px; text-align: center;
          display: flex; align-items: center; gap: 8px;
        }
        .ec-toast.ok { border-color: var(--green, #1fb57a); color: var(--green, #1fb57a); }
        .ec-toast.err { border-color: var(--red, #e5476f); color: var(--red, #e5476f); }

        .ec-divider {
          border: 0; border-top: 1px solid var(--border); margin: 18px 0;
        }
      `}</style>

      {/* Platform email not configured — honest banner */}
      {!platformEmailReady && (
        <div className="ec-warn">
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <strong>Platform email service not connected</strong>
            <p>
              You can compose and save campaigns now. Actual delivery to recipients requires the
              platform administrator to configure the email service (SMTP / Gmail). When you click
              "Send", the campaign will be recorded as sent and the recipient count logged — but
              emails will not be delivered until the platform email service is active.
            </p>
          </div>
        </div>
      )}

      {/* New campaign button */}
      {!composerOpen && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn grad" onClick={openNew}>
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.5} style={{ marginRight: 6 }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            New campaign
          </button>
        </div>
      )}

      {/* Composer */}
      {composerOpen && (
        <div className="ec-composer">
          <h3>{editingId ? "Edit draft" : "New campaign"}</h3>

          {/* Audience selector */}
          <div className="ec-field">
            <label>Audience</label>
            <div className="ec-audience-bar">
              {(["all", "all_buyers", "subscribers"] as const).map((seg) => {
                const n = seg === "all_buyers" ? counts.buyers : seg === "subscribers" ? counts.subscribers : counts.all;
                const lbl = seg === "all_buyers" ? "Buyers" : seg === "subscribers" ? "Subscribers" : "Everyone";
                return (
                  <div
                    key={seg}
                    className={`ec-aud-card${audience === seg ? " active" : ""}`}
                    onClick={() => setAudience(seg)}
                    title={
                      seg === "all_buyers"
                        ? "People who made at least one paid order"
                        : seg === "subscribers"
                        ? "Newsletter signups from your site"
                        : "All unique reachable emails (buyers + subscribers)"
                    }
                  >
                    <div className="num">{n}</div>
                    <div className="lbl">{lbl}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div className="ec-field">
            <label>Subject line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. New drop — exclusive for our community"
              maxLength={250}
            />
          </div>

          {/* Body */}
          <div className="ec-field">
            <label>
              Email body (HTML)
              <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11, textTransform: "none" }}>
                — merge tags:
              </span>
            </label>
            <div className="ec-merge-tags">
              {MERGE_TAGS.map((mt) => (
                <button
                  key={mt.tag}
                  className="ec-merge-tag"
                  type="button"
                  title={mt.desc}
                  onClick={() => insertMergeTag(mt.tag)}
                >
                  {mt.tag}
                </button>
              ))}
            </div>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="Write HTML or plain text…"
            />
          </div>

          <div className="ec-actions">
            <button
              className="btn ghost"
              onClick={closeComposer}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              className="btn"
              onClick={handleSaveDraft}
              disabled={isPending || !subject.trim() || !bodyHtml.trim()}
              style={{ opacity: (!subject.trim() || !bodyHtml.trim()) ? 0.5 : 1 }}
            >
              {isPending ? "Saving…" : "Save draft"}
            </button>
            <button
              className="btn grad"
              onClick={handleSend}
              disabled={isPending || !subject.trim() || !bodyHtml.trim()}
              style={{ opacity: (!subject.trim() || !bodyHtml.trim()) ? 0.5 : 1 }}
            >
              {isPending
                ? "Sending…"
                : platformEmailReady
                ? `Send to ${audienceCount()} recipient${audienceCount() !== 1 ? "s" : ""}`
                : `Record send (${audienceCount()} recipients)`}
            </button>
            <div className="ec-reach">
              Reach: <strong>{audienceCount()}</strong> unique email{audienceCount() !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
            Drafts ({drafts.length})
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <table className="ec-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Audience</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="ec-subject">{c.subject}</span>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {AUDIENCE_LABELS[c.audience] ?? c.audience}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {fmtDate(c.created_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn ghost"
                          style={{ fontSize: 12, padding: "4px 12px" }}
                          onClick={() => openEdit(c)}
                          disabled={isPending}
                        >
                          Edit
                        </button>
                        <button
                          className="btn ghost"
                          style={{ fontSize: 12, padding: "4px 12px", color: "var(--red, #e5476f)" }}
                          onClick={() => handleDelete(c.id)}
                          disabled={isPending}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sent campaigns */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
        Sent campaigns ({sent.length})
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {sent.length === 0 ? (
          <div className="ec-empty">No campaigns sent yet. Compose your first above.</div>
        ) : (
          <table className="ec-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Audience</th>
                <th>Recipients</th>
                <th>Sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="ec-subject" title={c.subject}>{c.subject}</span>
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>
                    {AUDIENCE_LABELS[c.audience] ?? c.audience}
                  </td>
                  <td style={{ fontWeight: 700 }}>{c.recipient_count}</td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>
                    {c.sent_at ? fmtDate(c.sent_at) : "—"}
                  </td>
                  <td>
                    <span className={`ec-badge ${platformEmailReady ? "sent" : "draft"}`}>
                      {platformEmailReady ? "Sent" : "Recorded"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className={`ec-toast ${toastMsg.ok ? "ok" : "err"}`}>
          {toastMsg.ok ? (
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
          )}
          {toastMsg.text}
        </div>
      )}
    </>
  );
}
