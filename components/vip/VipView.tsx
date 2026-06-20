"use client";

import { useState, useCallback } from "react";
import {
  type VipContent,
  type VipPlan,
  DEFAULT_VIP_CONTENT,
  formatVipPrice,
  planToMinorUnits,
} from "@/lib/vip";

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

// Avatar bg colors (deterministic by initial)
const AVATAR_COLORS = ["#ff6a3d", "#7b3fe4", "#ff4d7d", "#ffb23e", "#36c98e", "#3b82f6"];
function avatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length]; }

type JoinState = "idle" | "loading" | "done" | "error";

export default function VipView({
  content,
  pageId,
  storeName = "Store",
  memberCount = 0,
  payEnabled = false,
  stage = false,
}: {
  content: VipContent;
  pageId: string;
  storeName?: string;
  memberCount?: number;
  payEnabled?: boolean;
  stage?: boolean;
}) {
  const c = { ...DEFAULT_VIP_CONTENT, ...content };
  const plans: VipPlan[] = c.plans && c.plans.length > 0 ? c.plans : DEFAULT_VIP_CONTENT.plans!;
  const currency = c.currency || "INR";
  const theme = c.theme ?? "dark";
  const isDark = theme === "dark";

  const [selectedPlan, setSelectedPlan] = useState<string>(plans[0]?.id ?? "monthly");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activePlan = plans.find((p) => p.id === selectedPlan) ?? plans[0];

  const copyInvite = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [inviteLink]);

  async function handleJoin() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (!activePlan) return;

    if (!payEnabled) {
      setErr("Payment is not set up for this store yet.");
      return;
    }

    setJoinState("loading");
    setErr(null);

    try {
      // Step 1: Create order for this VIP page (VIP-specific endpoint reads plan price from DB)
      const createRes = await fetch("/api/vip/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          vip_plan: activePlan.id,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Could not create order");

      const orderId: string = createData.order_id;

      // Step 2: Load Razorpay
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load payment library. Check your connection.");

      // Step 3: Start payment
      const startRes = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          buyer_email: email,
          buyer_name: name || email.split("@")[0],
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "Could not start payment");

      // Step 4: Open Razorpay
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: startData.key_id,
          order_id: startData.razorpay_order_id,
          amount: startData.amount,
          currency: startData.currency,
          name: storeName,
          description: `${c.title || "VIP Community"} — ${activePlan.name}`,
          prefill: { email, name: name || "" },
          theme: { color: "#ff6a3d" },
          modal: {
            ondismiss: () => {
              setJoinState("idle");
              resolve();
            },
          },
          handler: async (resp: Record<string, string>) => {
            try {
              // Step 5: Verify payment
              const verifyRes = await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  order_id: orderId,
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.ok) throw new Error(verifyData.error || "Verification failed");

              // Step 6: Create VIP member row + get invite link
              const memberRes = await fetch("/api/vip/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  order_id: orderId,
                  page_id: pageId,
                  buyer_email: email,
                  buyer_name: name || email.split("@")[0],
                  plan: activePlan.id,
                }),
              });
              const memberData = await memberRes.json();
              const link = memberData.invite_link || c.inviteLink || null;
              setInviteLink(link);
              setJoinState("done");
              resolve();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Payment verification failed");
              setJoinState("error");
              reject(e);
            }
          },
        });
        rzp.open();
      });
    } catch (e) {
      if (joinState !== "idle") {
        setErr(e instanceof Error ? e.message : "Something went wrong");
        setJoinState("error");
      }
    }
  }

  const avatarCount = Math.min(5, memberCount);
  const displayCount = memberCount;

  return (
    <div
      className="vp"
      data-theme={theme}
      style={{
        "--bg": isDark ? "#120c1c" : "#fff9f4",
        "--card": isDark ? "#1d1630" : "#fff",
        "--s2": isDark ? "#251c3c" : "#fff3ec",
        "--primary": isDark ? "#ff7e55" : "#ff6a3d",
        "--secondary": isDark ? "#ff6aa0" : "#ff4d7d",
        "--accent": isDark ? "#a06bff" : "#7b3fe4",
        "--gold": isDark ? "#ffc773" : "#ffb23e",
        "--text": isDark ? "#f6eef2" : "#2b1b2e",
        "--muted": isDark ? "#b6a8c4" : "#7a6770",
        "--border": isDark ? "#342a4a" : "#f0e1d6",
        "--green": isDark ? "#36c98e" : "#1fb57a",
        "--grad": "linear-gradient(135deg,#ffb23e,#ff6a3d 36%,#ff4d7d 68%,#7b3fe4)",
      } as React.CSSProperties}
    >
      <style>{`
        .vp{background:var(--bg);color:var(--text);font-family:"Inter",system-ui,sans-serif;min-height:100dvh;position:relative;-webkit-font-smoothing:antialiased;line-height:1.55}
        .vp h1,.vp h2,.vp h3{margin:0;font-family:"Sora",system-ui,sans-serif;letter-spacing:-.02em}
        .vp p{margin:0}
        .vp-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
        .vp-blob{position:absolute;width:48vmax;height:48vmax;border-radius:50%;filter:blur(95px);opacity:.42}
        .vp[data-theme="light"] .vp-blob{opacity:.3}
        .vp-blob.b1{background:var(--accent);top:-18vmax;left:-12vmax;animation:vp-a1 26s ease-in-out infinite}
        .vp-blob.b2{background:var(--secondary);top:-8vmax;right:-14vmax;animation:vp-a2 30s ease-in-out infinite}
        .vp-blob.b3{background:var(--primary);bottom:-20vmax;left:20%;opacity:.3;animation:vp-a3 24s ease-in-out infinite}
        @keyframes vp-a1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(8%,7%) scale(1.22)}}
        @keyframes vp-a2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-7%,5%) scale(1.16)}}
        @keyframes vp-a3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6%,-6%) scale(1.18)}}
        @keyframes vp-shine{0%{left:-60%}55%,100%{left:130%}}
        @keyframes vp-spin{to{transform:rotate(360deg)}}
        @keyframes vp-pop{from{transform:scale(.9);opacity:.3}to{transform:scale(1);opacity:1}}
        @keyframes vp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        .vp-wrap{position:relative;z-index:1;max-width:920px;margin:0 auto;padding:40px 24px 70px}
        @media(max-width:640px){.vp-wrap{padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))}}
        .vp-hero{text-align:center}
        .vp-badge{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;padding:7px 15px;border-radius:999px;background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)}
        .vp[data-theme="dark"] .vp-badge{color:#d7c4ff}
        .vp-crest{width:92px;height:92px;border-radius:26px;background:var(--grad);display:grid;place-items:center;font-size:44px;margin:22px auto 0;box-shadow:0 22px 50px -16px color-mix(in srgb,var(--secondary) 70%,transparent);animation:vp-float 5s ease-in-out infinite}
        .vp-h1{font-size:clamp(28px,4.5vw,46px);font-weight:800;margin:22px 0 10px}
        .vp-h1 .g{background:linear-gradient(115deg,var(--gold),var(--secondary) 55%,var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent}
        .vp-sub{color:var(--muted);font-size:17px;max-width:46ch;margin:0 auto}
        .vp-host{display:inline-flex;align-items:center;gap:9px;margin-top:18px;font-size:13.5px;color:var(--muted)}
        .vp-host .av{width:30px;height:30px;border-radius:50%;background:var(--grad);color:#fff;display:grid;place-items:center;font-weight:800;font-size:12px;font-family:"Sora",system-ui,sans-serif}
        .vp-stats{display:flex;justify-content:center;gap:12px;margin-top:26px;flex-wrap:wrap}
        .vp-stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 22px;text-align:center;min-width:120px}
        .vp-stat .n{font-family:"Sora",system-ui,sans-serif;font-weight:800;font-size:24px}
        .vp-stat .l{font-size:12px;color:var(--muted);margin-top:2px}
        .vp-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:22px;margin-top:40px;align-items:start}
        .vp-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:24px}
        .vp-h3{font-size:17px;margin-bottom:16px}
        .vp-perks{display:flex;flex-direction:column;gap:14px}
        .vp-perk{display:flex;gap:13px}
        .vp-perk .pi{width:40px;height:40px;border-radius:11px;background:color-mix(in srgb,var(--accent) 16%,transparent);display:grid;place-items:center;font-size:19px;flex:none}
        .vp-perk b{font-family:"Sora",system-ui,sans-serif;font-size:14.5px}
        .vp-perk p{font-size:13px;color:var(--muted);margin-top:2px}
        .vp-locked{margin-top:22px;position:relative;border:1px solid var(--border);border-radius:16px;overflow:hidden}
        .vp-locked .feed{padding:16px;filter:blur(3px);opacity:.5;pointer-events:none}
        .vp-msg{display:flex;gap:10px;margin-bottom:14px}
        .vp-msg .a{width:32px;height:32px;border-radius:50%;background:var(--grad);flex:none}
        .vp-msg .b{background:var(--s2);border-radius:4px 12px 12px 12px;padding:9px 12px;font-size:12.5px}
        .vp-lockover{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--card) 92%,transparent) 60%)}
        .vp-lockover .ic{font-size:30px}
        .vp-lockover .t{font-family:"Sora",system-ui,sans-serif;font-weight:700;font-size:15px}
        .vp-lockover .s{font-size:12.5px;color:var(--muted)}
        .vp-join{position:sticky;top:80px}
        .vp-pseg{display:flex;background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:4px;gap:3px;margin-bottom:16px}
        .vp-pseg button{flex:1;border:0;background:none;font:inherit;font-weight:600;font-size:12.5px;color:var(--muted);padding:9px;border-radius:9px;cursor:pointer}
        .vp-pseg button.on{background:var(--card);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.2)}
        .vp-price{display:flex;align-items:baseline;gap:8px}
        .vp-price .now{font-family:"Sora",system-ui,sans-serif;font-weight:800;font-size:36px;letter-spacing:-.02em}
        .vp-price .per{color:var(--muted);font-size:14px}
        .vp-price .save{margin-left:auto;font-size:11px;font-weight:800;color:var(--green);background:color-mix(in srgb,var(--green) 14%,transparent);padding:4px 9px;border-radius:999px}
        .vp-incl{list-style:none;padding:16px 0;margin:14px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:10px;font-size:13.5px}
        .vp-incl li{display:flex;gap:9px}
        .vp-incl li::before{content:"✓";color:var(--green);font-weight:800}
        .vp-join-btn{position:relative;overflow:hidden;width:100%;background:var(--grad);color:#fff;border:0;border-radius:13px;padding:15px;font-family:"Sora",system-ui,sans-serif;font-weight:800;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px}
        .vp-join-btn:disabled{opacity:.8;cursor:not-allowed}
        .vp-join-btn .sh{position:absolute;top:0;left:-60%;width:34%;height:100%;transform:skewX(-18deg);background:#fff;opacity:.4;filter:blur(3px);animation:vp-shine 3s ease-in-out infinite}
        .vp-spin{width:18px;height:18px;border:2.5px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:vp-spin .7s linear infinite;flex:none}
        .vp-secure{text-align:center;font-size:11.5px;color:var(--muted);margin-top:12px}
        .vp-field{margin-top:12px}
        .vp-field input{width:100%;padding:12px 14px;font:inherit;font-size:14px;background:var(--bg);border:1.5px solid var(--border);border-radius:11px;color:var(--text);outline:none;box-sizing:border-box}
        .vp-field input:focus{border-color:var(--primary)}
        .vp-members{display:flex;align-items:center;gap:10px;margin-top:20px;justify-content:center}
        .vp-ava{display:flex}
        .vp-ava span{width:30px;height:30px;border-radius:50%;border:2px solid var(--bg);margin-left:-8px;display:grid;place-items:center;color:#fff;font-size:11px;font-weight:800;font-family:"Sora",system-ui,sans-serif}
        .vp-members .t{font-size:12.5px;color:var(--muted)}
        .vp-unlocked{text-align:center;animation:vp-pop .45s cubic-bezier(.2,.8,.2,1)}
        .vp-check{width:76px;height:76px;border-radius:50%;background:var(--grad);color:#fff;display:grid;place-items:center;font-size:36px;margin:0 auto 16px;box-shadow:0 18px 44px -14px color-mix(in srgb,var(--secondary) 70%,transparent)}
        .vp-unlocked h2{font-size:23px}
        .vp-unlocked p{color:var(--muted);font-size:14px;margin-top:8px}
        .vp-invite{display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin:18px 0}
        .vp-invite .lk{flex:1;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:var(--accent);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .vp-invite .cp{font:inherit;font-weight:700;font-size:12px;border:1px solid var(--border);background:var(--card);color:var(--text);padding:7px 12px;border-radius:8px;cursor:pointer}
        .vp-open{width:100%;background:var(--grad);color:#fff;border:0;border-radius:13px;padding:14px;font-family:"Sora",system-ui,sans-serif;font-weight:800;font-size:15px;cursor:pointer}
        .vp-pixel{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;color:var(--green);background:color-mix(in srgb,var(--green) 12%,transparent);padding:7px 13px;border-radius:999px;margin-top:16px}
        .vp-err{color:var(--secondary,#ff4d7d);font-size:13px;margin-top:10px;text-align:center}
        @media(max-width:800px){.vp-grid{grid-template-columns:1fr}.vp-join{position:static}}
      `}</style>

      {/* Animated background */}
      <div className="vp-bg">
        <div className="vp-blob b1" />
        <div className="vp-blob b2" />
        <div className="vp-blob b3" />
      </div>

      <div className="vp-wrap">
        {/* Hero */}
        <div className="vp-hero">
          <span className="vp-badge">⭐ Private members club</span>
          <div className="vp-crest">{c.crestEmoji || "⭐"}</div>
          <h1 className="vp-h1">
            <span className="g">{c.title || "VIP Community"}</span>
          </h1>
          <p className="vp-sub">{c.description || ""}</p>

          {c.host && (
            <div className="vp-host">
              {c.hostAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.hostAvatarUrl} alt={c.host} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span className="av">{c.host.charAt(0).toUpperCase()}</span>
              )}
              Hosted by <b style={{ color: "var(--text)" }}>{c.host}</b>
              {c.hostTitle && <span> · {c.hostTitle}</span>}
            </div>
          )}

          {displayCount > 0 && (
            <div className="vp-members">
              <span className="vp-ava">
                {Array.from({ length: Math.max(avatarCount, 1) }).map((_, i) => (
                  <span key={i} style={{ background: avatarColor(i) }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                ))}
              </span>
              <span className="t">
                <b style={{ color: "var(--text)" }}>{displayCount}</b> members inside
              </span>
            </div>
          )}
        </div>

        {/* Two-column grid */}
        <div className="vp-grid">
          {/* Left: perks + locked preview */}
          <div>
            {c.perks && c.perks.length > 0 && (
              <div className="vp-card">
                <h3 className="vp-h3">{"What's inside"}</h3>
                <div className="vp-perks">
                  {c.perks.map((perk, i) => (
                    <div className="vp-perk" key={i}>
                      <span className="pi">{perk.icon}</span>
                      <div>
                        <b>{perk.title}</b>
                        <p>{perk.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Locked preview */}
            <div className="vp-locked">
              <div className="feed">
                {(c.previewMessages || DEFAULT_VIP_CONTENT.previewMessages!).map((msg, i) => (
                  <div className="vp-msg" key={i}>
                    <span className="a" />
                    <div className="b">{msg.text}</div>
                  </div>
                ))}
              </div>
              <div className="vp-lockover">
                <div className="ic">🔒</div>
                <div className="t">Members-only space</div>
                <div className="s">Join to unlock the channel &amp; chat</div>
              </div>
            </div>
          </div>

          {/* Right: join card */}
          <div className="vp-join">
            <div className="vp-card">
              {joinState === "done" ? (
                <SuccessCard
                  email={email}
                  inviteLink={inviteLink}
                  platform={c.platform}
                  copied={copied}
                  onCopy={copyInvite}
                />
              ) : (
                <JoinCard
                  plans={plans}
                  currency={currency}
                  selectedPlan={selectedPlan}
                  onSelectPlan={setSelectedPlan}
                  activePlan={activePlan}
                  email={email}
                  name={name}
                  onEmail={setEmail}
                  onName={setName}
                  loading={joinState === "loading"}
                  err={err}
                  onJoin={handleJoin}
                  payEnabled={payEnabled}
                  stage={stage}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only fixed bottom pay bar — hidden on desktop via CSS (≤640px only).
          Duplicates the primary Join action so it's always reachable without scrolling. */}
      {joinState !== "done" && (
        <div className="mobile-pay-bar">
          <div className="mobile-pay-bar-price">
            {activePlan ? formatVipPrice(activePlan.price, currency) : ""}
            <small>{activePlan?.interval ? `per ${activePlan.interval}` : ""}</small>
          </div>
          <button
            className="mobile-pay-bar-btn"
            onClick={stage ? undefined : handleJoin}
            disabled={joinState === "loading" || stage}
          >
            {joinState === "loading" ? "Processing…" : `🔓 Join now`}
          </button>
        </div>
      )}
    </div>
  );
}

function JoinCard({
  plans,
  currency,
  selectedPlan,
  onSelectPlan,
  activePlan,
  email,
  name,
  onEmail,
  onName,
  loading,
  err,
  onJoin,
  payEnabled,
  stage,
}: {
  plans: VipPlan[];
  currency: string;
  selectedPlan: string;
  onSelectPlan: (id: string) => void;
  activePlan: VipPlan | undefined;
  email: string;
  name: string;
  onEmail: (v: string) => void;
  onName: (v: string) => void;
  loading: boolean;
  err: string | null;
  onJoin: () => void;
  payEnabled: boolean;
  stage: boolean;
}) {
  const priceStr = activePlan ? formatVipPrice(activePlan.price, currency) : "";
  const perStr = activePlan?.interval ?? "";
  const saveStr = activePlan?.saveBadge ?? "";

  return (
    <>
      {/* Plan segment */}
      {plans.length > 1 && (
        <div className="vp-pseg">
          {plans.map((p) => (
            <button
              key={p.id}
              className={selectedPlan === p.id ? "on" : ""}
              onClick={() => onSelectPlan(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Price */}
      <div className="vp-price">
        <span className="now">{priceStr}</span>
        <span className="per">{perStr}</span>
        {saveStr && <span className="save">{saveStr}</span>}
      </div>

      {/* Includes */}
      <ul className="vp-incl">
        <li>Full channel &amp; chat access</li>
        <li>All members-only content</li>
        <li>Direct access to host</li>
        {activePlan?.id !== "lifetime" && <li>Cancel anytime</li>}
      </ul>

      {/* Email */}
      <div className="vp-field">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="vp-field">
        <input
          type="email"
          placeholder="Email for your invite"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
        />
      </div>

      {err && <p className="vp-err">{err}</p>}

      <button
        className="vp-join-btn"
        onClick={stage ? undefined : onJoin}
        disabled={loading || stage}
        title={stage ? "Preview mode — payment disabled" : undefined}
      >
        {loading ? (
          <>
            <span className="vp-spin" />
            Granting access…
          </>
        ) : (
          <>
            🔓 Join · {priceStr}
            <span className="sh" />
          </>
        )}
      </button>

      {!payEnabled && !stage && (
        <p className="vp-secure" style={{ color: "var(--secondary)" }}>
          Payment gateway not configured yet
        </p>
      )}
      {payEnabled && (
        <p className="vp-secure">🔒 Secure payment · instant access · powered by Razorpay</p>
      )}
      {stage && (
        <p className="vp-secure">Preview mode — join button disabled</p>
      )}
    </>
  );
}

function SuccessCard({
  email,
  inviteLink,
  platform,
  copied,
  onCopy,
}: {
  email: string;
  inviteLink: string | null;
  platform?: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const firstName = email.split("@")[0] || "member";
  const platformLabel = platform === "discord" ? "Discord" : platform === "whatsapp" ? "WhatsApp" : "Telegram";

  return (
    <div className="vp-unlocked">
      <div className="vp-check">✓</div>
      <h2>{"Welcome to the community!"}</h2>
      <p>{"You're in, "}<b>{firstName}</b>{"! Use your private invite to join:"}</p>
      {inviteLink ? (
        <>
          <div className="vp-invite">
            <span className="lk">{inviteLink}</span>
            <button className="cp" onClick={onCopy}>{copied ? "Copied!" : "Copy"}</button>
          </div>
          <button
            className="vp-open"
            onClick={() => window.open(inviteLink, "_blank", "noreferrer")}
          >
            Open in {platformLabel} ↗
          </button>
        </>
      ) : (
        <p style={{ marginTop: 16, fontSize: 13 }}>
          Your access is confirmed. The seller hasn&apos;t set an invite link yet —
          please reach out to them to get added.
        </p>
      )}
      <div className="vp-pixel">● Access granted · invite link revealed</div>
    </div>
  );
}
