"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

export type NavItem = { label: string; href: string; icon?: string; exact?: boolean };

/**
 * Shared dashboard/admin layout: fixed left sidebar on desktop, hamburger drawer
 * on mobile (≤820px). Used by both the seller dashboard and the admin panel.
 */
export default function AppShell({
  brand,
  nav,
  children,
}: {
  brand: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="shell">
      <div
        className={`sidebar-backdrop${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
      />
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">{brand}</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(item) ? " active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.icon && <span className="ico">{item.icon}</span>}
              {item.label}
            </a>
          ))}
        </nav>
        <form method="post" action="/auth/signout" style={{ marginTop: "auto" }}>
          <button className="btn btn-ghost btn-block" type="submit">
            Sign out
          </button>
        </form>
      </aside>

      <div className="shell-main">
        <div className="topbar">
          <button
            className="hamburger"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            ☰
          </button>
          <strong style={{ fontFamily: "var(--font-heading)" }}>{brand}</strong>
        </div>
        {children}
      </div>
    </div>
  );
}
