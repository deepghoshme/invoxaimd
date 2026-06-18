const SP: Record<string, string> = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r=".6" fill="currentColor" stroke="none"/>',
  youtube: '<rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M10.5 9.3l4.5 2.7-4.5 2.7z"/>',
  x: '<path d="M4 4l7 8.5M20 4l-7 8.5M4 20l7-8.5M20 20l-7-8.5"/>',
  facebook: '<path d="M15 6h-2a2.2 2.2 0 0 0-2.2 2.2V11M8.5 11h6M11.5 11v8"/>',
  tiktok: '<path d="M14 4v10a3.2 3.2 0 1 1-3.2-3.2"/><path d="M14 6.5a4.5 4.5 0 0 0 4.5 3.2"/>',
  whatsapp: '<path d="M3.2 20.8l1.5-4A8 8 0 1 1 8 19.5z"/><path d="M8.6 9.3c.4 1.9 1.9 3.4 3.8 3.9l1.1-1 2 .8-.4 1.9c-2.9.5-6.2-2-7-4.9z"/>',
  telegram: '<path d="M21 4.5L3.2 11.2l5 1.8M21 4.5L17 19l-5-4.5M8.2 13l1 5.5L12 14.5"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10.5V17M7 7.2v.01M11 17v-3.8a2 2 0 0 1 4 0V17M11 10.5V17"/>',
  pinterest: '<circle cx="12" cy="12" r="9"/><path d="M9.5 18l1.6-6.5a2.6 2.6 0 1 1 3 2.1"/>',
  snapchat: '<path d="M12 3.5c2.4 0 3.8 1.8 3.8 4.4 0 1.5.4 2.4 1.9 2.9-.9.9-1.9 1-1.9 1.9 1.4.5 2.8 1 2.8 1-1.9 1.9-3.8 1.4-4.8 2.9-.9-.5-1.9-.5-2.8 0-1-1.5-2.9-1-4.8-2.9 0 0 1.4-.5 2.8-1 0-.9-1-1-1.9-1.9 1.5-.5 1.9-1.4 1.9-2.9C8.2 5.3 9.6 3.5 12 3.5z"/>',
  github: '<path d="M9 19c-4 1.3-4-2-6-2m12 4v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2S16.3 2.3 14 3.9a11.5 11.5 0 0 0-6 0C5.7 2.3 4.7 2.6 4.7 2.6a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.3 9c0 4.6 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
};

export const SOCIALS: [string, string][] = [
  ["instagram", "Instagram"], ["youtube", "YouTube"], ["x", "X / Twitter"], ["facebook", "Facebook"],
  ["tiktok", "TikTok"], ["whatsapp", "WhatsApp"], ["telegram", "Telegram"], ["linkedin", "LinkedIn"],
  ["pinterest", "Pinterest"], ["snapchat", "Snapchat"], ["github", "GitHub"], ["email", "Email"], ["website", "Website"],
];

export default function SocialIcon({ platform, size = 18 }: { platform: string; size?: number }) {
  const p = SP[platform];
  if (!p) return <span style={{ fontSize: 11, fontWeight: 700 }}>{platform.slice(0, 2).toUpperCase()}</span>;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />
  );
}
