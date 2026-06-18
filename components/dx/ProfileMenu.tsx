"use client";

import { useState } from "react";
import Link from "next/link";

export type ProfileItem = { label: string; href: string };

/**
 * Profile avatar + dropdown (Account setting · Plan & billing · Sign out).
 * `compact` → icon-only (header). Otherwise full row (sidebar footer).
 */
export default function ProfileMenu({
  name,
  email,
  avatarUrl,
  items,
  compact = false,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  items: ProfileItem[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = (name || email || "U").trim();
  const initial = label.charAt(0).toUpperCase();

  const avatar = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="dx-avatar" src={avatarUrl} alt="" />
  ) : (
    <span className="dx-avatar dx-avatar-i">{initial}</span>
  );

  return (
    <div className="dx-profile-wrap">
      <button className={`dx-profile${compact ? " compact" : ""}`} onClick={() => setOpen((v) => !v)} aria-label="Account">
        {avatar}
        {!compact && (
          <span className="dx-profile-id">
            <b>{name || "Account"}</b>
            {email && <span>{email}</span>}
          </span>
        )}
        {!compact && <span className="dx-chev">▾</span>}
      </button>
      {open && (
        <>
          <div className="dx-pop-backdrop" onClick={() => setOpen(false)} />
          <div className={`dx-pop${compact ? " right" : ""}`}>
            <div className="dx-pop-head">
              {avatar}
              <div className="dx-profile-id">
                <b>{name || "Account"}</b>
                {email && <span>{email}</span>}
              </div>
            </div>
            {items.map((it) => (
              <Link key={it.href} href={it.href} className="dx-pop-item" onClick={() => setOpen(false)}>
                {it.label}
              </Link>
            ))}
            <form method="post" action="/auth/signout">
              <button className="dx-pop-item danger" type="submit">Sign out</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
