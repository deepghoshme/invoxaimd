"use client";

import { usePathname } from "next/navigation";

export type NavItem = { label: string; href: string; icon?: string; exact?: boolean };

/**
 * Minimal functional dashboard shell — a plain top bar with nav + sign out.
 * The visual design is intentionally stripped back; a fresh redesign is pending.
 * All routing, auth and data behavior is unchanged.
 */
export default function AppShell({
  brand,
  nav,
  children,
  user,
  siteUrl,
  homeHref = "/",
}: {
  brand: string;
  nav: NavItem[];
  children: React.ReactNode;
  user?: { email?: string | null; name?: string | null };
  siteUrl?: string;
  homeHref?: string;
}) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="dash">
      <header className="dash-top">
        <a href={homeHref} className="dash-brand">{brand}</a>
        <nav className="dash-nav">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className={isActive(item) ? "on" : ""}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="dash-right">
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noreferrer">View site</a>
          )}
          {user?.email && <span className="dash-user">{user.email}</span>}
          <form method="post" action="/auth/signout">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="dash-main">{children}</main>
    </div>
  );
}
