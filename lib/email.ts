import "server-only";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Build a mailer from the platform's email_config (admin → Emails). Returns a
 * clear error if sending isn't configured, so callers can stay honest rather
 * than pretend an email went out. Credentials live only on the server.
 */
export type PlatformMailer = {
  from: string;
  /**
   * Send one message. `from` overrides the default sender (used to send AS a
   * domain alias like billing@ / no-reply@ — requires the sending account to be
   * authorised for that alias). `cc` copies admin record addresses; `bcc` fans
   * out to many recipients.
   */
  send: (opts: { from?: string; to?: string; cc?: string[]; bcc?: string[]; subject: string; html: string }) => Promise<void>;
};

export async function getPlatformMailer():
  Promise<{ ok: true; mailer: PlatformMailer } | { ok: false; error: string }> {
  const sb = createAdminClient();
  const { data: cfg, error } = await sb
    .from("email_config")
    .select("method, from_name, gmail_user, gmail_app_password, smtp_host, smtp_port, smtp_user, smtp_pass")
    .maybeSingle();

  if (error || !cfg) {
    return { ok: false, error: "Platform email isn’t configured yet. Ask the admin to set it up in Admin → Emails." };
  }

  const fromName = (cfg.from_name as string) || "invoxai";
  let transport: nodemailer.Transporter;
  let fromAddr: string;

  if (cfg.method === "gmail") {
    if (!cfg.gmail_user || !cfg.gmail_app_password) {
      return { ok: false, error: "Gmail sending isn’t set up. Add the Google account + app password in Admin → Emails." };
    }
    transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: cfg.gmail_user as string, pass: cfg.gmail_app_password as string },
    });
    fromAddr = cfg.gmail_user as string;
  } else {
    if (!cfg.smtp_host || !cfg.smtp_port || !cfg.smtp_user || !cfg.smtp_pass) {
      return { ok: false, error: "SMTP sending isn’t set up. Add host/port/user/password in Admin → Emails." };
    }
    const port = Number(cfg.smtp_port);
    transport = nodemailer.createTransport({
      host: cfg.smtp_host as string,
      port,
      secure: port === 465, // implicit TLS on 465; STARTTLS otherwise
      auth: { user: cfg.smtp_user as string, pass: cfg.smtp_pass as string },
    });
    fromAddr = (cfg.smtp_user as string);
  }

  const from = `"${fromName}" <${fromAddr}>`;
  return {
    ok: true,
    mailer: {
      from,
      send: ({ from: fromOverride, to, cc, bcc, subject, html }) =>
        transport
          .sendMail({ from: fromOverride || from, to: to ?? fromAddr, cc, bcc, subject, html })
          .then(() => undefined),
    },
  };
}

/**
 * Send one HTML message to many recipients via chunked BCC (recipients can't see
 * each other). Returns how many addresses were accepted. Best-effort per chunk —
 * a failing chunk is skipped, not fatal, so a bad address can't sink the batch.
 */
export async function sendBulk(
  mailer: PlatformMailer,
  recipients: string[],
  subject: string,
  html: string,
  from?: string,
  chunkSize = 50,
): Promise<number> {
  let sent = 0;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    try {
      await mailer.send({ from, bcc: chunk, subject, html });
      sent += chunk.length;
    } catch {
      // skip this chunk; keep going
    }
  }
  return sent;
}
