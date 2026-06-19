"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "./Icon";
import ProfileMenu, { type ProfileItem } from "./ProfileMenu";

export type DxNavItem = { label: string; icon: string; href: string; exact?: boolean };
export type DxNavGroup = { label: string; items: DxNavItem[] };
export type DxNotifItem = { id: string; cat?: string; icon?: string; title: string; sub?: string; ts?: string | number; href?: string };

/** Header bell with unread count + dropdown. Read-state in localStorage. */
function BellMenu({ items, viewAllHref, storageKey }: { items: DxNotifItem[]; viewAllHref: string; storageKey: string }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { setRead(new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]"))); } catch {}
    setHydrated(true);
  }, [storageKey]);
  const unread = hydrated ? items.filter((i) => !read.has(i.id)).length : 0;
  function markAll() {
    const all = new Set(items.map((i) => i.id));
    setRead(all);
    try { localStorage.setItem(storageKey, JSON.stringify([...all])); } catch {}
  }
  return (
    <div className="dx-bell-wrap" style={{ position: "relative" }}>
      <button className="dx-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Notifications" style={{ position: "relative" }}>
        🔔
        {unread > 0 && (
          <span style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "var(--secondary)", color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", lineHeight: 1 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, maxWidth: "90vw", maxHeight: 440, overflowY: "auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-pop, 0 18px 50px -22px rgba(0,0,0,.42))", zIndex: 50 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
              <strong style={{ fontSize: 14 }}>Notifications</strong>
              {unread > 0 && <button onClick={markAll} style={{ fontSize: 12, color: "var(--primary)", background: "none", border: 0, cursor: "pointer" }}>Mark all read</button>}
            </div>
            {items.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No notifications yet.</div>
            ) : (
              items.slice(0, 8).map((i) => (
                <Link key={i.id} href={i.href ?? viewAllHref} onClick={() => setOpen(false)} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: "1px solid var(--border)", textDecoration: "none", color: "var(--text)", background: hydrated && !read.has(i.id) ? "var(--surface2)" : "transparent" }}>
                  <span style={{ fontSize: 16 }}>{i.icon ?? "•"}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.title}</span>
                    {i.sub && <span style={{ display: "block", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.sub}</span>}
                  </span>
                </Link>
              ))
            )}
            <Link href={viewAllHref} onClick={() => setOpen(false)} style={{ display: "block", textAlign: "center", padding: "11px 14px", fontSize: 13, fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
              View all notifications →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function DxShell({
  brand,
  logoUrl,
  badge,
  groups,
  user,
  walletHref,
  profileItems,
  notifItems,
  homeHref,
  children,
}: {
  brand: string;
  logoUrl?: string | null;
  badge?: string;
  groups: DxNavGroup[];
  user?: { email?: string | null; name?: string | null; avatarUrl?: string | null };
  walletHref?: string;
  profileItems: ProfileItem[];
  notifItems?: DxNotifItem[];
  homeHref: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const isActive = (i: DxNavItem) =>
    i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/");

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("invox-theme", next); } catch {}
    setDark(!dark);
  }

  return (
    <div className={`dx${dark ? " dark" : ""}`}>
      <aside className="dx-side">
        <Link className="dx-logo" href={homeHref}>
          {logoUrl
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={brand} style={{ height: 22, width: "auto", maxWidth: 120, objectFit: "contain", display: "block" }} />
            : <><span className="dx-dot" /> {brand}</>}
          {badge && <span className="dx-pill" style={badge === "buyer" ? { background: "var(--secondary)" } : undefined}>{badge}</span>}
        </Link>

        <nav className="dx-navscroll">
          {groups.map((g) => (
            <div className="dx-navgroup" key={g.label}>
              <div className="dx-navlbl">{g.label}</div>
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className={`dx-nav${isActive(it) ? " act" : ""}`}>
                  <Icon name={it.icon} /> {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="dx-side-foot">
          <ProfileMenu name={user?.name} email={user?.email} avatarUrl={user?.avatarUrl} items={profileItems} />
        </div>
      </aside>

      <div className="dx-col">
        <header className="dx-top">
          {walletHref && (
            <Link className="dx-wallet" href={walletHref}>
              <Icon name="wallet" size={16} /> Wallet
            </Link>
          )}
          {notifItems && (
            <BellMenu
              items={notifItems}
              viewAllHref={badge === "admin" ? "/admin/notifications" : "/dashboard/notifications"}
              storageKey={badge === "admin" ? "invox_admin_notif_read" : "invox_notif_read"}
            />
          )}
          <button className="dx-icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {dark ? "☀️" : "🌙"}
          </button>
          <ProfileMenu compact name={user?.name} email={user?.email} avatarUrl={user?.avatarUrl} items={profileItems} />
        </header>
        <main className="dx-main">{children}</main>
      </div>
    </div>
  );
}
