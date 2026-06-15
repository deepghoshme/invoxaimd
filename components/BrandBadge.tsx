/**
 * Floating invoxai brand button, pinned bottom-right of public pages.
 * In the editor preview it is contained to the device frame (the frame uses a
 * CSS transform, which makes position:fixed relative to it); on the live page
 * there is no frame, so it pins to the viewport.
 */
export default function BrandBadge() {
  return (
    <a
      href="https://invoxai.io"
      target="_blank"
      rel="noreferrer"
      aria-label="Built with invoxai.io"
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 50,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 12px 7px 8px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 24px -10px rgba(0,0,0,0.4)",
        textDecoration: "none",
        fontFamily: "var(--font-heading), sans-serif",
        fontWeight: 700,
        fontSize: "0.82rem",
        color: "#2B1B2E",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          background: "linear-gradient(135deg,#FFB23E,#FF6A3D,#FF4D7D,#7B3FE4)",
          display: "inline-block",
        }}
      />
      invoxai
    </a>
  );
}
