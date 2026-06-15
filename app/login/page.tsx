"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stage = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setNotice(`We sent a 6-digit code to ${email.trim().toLowerCase()}.`);
    setStage("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    // Session cookies are set; the dashboard guard routes to onboarding if needed.
    router.replace("/dashboard");
  }

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-3)",
      }}
    >
      <div className="card" style={{ width: "min(420px, 100%)" }}>
        <h1
          style={{
            fontSize: "1.6rem",
            margin: "0 0 0.25rem",
            background: "var(--brand-gradient)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            display: "inline-block",
          }}
        >
          invoxai.io
        </h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: "var(--space-3)" }}>
          {stage === "email"
            ? "Sign in or create your account."
            : "Enter the code we emailed you."}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {notice && stage === "code" && <div className="alert alert-ok">{notice}</div>}

        {stage === "email" ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={signInWithGoogle}
              disabled={busy}
              style={{ marginBottom: "var(--space-2)" }}
            >
              Continue with Google
            </button>

            <div
              className="muted"
              style={{ textAlign: "center", fontSize: "0.8rem", margin: "0.5rem 0" }}
            >
              or with email
            </div>

            <form onSubmit={sendCode}>
              <div className="field">
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? "Sending…" : "Email me a login code"}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={verifyCode}>
            <div className="field">
              <label className="label" htmlFor="code">
                6-digit code
              </label>
              <input
                id="code"
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                style={{ letterSpacing: "0.4em", fontSize: "1.2rem", textAlign: "center" }}
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: "var(--space-1)" }}
              disabled={busy}
              onClick={() => {
                setStage("email");
                setCode("");
                setNotice(null);
              }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
