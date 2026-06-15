import type { BioTheme } from "@/lib/bioThemes";

/**
 * Looping animated background layers (pure CSS). Sits behind the bio content.
 * Multiple types; colors derive from the active theme so they suit any palette.
 */
export default function BioBackgroundFX({
  motion,
  theme,
}: {
  motion?: string;
  theme: BioTheme;
}) {
  if (!motion || motion === "none") return null;
  const a = theme.primary;
  const b = theme.text;

  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    overflow: "hidden",
  };

  if (motion === "gradient") {
    return (
      <div
        className="fx-gradient"
        style={{ ...layer, ["--c1" as string]: a, ["--c2" as string]: theme.bg, ["--c3" as string]: b }}
      />
    );
  }

  if (motion === "blobs") {
    return (
      <div style={layer}>
        <span className="fx-blob" style={{ background: a, width: 280, height: 280, top: "-6%", left: "-8%", animationDelay: "0s" }} />
        <span className="fx-blob" style={{ background: b, width: 240, height: 240, bottom: "-10%", right: "-6%", animationDelay: "-4s" }} />
        <span className="fx-blob" style={{ background: a, width: 200, height: 200, top: "40%", right: "20%", animationDelay: "-8s" }} />
      </div>
    );
  }

  if (motion === "aurora") {
    return (
      <div style={layer}>
        <div className="fx-aurora" style={{ background: `radial-gradient(40% 50% at 30% 30%, ${a}88, transparent 70%)` }} />
        <div className="fx-aurora fx-aurora-2" style={{ background: `radial-gradient(45% 55% at 70% 60%, ${b}66, transparent 70%)` }} />
      </div>
    );
  }

  if (motion === "bubbles") {
    const conf = [
      { l: "8%", s: 26, d: "9s", delay: "0s" },
      { l: "24%", s: 16, d: "12s", delay: "-3s" },
      { l: "44%", s: 34, d: "10s", delay: "-6s" },
      { l: "62%", s: 20, d: "13s", delay: "-2s" },
      { l: "80%", s: 28, d: "11s", delay: "-7s" },
      { l: "92%", s: 14, d: "14s", delay: "-5s" },
    ];
    return (
      <div style={layer}>
        {conf.map((c, i) => (
          <span
            key={i}
            className="fx-bubble"
            style={{ left: c.l, width: c.s, height: c.s, background: a, animationDuration: c.d, animationDelay: c.delay }}
          />
        ))}
      </div>
    );
  }

  if (motion === "glow") {
    return (
      <div style={layer}>
        <div className="fx-glow" style={{ background: `radial-gradient(circle, ${a}55, transparent 60%)` }} />
      </div>
    );
  }

  if (motion === "rays") {
    return (
      <div style={layer}>
        <div
          className="fx-rays"
          style={{ background: `repeating-conic-gradient(from 0deg at 50% 50%, ${a}24 0deg 7deg, transparent 7deg 22deg)` }}
        />
      </div>
    );
  }

  if (motion === "waves") {
    return (
      <div style={layer}>
        <div className="fx-wave" style={{ background: `radial-gradient(130% 60% at 50% 118%, ${a}66, transparent 62%)` }} />
        <div className="fx-wave fx-wave-2" style={{ background: `radial-gradient(130% 60% at 50% 122%, ${b}40, transparent 62%)` }} />
      </div>
    );
  }

  if (motion === "stars") {
    const stars = [
      { l: "12%", t: "18%", s: 3, d: "2.4s" }, { l: "28%", t: "62%", s: 2, d: "3.1s" },
      { l: "44%", t: "26%", s: 4, d: "2.8s" }, { l: "60%", t: "70%", s: 2, d: "2.2s" },
      { l: "76%", t: "20%", s: 3, d: "3.4s" }, { l: "88%", t: "55%", s: 2, d: "2.6s" },
      { l: "20%", t: "84%", s: 2, d: "3.0s" }, { l: "52%", t: "48%", s: 3, d: "2.0s" },
      { l: "70%", t: "40%", s: 2, d: "3.6s" }, { l: "34%", t: "12%", s: 3, d: "2.9s" },
      { l: "82%", t: "82%", s: 3, d: "2.3s" }, { l: "8%", t: "48%", s: 2, d: "3.2s" },
    ];
    return (
      <div style={layer}>
        {stars.map((c, i) => (
          <span
            key={i}
            className="fx-star"
            style={{ left: c.l, top: c.t, width: c.s, height: c.s, background: b, animationDuration: c.d }}
          />
        ))}
      </div>
    );
  }

  if (motion === "mesh") {
    return (
      <div style={layer}>
        <div
          className="fx-mesh"
          style={{
            backgroundImage: `radial-gradient(at 22% 24%, ${a}66, transparent 42%), radial-gradient(at 78% 30%, ${b}44, transparent 42%), radial-gradient(at 50% 82%, ${a}55, transparent 46%)`,
          }}
        />
      </div>
    );
  }

  return null;
}
