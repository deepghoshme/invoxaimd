/**
 * lib/builder/RenderEngine.tsx
 * InvoxAI Page Builder v6 — the ONE render engine.
 * Renders a PageDoc (or a raw Section[]) and is shared by the editor preview,
 * the Preview overlay and the public SSR route. Presentational + SSR-safe
 * (no hooks, no event handlers) so it renders identically on server & client.
 * Self-contained: do NOT import from any existing studio/route/db module.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { PageDoc, Section } from './types';
import { getTheme, themeVars } from './themes';
import { pageBgStyle, sectionBgStyle } from './backgrounds';

// ---------------------------------------------------------------------------
// prop readers
// ---------------------------------------------------------------------------

function str(props: Record<string, unknown>, key: string, fallback = ''): string {
  const v = props[key];
  return typeof v === 'string' ? v : v == null ? fallback : String(v);
}
function num(props: Record<string, unknown>, key: string, fallback = 0): number {
  const v = props[key];
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}
function bool(props: Record<string, unknown>, key: string): boolean {
  return props[key] === true || props[key] === 'true';
}
function list<T = Record<string, unknown>>(props: Record<string, unknown>, key: string): T[] {
  const v = props[key];
  return Array.isArray(v) ? (v as T[]) : [];
}
function lines(s: string): string[] {
  return s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// section-level styling
// ---------------------------------------------------------------------------

const PAD: Record<string, string> = { sm: '28px', md: '64px', lg: '104px' };
const ALIGN: Record<string, CSSProperties['textAlign']> = {
  left: 'left', center: 'center', right: 'right',
};

function sectionStyle(s: Section): CSSProperties {
  const style: CSSProperties = {
    position: 'relative',
    paddingTop: PAD[s.size] ?? PAD.md,
    paddingBottom: PAD[s.size] ?? PAD.md,
    paddingLeft: '20px',
    paddingRight: '20px',
    ...sectionBgStyle(s.bg),
  };
  if (s.align && ALIGN[s.align]) style.textAlign = ALIGN[s.align];
  if (s.textColor === 'light') style.color = '#fff';
  if (s.textColor === 'dark') style.color = '#0b0b14';
  return style;
}

function btnStyle(s: Section, kind: 'primary' | 'secondary' = 'primary'): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-block',
    fontWeight: 700,
    fontFamily: 'var(--bx-font-display)',
    borderRadius: '12px',
    textDecoration: 'none',
    padding: s.btnSize === 'sm' ? '8px 16px' : s.btnSize === 'lg' ? '16px 32px' : '12px 24px',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'transform .12s ease, filter .12s ease',
  };
  if (kind === 'secondary') {
    return { ...base, background: 'transparent', color: 'var(--bx-brand)', borderColor: 'var(--bx-brand)' };
  }
  const color = s.btnColor;
  if (color === 'white') return { ...base, background: '#fff', color: 'var(--bx-brand)' };
  if (color === 'dark') return { ...base, background: '#0b0b14', color: '#fff' };
  if (color === 'success') return { ...base, background: '#16a34a', color: '#fff' };
  switch (s.btn) {
    case 'solid':
      return { ...base, background: 'var(--bx-brand)', color: '#fff' };
    case 'outline':
      return { ...base, background: 'transparent', color: 'var(--bx-brand)', borderColor: 'var(--bx-brand)' };
    case 'metal':
      return { ...base, background: 'linear-gradient(180deg,#3a3a44,#15151c)', color: '#fff' };
    case 'glow':
      return { ...base, background: 'var(--bx-grad)', color: '#fff', boxShadow: '0 0 28px -6px var(--bx-brand)' };
    case 'gradient':
    default:
      return { ...base, background: 'var(--bx-grad)', color: '#fff' };
  }
}

// ---------------------------------------------------------------------------
// shared layout atoms
// ---------------------------------------------------------------------------

function Container({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ maxWidth: 1120, margin: '0 auto', width: '100%', ...style }}>{children}</div>;
}
function H({ children, lvl = 2 }: { children: ReactNode; lvl?: 1 | 2 | 3 }) {
  const size = lvl === 1 ? 'clamp(34px,5vw,60px)' : lvl === 3 ? '18px' : 'clamp(24px,3.4vw,38px)';
  return (
    <div style={{ fontFamily: 'var(--bx-font-display)', fontWeight: 800, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.02em' }}>
      {children}
    </div>
  );
}
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--bx-brand)', background: 'color-mix(in srgb, var(--bx-brand) 12%, transparent)', padding: '4px 10px', borderRadius: 999 }}>
      {children}
    </div>
  );
}
function Sub({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 17, lineHeight: 1.6, opacity: 0.78, maxWidth: 640, margin: '12px auto 0' }}>{children}</p>;
}
function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.7)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 22, ...style }}>
      {children}
    </div>
  );
}
function Img({ src, alt, style }: { src: string; alt?: string; style?: CSSProperties }) {
  if (!src) {
    return <div style={{ background: 'color-mix(in srgb, var(--bx-brand) 10%, #eee)', borderRadius: 14, aspectRatio: '16/10', width: '100%', ...style }} aria-hidden />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? ''} style={{ borderRadius: 14, maxWidth: '100%', display: 'block', ...style }} />;
}

const grid = (cols: number, gap = 18): CSSProperties => ({
  display: 'grid', gap, gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
});

// ---------------------------------------------------------------------------
// per-block renderers
// ---------------------------------------------------------------------------

function renderBlock(s: Section): ReactNode {
  const p = s.props || {};
  switch (s.type) {
    // ---- Structure ----
    case 'navbar': {
      const links = list(p, 'links');
      return (
        <Container style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <strong style={{ fontFamily: 'var(--bx-font-display)', fontSize: 18 }}>{str(p, 'logoText', 'InvoxAI')}</strong>
          <nav style={{ display: 'flex', gap: 18, opacity: 0.85, fontSize: 14 }}>
            {links.map((l, i) => <a key={i} href={str(l as Record<string, unknown>, 'url', '#')} style={{ color: 'inherit', textDecoration: 'none' }}>{str(l as Record<string, unknown>, 'label')}</a>)}
          </nav>
          {str(p, 'ctaLabel') && <a href={str(p, 'ctaUrl', '#')} style={btnStyle(s)}>{str(p, 'ctaLabel')}</a>}
        </Container>
      );
    }
    case 'footer': {
      const links = list(p, 'links');
      return (
        <Container style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong style={{ fontFamily: 'var(--bx-font-display)', fontSize: 18 }}>{str(p, 'logoText', 'InvoxAI')}</strong>
            <div style={{ opacity: 0.7, fontSize: 14, marginTop: 4 }}>{str(p, 'tagline')}</div>
          </div>
          <nav style={{ display: 'flex', gap: 18, fontSize: 14, opacity: 0.85 }}>
            {links.map((l, i) => <a key={i} href={str(l as Record<string, unknown>, 'url', '#')} style={{ color: 'inherit', textDecoration: 'none' }}>{str(l as Record<string, unknown>, 'label')}</a>)}
          </nav>
          <div style={{ width: '100%', opacity: 0.55, fontSize: 12, marginTop: 8 }}>{str(p, 'copyright')}</div>
        </Container>
      );
    }

    // ---- Headers ----
    case 'badgebar': {
      const items = list(p, 'items');
      return (
        <Container style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {items.map((it, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.6)', border: '1px solid rgba(0,0,0,.08)' }}>
              <span>{str(it as Record<string, unknown>, 'icon')}</span>{str(it as Record<string, unknown>, 'text')}
            </span>
          ))}
        </Container>
      );
    }
    case 'hero': {
      const split = s.variant === 'split' || s.variant === 'left' || s.variant === 'right';
      const copy = (
        <div>
          {str(p, 'eyebrow') && <Eyebrow>{str(p, 'eyebrow')}</Eyebrow>}
          <div style={{ marginTop: 14 }}><H lvl={1}>{str(p, 'title')}</H></div>
          {str(p, 'subtitle') && <Sub>{str(p, 'subtitle')}</Sub>}
          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap', justifyContent: s.align === 'center' || !s.align ? (split ? 'flex-start' : 'center') : undefined }}>
            {str(p, 'b1Label') && <a href={str(p, 'b1Url', '#')} style={btnStyle(s)}>{str(p, 'b1Label')}</a>}
            {str(p, 'b2Label') && <a href={str(p, 'b2Url', '#')} style={btnStyle(s, 'secondary')}>{str(p, 'b2Label')}</a>}
          </div>
        </div>
      );
      if (split) {
        return (
          <Container style={{ ...grid(2, 40), alignItems: 'center', textAlign: 'left' }}>
            {s.variant === 'right' ? (<><Img src={str(p, 'image')} /><div>{copy}</div></>) : (<><div>{copy}</div><Img src={str(p, 'image')} /></>)}
          </Container>
        );
      }
      return (
        <Container style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {copy}
          {str(p, 'image') && <div style={{ marginTop: 36, width: '100%', maxWidth: 880 }}><Img src={str(p, 'image')} /></div>}
        </Container>
      );
    }
    case 'flip3d': {
      return (
        <Container style={{ textAlign: 'center' }}>
          <H lvl={1}>{str(p, 'title')}</H>
          {str(p, 'subtitle') && <Sub>{str(p, 'subtitle')}</Sub>}
          <div style={{ marginTop: 28, transform: 'perspective(900px) rotateX(6deg)', maxWidth: 760, marginInline: 'auto' }}>
            <Img src={str(p, 'image')} style={{ boxShadow: '0 40px 80px -30px rgba(0,0,0,.45)' }} />
          </div>
        </Container>
      );
    }
    case 'webinfo': {
      const items = list(p, 'items');
      return (
        <Container style={grid(Math.min(items.length || 1, 4))}>
          {items.map((it, i) => (
            <Card key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--bx-font-display)' }}>{str(it as Record<string, unknown>, 'value')}</div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>{str(it as Record<string, unknown>, 'label')}</div>
            </Card>
          ))}
        </Container>
      );
    }

    // ---- Social proof ----
    case 'logos': {
      const logos = list(p, 'logos');
      return (
        <Container style={{ textAlign: 'center' }}>
          {str(p, 'heading') && <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 18 }}>{str(p, 'heading')}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, justifyContent: 'center', alignItems: 'center', opacity: 0.8 }}>
            {logos.map((l, i) => {
              const img = str(l as Record<string, unknown>, 'img');
              return img ? <Img key={i} src={img} alt={str(l as Record<string, unknown>, 'alt')} style={{ height: 28, width: 'auto', borderRadius: 6 }} /> : <strong key={i} style={{ fontFamily: 'var(--bx-font-display)' }}>{str(l as Record<string, unknown>, 'alt')}</strong>;
            })}
          </div>
        </Container>
      );
    }
    case 'marquee': {
      const items = list(p, 'items');
      const row = [...items, ...items];
      return (
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div className="bx-marquee" style={{ display: 'inline-flex', gap: 40, paddingInline: 20 }}>
            {row.map((it, i) => <span key={i} style={{ fontWeight: 700, fontFamily: 'var(--bx-font-display)', opacity: 0.9 }}>{str(it as Record<string, unknown>, 'text')} ✦</span>)}
          </div>
        </div>
      );
    }
    case 'proof': {
      const r = num(p, 'rating', 4.9);
      return (
        <Container style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, color: 'var(--bx-acc)' }}>{'★'.repeat(Math.round(r))}{'☆'.repeat(Math.max(0, 5 - Math.round(r)))}</div>
          <H lvl={3}>{str(p, 'heading')}</H>
          {num(p, 'count') > 0 && <div style={{ opacity: 0.7, fontSize: 13 }}>{num(p, 'count').toLocaleString()} reviews</div>}
        </Container>
      );
    }
    case 'testimonials': {
      const items = list(p, 'items');
      return (
        <Container>
          {str(p, 'heading') && <div style={{ textAlign: 'center', marginBottom: 28 }}><H>{str(p, 'heading')}</H></div>}
          <div style={grid(Math.min(items.length || 1, 3))}>
            {items.map((it, i) => (
              <Card key={i}>
                <p style={{ fontStyle: 'italic', lineHeight: 1.6 }}>“{str(it as Record<string, unknown>, 'quote')}”</p>
                <div style={{ marginTop: 14, fontWeight: 700 }}>{str(it as Record<string, unknown>, 'name')}</div>
                <div style={{ opacity: 0.65, fontSize: 13 }}>{str(it as Record<string, unknown>, 'role')}</div>
              </Card>
            ))}
          </div>
        </Container>
      );
    }

    // ---- Content ----
    case 'features': {
      const items = list(p, 'items');
      const isList = s.variant === 'list';
      return (
        <Container>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <H>{str(p, 'heading')}</H>
            {str(p, 'sub') && <Sub>{str(p, 'sub')}</Sub>}
          </div>
          <div style={isList ? { display: 'grid', gap: 14 } : grid(Math.min(items.length || 1, 3))}>
            {items.map((it, i) => (
              <Card key={i} style={{ textAlign: isList ? 'left' : 'center', display: isList ? 'flex' : undefined, gap: 14, alignItems: isList ? 'flex-start' : undefined }}>
                <div style={{ fontSize: 26 }}>{str(it as Record<string, unknown>, 'icon')}</div>
                <div>
                  <H lvl={3}>{str(it as Record<string, unknown>, 'title')}</H>
                  <p style={{ opacity: 0.75, marginTop: 6, lineHeight: 1.55 }}>{str(it as Record<string, unknown>, 'text')}</p>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      );
    }
    case 'bento': {
      const items = list(p, 'items');
      return (
        <Container>
          {str(p, 'heading') && <div style={{ marginBottom: 24 }}><H>{str(p, 'heading')}</H></div>}
          <div style={grid(3)}>
            {items.map((it, i) => (
              <Card key={i} style={{ gridColumn: str(it as Record<string, unknown>, 'span') === '2' ? 'span 2' : undefined }}>
                <H lvl={3}>{str(it as Record<string, unknown>, 'title')}</H>
                <p style={{ opacity: 0.75, marginTop: 6 }}>{str(it as Record<string, unknown>, 'text')}</p>
              </Card>
            ))}
          </div>
        </Container>
      );
    }
    case 'tabs': {
      const items = list(p, 'items');
      const first = (items[0] as Record<string, unknown>) || {};
      return (
        <Container>
          {str(p, 'heading') && <div style={{ textAlign: 'center', marginBottom: 24 }}><H>{str(p, 'heading')}</H></div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            {items.map((it, i) => <span key={i} style={{ padding: '8px 16px', borderRadius: 999, fontWeight: 600, fontSize: 14, background: i === 0 ? 'var(--bx-grad)' : 'rgba(0,0,0,.05)', color: i === 0 ? '#fff' : 'inherit' }}>{str(it as Record<string, unknown>, 'label')}</span>)}
          </div>
          <Card style={{ ...grid(2, 28), alignItems: 'center' }}>
            <div><H lvl={3}>{str(first, 'title')}</H><p style={{ opacity: 0.75, marginTop: 8 }}>{str(first, 'text')}</p></div>
            <Img src={str(first, 'image')} />
          </Card>
        </Container>
      );
    }
    case 'orbital': {
      const items = list(p, 'items');
      return (
        <Container style={{ textAlign: 'center' }}>
          <H>{str(p, 'heading')}</H>
          <div style={{ marginTop: 28, display: 'inline-flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', maxWidth: 560 }}>
            <span style={{ padding: '14px 22px', borderRadius: 999, background: 'var(--bx-grad)', color: '#fff', fontWeight: 800 }}>{str(p, 'center')}</span>
            {items.map((it, i) => <span key={i} style={{ padding: '12px 18px', borderRadius: 999, background: 'rgba(0,0,0,.05)', fontWeight: 600 }}>{str(it as Record<string, unknown>, 'label')}</span>)}
          </div>
        </Container>
      );
    }
    case 'alist': {
      const items = list(p, 'items');
      const check = s.variant === 'checklist';
      return (
        <Container style={{ maxWidth: 760 }}>
          {str(p, 'heading') && <div style={{ marginBottom: 18 }}><H>{str(p, 'heading')}</H></div>}
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((it, i) => (
              <Card key={i} style={{ display: 'flex', gap: 12 }}>
                {check && <span style={{ color: 'var(--bx-brand)', fontWeight: 800 }}>✓</span>}
                <div><strong>{str(it as Record<string, unknown>, 'title')}</strong><p style={{ opacity: 0.72, marginTop: 4 }}>{str(it as Record<string, unknown>, 'text')}</p></div>
              </Card>
            ))}
          </div>
        </Container>
      );
    }
    case 'stats':
    case 'counters': {
      const items = list(p, 'items');
      return (
        <Container>
          {str(p, 'heading') && <div style={{ textAlign: 'center', marginBottom: 24 }}><H>{str(p, 'heading')}</H></div>}
          <div style={grid(Math.min(items.length || 1, 4))}>
            {items.map((it, i) => {
              const r = it as Record<string, unknown>;
              const value = s.type === 'counters' ? `${str(r, 'value')}${str(r, 'suffix')}` : str(r, 'value');
              return (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, fontFamily: 'var(--bx-font-display)', backgroundImage: 'var(--bx-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{value}</div>
                  <div style={{ opacity: 0.7, fontSize: 14 }}>{str(r, 'label')}</div>
                </div>
              );
            })}
          </div>
        </Container>
      );
    }
    case 'steps': {
      const items = list(p, 'items');
      return (
        <Container>
          {str(p, 'heading') && <div style={{ textAlign: 'center', marginBottom: 28 }}><H>{str(p, 'heading')}</H></div>}
          <div style={grid(Math.min(items.length || 1, 4))}>
            {items.map((it, i) => (
              <Card key={i}>
                <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--bx-grad)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, marginBottom: 12 }}>{i + 1}</div>
                <H lvl={3}>{str(it as Record<string, unknown>, 'title')}</H>
                <p style={{ opacity: 0.75, marginTop: 6 }}>{str(it as Record<string, unknown>, 'text')}</p>
              </Card>
            ))}
          </div>
        </Container>
      );
    }
    case 'video': {
      return (
        <Container style={{ textAlign: 'center', maxWidth: 880 }}>
          {str(p, 'heading') && <div style={{ marginBottom: 20 }}><H>{str(p, 'heading')}</H></div>}
          <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden' }}>
            <Img src={str(p, 'poster')} style={{ aspectRatio: '16/9' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <span style={{ width: 64, height: 64, borderRadius: 999, background: 'rgba(255,255,255,.92)', color: 'var(--bx-brand)', display: 'grid', placeItems: 'center', fontSize: 24 }}>▶</span>
            </div>
          </div>
        </Container>
      );
    }
    case 'faq': {
      const items = list(p, 'items');
      const two = s.variant === 'two-col';
      return (
        <Container style={{ maxWidth: two ? 980 : 760 }}>
          {str(p, 'heading') && <div style={{ textAlign: 'center', marginBottom: 24 }}><H>{str(p, 'heading')}</H></div>}
          <div style={two ? grid(2) : { display: 'grid', gap: 10 }}>
            {items.map((it, i) => (
              <Card key={i}>
                <strong>{str(it as Record<string, unknown>, 'q')}</strong>
                <p style={{ opacity: 0.75, marginTop: 8, lineHeight: 1.55 }}>{str(it as Record<string, unknown>, 'a')}</p>
              </Card>
            ))}
          </div>
        </Container>
      );
    }

    // ---- Layout ----
    case 'grid': {
      const items = list(p, 'items');
      const cols = s.variant === '2col' ? 2 : s.variant === '4col' ? 4 : 3;
      return (
        <Container>
          {str(p, 'heading') && <div style={{ textAlign: 'center', marginBottom: 28 }}><H>{str(p, 'heading')}</H></div>}
          <div style={grid(cols)}>
            {items.map((it, i) => (
              <Card key={i} style={{ padding: 0, overflow: 'hidden' }}>
                <Img src={str(it as Record<string, unknown>, 'image')} style={{ borderRadius: 0, aspectRatio: '16/10' }} />
                <div style={{ padding: 18 }}>
                  <H lvl={3}>{str(it as Record<string, unknown>, 'title')}</H>
                  <p style={{ opacity: 0.75, marginTop: 6 }}>{str(it as Record<string, unknown>, 'text')}</p>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      );
    }
    case 'media': {
      const right = s.variant === 'right';
      const copy = (
        <div>
          <H>{str(p, 'title')}</H>
          <p style={{ opacity: 0.78, marginTop: 12, lineHeight: 1.6 }}>{str(p, 'text')}</p>
          {str(p, 'b1Label') && <div style={{ marginTop: 18 }}><a href={str(p, 'b1Url', '#')} style={btnStyle(s)}>{str(p, 'b1Label')}</a></div>}
        </div>
      );
      if (s.variant === 'full') {
        return <Container style={{ textAlign: 'center' }}>{copy}<div style={{ marginTop: 28 }}><Img src={str(p, 'image')} /></div></Container>;
      }
      return (
        <Container style={{ ...grid(2, 40), alignItems: 'center' }}>
          {right ? (<><Img src={str(p, 'image')} />{copy}</>) : (<>{copy}<Img src={str(p, 'image')} /></>)}
        </Container>
      );
    }
    case 'gallery': {
      const images = list(p, 'images');
      return (
        <Container>
          {str(p, 'heading') && <div style={{ textAlign: 'center', marginBottom: 24 }}><H>{str(p, 'heading')}</H></div>}
          <div style={grid(3)}>
            {images.map((im, i) => <Img key={i} src={str(im as Record<string, unknown>, 'img')} style={{ aspectRatio: '1/1', objectFit: 'cover', width: '100%' }} />)}
          </div>
        </Container>
      );
    }

    // ---- Commerce ----
    case 'pricing': {
      const plans = list(p, 'plans');
      return (
        <Container>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <H>{str(p, 'heading')}</H>
            {str(p, 'sub') && <Sub>{str(p, 'sub')}</Sub>}
          </div>
          <div style={grid(Math.min(plans.length || 1, 3))}>
            {plans.map((pl, i) => {
              const r = pl as Record<string, unknown>;
              const feat = lines(str(r, 'features'));
              const featured = bool(r, 'featured');
              return (
                <Card key={i} style={{ borderColor: featured ? 'var(--bx-brand)' : undefined, boxShadow: featured ? '0 20px 50px -24px var(--bx-brand)' : undefined, transform: featured ? 'translateY(-6px)' : undefined }}>
                  {featured && <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#fff', background: 'var(--bx-grad)', padding: '3px 10px', borderRadius: 999, marginBottom: 10 }}>Popular</div>}
                  <div style={{ fontWeight: 700, fontFamily: 'var(--bx-font-display)' }}>{str(r, 'name')}</div>
                  <div style={{ marginTop: 6 }}><span style={{ fontSize: 40, fontWeight: 800, fontFamily: 'var(--bx-font-display)' }}>{str(r, 'price')}</span><span style={{ opacity: 0.65 }}>{str(r, 'period')}</span></div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0', display: 'grid', gap: 8 }}>
                    {feat.map((ft, j) => <li key={j} style={{ display: 'flex', gap: 8, opacity: 0.85 }}><span style={{ color: 'var(--bx-brand)' }}>✓</span>{ft}</li>)}
                  </ul>
                  <a href={str(r, 'ctaUrl', '#')} style={{ ...btnStyle(s, featured ? 'primary' : 'secondary'), display: 'block', textAlign: 'center' }}>{str(r, 'ctaLabel', 'Choose')}</a>
                </Card>
              );
            })}
          </div>
        </Container>
      );
    }
    case 'payment': {
      return (
        <Container style={{ maxWidth: 460, textAlign: 'center' }}>
          <Card>
            <H lvl={3}>{str(p, 'heading')}</H>
            <div style={{ fontSize: 40, fontWeight: 800, fontFamily: 'var(--bx-font-display)', margin: '10px 0' }}>{str(p, 'currency', 'INR')} {num(p, 'amount').toLocaleString()}</div>
            <a href="#" style={{ ...btnStyle(s), display: 'block' }}>{str(p, 'label', 'Pay now')}</a>
          </Card>
        </Container>
      );
    }

    // ---- Capture ----
    case 'countdown': {
      return (
        <Container style={{ textAlign: 'center' }}>
          <H lvl={3}>{str(p, 'heading')}</H>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
            {['Days', 'Hrs', 'Min', 'Sec'].map((u) => (
              <div key={u} style={{ minWidth: 64 }}>
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--bx-font-display)', background: 'rgba(0,0,0,.06)', borderRadius: 12, padding: '10px 0' }}>00</div>
                <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>{u}</div>
              </div>
            ))}
          </div>
        </Container>
      );
    }
    case 'banner': {
      return (
        <Container style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontFamily: 'var(--bx-font-display)', fontSize: 20 }}>{str(p, 'text')}</strong>
          {str(p, 'ctaLabel') && <a href={str(p, 'ctaUrl', '#')} style={btnStyle(s)}>{str(p, 'ctaLabel')}</a>}
        </Container>
      );
    }
    case 'lead': {
      const fields = list(p, 'fields');
      return (
        <Container style={{ maxWidth: 480, textAlign: 'center' }}>
          <H>{str(p, 'heading')}</H>
          {str(p, 'sub') && <Sub>{str(p, 'sub')}</Sub>}
          <form style={{ display: 'grid', gap: 10, marginTop: 20, textAlign: 'left' }}>
            {fields.map((fl, i) => {
              const r = fl as Record<string, unknown>;
              const type = str(r, 'type', 'text');
              const common: CSSProperties = { padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,.15)', width: '100%', font: 'inherit' };
              return type === 'textarea'
                ? <textarea key={i} placeholder={str(r, 'label')} rows={3} style={common} />
                : <input key={i} type={type} placeholder={str(r, 'label')} style={common} />;
            })}
            <span style={{ ...btnStyle(s), textAlign: 'center' }}>{str(p, 'submitLabel', 'Submit')}</span>
          </form>
        </Container>
      );
    }
    case 'popup': {
      // In static render the popup is shown inline as a card preview.
      return (
        <Container style={{ maxWidth: 420 }}>
          <Card style={{ textAlign: 'center', boxShadow: '0 30px 70px -30px rgba(0,0,0,.5)' }}>
            <H lvl={3}>{str(p, 'title')}</H>
            <p style={{ opacity: 0.78, marginTop: 8 }}>{str(p, 'text')}</p>
            {str(p, 'ctaLabel') && <div style={{ marginTop: 16 }}><a href={str(p, 'ctaUrl', '#')} style={btnStyle(s)}>{str(p, 'ctaLabel')}</a></div>}
          </Card>
        </Container>
      );
    }

    default:
      return <Container style={{ opacity: 0.5, textAlign: 'center' }}>[{s.type}]</Container>;
  }
}

// ---------------------------------------------------------------------------
// section wrapper + page
// ---------------------------------------------------------------------------

const ANIM_CLASS: Record<string, string> = {
  up: 'bx-anim-up', zoom: 'bx-anim-zoom', float: 'bx-anim-float', fade: 'bx-anim-fade',
};

function SectionView({ section, editor }: { section: Section; editor?: boolean }) {
  if (section.mobileHidden && !editor) {
    return <section className="bx-mobile-hidden" style={sectionStyle(section)}>{renderBlock(section)}</section>;
  }
  const cls = section.anim ? ANIM_CLASS[section.anim] : undefined;
  return (
    <section className={cls} data-block={section.type} style={sectionStyle(section)}>
      {renderBlock(section)}
    </section>
  );
}

/** Engine styles: keyframes + responsive rules, scoped to the engine root. */
const ENGINE_CSS = `
.bx-root{font-family:var(--bx-font-body);color:#0b0b14;position:relative;isolation:isolate}
.bx-root a{color:inherit}
.bx-pagebg{position:fixed;inset:0;z-index:-1;pointer-events:none}
@keyframes bxUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes bxZoom{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes bxFade{from{opacity:0}to{opacity:1}}
@keyframes bxFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes bxMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.bx-anim-up{animation:bxUp .6s ease both}
.bx-anim-zoom{animation:bxZoom .6s ease both}
.bx-anim-fade{animation:bxFade .8s ease both}
.bx-anim-float{animation:bxFloat 4s ease-in-out infinite}
.bx-marquee{animation:bxMarquee 22s linear infinite}
@media (max-width:760px){
  .bx-root [style*="grid-template-columns"]{grid-template-columns:1fr !important}
  .bx-mobile-hidden{display:none !important}
}
@media (prefers-reduced-motion:reduce){
  .bx-anim-up,.bx-anim-zoom,.bx-anim-fade,.bx-anim-float,.bx-marquee{animation:none !important}
}
`;

export interface RenderEngineProps {
  /** Full page document (preferred). */
  doc?: PageDoc;
  /** …or raw inputs (editor live preview). */
  sections?: Section[];
  themeId?: string;
  pageBg?: PageDoc['pageBg'];
  /** Editor mode keeps mobile-hidden sections visible. */
  editor?: boolean;
}

/**
 * The single render engine. Pass a `doc` (public/preview) or raw
 * `sections`/`themeId`/`pageBg` (editor live preview).
 */
export function RenderEngine({ doc, sections, themeId, pageBg, editor }: RenderEngineProps) {
  const secs = doc?.sections ?? sections ?? [];
  const theme = getTheme(doc?.themeId ?? themeId);
  const bg = doc?.pageBg ?? pageBg ?? 'none';
  return (
    <div className="bx-root" style={themeVars(theme)}>
      <style dangerouslySetInnerHTML={{ __html: ENGINE_CSS }} />
      {bg !== 'none' && <div className="bx-pagebg" style={pageBgStyle(bg)} aria-hidden />}
      {secs.map((s) => <SectionView key={s.id} section={s} editor={editor} />)}
    </div>
  );
}

export default RenderEngine;
