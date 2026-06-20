/**
 * Bare layout for the template preview frame.
 * No navigation, no shell — just the raw page content.
 * This wraps inside app/layout.tsx (html/body/fonts) but NOT app/admin/layout.tsx.
 */
export default function TplPreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
