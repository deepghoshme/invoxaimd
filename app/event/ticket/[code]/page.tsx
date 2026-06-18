import { createAdminClient } from "@/lib/supabase/admin";
import { type EventContent, formatEventDate } from "@/lib/event";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your Ticket", robots: { index: false, follow: false } };

/**
 * Platform-level ticket lookup: invoxai.io/event/ticket/[code]
 * Buyers can bookmark this URL to retrieve their ticket.
 * Also reachable from the seller's subdomain via /event/ticket/[code]
 * once the CEO adds the 'event' renderer branch to app/sites/[domain]/[[...path]]/page.tsx.
 */
export default async function TicketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const sb = createAdminClient();

  // Graceful: if event_tickets table doesn't exist yet, show a clear message
  const { data: ticket, error } = await sb
    .from("event_tickets")
    .select("id, tier_name, buyer_name, buyer_email, qty, code, order_id, status, page_id, store_id, created_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) {
    return <TicketShell><ErrorCard title="Table not set up" body="The event tickets table hasn't been created yet. Run the migration: supabase/migrations/20260618390000_events.sql" /></TicketShell>;
  }

  if (!ticket) {
    return <TicketShell><ErrorCard title="Ticket not found" body="This ticket code is invalid or has been cancelled." /></TicketShell>;
  }

  if (ticket.status === "cancelled") {
    return <TicketShell><ErrorCard title="Ticket cancelled" body="This ticket has been cancelled. Contact the event organiser." /></TicketShell>;
  }

  // Load event page content
  const { data: page } = await sb
    .from("pages")
    .select("content, title")
    .eq("id", ticket.page_id)
    .maybeSingle();

  const content = ((page?.content ?? {}) as EventContent);
  const eventTitle = content.title || page?.title || "Event";
  const dateStr = formatEventDate(content.event_date, content.event_time, content.timezone);
  const locationLabel =
    content.is_online !== false
      ? content.location
        ? `Online · ${content.location}`
        : "Online"
      : content.location || "See confirmation email";

  const orderId = ticket.order_id ? String(ticket.order_id).slice(-6).toUpperCase() : "—";

  return (
    <TicketShell>
      <link
        href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{TICKET_CSS}</style>

      <div className="et" data-theme="dark" style={{ display: "grid", placeItems: "center", padding: "28px 18px", minHeight: "100dvh" }}>
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
              {ticket.status === "used" ? "Used" : "Confirmed"}
            </span>
            <div className="k">{content.is_online !== false ? "Online Event" : "Live Event"}</div>
            <h2>{eventTitle}</h2>
          </div>

          <div className="et-body">
            <div className="et-rows">
              {content.event_date && (
                <div className="et-kv">
                  <div className="l">Date</div>
                  <div className="v">
                    {new Date(content.event_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              )}
              {content.event_time && (
                <div className="et-kv">
                  <div className="l">Time</div>
                  <div className="v">
                    {content.event_time}{" "}
                    {content.timezone === "Asia/Kolkata" ? "IST" : ""}
                  </div>
                </div>
              )}
              <div className="et-kv">
                <div className="l">Ticket</div>
                <div className="v">{ticket.tier_name}</div>
              </div>
              <div className="et-kv">
                <div className="l">Attendee</div>
                <div className="v">{ticket.buyer_name || "Guest"}</div>
              </div>
              <div className="et-kv">
                <div className="l">Location</div>
                <div className="v">{locationLabel}</div>
              </div>
              <div className="et-kv">
                <div className="l">Order</div>
                <div className="v">#{orderId}</div>
              </div>
            </div>

            <div className="et-perf">
              <QrBlock code={ticket.code} />
              <div className="et-code">{ticket.code}</div>
              <div className="et-codel">
                Show this at entry · {ticket.qty > 1 ? `${ticket.qty} admits` : "1 admit"}
              </div>
            </div>
          </div>

          {content.is_online !== false && content.location && content.location.startsWith("http") && (
            <div className="et-act">
              <a
                className="et-btn grad"
                href={content.location}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none", textAlign: "center" }}
              >
                Join event ↗
              </a>
            </div>
          )}

          <div className="et-foot">
            Ticket by <b>invoxai</b>
          </div>
        </div>
      </div>
    </TicketShell>
  );
}

function QrBlock({ code }: { code: string }) {
  const cells = 11;
  const bits: boolean[] = [];
  for (let i = 0; i < cells * cells; i++) {
    const charCode = code.charCodeAt(i % code.length);
    bits.push(((charCode >> (i % 8)) & 1) === 1);
  }
  const corners = [0, 1, 2, 3, 4, 11, 22, 33, 44, 5, 16, 27, 38, 49, 6, 7, 8, 9, 10];
  corners.forEach((idx) => { if (idx < bits.length) bits[idx] = true; });
  return (
    <div style={{ width: 120, height: 120, background: "#fff", borderRadius: 12, padding: 8, margin: "0 auto", display: "grid", placeItems: "center" }}>
      <svg viewBox={`0 0 ${cells} ${cells}`} width="104" height="104" shapeRendering="crispEdges">
        {bits.map((on, i) => {
          const x = i % cells;
          const y = Math.floor(i / cells);
          return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#111" /> : null;
        })}
        <rect x={4.5} y={4.5} width={2} height={2} fill="#111" />
      </svg>
    </div>
  );
}

function TicketShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100dvh", background: "#0f1115" }}>
      {children}
    </main>
  );
}

function ErrorCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 400, width: "100%", background: "#1c1f26", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, padding: "32px 28px", textAlign: "center", color: "#f2f3f5" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🎟️</div>
        <h2 style={{ margin: "0 0 10px", fontFamily: "system-ui, sans-serif", fontSize: 20 }}>{title}</h2>
        <p style={{ margin: 0, color: "#9aa0ab", fontSize: 13.5, lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  );
}

const TICKET_CSS = `
  @keyframes et-pop { from { transform: scale(.94); } to { transform: scale(1); } }
  .et {
    --bg:#0f1115;--card:#1c1f26;--border:rgba(255,255,255,.1);--green:#36c98e;
    --text:#f2f3f5;--muted:#9aa0ab;
    --grad:linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4);
    --fh:"Sora",system-ui,sans-serif;--fb:"Inter",system-ui,sans-serif;
    background:var(--bg);color:var(--text);font-family:var(--fb);
  }
  .et h1,.et h2,.et h3{margin:0;font-family:var(--fh);letter-spacing:-.02em;}
  .et p{margin:0;}
  .et-ticket{position:relative;z-index:1;width:380px;max-width:100%;background:var(--card);border:1px solid var(--border);border-radius:22px;overflow:hidden;box-shadow:0 40px 90px -40px rgba(0,0,0,.7);animation:et-pop .4s cubic-bezier(.2,.8,.2,1);}
  .et-poster{height:150px;background:linear-gradient(130deg,#2a1830,#7b3fe4 55%,#ff4d7d);position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding:18px;background-size:cover;background-position:center;}
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
  .et-foot b{background:linear-gradient(135deg,#ff6a3d,#ff4d7d 55%,#7b3fe4);-webkit-background-clip:text;background-clip:text;color:transparent;font-family:var(--fh);}
`;
