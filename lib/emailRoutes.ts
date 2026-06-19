// Canonical platform email addresses (domain aliases) and what each is for.
// Single source of truth: every transactional / notification sender references
// these for the From address and any admin "record copy" recipients, so routing
// lives in ONE place instead of being scattered across features.

const DOMAIN = "invoxai.io";

export const EMAIL_ADDR = {
  info: `info@${DOMAIN}`,
  billing: `billing@${DOMAIN}`,
  admin: `admin@${DOMAIN}`,
  wallet: `wallet@${DOMAIN}`,
  noReply: `no-reply@${DOMAIN}`,
  support: `support@${DOMAIN}`,
  hello: `hello@${DOMAIN}`,
  domains: `domains@${DOMAIN}`,
  adminLog: `adminlog@${DOMAIN}`,
  userLog: `userlog@${DOMAIN}`,
  userPay: `userpay@${DOMAIN}`,
} as const;

export type EmailRoute = { from: string; cc?: string[]; to?: string[] };

// Per email category: the alias it's sent FROM, plus any admin addresses that
// get a record/notification copy (cc) or that are the sole recipient (to, for
// admin-only reports).
export const EMAIL_ROUTES = {
  // Auth (no-reply@)
  otp: { from: EMAIL_ADDR.noReply },
  login_alert: { from: EMAIL_ADDR.noReply },
  password_change: { from: EMAIL_ADDR.noReply },

  // Onboarding (info@; admin gets a copy of the new join)
  welcome: { from: EMAIL_ADDR.info, cc: [EMAIL_ADDR.admin] },
  signup_admin_notify: { from: EMAIL_ADDR.info, to: [EMAIL_ADDR.admin] },

  // Commerce / money
  order_receipt: { from: EMAIL_ADDR.hello, cc: [EMAIL_ADDR.admin] }, // user txn, 1 copy for record
  plan_billing: { from: EMAIL_ADDR.billing, cc: [EMAIL_ADDR.admin] },
  wallet_txn: { from: EMAIL_ADDR.wallet, cc: [EMAIL_ADDR.admin] },
  payment_admin_notify: { from: EMAIL_ADDR.userPay, to: [EMAIL_ADDR.admin] }, // plan & wallet payment alert

  // Platform ops (admin-side inbound)
  domain_notify: { from: EMAIL_ADDR.domains, to: [EMAIL_ADDR.admin] },
  support: { from: EMAIL_ADDR.support },

  // General buyer/seller mail (campaigns etc.)
  general: { from: EMAIL_ADDR.hello },

  // Daily audit reports (admin-side)
  admin_audit_report: { from: EMAIL_ADDR.adminLog, to: [EMAIL_ADDR.adminLog] },
  user_audit_report: { from: EMAIL_ADDR.userLog, to: [EMAIL_ADDR.userLog] },
} as const satisfies Record<string, EmailRoute>;

export type EmailCategory = keyof typeof EMAIL_ROUTES;

// Flat list of every alias + its purpose — drives the admin Test-Mail panel.
export const EMAIL_ALIASES: { address: string; purpose: string }[] = [
  { address: EMAIL_ADDR.info, purpose: "Welcome / new-join (user receives; admin copied)" },
  { address: EMAIL_ADDR.billing, purpose: "Plan & billing emails" },
  { address: EMAIL_ADDR.admin, purpose: "Record copy of user transactions; plan & wallet payment alerts" },
  { address: EMAIL_ADDR.wallet, purpose: "Wallet transaction emails" },
  { address: EMAIL_ADDR.noReply, purpose: "OTP / login alert / password change" },
  { address: EMAIL_ADDR.support, purpose: "Support inbox" },
  { address: EMAIL_ADDR.hello, purpose: "General buyer & seller mail" },
  { address: EMAIL_ADDR.domains, purpose: "Subdomain / custom-domain notifications (admin)" },
  { address: EMAIL_ADDR.adminLog, purpose: "Daily admin audit-log report" },
  { address: EMAIL_ADDR.userLog, purpose: "Daily user audit-log report" },
  { address: EMAIL_ADDR.userPay, purpose: "User payment notifications" },
];
