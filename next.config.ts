import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Seller pages are served from wildcard subdomains + custom domains.
  // Image host allowlist (Supabase Storage) is added when storage rendering lands.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
