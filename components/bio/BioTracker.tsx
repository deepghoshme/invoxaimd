"use client";

import { useEffect } from "react";

/** Fires a single view beacon for a published bio/page. */
export default function BioTracker({ pageId, storeId }: { pageId: string; storeId?: string }) {
  useEffect(() => {
    const key = `inv_view_${pageId}`;
    try {
      if (sessionStorage.getItem(key)) return; // once per session
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch("/api/bio/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: pageId, store_id: storeId }),
      keepalive: true,
    }).catch(() => {});
  }, [pageId, storeId]);
  return null;
}
