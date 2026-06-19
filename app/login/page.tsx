"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "otp" | "done";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Respect system preference on first load
  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  function destination() {
    if (typeof window === "undefined") return "/dashboard";
    return window.location.hostname.startsWith("admin.") ? "/admin" : "/dashboard";
  }

  function validEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validEmail(email)) { setEmailTouched(true); return; }
    if (sending) return;
    setError(null);
    setSending(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (err) { setError(err.message); return; }
    setOtp("");
    setStep("otp");
  }

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    const token = otp.replace(/\D/g, "");
    if (token.length !== 6 || verifying) return;
    setError(null);
    setVerifying(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    if (err) {
      setVerifying(false);
      setError(err.message);
      return;
    }
    setStep("done");
    // Short pause so the done state is visible, then redirect
    setTimeout(() => router.replace(destination()), 1200);
  }

  async function handleGoogle() {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination())}`,
      },
    });
    if (err) setError(err.message);
  }

  const emailBad = emailTouched && !validEmail(email);
  const otpClean = otp.replace(/\D/g, "");

  return (
    <>
      <style>{`
        @keyframes lg-a2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-8%,6%) scale(1.16); } }
        @keyframes lg-a3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,-7%) scale(1.2); } }
        @keyframes lg-shine { 0% { left: -60%; } 55%,100% { left: 130%; } }
        @keyframes lg-spin { to { transform: rotate(360deg); } }
        @keyframes lg-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes lg-pop { from { transform: scale(.9); } to { transform: scale(1); } }
        @keyframes lg-float { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-12px) rotate(var(--r,0deg)); } }
        @keyframes lg-loaddot { 0%,100% { transform: scale(1); opacity:.5; } 50% { transform: scale(1.4); opacity:1; } }

        .lg-wrap {
          --bg: #fff9f4; --card: #fff; --s2: #fff3ec;
          --primary: #ff6a3d; --primaryh: #f0532a; --secondary: #ff4d7d; --accent: #7b3fe4; --gold: #ffb23e;
          --text: #2b1b2e; --muted: #7a6770; --border: #f0e1d6; --green: #1fb57a;
          --grad: linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4 100%);
          --fh: var(--font-heading,"Sora",system-ui,sans-serif);
          --fb: var(--font-body,"Inter",system-ui,sans-serif);
          background: var(--bg); color: var(--text); font-family: var(--fb);
          min-height: 100dvh; display: grid; grid-template-columns: 1.05fr 1fr;
          line-height: 1.55; -webkit-font-smoothing: antialiased;
        }
        .lg-wrap.dark {
          --bg: #16101f; --card: #221833; --s2: #2a2040;
          --primary: #ff7e55; --primaryh: #ff8e69; --secondary: #ff6aa0; --accent: #a06bff; --gold: #ffc773;
          --text: #f6eef2; --muted: #b9a8bc; --border: #34264a; --green: #36c98e;
        }

        /* brand panel */
        .lg-brand { position: relative; overflow: hidden; background: var(--grad); color: #fff; padding: 54px 56px; display: flex; flex-direction: column; }
        .lg-brand::after { content: ""; position: absolute; inset: 0; background: radial-gradient(55% 90% at 80% 12%, rgba(255,255,255,.28), transparent 60%); pointer-events: none; }
        .lg-bp-in { position: relative; z-index: 2; display: flex; flex-direction: column; height: 100%; }
        .lg-bp-logo { display: flex; align-items: center; gap: 11px; font-family: var(--fh); font-weight: 800; font-size: 22px; }
        .lg-bp-logo-icon { width: 34px; height: 34px; border-radius: 10px; background: rgba(255,255,255,.92); box-shadow: 0 10px 26px rgba(0,0,0,.2); flex-shrink: 0; }
        .lg-bp-mid { margin-top: auto; }
        .lg-bp-h2 { font-family: var(--fh); font-size: 40px; line-height: 1.1; font-weight: 800; max-width: 15ch; margin: 0; letter-spacing: -.02em; }
        .lg-bp-ticks { margin-top: 26px; display: flex; flex-direction: column; gap: 13px; }
        .lg-bp-tick { display: flex; gap: 11px; font-size: 15px; opacity: .95; align-items: flex-start; }
        .lg-bp-tick::before { content: "✓"; font-weight: 800; flex-shrink: 0; }
        .lg-bp-foot { margin-top: auto; font-size: 13px; opacity: .85; padding-top: 24px; }

        .lg-chip { position: absolute; z-index: 1; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.28); backdrop-filter: blur(8px); border-radius: 14px; padding: 12px 15px; color: #fff; font-size: 12.5px; font-weight: 600; display: flex; align-items: center; gap: 9px; }
        .lg-chip .e { font-size: 17px; }
        .lg-chip.c1 { top: 16%; right: 8%; --r: 3deg; animation: lg-float 7s ease-in-out infinite; }
        .lg-chip.c2 { bottom: 18%; right: 14%; --r: -3deg; animation: lg-float 8.4s ease-in-out infinite .6s; }

        /* form side */
        .lg-side { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 40px 28px; }
        .lg-side-bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .lg-blob { position: absolute; width: 40vmax; height: 40vmax; border-radius: 50%; filter: blur(90px); opacity: .16; }
        .lg-blob.b1 { background: var(--secondary); top: -16vmax; right: -12vmax; animation: lg-a2 28s ease-in-out infinite; }
        .lg-blob.b2 { background: var(--accent); bottom: -18vmax; left: -10vmax; animation: lg-a3 32s ease-in-out infinite; }

        .lg-card { position: relative; z-index: 1; width: 100%; max-width: 400px; }
        .lg-topbar { display: flex; align-items: center; margin-bottom: 26px; }
        .lg-mlogo { display: none; align-items: center; gap: 9px; font-family: var(--fh); font-weight: 800; font-size: 17px; }
        .lg-mlogo-icon { width: 26px; height: 26px; border-radius: 8px; background: var(--grad); flex-shrink: 0; }
        .lg-tgl { margin-left: auto; width: 36px; height: 36px; border-radius: 999px; border: 1px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: border-color .15s; flex-shrink: 0; }
        .lg-tgl:hover { border-color: var(--muted); }

        .lg-view { animation: lg-in .35s ease; }
        .lg-h1 { font-family: var(--fh); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; }
        .lg-lead { color: var(--muted); font-size: 14.5px; margin-top: 8px; margin-bottom: 0; }

        .lg-google { width: 100%; margin-top: 24px; display: flex; align-items: center; justify-content: center; gap: 11px; padding: 13px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--card); color: var(--text); font-family: var(--fh); font-weight: 600; font-size: 14.5px; cursor: pointer; transition: border-color .15s, background .15s; }
        .lg-google:hover:not(:disabled) { border-color: var(--muted); }
        .lg-google:disabled { opacity: .55; cursor: not-allowed; }
        .lg-gico { width: 19px; height: 19px; flex: none; }
        .lg-or { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--muted); font-size: 12px; }
        .lg-or::before, .lg-or::after { content: ""; flex: 1; height: 1px; background: var(--border); }

        .lg-label { display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 6px; color: var(--text); }
        .lg-input { width: 100%; padding: 13px 15px; font: inherit; font-size: 15px; color: var(--text); background: var(--bg); border: 1.5px solid var(--border); border-radius: 12px; outline: none; transition: border-color .15s, box-shadow .15s; }
        .lg-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb,var(--primary) 20%,transparent); }
        .lg-input.err { border-color: var(--secondary); }
        .lg-input.otp-style { text-align: center; font-family: var(--fh); font-weight: 800; font-size: 30px; letter-spacing: 14px; padding-left: 14px; margin-top: 22px; }
        .lg-err { color: var(--secondary); font-size: 11.5px; margin-top: 6px; min-height: 14px; }

        .lg-go { position: relative; overflow: hidden; width: 100%; margin-top: 16px; background: var(--grad); color: #fff; border: 0; border-radius: 12px; padding: 14px; font-family: var(--fh); font-weight: 800; font-size: 15.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .lg-go:disabled { opacity: .5; cursor: not-allowed; }
        .lg-go .sh { position: absolute; top: 0; left: -60%; width: 34%; height: 100%; transform: skewX(-18deg); background: #fff; opacity: .4; filter: blur(3px); animation: lg-shine 3s ease-in-out infinite; }
        .lg-spin { width: 17px; height: 17px; border: 2.5px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: lg-spin .7s linear infinite; }
        .lg-mailto { font-size: 13px; color: var(--muted); margin-top: 16px; text-align: center; }
        .lg-mailto a { color: var(--primary); cursor: pointer; font-weight: 600; }
        .lg-fine { font-size: 12px; color: var(--muted); margin-top: 22px; text-align: center; }
        .lg-fine a { color: var(--primary); }
        .lg-back { background: none; border: 0; color: var(--muted); font: inherit; font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 14px; display: block; }
        .lg-back:hover { color: var(--text); }

        .lg-done { text-align: center; padding: 16px 0; animation: lg-pop .4s cubic-bezier(.2,.8,.2,1); }
        .lg-check { width: 70px; height: 70px; border-radius: 50%; background: var(--grad); color: #fff; display: grid; place-items: center; font-size: 32px; margin: 0 auto 16px; }
        .lg-done h2 { font-family: var(--fh); font-size: 22px; letter-spacing: -.02em; margin: 0; }
        .lg-done p { color: var(--muted); font-size: 14px; margin-top: 8px; }
        .lg-loaddots { display: inline-flex; gap: 5px; margin-top: 16px; }
        .lg-loaddots i { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); display: block; animation: lg-loaddot .6s ease-in-out infinite alternate; }
        .lg-loaddots i:nth-child(2) { animation-delay: .2s; }
        .lg-loaddots i:nth-child(3) { animation-delay: .4s; }

        .lg-alert { background: color-mix(in srgb,var(--secondary) 12%,transparent); border: 1px solid color-mix(in srgb,var(--secondary) 30%,transparent); color: var(--secondary); font-size: 13px; border-radius: 10px; padding: 10px 14px; margin-top: 12px; }

        @media (max-width: 860px) {
          .lg-wrap { grid-template-columns: 1fr; }
          .lg-brand { display: none; }
          .lg-mlogo { display: flex; }
        }
      `}</style>

      <div className={`lg-wrap${theme === "dark" ? " dark" : ""}`}>
        {/* ── Brand panel (left) ── */}
        <div className="lg-brand">
          <span className="lg-chip c1"><span className="e">₹</span>Payment received · ₹1,499</span>
          <span className="lg-chip c2"><span className="e">🎉</span>New order · Studio Aanya</span>
          <div className="lg-bp-in">
            <div className="lg-bp-logo">
              <span className="lg-bp-logo-icon" />
              invoxai
            </div>
            <div className="lg-bp-mid">
              <h2 className="lg-bp-h2">Welcome back to your business HQ.</h2>
              <div className="lg-bp-ticks">
                <div className="lg-bp-tick">Your store, courses &amp; pages — one login</div>
                <div className="lg-bp-tick">Payments land in your own account</div>
                <div className="lg-bp-tick">Buyers tracked across every sale</div>
              </div>
            </div>
            <div className="lg-bp-foot">India-first · built for the world · invoxai.io</div>
          </div>
        </div>

        {/* ── Form side (right) ── */}
        <div className="lg-side">
          <div className="lg-side-bg">
            <div className="lg-blob b1" />
            <div className="lg-blob b2" />
          </div>
          <div className="lg-card">
            <div className="lg-topbar">
              <div className="lg-mlogo">
                <span className="lg-mlogo-icon" />
                invoxai
              </div>
              <button
                className="lg-tgl"
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
            </div>

            {/* ── Step: email ── */}
            {step === "email" && (
              <div className="lg-view">
                <h1 className="lg-h1">Sign in to invoxai</h1>
                <p className="lg-lead">Use Google or your email — no password needed.</p>

                {error && <div className="lg-alert">{error}</div>}

                <button
                  className="lg-google"
                  type="button"
                  onClick={handleGoogle}
                  disabled={sending}
                >
                  <svg className="lg-gico" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.9 35.7 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="lg-or">or</div>

                <form onSubmit={handleSendCode} noValidate>
                  <label className="lg-label" htmlFor="lg-email">Email address</label>
                  <input
                    id="lg-email"
                    className={`lg-input${emailBad ? " err" : ""}`}
                    type="email"
                    placeholder="you@email.com"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                  />
                  <div className="lg-err">{emailBad ? "Enter a valid email address" : ""}</div>
                  <button className="lg-go" disabled={sending}>
                    {sending
                      ? <><span className="lg-spin" />Sending code…</>
                      : <>Email me a code<span className="sh" /></>}
                  </button>
                </form>

                <div className="lg-fine">
                  By continuing you agree to the Terms &amp; Privacy Policy.
                </div>
              </div>
            )}

            {/* ── Step: otp ── */}
            {step === "otp" && (
              <div className="lg-view">
                <button className="lg-back" onClick={() => { setStep("email"); setError(null); }}>
                  ‹ Back
                </button>
                <h1 className="lg-h1">Enter your code</h1>
                <p className="lg-lead">
                  We sent a 6-digit code to <b style={{ color: "var(--text)" }}>{email.trim().toLowerCase()}</b>.
                </p>

                {error && <div className="lg-alert">{error}</div>}

                <form onSubmit={handleVerify} noValidate>
                  <input
                    className="lg-input otp-style"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="••••••"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoFocus
                  />
                  <button
                    className="lg-go"
                    disabled={otpClean.length !== 6 || verifying}
                  >
                    {verifying
                      ? <><span className="lg-spin" />Verifying…</>
                      : <>Verify &amp; continue<span className="sh" /></>}
                  </button>
                </form>

                <div className="lg-mailto">
                  Didn&apos;t get it?{" "}
                  <a onClick={() => handleSendCode()}>Resend code</a>
                </div>
              </div>
            )}

            {/* ── Step: done ── */}
            {step === "done" && (
              <div className="lg-done">
                <div className="lg-check">✓</div>
                <h2>You&apos;re in!</h2>
                <p>Taking you to your dashboard…</p>
                <div className="lg-loaddots">
                  <i /><i /><i />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
