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

export default function OnboardingWizard({ email, initial, categories }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const startStep: Step = ORDER.includes(initial.step as Step)
    ? (initial.step as Step)
    : "store_name";
  const [step, setStep] = useState<Step>(startStep);
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

  // --- Live subdomain availability (debounced RPC) ---
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkAvailability = useCallback(
    (value: string) => {
      if (debounce.current) clearTimeout(debounce.current);
      const v = value.trim().toLowerCase();
      if (!v) return setAvail("idle");
      if (!SUBDOMAIN_RE.test(v)) return setAvail("invalid");
      setAvail("checking");
      debounce.current = setTimeout(async () => {
        const { data, error } = await supabase.rpc("is_subdomain_available", {
          _name: v,
        });
        if (error) return setAvail("error");
        setAvail(data ? "available" : "taken");
      }, 400);
    },
    [supabase],
  );

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) {
    setError(null);
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Something went wrong.");
    onOk();
  }

  const selectedCat = categories.find((c) => c.id === categoryId);

  return (
    <div className="card" style={{ width: "min(520px, 100%)" }}>
      <div className="steps" aria-hidden>
        {/* OTP (done) + the four remaining steps */}
        <span className="step-dot active" />
        {ORDER.map((s, i) => (
          <span key={s} className={`step-dot${i <= stepIndex ? " active" : ""}`} />
        ))}
      </div>

      <p className="muted" style={{ margin: "0 0 0.25rem", fontSize: "0.8rem" }}>
        Step {stepIndex + 2} of 5 · signed in as {email}
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {step === "store_name" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveStoreName(storeName), () => setStep("subdomain"));
          }}
        >
          <h2 style={{ marginTop: 0 }}>Name your store</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            This is how buyers will see your brand.
          </p>
          <div className="field">
            <label className="label" htmlFor="storeName">
              Store name
            </label>
            <input
              id="storeName"
              className="input"
              required
              maxLength={60}
              placeholder="Acme Studio"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      )}

      {step === "subdomain" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveSubdomain(subdomain), () => setStep("category"));
          }}
        >
          <h2 style={{ marginTop: 0 }}>Pick your address</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Your free subdomain. You can connect a custom domain later.
          </p>
          <div className="field">
            <label className="label" htmlFor="subdomain">
              Subdomain
            </label>
            <div className="input-suffix">
              <input
                id="subdomain"
                inputMode="url"
                placeholder="acme"
                value={subdomain}
                autoFocus
                onChange={(e) => {
                  const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                  setSubdomain(v);
                  checkAvailability(v);
                }}
              />
              <span className="suffix">.{ROOT}</span>
            </div>
            <span className="hint">
              {avail === "idle" && "3–63 lowercase letters, numbers, hyphens."}
              {avail === "invalid" && "Use 3–63 lowercase letters, numbers or hyphens."}
              {avail === "checking" && "Checking availability…"}
              {avail === "available" && (
                <span style={{ color: "#1c7d57" }}>✓ {subdomain}.{ROOT} is available</span>
              )}
              {avail === "taken" && (
                <span style={{ color: "#b3214e" }}>✗ That one is taken or reserved</span>
              )}
              {avail === "error" && "Couldn't check right now — try again."}
            </span>
          </div>
          <button
            className="btn btn-primary btn-block"
            disabled={busy || avail !== "available"}
          >
            {busy ? "Saving…" : "Continue"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: "var(--space-1)" }}
            onClick={() => setStep("store_name")}
            disabled={busy}
          >
            Back
          </button>
        </form>
      )}

      {step === "category" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveCategory(categoryId), () => setStep("billing"));
          }}
        >
          <h2 style={{ marginTop: 0 }}>What do you sell?</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Sets your platform commission rate per sale.
          </p>
          <div className="field">
            <label className="label" htmlFor="category">
              Business category
            </label>
            <select
              id="category"
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {(c.commission_rate * 100).toFixed(1)}% fee
                </option>
              ))}
            </select>
            {selectedCat && (
              <span className="hint">
                Platform fee on each sale: {(selectedCat.commission_rate * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: "var(--space-1)" }}
            onClick={() => setStep("subdomain")}
            disabled={busy}
          >
            Back
          </button>
        </form>
      )}

      {step === "billing" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => saveBilling(billing),
              () => router.replace("/dashboard"),
            );
          }}
        >
          <h2 style={{ marginTop: 0 }}>Billing details</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Used on your invoices. You can edit these later.
          </p>

          {(
            [
              ["full_name", "Full name *", "Jane Doe", true],
              ["phone", "Phone *", "+91 98765 43210", true],
              ["business_name", "Business name", "Acme Studio Pvt Ltd", false],
              ["address", "Address", "123 MG Road", false],
              ["city", "City", "Bengaluru", false],
              ["state", "State", "Karnataka", false],
              ["postal_code", "Postal code", "560001", false],
              ["tax_id", "GST / Tax ID", "29ABCDE1234F1Z5", false],
            ] as const
          ).map(([key, label, ph, required]) => (
            <div className="field" key={key}>
              <label className="label" htmlFor={key}>
                {label}
              </label>
              <input
                id={key}
                className="input"
                placeholder={ph}
                required={required}
                value={(billing as Record<string, string>)[key] ?? ""}
                onChange={(e) =>
                  setBilling((b) => ({ ...b, [key]: e.target.value }))
                }
              />
            </div>
          ))}

          <div className="field">
            <label className="label" htmlFor="country">
              Country *
            </label>
            <input
              id="country"
              className="input"
              required
              value={billing.country}
              onChange={(e) => setBilling((b) => ({ ...b, country: e.target.value }))}
            />
          </div>

          <button className="btn btn-gradient btn-block" disabled={busy}>
            {busy ? "Finishing…" : "Finish & open dashboard"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: "var(--space-1)" }}
            onClick={() => setStep("category")}
            disabled={busy}
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}
