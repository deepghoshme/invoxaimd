"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  saveBilling,
  saveCategory,
  saveStoreName,
  saveSubdomain,
  type BillingInput,
} from "./actions";

type Category = { id: string; name: string; commission_rate: number };

type Props = {
  email: string;
  initial: { store_name: string; subdomain: string; category_id: string; step: string };
  categories: Category[];
};

const ORDER = ["store_name", "subdomain", "category", "billing"] as const;
type Step = (typeof ORDER)[number];

const ROOT = "invoxai.io";
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/;
type Avail = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

// Category display metadata (emoji + friendly names) keyed by category name keywords
function catEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("course") || n.includes("edu")) return "🎓";
  if (n.includes("digital") || n.includes("download")) return "📦";
  if (n.includes("physical") || n.includes("product")) return "🛍️";
  if (n.includes("event") || n.includes("ticket")) return "🎟️";
  if (n.includes("service") || n.includes("book")) return "📅";
  if (n.includes("member") || n.includes("sub")) return "⭐";
  return "🏪";
}

export default function OnboardingWizard({ email, initial, categories }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  const startStep: Step = ORDER.includes(initial.step as Step)
    ? (initial.step as Step)
    : "store_name";
  const [step, setStep] = useState<Step>(startStep);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [storeName, setStoreName] = useState(initial.store_name);
  const [subdomain, setSubdomain] = useState(initial.subdomain);
  const [avail, setAvail] = useState<Avail>(initial.subdomain ? "available" : "idle");
  const [categoryId, setCategoryId] = useState(initial.category_id || categories[0]?.id || "");
  const [billing, setBilling] = useState<BillingInput>({
    full_name: "",
    phone: "",
    country: "India",
  });

  const stepIndex = ORDER.indexOf(step);

  // ── Live subdomain availability (debounced RPC) ─────────────────────────────
  // This is the real is_subdomain_available RPC — preserved exactly from the original.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkAvailability = useCallback(
    (value: string) => {
      if (debounce.current) clearTimeout(debounce.current);
      const v = value.trim().toLowerCase();
      if (!v) return setAvail("idle");
      if (!SUBDOMAIN_RE.test(v)) return setAvail("invalid");
      setAvail("checking");
      debounce.current = setTimeout(async () => {
        const { data, error } = await supabase.rpc("is_subdomain_available", { _name: v });
        if (error) return setAvail("error");
        setAvail(data ? "available" : "taken");
      }, 400);
    },
    [supabase],
  );

  useEffect(() => {
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, []);

  // ── Generic step runner ──────────────────────────────────────────────────────
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) {
    setError(null);
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Something went wrong.");
    onOk();
  }

  function goBack() {
    const idx = ORDER.indexOf(step);
    if (idx > 0) setStep(ORDER[idx - 1]);
  }

  async function handleNext() {
    if (step === "store_name") {
      await run(() => saveStoreName(storeName), () => setStep("subdomain"));
    } else if (step === "subdomain") {
      await run(() => saveSubdomain(subdomain), () => setStep("category"));
    } else if (step === "category") {
      await run(() => saveCategory(categoryId), () => setStep("billing"));
    } else if (step === "billing") {
      await run(() => saveBilling(billing), () => setDone(true));
    }
  }

  // Next button disabled logic (mirrors original)
  let nextDisabled = busy;
  if (step === "store_name") nextDisabled = nextDisabled || storeName.trim().length < 2;
  if (step === "subdomain") nextDisabled = nextDisabled || avail !== "available";
  if (step === "category") nextDisabled = nextDisabled || !categoryId;
  if (step === "billing") nextDisabled = nextDisabled || !billing.full_name?.trim() || !billing.phone?.trim();

  const nextLabel = step === "billing" ? "Create my store ✦" : "Continue →";

  // Dot state helper
  function dotCls(i: number) {
    if (i < stepIndex) return "ob-stepdot done";
    if (i === stepIndex) return "ob-stepdot cur";
    return "ob-stepdot";
  }

  const selectedCat = categories.find(c => c.id === categoryId);

  return (
    <>
      <style>{`
        @keyframes ob-a1 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(8%,6%) scale(1.2);} }
        @keyframes ob-a2 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(-7%,5%) scale(1.15);} }
        @keyframes ob-shine { 0%{left:-60%;} 55%,100%{left:130%;} }
        @keyframes ob-spin { to{transform:rotate(360deg);} }
        @keyframes ob-in { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:none;} }
        @keyframes ob-pop { from{transform:scale(.9);} to{transform:scale(1);} }

        .ob-wrap {
          --bg:#fff9f4;--card:#fff;--s2:#fff3ec;
          --primary:#ff6a3d;--primaryh:#f0532a;--secondary:#ff4d7d;--accent:#7b3fe4;--gold:#ffb23e;
          --text:#2b1b2e;--muted:#7a6770;--border:#f0e1d6;--green:#1fb57a;--red:#e5476f;
          --grad:linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4);
          --shadow-xl:0 40px 90px -40px rgba(43,27,46,.45);
          --fh:var(--font-heading,"Sora",system-ui,sans-serif);
          --fb:var(--font-body,"Inter",system-ui,sans-serif);
          background:var(--bg);color:var(--text);font-family:var(--fb);
          min-height:100dvh;position:relative;display:flex;flex-direction:column;
          -webkit-font-smoothing:antialiased;line-height:1.55;
        }
        .ob-wrap.dark {
          --bg:#16101f;--card:#221833;--s2:#2a2040;
          --primary:#ff7e55;--primaryh:#ff8e69;--secondary:#ff6aa0;--accent:#a06bff;--gold:#ffc773;
          --text:#f6eef2;--muted:#b9a8bc;--border:#34264a;--green:#36c98e;--red:#ff6f93;
          --shadow-xl:0 40px 90px -40px rgba(0,0,0,.6);
        }

        .ob-bg { position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none; }
        .ob-blob { position:absolute;width:48vmax;height:48vmax;border-radius:50%;filter:blur(90px);opacity:.32; }
        .ob-blob.b1 { background:var(--gold);top:-18vmax;left:-10vmax;animation:ob-a1 26s ease-in-out infinite; }
        .ob-blob.b2 { background:var(--accent);bottom:-18vmax;right:-10vmax;animation:ob-a2 30s ease-in-out infinite; }

        .ob-topbar { position:relative;z-index:2;display:flex;align-items:center;padding:18px 26px; }
        .ob-brand { display:flex;align-items:center;gap:9px;font-family:var(--fh);font-weight:800;font-size:17px; }
        .ob-logo-icon { width:27px;height:27px;border-radius:8px;background:var(--grad);flex-shrink:0; }
        .ob-tgl { margin-left:auto;width:36px;height:36px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:border-color .15s; }
        .ob-tgl:hover { border-color:var(--muted); }

        .ob-stage { position:relative;z-index:1;flex:1;display:flex;align-items:center;justify-content:center;padding:10px 22px 50px; }
        .ob-card { width:100%;max-width:520px;background:var(--card);border:1px solid var(--border);border-radius:24px;box-shadow:var(--shadow-xl);padding:30px; }

        .ob-steps { display:flex;gap:7px;margin-bottom:26px; }
        .ob-stepdot { flex:1;height:6px;border-radius:3px;background:var(--border);overflow:hidden; }
        .ob-stepdot.done { background:var(--grad); }
        .ob-stepdot.cur { background:var(--border);position:relative; }
        .ob-stepdot.cur::after { content:"";position:absolute;inset:0;width:60%;background:var(--grad);border-radius:3px; }

        .ob-view { animation:ob-in .35s ease; }
        .ob-stepno { font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--primary); }
        .ob-h1 { font-family:var(--fh);font-size:26px;font-weight:800;letter-spacing:-.02em;margin:8px 0 6px; }
        .ob-lead { color:var(--muted);font-size:14.5px;margin-bottom:22px;margin-top:0; }

        .ob-label { display:block;font-size:12.5px;font-weight:700;margin:14px 0 6px;color:var(--text); }
        .ob-input { width:100%;padding:13px 15px;font:inherit;font-size:15px;color:var(--text);background:var(--bg);border:1.5px solid var(--border);border-radius:12px;outline:none;transition:border-color .15s,box-shadow .15s; }
        .ob-input:focus { border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 20%,transparent); }

        .ob-sfx { display:flex;align-items:center;background:var(--bg);border:1.5px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color .15s,box-shadow .15s; }
        .ob-sfx.ok { border-color:var(--green); }
        .ob-sfx.bad { border-color:var(--red); }
        .ob-sfx:focus-within { border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 20%,transparent); }
        .ob-sfx input { flex:1;border:0;background:transparent;padding:13px 15px;font:inherit;font-size:15px;color:var(--text);outline:none; }
        .ob-sfx .tail { padding:0 15px;color:var(--muted);font-size:14px;white-space:nowrap;display:flex;align-items:center;gap:7px; }

        .ob-avail { font-size:12.5px;font-weight:600;margin-top:8px;display:flex;align-items:center;gap:7px;min-height:18px; }
        .ob-avail.ok { color:var(--green); }
        .ob-avail.bad { color:var(--red); }
        .ob-avail.checking { color:var(--muted); }
        .ob-mini-spin { width:13px;height:13px;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:ob-spin .7s linear infinite;flex-shrink:0; }

        .ob-cats { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
        .ob-cat { border:1.5px solid var(--border);border-radius:14px;padding:15px;cursor:pointer;background:var(--card);position:relative;transition:border-color .15s,background .15s; }
        .ob-cat.on { border-color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,transparent); }
        .ob-cat .ico { font-size:24px; }
        .ob-cat .nm { font-family:var(--fh);font-weight:700;font-size:14px;margin-top:8px; }
        .ob-cat .comm { font-size:11.5px;color:var(--muted);margin-top:3px; }
        .ob-cat .comm b { color:var(--primary); }
        .ob-cat .tick { position:absolute;top:11px;right:11px;width:20px;height:20px;border-radius:50%;background:var(--primary);color:#fff;display:none;place-items:center;font-size:12px; }
        .ob-cat.on .tick { display:grid; }

        .ob-ff { display:flex;gap:12px; }
        .ob-ff > div { flex:1; }
        .ob-row { display:flex;gap:11px;align-items:center;margin-top:26px; }
        .ob-back { font:inherit;font-family:var(--fh);font-weight:600;font-size:14px;padding:13px 18px;border-radius:12px;border:1.5px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;transition:border-color .15s; }
        .ob-back:hover { border-color:var(--muted); }
        .ob-next { position:relative;overflow:hidden;flex:1;background:var(--grad);color:#fff;border:0;border-radius:12px;padding:14px;font-family:var(--fh);font-weight:800;font-size:15.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px; }
        .ob-next:disabled { opacity:.5;cursor:not-allowed; }
        .ob-next .sh { position:absolute;top:0;left:-60%;width:34%;height:100%;transform:skewX(-18deg);background:#fff;opacity:.4;filter:blur(3px);animation:ob-shine 3s ease-in-out infinite; }
        .ob-spin { width:17px;height:17px;border:2.5px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:ob-spin .7s linear infinite; }

        .ob-alert { background:color-mix(in srgb,var(--red) 12%,transparent);border:1px solid color-mix(in srgb,var(--red) 30%,transparent);color:var(--red);font-size:13px;border-radius:10px;padding:10px 14px;margin-bottom:12px; }

        .ob-done { text-align:center;padding:10px 0;animation:ob-pop .45s cubic-bezier(.2,.8,.2,1); }
        .ob-check { width:76px;height:76px;border-radius:50%;background:var(--grad);color:#fff;display:grid;place-items:center;font-size:36px;margin:0 auto 18px;box-shadow:0 16px 40px -12px color-mix(in srgb,var(--primary) 70%,transparent); }
        .ob-done h2 { font-family:var(--fh);font-size:26px;letter-spacing:-.02em;margin:0; }
        .ob-done p { color:var(--muted);font-size:14.5px;margin-top:10px; }
        .ob-url { font-family:ui-monospace,Menlo,monospace;font-size:13.5px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin:18px 0;color:var(--primary);font-weight:600; }
        .ob-firstpages { display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:16px 0 4px; }
        .ob-fp { border:1px solid var(--border);border-radius:12px;padding:14px 8px;text-align:center;cursor:pointer;background:var(--card);transition:border-color .15s,transform .15s; }
        .ob-fp:hover { border-color:var(--primary);transform:translateY(-3px); }
        .ob-fp .e { font-size:24px; }
        .ob-fp .l { font-size:12px;font-weight:600;margin-top:6px; }

        @media(max-width:520px) { .ob-cats { grid-template-columns:1fr; } }
      `}</style>

      <div className={`ob-wrap${theme === "dark" ? " dark" : ""}`}>
        <div className="ob-bg">
          <div className="ob-blob b1" />
          <div className="ob-blob b2" />
        </div>

        <div className="ob-topbar">
          <div className="ob-brand">
            <span className="ob-logo-icon" />
            invoxai
          </div>
          <button
            className="ob-tgl"
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>

        <div className="ob-stage">
          <div className="ob-card">
            {!done ? (
              <>
                {/* Progress dots — 4 real steps (OTP already satisfied by login) */}
                <div className="ob-steps" aria-hidden>
                  {ORDER.map((_, i) => (
                    <span key={i} className={dotCls(i)} />
                  ))}
                </div>

                {error && <div className="ob-alert">{error}</div>}

                {/* ── Step: store name ── */}
                {step === "store_name" && (
                  <div className="ob-view">
                    <div className="ob-stepno">Step 1 of 4</div>
                    <h1 className="ob-h1">Name your store</h1>
                    <p className="ob-lead">This is how buyers will recognise you. You can change it anytime.</p>
                    <label className="ob-label" htmlFor="ob-storename">Store name</label>
                    <input
                      id="ob-storename"
                      className="ob-input"
                      placeholder="e.g. Studio Aanya"
                      maxLength={60}
                      value={storeName}
                      onChange={e => setStoreName(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}

                {/* ── Step: subdomain ── */}
                {step === "subdomain" && (
                  <div className="ob-view">
                    <div className="ob-stepno">Step 2 of 4</div>
                    <h1 className="ob-h1">Claim your subdomain</h1>
                    <p className="ob-lead">Your free address on invoxai. Connect a custom domain later from Settings.</p>
                    <label className="ob-label" htmlFor="ob-sub">Subdomain</label>
                    <div className={`ob-sfx${avail === "available" ? " ok" : avail === "taken" || avail === "invalid" ? " bad" : ""}`}>
                      <input
                        id="ob-sub"
                        placeholder="yourname"
                        inputMode="url"
                        autoFocus
                        value={subdomain}
                        onChange={e => {
                          const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                          setSubdomain(v);
                          checkAvailability(v);
                        }}
                      />
                      <span className="tail">.{ROOT}</span>
                    </div>
                    <div className={`ob-avail${avail === "available" ? " ok" : avail === "taken" || avail === "invalid" ? " bad" : avail === "checking" ? " checking" : ""}`}>
                      {avail === "checking" && <><span className="ob-mini-spin" />Checking availability…</>}
                      {avail === "available" && <>✓ {subdomain}.{ROOT} is available</>}
                      {avail === "taken" && <>✕ That subdomain is taken or reserved</>}
                      {avail === "invalid" && <>✕ Use 3–63 lowercase letters, numbers or hyphens</>}
                      {avail === "error" && <>Couldn't check right now — try again.</>}
                      {avail === "idle" && <span style={{ color: "var(--muted)", fontWeight: 400 }}>3–63 lowercase letters, numbers, hyphens.</span>}
                    </div>
                  </div>
                )}

                {/* ── Step: category ── */}
                {step === "category" && (
                  <div className="ob-view">
                    <div className="ob-stepno">Step 3 of 4</div>
                    <h1 className="ob-h1">What do you sell?</h1>
                    <p className="ob-lead">This sets your per-sale commission rate. Pick the closest fit.</p>
                    <div className="ob-cats">
                      {categories.map(c => (
                        <div
                          key={c.id}
                          className={`ob-cat${categoryId === c.id ? " on" : ""}`}
                          onClick={() => setCategoryId(c.id)}
                        >
                          <span className="tick">✓</span>
                          <div className="ico">{catEmoji(c.name)}</div>
                          <div className="nm">{c.name}</div>
                          <div className="comm"><b>{(c.commission_rate * 100).toFixed(0)}%</b> commission</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Step: billing ── */}
                {step === "billing" && (
                  <div className="ob-view">
                    <div className="ob-stepno">Step 4 of 4</div>
                    <h1 className="ob-h1">Billing details</h1>
                    <p className="ob-lead">For invoices and your commission wallet. GST is optional.</p>
                    <label className="ob-label" htmlFor="ob-name">Full name *</label>
                    <input
                      id="ob-name"
                      className="ob-input"
                      placeholder="Jane Doe"
                      autoFocus
                      value={billing.full_name}
                      onChange={e => setBilling(b => ({ ...b, full_name: e.target.value }))}
                    />
                    <label className="ob-label" htmlFor="ob-phone">Phone *</label>
                    <input
                      id="ob-phone"
                      className="ob-input"
                      placeholder="+91 98765 43210"
                      inputMode="tel"
                      value={billing.phone}
                      onChange={e => setBilling(b => ({ ...b, phone: e.target.value }))}
                    />
                    <div className="ob-ff">
                      <div>
                        <label className="ob-label" htmlFor="ob-city">City</label>
                        <input
                          id="ob-city"
                          className="ob-input"
                          placeholder="Mumbai"
                          value={billing.city ?? ""}
                          onChange={e => setBilling(b => ({ ...b, city: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="ob-label" htmlFor="ob-gst">GSTIN (optional)</label>
                        <input
                          id="ob-gst"
                          className="ob-input"
                          placeholder="22AAAAA0000A1Z5"
                          value={billing.tax_id ?? ""}
                          onChange={e => setBilling(b => ({ ...b, tax_id: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Back / Next row */}
                <div className="ob-row">
                  {stepIndex > 0 && (
                    <button className="ob-back" onClick={goBack} disabled={busy}>
                      ‹ Back
                    </button>
                  )}
                  <button
                    className="ob-next"
                    onClick={handleNext}
                    disabled={nextDisabled}
                  >
                    {busy
                      ? <><span className="ob-spin" />Saving…</>
                      : <>{nextLabel}<span className="sh" /></>}
                  </button>
                </div>
              </>
            ) : (
              /* ── Done state ── */
              <div className="ob-done">
                <div className="ob-check">✓</div>
                <h2>You&apos;re all set, {(billing.full_name || storeName || "there").split(" ")[0]}!</h2>
                <p>{storeName} is live. Your store address:</p>
                <div className="ob-url">{subdomain}.{ROOT}</div>
                <p style={{ fontWeight: 600, color: "var(--text)" }}>Create your first page to get started</p>
                <div className="ob-firstpages">
                  <div className="ob-fp" onClick={() => router.push("/dashboard/bio")}>
                    <div className="e">🔗</div><div className="l">Link-in-bio</div>
                  </div>
                  <div className="ob-fp" onClick={() => router.push("/dashboard/store")}>
                    <div className="e">🛍️</div><div className="l">Store</div>
                  </div>
                  <div className="ob-fp" onClick={() => router.push("/dashboard/products/new")}>
                    <div className="e">📦</div><div className="l">Product</div>
                  </div>
                </div>
                <button
                  className="ob-next"
                  style={{ marginTop: 14 }}
                  onClick={() => router.replace("/dashboard")}
                >
                  Go to dashboard →<span className="sh" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
