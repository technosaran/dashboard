import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "logos.hunter.io" },
      { protocol: "https", hostname: "companyenrich.com" },
      { protocol: "https", hostname: "www.google.com", pathname: "/s2/favicons/**" },
      { protocol: "https", hostname: "icons.duckduckgo.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
      { protocol: "https", hostname: "unavatar.io" },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  poweredByHeader: false,
  
  // Build optimizations
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

export default withSentryConfig(nextConfig, {
  org: "wealth-os",
  project: "dashboard",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
