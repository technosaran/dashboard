import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "logos.hunter.io" },
      { protocol: "https", hostname: "companyenrich.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "icons.duckduckgo.com" },
    ],
  },
};

export default nextConfig;
