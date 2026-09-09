import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ftokvvzgvzkphszgfjbi.supabase.co" },
    ],
    // Скриншоты Справочника с cache-busting версией (?v=<mtime> в Shot).
    // search опущен = разрешена любая query-строка, но только для /help/**.
    localPatterns: [
      { pathname: "/help/**" },
    ],
  },
};

export default nextConfig;