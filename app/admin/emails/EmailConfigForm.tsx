"use client";

import { useState, useTransition } from "react";
import { Card, Switch } from "@/components/dx/ui";
import { saveEmailConfig, toggleEmailFlag } from "./actions";

type Config = {
  method: "gmail" | "smtp";
  from_name: string;
  gmail_user: string | null;
  has_gmail_pass: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  has_smtp_pass: boolean;
  otp_enabled: boolean;
  welcome_enabled: boolean;
  daily_wallet_enabled: boolean;
  weekly_report_enabled: boolean;
  migrationPending?: boolean;
} | null;

export default function EmailConfigForm({ config }: { config: Config }) {
  const [method, setMethod] = useState<"gmail" | "smtp">(config?.method ?? "smtp");
  const [fromName, setFromName] = useState(config?.from_name ?? "invoxai");

  // Gmail fields
  const [gmailUser, setGmailUser] = useState(config?.gmail_user ?? "");
  const [gmailPass, setGmailPass] = useState("");

  // SMTP fields
  const [smtpHost, setSmtpHost] = useState(config?.smtp_host ?? "");
  const [smtpPort, setSmtpPort] = useState(String(config?.smtp_port ?? "587"));
  const [smtpUser, setSmtpUser] = useState(config?.smtp_user ?? "");
  const [smtpPass, setSmtpPass] = useState("");

  // Toggles
  const [otpEnabled, setOtpEnabled] = useState(config?.otp_enabled ?? true);
  const [welcomeEnabled, setWelcomeEnabled] = useState(config?.welcome_enabled ?? true);
  const [dailyEnabled, setDailyEnabled] = useState(config?.daily_wallet_enabled ?? false);
  const [weeklyEnabled, setWeeklyEnabled] = useState(config?.weekly_report_enabled ?? false);

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const showMsg = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveEmailConfig({
        method,
        from_name: fromName,
        gmail_user: gmailUser,
        gmail_app_password: gmailPass,
        smtp_host: smtpHost,
        smtp_port: smtpPort ? Number(smtpPort) : undefined,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        otp_enabled: otpEnabled,
        welcome_enabled: welcomeEnabled,
        daily_wallet_enabled: dailyEnabled,
        weekly_report_enabled: weeklyEnabled,
      });
      showMsg(res.ok, res.ok ? "Email config saved." : res.error ?? "Save failed.");
    });
  };

  const handleToggle = (
    flag: "otp_enabled" | "welcome_enabled" | "daily_wallet_enabled" | "weekly_report_enabled",
    setter: (v: boolean) => void,
    value: boolean
  ) => {
    setter(value);
    startTransition(async () => {
      const res = await toggleEmailFlag(flag, value);
      if (!res.ok) {
        setter(!value); // revert on error
        showMsg(false, res.error ?? "Toggle failed.");
      }
    });
  };

  const disabled = config?.migrationPending;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Sending account */}
        <Card title="Sending account">
          {/* Method segment */}
          <div className="segment" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={method === "gmail" ? "on" : ""}
              onClick={() => setMethod("gmail")}
            >
              Google Mail
            </button>
            <button
              type="button"
              className={method === "smtp" ? "on" : ""}
              onClick={() => setMethod("smtp")}
            >
              Custom SMTP
            </button>
          </div>

          {/* From name */}
          <div className="dx-field" style={{ marginBottom: 12 }}>
            <label>From name</label>
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="invoxai"
            />
          </div>

          {method === "gmail" ? (
            <>
              <div className="dx-field" style={{ marginBottom: 12 }}>
                <label>Google account email</label>
                <input
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                  placeholder="noreply@invoxai.io"
                  type="email"
                  autoComplete="off"
                />
              </div>
              <div className="dx-field" style={{ marginBottom: 16 }}>
                <label>App password {config?.has_gmail_pass && <span style={{ color: "var(--green)", fontSize: 11.5, fontWeight: 600 }}>(set)</span>}</label>
                <input
                  value={gmailPass}
                  onChange={(e) => setGmailPass(e.target.value)}
                  placeholder={config?.has_gmail_pass ? "Leave blank to keep existing" : "xxxx xxxx xxxx xxxx"}
                  type="password"
                  autoComplete="new-password"
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10, marginBottom: 12 }}>
                <div className="dx-field">
                  <label>SMTP host</label>
                  <input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.ses.amazonaws.com"
                    autoComplete="off"
                  />
                </div>
                <div className="dx-field">
                  <label>Port</label>
                  <input
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="587"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="dx-field" style={{ marginBottom: 12 }}>
                <label>SMTP username</label>
                <input
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="apikey"
                  autoComplete="off"
                />
              </div>
              <div className="dx-field" style={{ marginBottom: 16 }}>
                <label>SMTP password {config?.has_smtp_pass && <span style={{ color: "var(--green)", fontSize: 11.5, fontWeight: 600 }}>(set)</span>}</label>
                <input
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={config?.has_smtp_pass ? "Leave blank to keep existing" : "••••••••••••"}
                  type="password"
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {msg && (
            <div style={{
              padding: "10px 14px",
              borderRadius: 9,
              marginBottom: 12,
              fontSize: 13,
              fontWeight: 600,
              background: msg.ok ? "var(--greenbg)" : "var(--redbg)",
              color: msg.ok ? "var(--green)" : "var(--red)",
            }}>
              {msg.text}
            </div>
          )}

          <button
            type="button"
            className="btn grad"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleSave}
            disabled={pending || !!disabled}
          >
            {pending ? "Saving…" : "Save & verify"}
          </button>
        </Card>

        {/* Automated email toggles */}
        <Card title="Automated emails">
          {(
            [
              { flag: "otp_enabled" as const, value: otpEnabled, setter: setOtpEnabled, label: "OTP & verification", desc: "Login codes sent on auth" },
              { flag: "welcome_enabled" as const, value: welcomeEnabled, setter: setWelcomeEnabled, label: "Welcome & payment receipts", desc: "New user + plan purchase" },
              { flag: "daily_wallet_enabled" as const, value: dailyEnabled, setter: setDailyEnabled, label: "Daily wallet invoice", desc: "Commission summary · cron 11 PM" },
              { flag: "weekly_report_enabled" as const, value: weeklyEnabled, setter: setWeeklyEnabled, label: "Weekly report", desc: "Platform digest · Monday 9 AM" },
            ] as const
          ).map((row) => (
            <div
              key={row.flag}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 13,
                padding: "13px 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.label}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{row.desc}</div>
              </div>
              <Switch
                on={row.value}
                disabled={!!disabled}
                onChange={(v) => handleToggle(row.flag, row.setter, v)}
              />
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
