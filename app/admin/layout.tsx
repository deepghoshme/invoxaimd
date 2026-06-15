export const dynamic = "force-dynamic";

/**
 * Pass-through. The admin authorization check lives in each admin page itself,
 * BEFORE any data is fetched — a layout redirect does not stop the page from
 * rendering (layout + page render in parallel), so the guard must be in the page.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
