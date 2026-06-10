import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "logos.hunter.io" },
      { protocol: "https", hostname: "companyenrich.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "icons.duckduckgo.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
    ],
  },

  // Compression & performance
  compress: true,
  poweredByHeader: false,
  
  // Build optimizations
  productionBrowserSourceMaps: false,

  // Static redirect: root → dashboard (no force-dynamic needed)
  redirects: async () => [
    {
      source: "/",
      destination: "/dashboard",
      permanent: false,
    },
  ],

  // Security headers
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=(self)",
        },
      ],
    },
    {
      // Cache static assets aggressively
      source: "/icon-:path.png",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/favicon.png",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/noise.svg",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/manifest.webmanifest",
      headers: [
        { key: "Cache-Control", value: "public, max-age=86400" },
      ],
    },
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0" },
      ],
    },
    {
      source: "/workbox-:path.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0" },
      ],
    },
  ],
};

export default nextConfig;
