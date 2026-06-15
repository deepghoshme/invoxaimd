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

  return null;
}
