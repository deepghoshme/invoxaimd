'use client';
/**
 * lib/builder/runtime.tsx
 * InvoxAI Page Builder v6 — CLIENT-INTERACTIVE widgets.
 *
 * "use client" — this module runs on the client and hydrates SSR output.
 * Each component renders meaningful SSR-safe static fallback markup first,
 * then enhances on mount (useEffect) when editor=false.
 *
 * Imported by RenderEngine.tsx (server component). Next.js app router
 * automatically hydrates client components embedded in server components.
 *
 * DO NOT import from any existing studio/route/db module.
 * DO NOT use dangerouslySetInnerHTML with user content.
 */

import React, { useEffect, useRef, useState, type CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Helpers shared with RenderEngine (duplicated to keep runtime self-contained)
// ---------------------------------------------------------------------------

/** Scheme-allowlist identical to RenderEngine.safeHref. */
function safeHref(u: string): string {
  const trimmed = (u || '').trim();
  if (!trimmed) return '#';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(trimmed)) return trimmed;
  return '#';
}

/** Zero-pad an integer to at least 2 digits. */
function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

/** Compute days/hours/minutes/seconds remaining until `target` (ISO string). */
function computeRemaining(target: string): { d: number; h: number; m: number; s: number; expired: boolean } {
  const now = Date.now();
  const then = target ? new Date(target).getTime() : NaN;
  if (!target || Number.isNaN(then) || then <= now) {
    return { d: 0, h: 0, m: 0, s: 0, expired: then <= now && !Number.isNaN(then) };
  }
  let rem = Math.floor((then - now) / 1000);
  const d = Math.floor(rem / 86400); rem -= d * 86400;
  const h = Math.floor(rem / 3600); rem -= h * 3600;
  const m = Math.floor(rem / 60); rem -= m * 60;
  return { d, h, m, s: rem, expired: false };
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

export interface CountdownProps {
  target: string;
  expiredText: string;
  heading: string;
  editor?: boolean;
  /** Inline style overrides for the digit box */
  boxStyle?: CSSProperties;
}

const UNITS = ['Days', 'Hrs', 'Min', 'Sec'] as const;

/** Static digit box (SSR + editor fallback). */
function CountdownBoxes({
  d, h, m, s, boxStyle,
}: {
  d: string; h: string; m: string; s: string; boxStyle?: CSSProperties;
}) {
  const defaultBoxStyle: CSSProperties = {
    fontSize: 32,
    fontWeight: 800,
    fontFamily: 'var(--bx-font-display)',
    background: 'rgba(0,0,0,.06)',
    borderRadius: 12,
    padding: '10px 0',
    minWidth: 64,
    textAlign: 'center',
  };
  const merged = { ...defaultBoxStyle, ...boxStyle };
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
      {([d, h, m, s] as string[]).map((val, i) => (
        <div key={i} style={{ minWidth: 64, textAlign: 'center' }}>
          <div style={merged}>{val}</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>{UNITS[i]}</div>
        </div>
      ))}
    </div>
  );
}

