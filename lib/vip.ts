/** VIP Community content shape stored in pages.content JSONB. */
export type VipPlan = {
  id: string;           // 'monthly' | 'yearly' | 'lifetime'
  name: string;         // display label, e.g. "Monthly"
  price: number;        // in major currency units (e.g. 499 for ₹499)
  interval: string;     // "/month" | "/year" | "one-time"
  saveBadge?: string;   // e.g. "Save 17%", "Best value"
};

export type VipPerk = {
  icon: string;         // emoji
  title: string;
  desc: string;
};

export type VipPreviewMsg = {
  text: string;
};

export type VipContent = {
  // Channel identity
  title?: string;
  description?: string;
  crestEmoji?: string;   // the big centered emoji, default "⭐"
  host?: string;
  hostTitle?: string;    // e.g. "Grammy-nominated engineer"
  hostAvatarUrl?: string;

  // Perks
  perks?: VipPerk[];

  // Plans
  plans?: VipPlan[];
  currency?: string;     // "INR" | "USD" etc., default "INR"

  // Locked preview content (blurred feed)
  previewMessages?: VipPreviewMsg[];

  // Invite
  platform?: string;     // "telegram" | "discord" | "whatsapp" | "other"
  inviteLink?: string;   // the real invite link (shown post-payment)

  // Theme
  theme?: "dark" | "light";

  // SEO
  seoTitle?: string;
  seoDescription?: string;
};

export const DEFAULT_VIP_CONTENT: VipContent = {
  title: "My VIP Community",
  description: "A private community for serious creators — exclusive content, live sessions, and a room full of people leveling up with you.",
  crestEmoji: "⭐",
  host: "Your Name",
  hostTitle: "Founder",
  currency: "INR",
  perks: [
    { icon: "🎙️", title: "Weekly live sessions", desc: "Join live sessions and get direct access to the host." },
    { icon: "💬", title: "Private community", desc: "Post, share, and collaborate with other members." },
    { icon: "📦", title: "Members-only content", desc: "Exclusive files, resources, and packs every month." },
    { icon: "🤝", title: "Collab opportunities", desc: "Find collaborators and grow your network." },
  ],
  plans: [
    { id: "monthly", name: "Monthly", price: 499, interval: "/month" },
    { id: "yearly", name: "Yearly", price: 4990, interval: "/year", saveBadge: "Save 17%" },
    { id: "lifetime", name: "Lifetime", price: 9999, interval: "one-time", saveBadge: "Best value" },
  ],
  previewMessages: [
    { text: "New pack dropped — check #downloads for the latest files!" },
    { text: "Live session starts in 1 hour — bring your questions!" },
    { text: "Anyone free for a collab this weekend?" },
  ],
  platform: "telegram",
  inviteLink: "",
  theme: "dark",
};

/** Currency formatting helper. */
export function formatVipPrice(amount: number, currency = "INR"): string {
  if (currency === "INR") return "₹" + amount.toLocaleString("en-IN");
  if (currency === "USD") return "$" + amount.toFixed(2);
  return `${currency} ${amount}`;
}

/** Convert a plan's major-unit price to minor units (paise / cents). */
export function planToMinorUnits(plan: VipPlan, currency = "INR"): number {
  // Most currencies use ×100 minor units
  return Math.round(plan.price * 100);
}
