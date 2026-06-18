import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import MarketingLanding from "./MarketingLanding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "invoxai.io — Sell anything on your own domain. Keep more of every sale.",
  description:
    "Build stores, courses, bookings, paid communities and link-in-bio pages on your subdomain or custom domain. Add Meta & Google pixels with no code. SEO-ready and ad-ready from day one.",
  openGraph: {
    title: "invoxai.io — Sell anything on your own domain",
    description:
      "All-in-one creator & commerce platform. India-first, built for the world. 10 page types, 5 payment gateways, no-code ad pixels, server-rendered SEO.",
    url: "https://invoxai.io",
    siteName: "invoxai.io",
    type: "website",
    images: [
      {
        url: "https://invoxai.io/og-home.png",
        width: 1200,
        height: 630,
        alt: "invoxai — sell anything on your own domain",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "invoxai.io — Sell anything on your own domain",
    description: "All-in-one creator & commerce platform. India-first.",
    images: ["https://invoxai.io/og-home.png"],
  },
  alternates: { canonical: "https://invoxai.io" },
  keywords: [
    "creator platform india",
    "sell digital products india",
    "link in bio store",
    "online store builder india",
    "razorpay store",
    "course platform india",
    "invoxai",
  ],
};

/**
 * Root router by host:
 *  - app.invoxai.io   → seller dashboard
 *  - admin.invoxai.io → admin panel
 *  - everything else  → marketing landing (invoxai.io)
 *
 * Maintenance mode is enforced centrally in middleware.ts before this page is
 * reached, so no check is needed here.
 */
export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  const sub = host.split(":")[0].split(".")[0];

  if (sub === "app") redirect("/dashboard");
  if (sub === "admin") redirect("/admin");

  return <MarketingLanding />;
}
