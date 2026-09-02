import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ftokvvzgvzkphszgfjbi.supabase.co" },
    ],
  },
};

export default nextConfig;