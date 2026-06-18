"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "./Icon";
import ProfileMenu, { type ProfileItem } from "./ProfileMenu";

export type DxNavItem = { label: string; icon: string; href: string; exact?: boolean };
export type DxNavGroup = { label: string; items: DxNavItem[] };

export default function DxShell({
  brand,
  badge,
  groups,
  user,
  walletHref,
  profileItems,
  homeHref,
  children,
}: {
  brand: string;
  badge?: string;
  groups: DxNavGroup[];
  user?: { email?: string | null; name?: string | null; avatarUrl?: string | null };
  walletHref?: string;
  profileItems: ProfileItem[];
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
          <span className="dx-dot" /> {brand}
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
