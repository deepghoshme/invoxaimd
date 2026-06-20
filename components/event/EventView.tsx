"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { type EventContent, type EventTier, formatEventDate } from "@/lib/event";

// ── QR Code: a real, scannable QR encoding the ticket verification URL ────────
// Scanning opens /event/ticket/<code>, which looks the ticket up by code.
function QrBlock({ code }: { code: string }) {
  const url =
    (typeof window !== "undefined" ? window.location.origin : "") +
    "/event/ticket/" +
    code;
  return (
    <div
      style={{
        width: 120,
        height: 120,
        background: "#fff",
        borderRadius: 12,
        padding: 8,
        margin: "0 auto",
        display: "grid",
        placeItems: "center",
      }}
    >
      <QRCode value={url} size={104} level="M" bgColor="#ffffff" fgColor="#111111" style={{ width: 104, height: 104 }} />
    </div>
  );
}

// ── Ticket card shown after purchase ─────────────────────────────────────────
function TicketCard({
  content,
  tierName,
  buyerName,
  qty,
  code,
  orderId,
}: {
  content: EventContent;
  tierName: string;
  buyerName: string;
  qty: number;
  code: string;
  orderId: string;
}) {
  const theme = content.theme ?? "light";
  const dateStr = formatEventDate(content.event_date, content.event_time, content.timezone);
  const locationLabel = content.is_online !== false
    ? (content.location ? `Online · ${content.location}` : "Online")
    : (content.location || "See confirmation email");

  return (
    <div
      className="et"
      data-theme={theme}
      style={{ display: "grid", placeItems: "center", padding: "28px 18px" }}
    >
      <div className="et-ticket">
        <div
          className="et-poster"
          style={
            content.poster_url
              ? { backgroundImage: `url(${content.poster_url})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          <span className="et-confirm">
            <span className="d" />
            Confirmed
          </span>
          <div className="k">{content.is_online !== false ? "Online Event" : "Live Event"}</div>
          <h2>{content.title || "Event"}</h2>
        </div>

        <div className="et-body">
          <div className="et-rows">
            {content.event_date && (
              <div className="et-kv">
                <div className="l">Date</div>
                <div className="v">{new Date(content.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
            )}
            {content.event_time && (
              <div className="et-kv">
                <div className="l">Time</div>
                <div className="v">{content.event_time} {content.timezone === "Asia/Kolkata" ? "IST" : ""}</div>
              </div>
            )}
            <div className="et-kv">
              <div className="l">Ticket</div>
              <div className="v">{tierName}</div>
            </div>
            <div className="et-kv">
              <div className="l">Attendee</div>
              <div className="v">{buyerName || "Guest"}</div>
            </div>
            <div className="et-kv">
              <div className="l">Location</div>
              <div className="v">{locationLabel}</div>
            </div>
            <div className="et-kv">
              <div className="l">Order</div>
              <div className="v">#{orderId.slice(-6).toUpperCase()}</div>
            </div>
          </div>

          <div className="et-perf">
            <QrBlock code={code} />
            <div className="et-code">{code}</div>
            <div className="et-codel">
              Show this at entry · {qty > 1 ? `${qty} admits` : "1 admit"}
            </div>
          </div>
        </div>

        <div className="et-act">
          {content.is_online !== false && content.location && (
            <a
              className="et-btn grad"
              href={content.location.startsWith("http") ? content.location : `https://${content.location}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none", textAlign: "center" }}
            >
              Join event ↗
            </a>
          )}
          {!(content.is_online !== false && content.location) && (
            <span className="et-btn" style={{ textAlign: "center", opacity: 0.6 }}>
              Check your email for the link
            </span>
          )}
        </div>

        <div className="et-foot">
          Ticket by <b>invoxai</b>
        </div>
      </div>
    </div>
  );
}

