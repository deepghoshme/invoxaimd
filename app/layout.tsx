import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { getPlatformSettings } from "@/lib/sites";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Dynamic so the admin-configured platform name + favicon (Admin → Branding)
// take effect across the app. Seller storefronts override icons/title in their
// own generateMetadata, so this only governs the platform surfaces.
export async function generateMetadata(): Promise<Metadata> {
  const { platform_name, favicon_url } = await getPlatformSettings();
  const name = platform_name || "invoxai.io";
  return {
    title: {
      default: `${name} — build pages, stores, courses & communities`,
      template: `%s · ${name}`,
    },
    description:
      "All-in-one creator & business platform. Build SEO-friendly pages, stores, courses, bookings and paid communities on your own subdomain or custom domain.",
    icons: favicon_url
      ? { icon: favicon_url, shortcut: favicon_url, apple: favicon_url }
      : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('invox-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
