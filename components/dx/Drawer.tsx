"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reusable right-side slide-over drawer.
 * Portals to document.body so it sits above all page content.
 * z-index: scrim=1000, drawer=1001 (matches bell dropdown backdrop + one level up).
 *
 * Usage:
 *   <Drawer open={open} onClose={() => setOpen(false)} title="Order #123" footer={<button>Save</button>}>
 *     …content…
 *   </Drawer>
 */
export default function Drawer({ open, onClose, title, footer, children }: DrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Scrim */}
      <div className="dx-scrim" onClick={onClose} />
      {/* Drawer panel */}
      <aside className="dx-drawer">
        <div className="dx-dhead">
          {title ? <h3>{title}</h3> : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface2)",
              color: "var(--text)",
              width: 30,
              height: 30,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        <div className="dx-dbody">{children}</div>
        {footer && <div className="dx-dfoot">{footer}</div>}
      </aside>
    </>,
    document.body
  );
}
