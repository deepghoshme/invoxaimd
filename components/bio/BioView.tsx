import { type BioContent, ACCENTS } from "@/lib/bio";
import { FONT_FAMILY, FONT_GOOGLE } from "@/lib/website";
import SocialIcon from "./SocialIcon";

/** Renders a bio page from content. Namespaced under .bioview. Pure (no hooks). */
export default function BioView({
  content, animate = true, showBrand = false, track, stage = false,
}: { content: BioContent; animate?: boolean; showBrand?: boolean; track?: { pageId: string; storeId?: string }; stage?: boolean }) {
  const linkHref = (l: { u: string; t: string }) =>
    track
      ? `/api/bio/go?p=${track.pageId}${track.storeId ? `&s=${track.storeId}` : ""}&u=${encodeURIComponent(l.u || "#")}&t=${encodeURIComponent(l.t || "")}`
      : (l.u || "#");
  const accent = ACCENTS[content.accent ?? 0]?.[1] ?? ACCENTS[0][1];
  const style = content.button_style ?? "soft";
  const shape = content.button_shape ?? "rounded";
  const bg = content.bg ?? "aurora";
  const name = content.name || "Your name";
  const initial = (content.name || "A").trim().charAt(0).toUpperCase();
  // Font override: reuse FONT_FAMILY/FONT_GOOGLE from website (same key set).
  const fontFam = content.font ? (FONT_FAMILY[content.font] ?? null) : null;
  const fontGoogleHref = content.font && FONT_GOOGLE[content.font]
    ? `https://fonts.googleapis.com/css2?family=${FONT_GOOGLE[content.font]}&display=swap`
    : null;
  const bioFontStyle = fontFam ? { ["--font-sora" as string]: fontFam } as Record<string, string> : undefined;
  // Normalise legacy link records that used {url, label} instead of the
  // canonical {u, t} keys. Old records from early builds may have the wrong
  // keys; coerce them so they render rather than being silently dropped.
  type AnyLink = Record<string, unknown>;
  const links = (content.links ?? [])
    .map((l) => {
      const raw = l as AnyLink;
      return {
        ...l,
        t: l.t || String(raw.label ?? ""),
        u: l.u || String(raw.url ?? ""),
      };
    })
    .filter((l) => l.t || l.u || l.type === "header");
  const socials = (content.socials ?? []).filter((s) => s.platform || s.label);
  const f = content.featured ?? {};
  const showReal = f.real && f.real !== f.off;

  return (
    <div className={`bioview${stage ? " stage" : ""}`}>
      {fontGoogleHref && <link rel="stylesheet" href={fontGoogleHref} />}
      <div className={`bio bg-${bg} style-${style} shape-${shape}${content.cover_url ? "" : " no-cover"}${animate ? " anim" : ""}`} style={{ ["--bioGrad" as string]: accent, ...bioFontStyle }}>
        <div className="bgfx"><span className="fx fx-a" /><span className="fx fx-b" /><span className="fx fx-c" /></div>
        <div className="inner">
          {content.cover_url && <div className="cover" style={{ backgroundImage: `url('${content.cover_url}')` }} />}
          <div className="body">
            <div className="avatar" style={content.profile_url ? { backgroundImage: `url('${content.profile_url}')` } : undefined}>
              {content.profile_url ? "" : initial}
            </div>
            <div className="bioname">{name}{content.verified && <span className="bioverif" title="Verified">✓</span>}</div>
            {content.handle && <div className="biohandle">{content.handle}</div>}
            {content.bio && <div className="biobio">{content.bio}</div>}
            {socials.length > 0 && (
              <div className="socials">
                {socials.map((s, i) => {
                  const inner = s.platform ? <SocialIcon platform={s.platform} /> : <span style={{ fontSize: 11, fontWeight: 700 }}>{s.label}</span>;
                  return s.url
                    ? <a key={i} className="soc" href={s.url} target="_blank" rel="noreferrer" aria-label={s.platform || s.label}>{inner}</a>
                    : <span key={i} className="soc">{inner}</span>;
                })}
              </div>
            )}
            {links.length > 0 && (
              <div className="links">
                {links.map((l, i) =>
                  l.type === "header" ? (
                    <div key={i} className="lhead">{l.t || "Section"}</div>
                  ) : (
                    <a key={i} className={`lbtn${l.highlight ? " hi" : ""}`} href={linkHref(l)} target="_blank" rel="noreferrer">
                      {l.highlight && <span className="lshine" />}
                      {l.img
                        ? // eslint-disable-next-line @next/next/no-img-element
                          <img className="lthumb" src={l.img} alt="" />
                        : <span className="em">{l.ic}</span>}
                      <span>{l.t || "Untitled link"}</span>
                      <span className="ar">›</span>
                    </a>
                  ),
                )}
              </div>
            )}
            {(f.title || f.image_url) && (
              <div className="feat">
                <div className="thumb" style={f.image_url ? { backgroundImage: `url('${f.image_url}')` } : undefined} />
                <div className="fb">
                  <div className="ft">{f.title}</div>
                  {(f.off || f.real) && (
                    <div className="prc">
                      {f.off && <span className="off">{f.off}</span>}
                      {showReal && <><span className="real">{f.real}</span><span className="save">OFFER</span></>}
                    </div>
                  )}
                  {f.cta && <a className="fbtn" href={f.url || "#"} target="_blank" rel="noreferrer">{f.cta}</a>}
                </div>
              </div>
            )}
            {showBrand && (
              <div className="biofoot">Powered by <a href="https://invoxai.io" target="_blank" rel="noreferrer"><b>invoxai</b></a></div>
            )}
            <div className="bioacct">
              <a href="https://app.invoxai.io/account" target="_blank" rel="noreferrer">My account ↗</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