export function Countdown({ target, expiredText, heading, editor, boxStyle }: CountdownProps) {
  // Compute SSR/initial static values from the target so SSR has real content.
  const initial = computeRemaining(target);

  const [state, setState] = useState(initial);

  useEffect(() => {
    // In editor mode don't tick (keeps preview stable).
    if (editor) return;

    function tick() {
      setState(computeRemaining(target));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, editor]);

  const { d, h, m, s, expired } = state;

  return (
    <div style={{ textAlign: 'center' }}>
      {heading && (
        <div style={{ fontFamily: 'var(--bx-font-display)', fontWeight: 800, fontSize: 'clamp(18px,2.5vw,24px)', lineHeight: 1.08 }}>
          {heading}
        </div>
      )}
      {expired ? (
        <p style={{ marginTop: 12, opacity: 0.75 }}>{expiredText || 'This offer has ended.'}</p>
      ) : (
        <CountdownBoxes
          d={pad2(d)}
          h={pad2(h)}
          m={pad2(m)}
          s={pad2(s)}
          boxStyle={boxStyle}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Popup
// ---------------------------------------------------------------------------

export interface PopupProps {
  delay: number;
  title: string;
  text: string;
  ctaLabel: string;
  ctaUrl: string;
  editor?: boolean;
  /** Inline section button style (passed through from RenderEngine) */
  btnInlineStyle?: CSSProperties;
}

/**
 * In editor mode: renders the inline card preview (identical to the old static
 * rendering so editor sees the content).
 * In live mode (SSR + client): returns null on server (no flash), then after
 * `delay` seconds a fixed overlay appears. Esc + overlay-click + x button close it.
 */
export function Popup({ delay, title, text, ctaLabel, ctaUrl, editor, btnInlineStyle }: PopupProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (editor) return;
    const ms = Math.max(0, (typeof delay === 'number' ? delay : 5)) * 1000;
    const t = setTimeout(() => setOpen(true), ms);
    return () => clearTimeout(t);
  }, [delay, editor]);

  // Key listener for Esc.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // --- Editor mode: static inline card preview ---
  if (editor) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(255,255,255,.7)',
          border: '1px solid rgba(0,0,0,.08)',
          borderRadius: 16,
          padding: 22,
          textAlign: 'center',
          boxShadow: '0 30px 70px -30px rgba(0,0,0,.5)',
        }}>
          <div style={{ fontFamily: 'var(--bx-font-display)', fontWeight: 800, fontSize: 18, lineHeight: 1.08 }}>{title}</div>
          <p style={{ opacity: 0.78, marginTop: 8 }}>{text}</p>
          {ctaLabel && (
            <div style={{ marginTop: 16 }}>
              <a href={safeHref(ctaUrl || '#')} style={btnInlineStyle ?? { display: 'inline-block', fontWeight: 700, padding: '12px 24px', borderRadius: 12, background: 'var(--bx-grad)', color: '#fff', textDecoration: 'none' }}>
                {ctaLabel}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Live mode: hidden until delay fires ---
  // Before hydration (SSR + pre-mount): render nothing so no flash on load.
  if (!mounted) return null;

  if (!open) return null;

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  };
  const dialogStyle: CSSProperties = {
    position: 'relative',
    background: '#fff',
    borderRadius: 18,
    padding: '32px 28px',
    maxWidth: 420,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 40px 80px -20px rgba(0,0,0,.4)',
  };
  const closeStyle: CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 14,
    background: 'none',
    border: 'none',
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
    opacity: 0.5,
    padding: 4,
  };

  return (
    <div
      style={overlayStyle}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Popup'}
    >
      {/* Prevent click-through from closing when clicking inside dialog */}
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <button
          style={closeStyle}
          onClick={() => setOpen(false)}
          aria-label="Close popup"
          type="button"
        >
          ×
        </button>
        <div style={{ fontFamily: 'var(--bx-font-display)', fontWeight: 800, fontSize: 22, lineHeight: 1.1, marginBottom: 10 }}>
          {title}
        </div>
        <p style={{ opacity: 0.78, lineHeight: 1.6 }}>{text}</p>
        {ctaLabel && (
          <div style={{ marginTop: 20 }}>
            <a
              href={safeHref(ctaUrl || '#')}
              style={btnInlineStyle ?? { display: 'inline-block', fontWeight: 700, fontFamily: 'var(--bx-font-display)', padding: '12px 28px', borderRadius: 12, background: 'var(--bx-grad)', color: '#fff', textDecoration: 'none' }}
            >
              {ctaLabel}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LeadForm
// ---------------------------------------------------------------------------

export interface LeadField {
  key: string;
  label: string;
  type: string;
}

export interface LeadFormProps {
  heading: string;
  sub: string;
  fields: LeadField[];
  submitLabel: string;
  action: string;
  editor?: boolean;
  /** Inline style for the submit button */
  btnInlineStyle?: CSSProperties;
}

/** Input common styles. */
const INPUT_STYLE: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,.15)',
  width: '100%',
  font: 'inherit',
  boxSizing: 'border-box',
};

/**
 * Working lead capture form.
 *
 * - When editor=true: static non-submitting preview (form renders but button is a <span>).
 * - When !editor: native <form method="post"> with a real <button type="submit">.
 *   - If action is empty or fails the scheme check → no-op: show local success state.
 *   - If action is valid http(s): POST the form (browser-native, no JS fetch needed).
 */
export function LeadForm({ heading, sub, fields, submitLabel, action, editor, btnInlineStyle }: LeadFormProps) {
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Validate action URL: must be http/https or empty. Relative paths allowed too.
  const safeAction = safeHref(action || '');
  // A "real" action is http(s) (or an absolute /relative path).
  const isRealAction = safeAction !== '#' && !!action.trim();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (editor) { e.preventDefault(); return; }
    if (!isRealAction) {
      // No valid action: prevent navigation, show success locally.
      e.preventDefault();
      setSuccess(true);
      return;
    }
    // Valid action: let the browser POST normally.
    // (no preventDefault — browser submits the form)
  }

  if (success) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <div style={{ fontFamily: 'var(--bx-font-display)', fontWeight: 800, fontSize: 22 }}>Thanks!</div>
        <p style={{ opacity: 0.72, marginTop: 8 }}>We'll be in touch soon.</p>
      </div>
    );
  }

  const submitBtn = editor ? (
    <span style={{ ...btnInlineStyle, textAlign: 'center', display: 'block' } as CSSProperties}>
      {submitLabel || 'Submit'}
    </span>
  ) : (
    <button
      type="submit"
      style={{
        ...(btnInlineStyle ?? { background: 'var(--bx-grad)', color: '#fff', fontWeight: 700, fontFamily: 'var(--bx-font-display)', padding: '12px 24px', borderRadius: 12 }),
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'center',
        fontSize: 'inherit',
      } as CSSProperties}
    >
      {submitLabel || 'Submit'}
    </button>
  );

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      {heading && (
        <div style={{ fontFamily: 'var(--bx-font-display)', fontWeight: 800, fontSize: 'clamp(24px,3.4vw,38px)', lineHeight: 1.08 }}>
          {heading}
        </div>
      )}
      {sub && <p style={{ fontSize: 17, lineHeight: 1.6, opacity: 0.78, maxWidth: 640, margin: '12px auto 0' }}>{sub}</p>}
      <form
        ref={formRef}
        method="post"
        action={isRealAction ? safeAction : undefined}
        onSubmit={handleSubmit}
        style={{ display: 'grid', gap: 10, marginTop: 20, textAlign: 'left' }}
      >
        {fields.map((fl, i) => {
          const type = fl.type || 'text';
          const name = fl.key || undefined;
          return type === 'textarea'
            ? <textarea key={i} name={name} placeholder={fl.label} rows={3} style={INPUT_STYLE} />
            : <input key={i} name={name} type={type} placeholder={fl.label} style={INPUT_STYLE} />;
        })}
        {submitBtn}
      </form>
    </div>
  );
}
