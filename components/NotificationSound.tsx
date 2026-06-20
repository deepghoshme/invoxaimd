"use client";

import { useEffect, useRef, useState } from "react";

/**
 * NotificationSound — WooCommerce-app-style notification chime + toggle.
 *
 * Mounted in both the admin and seller dashboard layouts. It:
 *  1. Polls /api/notifications (the same derivation that feeds the bell) every
 *     POLL_MS and detects when a previously-unseen notification id appears.
 *  2. Plays a short two-note "ding" synthesized with the Web Audio API — no
 *     audio asset/binary is needed.
 *  3. Shows a brief visual ping (pulse ring) on its own speaker icon.
 *  4. Exposes a speaker toggle (default ON) persisted in localStorage so the
 *     user can mute the chime.
 *
 * Autoplay policy: browsers block AudioContext until the user interacts with
 * the page. We track a first-interaction flag and only chime after that; any
 * "new notification" that lands before the first interaction is recorded as
 * seen (so it doesn't chime late) but plays no sound.
 *
 * Read/unread state is NOT owned here — it stays in the bell's localStorage
 * sets. This component only cares about "is there an id I haven't seen yet".
 */

const POLL_MS = 25_000;

type Scope = "admin" | "seller";

function keysFor(scope: Scope) {
  return {
    seen: scope === "admin" ? "invox_admin_notif_seen" : "invox_notif_seen",
    enabled: scope === "admin" ? "invox_admin_notif_sound" : "invox_notif_sound",
  };
}

export default function NotificationSound({ scope }: { scope: Scope }) {
  const { seen: SEEN_KEY, enabled: SOUND_KEY } = keysFor(scope);

  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [ping, setPing] = useState(false);

  // Mutable refs so the polling closure always reads the latest values.
  const enabledRef = useRef(true);
  const seenRef = useRef<Set<string>>(new Set());
  const interactedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const initializedRef = useRef(false); // first poll just seeds, never chimes

  // ── Hydrate persisted state ────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(SOUND_KEY);
      const on = raw === null ? true : raw === "1"; // default ON
      setEnabled(on);
      enabledRef.current = on;
    } catch {
      /* storage blocked — default ON */
    }
    try {
      const rawSeen = localStorage.getItem(SEEN_KEY);
      if (rawSeen) seenRef.current = new Set(JSON.parse(rawSeen) as string[]);
    } catch {
      /* ignore */
    }
  }, [SOUND_KEY, SEEN_KEY]);

  // ── Track first user interaction (unlocks audio per autoplay policy) ────────
  useEffect(() => {
    const mark = () => {
      interactedRef.current = true;
      // Resume a suspended context created before the gesture.
      audioCtxRef.current?.resume?.().catch(() => {});
    };
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", mark, opts);
    window.addEventListener("keydown", mark, opts);
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  // ── Synthesize a pleasant two-note ding ─────────────────────────────────────
  function playChime() {
    if (!interactedRef.current) return; // respect autoplay rules
    try {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const now = ctx.currentTime;
      // Two ascending notes: E6 then B6 — short, bright, WooCommerce-ish.
      const notes = [
        { freq: 1318.5, start: 0, dur: 0.16 },
        { freq: 1567.98, start: 0.12, dur: 0.22 },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = n.freq;
        const t0 = now + n.start;
        const peak = 0.18;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + n.dur + 0.02);
      }
    } catch {
      /* audio unavailable — silently ignore */
    }
  }

  function flashPing() {
    setPing(true);
    window.setTimeout(() => setPing(false), 1400);
  }

  // ── Poll loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/notifications?scope=${scope}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ids?: string[] };
        const ids = Array.isArray(data.ids) ? data.ids : [];

        const seen = seenRef.current;
        const fresh = ids.filter((id) => !seen.has(id));

        if (!initializedRef.current) {
          // First successful poll just seeds the baseline — never chimes for
          // notifications that already existed when the dashboard opened.
          initializedRef.current = true;
        } else if (fresh.length > 0) {
          if (enabledRef.current) playChime();
          flashPing();
        }

        if (fresh.length > 0 || seen.size === 0) {
          for (const id of ids) seen.add(id);
          // Cap stored set so it can't grow unbounded.
          const trimmed = [...seen].slice(-300);
          seenRef.current = new Set(trimmed);
          try {
            localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* network hiccup — try again next tick */
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  function toggle() {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    // Give immediate audible feedback when turning ON (also unlocks audio).
    if (next) {
      interactedRef.current = true;
      playChime();
    }
  }

  if (!mounted) {
    // Avoid a hydration mismatch on the toggle's pressed state.
    return <span className="dx-icon-btn" aria-hidden style={{ visibility: "hidden" }} />;
  }

  return (
    <button
      className="dx-icon-btn"
      onClick={toggle}
      aria-label={enabled ? "Mute notification sound" : "Unmute notification sound"}
      aria-pressed={enabled}
      title={enabled ? "Notification sound on — click to mute" : "Notification sound off — click to unmute"}
      style={{ position: "relative" }}
    >
      {enabled ? "🔊" : "🔇"}
      {ping && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 999,
            border: "2px solid var(--secondary, #ff4d7d)",
            animation: "nsnd-ping 1.3s ease-out 1",
            pointerEvents: "none",
          }}
        />
      )}
      <style>{`
        @keyframes nsnd-ping {
          0%   { transform: scale(0.8); opacity: 0.9; }
          80%  { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>
    </button>
  );
}