// ── Razorpay loader ────────────────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ── EventView — public-facing event + registration page ──────────────────────
export default function EventView({
  content,
  pageId,
  storeName,
  payEnabled,
  preview,
}: {
  content: EventContent;
  pageId: string;
  storeName?: string;
  payEnabled?: boolean;
  preview?: boolean;
}) {
  const tiers: EventTier[] = content.tiers ?? [];
  const currency = content.currency ?? "INR";
  const theme = content.theme ?? "light";
  const dateStr = formatEventDate(content.event_date, content.event_time, content.timezone);

  const [selectedTier, setSelectedTier] = useState<number>(0);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // After payment + ticket creation
  const [ticket, setTicket] = useState<{
    code: string;
    tier: string;
    orderId: string;
  } | null>(null);

  const tier = tiers[selectedTier];
  const unitPrice = tier?.price ?? 0;
  const total = unitPrice * qty;

  function fmtPrice(n: number) {
    if (currency === "INR") return "₹" + n.toLocaleString("en-IN");
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  }

  async function register() {
    if (!tier) return;
    if (!email.trim()) { setErr("Please enter your email."); return; }
    setLoading(true);
    setErr(null);

    if (preview) {
      // In preview mode just show a fake success ticket
      setTimeout(() => {
        setTicket({ code: "INVX-DEMO-0000", tier: tier.name, orderId: "preview" });
        setLoading(false);
      }, 800);
      return;
    }

    // Step 1: create an internal order for this event page
    let orderId: string;
    try {
      const res = await fetch("/api/checkout/event/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          tier_index: selectedTier,
          qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create order");
      orderId = data.order_id;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start checkout");
      setLoading(false);
      return;
    }

    // Step 2: If free (price = 0), skip Razorpay; issue ticket directly
    if (unitPrice === 0) {
      try {
        const res = await fetch("/api/checkout/event/ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId, buyer_name: name, buyer_email: email }),
        });
        const data = await res.json();
        if (!res.ok || !data.code) throw new Error(data.error || "Ticket creation failed");
        setTicket({ code: data.code, tier: tier.name, orderId });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to issue ticket");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Step 3: Razorpay flow
    const ok = await loadRazorpay();
    if (!ok) {
      setErr("Couldn't load the payment library. Check your connection.");
      setLoading(false);
      return;
    }

    let start: Record<string, unknown>;
    try {
      const res = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          buyer_email: email,
          buyer_name: name,
          buyer_phone: phone,
        }),
      });
      start = await res.json();
      if (!res.ok) throw new Error((start.error as string) || "Could not start payment");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start payment");
      setLoading(false);
      return;
    }

    const rzp = new window.Razorpay!({
      key: start.key_id,
      order_id: start.razorpay_order_id,
      amount: start.amount,
      currency: start.currency,
      name: storeName || content.title || "Event",
      description: `${tier.name} × ${qty}`,
      prefill: { email, name, contact: phone },
      theme: { color: "#FF6A3D" },
      modal: { ondismiss: () => setLoading(false) },
      handler: async (resp: Record<string, string>) => {
        try {
          // Verify payment
          const vres = await fetch("/api/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: orderId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const vdata = await vres.json();
          if (!vres.ok || !vdata.ok) throw new Error(vdata.error || "Verification failed");

          // Issue ticket
          const tres = await fetch("/api/checkout/event/ticket", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: orderId, buyer_name: name, buyer_email: email }),
          });
          const tdata = await tres.json();
          if (!tres.ok || !tdata.code) throw new Error(tdata.error || "Ticket creation failed");

          setTicket({ code: tdata.code, tier: tier.name, orderId });
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Verification or ticket failed");
        } finally {
          setLoading(false);
        }
      },
    });
    rzp.open();
  }

  // Show ticket after successful payment
  if (ticket) {
    return (
      <>
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{ET_CSS}</style>
        <TicketCard
          content={content}
          tierName={ticket.tier}
          buyerName={name}
          qty={qty}
          code={ticket.code}
          orderId={ticket.orderId}
        />
      </>
    );
  }

  // Public event page (registration/buy flow)
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{ET_CSS}</style>
      <div className="pt" data-theme={theme} style={{ minHeight: "100dvh" }}>
        <div className="pt-bg">
          <div className="pt-blob b1" />
          <div className="pt-blob b2" />
        </div>

        <div className="pt-wrap">
          <div className="pt-card">
            {/* Poster / hero */}
            <div
              className="pt-poster"
              style={
                content.poster_url
                  ? {
                      backgroundImage: `url(${content.poster_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              {preview && (
                <span className="pin" style={{ background: "rgba(255,126,85,.92)", color: "#fff" }}>
                  Preview
                </span>
              )}
              <div className="pt">
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, color: "#fff" }}>
                  {content.is_online !== false ? "ONLINE EVENT" : "LIVE EVENT"}
                </div>
                <h1 style={{ color: "#fff", fontSize: 28, marginTop: 6, letterSpacing: "-.02em" }}>
                  {content.title || "Untitled Event"}
                </h1>
              </div>
            </div>

            <div className="pt-body">
              {/* Meta */}
              <div className="pt-evmeta">
                {dateStr && <span>📅 <b>{dateStr}</b></span>}
                <span>📍 <b>{content.is_online !== false ? (content.location ? `Online · ${content.location}` : "Online") : (content.location || "Location TBD")}</b></span>
              </div>

              {content.description && (
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
                  {content.description}
                </p>
              )}

              {/* Ticket tier selector */}
              {tiers.length > 0 && (
                <>
                  <div className="pt-h3" style={{ marginTop: 16 }}>
                    Choose your ticket
                  </div>
                  {tiers.map((t, i) => (
                    <div
                      key={i}
                      className={`pt-tier${selectedTier === i ? " on" : ""}`}
                      onClick={() => { setSelectedTier(i); setQty(1); }}
                    >
                      <span className="rd" />
                      <div>
                        <div className="tn">{t.name}</div>
                        {t.desc && <div className="td">{t.desc}</div>}
                        {t.qty > 0 && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            {t.qty} seats available
                          </div>
                        )}
                      </div>
                      <span className="tp">{fmtPrice(t.price)}</span>
                    </div>
                  ))}

                  {/* Qty selector */}
                  <div className="pt-h3" style={{ marginTop: 16 }}>
                    Number of tickets
                  </div>
                  <div className="pt-qty">
                    <button
                      className="pt-qbtn"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      −
                    </button>
                    <span className="pt-qn">{qty}</span>
                    <button
                      className="pt-qbtn"
                      onClick={() => setQty((q) => Math.min(tier?.qty || 99, q + 1))}
                    >
                      +
                    </button>
                  </div>

                  {/* Total */}
                  <div className="pt-total">
                    <span style={{ color: "var(--muted)" }}>Total</span>
                    <span className="tv">{fmtPrice(total)}</span>
                  </div>

                  {/* Buyer info */}
                  <div style={{ marginTop: 16 }}>
                    <label className="pt-label">Your name</label>
                    <input
                      className="pt-input"
                      placeholder="Full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <label className="pt-label">Email *</label>
                    <input
                      className="pt-input"
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <label className="pt-label">Phone</label>
                    <input
                      className="pt-input"
                      placeholder="+91…"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  {err && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        background: "color-mix(in srgb, var(--secondary, #e5476f) 12%, transparent)",
                        color: "var(--secondary, #e5476f)",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {err}
                    </div>
                  )}

                  <button
                    className="pt-go"
                    onClick={register}
                    disabled={loading || (!preview && !payEnabled)}
                  >
                    {loading ? (
                      <span className="pt-spin" />
                    ) : (
                      <>
                        {tier?.price === 0 ? "Register free" : `Buy tickets · ${fmtPrice(total)}`}
                        <span className="sh" />
                      </>
                    )}
                  </button>
                  {!preview && !payEnabled && (
                    <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>
                      Payment gateway not connected — configure in dashboard settings.
                    </p>
                  )}
                  <div className="pt-secure">🔒 Secure checkout · instant ticket</div>
                </>
              )}

              {tiers.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                  Ticket tiers not configured yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── CSS: combined pt- (event page) + et- (ticket card) styles ─────────────────
const ET_CSS = `
  @keyframes et-a1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(7%,5%) scale(1.18); } }
  @keyframes et-pop { from { transform: scale(.94); } to { transform: scale(1); } }
  @keyframes pt-a1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(8%,6%) scale(1.2); } }
  @keyframes pt-a2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-7%,5%) scale(1.15); } }
  @keyframes pt-shine { 0% { left: -60%; } 55%,100% { left: 130%; } }
  @keyframes pt-spin { to { transform: rotate(360deg); } }

  .et {
    --bg:#0f1115;--card:#1c1f26;--s2:#23262e;
    --primary:#ff7e55;--secondary:#ff6aa0;--accent:#a06bff;--gold:#ffc773;
    --text:#f2f3f5;--muted:#9aa0ab;--border:rgba(255,255,255,.1);--green:#36c98e;
    --grad:linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4);
    --fh:"Sora",system-ui,sans-serif;--fb:"Inter",system-ui,sans-serif;
    background:var(--bg);color:var(--text);font-family:var(--fb);line-height:1.5;
  }
  .et[data-theme="light"] {
    --bg:#fff9f4;--card:#fff;--s2:#fff3ec;--primary:#ff6a3d;--secondary:#ff4d7d;
    --accent:#7b3fe4;--gold:#ffb23e;--text:#2b1b2e;--muted:#7a6770;
    --border:#f0e1d6;--green:#1fb57a;
  }
  .et h1,.et h2,.et h3{margin:0;font-family:var(--fh);letter-spacing:-.02em;}
  .et p{margin:0;}
  .et-ticket{position:relative;z-index:1;width:380px;max-width:100%;background:var(--card);border:1px solid var(--border);border-radius:22px;overflow:hidden;box-shadow:0 40px 90px -40px rgba(0,0,0,.7);animation:et-pop .4s cubic-bezier(.2,.8,.2,1);}
  .et-poster{height:150px;background:linear-gradient(130deg,color-mix(in srgb,var(--accent) 25%,#0d0d12),var(--accent,#7b3fe4) 55%,var(--secondary,#ff4d7d));position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding:18px;background-size:cover;background-position:center;}
  .et-poster::after{content:"";position:absolute;inset:0;background:radial-gradient(60% 90% at 80% 10%,rgba(255,255,255,.28),transparent 60%);}
  .et-poster>*{position:relative;z-index:1;color:#fff;}
  .et-poster .k{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.9;}
  .et-poster h2{font-size:22px;margin-top:5px;}
  .et-confirm{display:inline-flex;align-items:center;gap:7px;position:absolute;top:14px;left:14px;z-index:2;background:rgba(0,0,0,.4);color:#fff;font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;}
  .et-confirm .d{width:7px;height:7px;border-radius:50%;background:var(--green);}
  .et-body{padding:20px;}
  .et-rows{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .et-kv .l{font-size:11px;color:var(--muted);font-weight:600;}
  .et-kv .v{font-family:var(--fh);font-weight:700;font-size:14px;margin-top:2px;}
  .et-perf{border-top:1px dashed var(--border);margin:18px -20px 0;position:relative;padding:20px 20px 0;}
  .et-perf::before,.et-perf::after{content:"";position:absolute;top:-11px;width:22px;height:22px;border-radius:50%;background:var(--bg);}
  .et-perf::before{left:-11px;}.et-perf::after{right:-11px;}
  .et-code{text-align:center;font-family:ui-monospace,Menlo,monospace;font-weight:700;font-size:14px;letter-spacing:2px;margin-top:12px;}
  .et-codel{text-align:center;font-size:11px;color:var(--muted);margin-top:3px;padding-bottom:4px;}
  .et-act{display:flex;gap:9px;padding:0 20px 20px;}
  .et-btn{flex:1;font:inherit;font-family:var(--fh);font-weight:700;font-size:13px;border:1px solid var(--border);background:var(--card);color:var(--text);padding:12px;border-radius:11px;cursor:pointer;display:block;}
  .et-btn.grad{background:var(--grad);color:#fff;border-color:transparent;}
  .et-foot{text-align:center;font-size:11px;color:var(--muted);padding-bottom:18px;}
  .et-foot b{background:linear-gradient(135deg,var(--primary),var(--secondary) 55%,var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent;font-family:var(--fh);}

  .pt{
    --bg:#fff9f4;--card:#fff;--s2:#fff3ec;
    --primary:#ff6a3d;--primaryh:#f0532a;--secondary:#ff4d7d;--accent:#7b3fe4;--gold:#ffb23e;
    --text:#2b1b2e;--muted:#7a6770;--border:#f0e1d6;--green:#1fb57a;
    --grad:linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4);
    --shadow-xl:0 40px 90px -40px rgba(43,27,46,.45);
    --fh:"Sora",system-ui,sans-serif;--fb:"Inter",system-ui,sans-serif;
    background:var(--bg);color:var(--text);font-family:var(--fb);line-height:1.55;
    -webkit-font-smoothing:antialiased;position:relative;
  }
  .pt[data-theme="dark"]{
    --bg:#0f1115;--card:#1c1f26;--s2:#23262e;
    --primary:#ff7e55;--primaryh:#ff8e69;--secondary:#ff6aa0;--accent:#a06bff;--gold:#ffc773;
    --text:#f2f3f5;--muted:#9aa0ab;--border:rgba(255,255,255,.1);--green:#36c98e;
    --shadow-xl:0 50px 100px -40px rgba(0,0,0,.85);
  }
  .pt h1,.pt h2,.pt h3{margin:0;font-family:var(--fh);letter-spacing:-.02em;}
  .pt p{margin:0;}
  .pt-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
  .pt-blob{position:absolute;width:46vmax;height:46vmax;border-radius:50%;filter:blur(85px);opacity:.34;}
  .pt-blob.b1{background:var(--gold);top:-18vmax;left:-10vmax;animation:pt-a1 26s ease-in-out infinite;}
  .pt-blob.b2{background:var(--secondary);bottom:-18vmax;right:-10vmax;animation:pt-a2 30s ease-in-out infinite;}
  .pt-wrap{position:relative;z-index:1;max-width:640px;margin:0 auto;padding:36px 22px 70px;}
  .pt-card{background:var(--card);border:1px solid var(--border);border-radius:22px;box-shadow:var(--shadow-xl);overflow:hidden;}
  .pt-poster{aspect-ratio:16/6;background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 25%,#0d0d12),var(--accent,#7b3fe4) 60%,var(--secondary,#ff4d7d));position:relative;display:flex;align-items:flex-end;padding:20px 24px;background-size:cover;background-position:center;}
  .pt-poster .pin{position:absolute;top:14px;left:14px;background:rgba(255,255,255,.92);color:var(--text);font-size:11px;font-weight:800;padding:5px 11px;border-radius:999px;}
  .pt-body{padding:24px 28px 28px;}
  .pt-h3{font-size:14px;font-weight:700;margin:0 0 12px;font-family:var(--fh);}
  .pt-label{display:block;font-size:12.5px;font-weight:700;margin:14px 0 6px;}
  .pt-input{width:100%;padding:12px 14px;font:inherit;font-size:14px;color:var(--text);background:var(--bg);border:1.5px solid var(--border);border-radius:11px;outline:none;box-sizing:border-box;}
  .pt-input:focus{border-color:var(--primary);}
  .pt-evmeta{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:13.5px;color:var(--muted);margin:16px 0;}
  .pt-evmeta b{color:var(--text);}
  .pt-tier{display:flex;align-items:center;gap:13px;border:1.5px solid var(--border);border-radius:13px;padding:14px;cursor:pointer;margin-bottom:9px;transition:border-color .12s;}
  .pt-tier.on{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,transparent);}
  .pt-tier .rd{width:20px;height:20px;border-radius:50%;border:2px solid var(--border);flex:none;display:grid;place-items:center;}
  .pt-tier.on .rd{border-color:var(--primary);}
  .pt-tier.on .rd::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--primary);}
  .pt-tier .tn{font-family:var(--fh);font-weight:700;font-size:14.5px;}
  .pt-tier .td{font-size:12.5px;color:var(--muted);}
  .pt-tier .tp{margin-left:auto;font-family:var(--fh);font-weight:800;font-size:16px;}
  .pt-qty{display:flex;align-items:center;gap:14px;margin-top:4px;}
  .pt-qbtn{width:38px;height:38px;border-radius:10px;border:1.5px solid var(--border);background:var(--card);color:var(--text);font-size:18px;cursor:pointer;font-family:inherit;}
  .pt-qn{font-family:var(--fh);font-weight:800;font-size:20px;min-width:28px;text-align:center;}
  .pt-total{display:flex;justify-content:space-between;align-items:baseline;padding-top:14px;margin-top:16px;border-top:1px solid var(--border);}
  .pt-total .tv{font-family:var(--fh);font-weight:800;font-size:24px;}
  .pt-go{position:relative;overflow:hidden;width:100%;margin-top:18px;background:var(--grad);color:#fff;border:0;border-radius:13px;padding:15px;font-family:var(--fh);font-weight:800;font-size:15.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}
  .pt-go:disabled{opacity:.5;cursor:not-allowed;}
  .pt-go .sh{position:absolute;top:0;left:-60%;width:34%;height:100%;transform:skewX(-18deg);background:#fff;opacity:.4;filter:blur(3px);animation:pt-shine 3s ease-in-out infinite;}
  .pt-secure{text-align:center;font-size:11.5px;color:var(--muted);margin-top:11px;}
  .pt-spin{width:17px;height:17px;border:2.5px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:pt-spin .7s linear infinite;}
`;
