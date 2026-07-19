import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "arthaX — Personal Wealth Terminal",
    template: "%s | arthaX"
  },
  description: "arthaX is a personal wealth management terminal to track stocks, mutual funds, expenses, income, budgets, and automate bank transaction alerts with enterprise-grade security.",
  keywords: ["arthaX", "personal finance", "stock tracker", "wealth management", "budgeting", "net worth", "investment dashboard", "mutual funds"],
  authors: [{ name: "TechnoSaran" }],
  creator: "TechnoSaran",
  publisher: "TechnoSaran",
  metadataBase: new URL("https://technosaranfin.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://technosaranfin.vercel.app",
    title: "arthaX — Personal Wealth Terminal",
    description: "Track stocks, mutual funds, expenses, income and automate bank transaction alerts with enterprise-grade security.",
    siteName: "arthaX",
  },
  twitter: {
    card: "summary_large_image",
    title: "arthaX — Personal Wealth Terminal",
    description: "Track your global financial footprint from a single premium console.",
    creator: "@technosaran",
  },
  manifest: "/manifest.webmanifest?v=2.1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "arthaX",
  },
  icons: {
    icon: [
      { url: "/favicon.png?v=2.1", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png?v=2.1", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=2.1", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png?v=2.1", sizes: "192x192", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

import { Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import PwaSecurityManager from "@/components/pwa-security-manager";
import { SkipNavLink } from "@/components/ui/skip-nav";
import { Analytics } from "@vercel/analytics/react";

import { headers } from "next/headers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await headers();

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "dark", "font-sans", "theme-google")}
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-full flex flex-col overflow-x-hidden bg-[--bg-base] text-[--text-primary] font-sans relative">
        <SkipNavLink />
        {/* Optimized Static Background (Removed heavy animated blurs) */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[--bg-base]">
          {/* Subtle static gradient instead of massive animating blurs */}
          <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-[rgba(14,165,233,0.05)] to-transparent" />
        </div>

        <PwaSecurityManager />


        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 4000,
            className: "app-toast",
            success: {
              className: "app-toast app-toast-success",
              iconTheme: {
                primary: "#10b981",
                secondary: "#ffffff",
                },
              },
            error: {
              className: "app-toast app-toast-error",
              iconTheme: {
                primary: "#f43f5e",
                secondary: "#ffffff",
                },
              }
            }}
          />
        <Analytics />
      </body>
    </html>
  );
}
