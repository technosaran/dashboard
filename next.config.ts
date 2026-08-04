import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.groww.in" },
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "img.logo.dev" },
    ],
  },
  productionBrowserSourceMaps: false,

  serverExternalPackages: ["@react-pdf/renderer"],

  // Static redirect: root → dashboard (no force-dynamic needed)
  redirects: async () => [
    {
      source: "/",
      destination: "/dashboard",
      permanent: false,
    },
  ],

  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },

  // Security headers — consolidated here. All non-cache headers live in
  // the middleware (src/proxy.ts) for dynamic routes. Only cache-control
  // and X-DNS-Prefetch-Control are kept here for static assets.
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
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
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
      ],
    },
    {
      source: "/workbox-:path.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  org: "wealth-os",
  project: "dashboard",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
