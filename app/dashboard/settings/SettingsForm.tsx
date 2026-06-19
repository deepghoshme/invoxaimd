"use client";

import { useState } from "react";
import { saveStoreSettings } from "./actions";

type Cat = { id: string; name: string };

export default function SettingsForm({
  storeName,
  subdomain,
  categoryId,
  categories,
  replyToEmail,
}: {
  storeName: string;
  subdomain: string | null;
  categoryId: string | null;
  categories: Cat[];
  replyToEmail: string | null;
}) {
  const [name, setName] = useState(storeName);
  const [cat, setCat] = useState(categoryId ?? "");
  const [replyTo, setReplyTo] = useState(replyToEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    const res = await saveStoreSettings({
      store_name: name,
      category_id: cat || null,
      reply_to_email: replyTo || null,
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 1800);
    } else {
      setErr(res.error ?? "Save failed");
    }
  }

  return (
    <div className="dx-card">
      <div className="dx-ctitle"><h3>Store details</h3></div>
      <div className="dx-field">
        <label>Store name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your store" />
      </div>
      <div className="dx-ff">
        <div className="dx-field">
          <label>Category</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="dx-field">
          <label>Subdomain</label>
          <input value={subdomain ? `${subdomain}.invoxai.io` : ""} disabled />
        </div>
      </div>
      <div className="dx-field">
        <label>Reply-to email (optional)</label>
        <input
          type="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="you@yourdomain.com"
        />
        <p className="dx-muted" style={{ fontSize: 12, marginTop: 4 }}>
          Buyer replies to your order emails go here. The sender stays an invoxai address for deliverability.
        </p>
      </div>
      {err && <div className="dx-empty" style={{ color: "var(--secondary)", textAlign: "left", padding: "4px 0 10px" }}>{err}</div>}
      <button className="btn grad" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      {msg && <span className="dx-muted" style={{ marginLeft: 10, fontSize: 13 }}>{msg}</span>}
    </div>
  );
}
