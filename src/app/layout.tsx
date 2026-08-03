import type { Metadata, Viewport } from "next";
import { Outfit, DM_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "arthaX",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  verification: {
    google: "SkukBAPEh1pI8zCu3LY6HPF2orVLqHVXBRYkLDtiPD8",
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
      className={cn("h-full", "antialiased", "dark", outfit.variable, dmSans.variable, jetbrainsMono.variable, newsreader.variable)}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="preconnect" href="https://www.google.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.google.com" />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden bg-[--bg-base] text-[--text-primary] font-sans relative selection:bg-amber-500/20 selection:text-amber-200">
        <SkipNavLink />
        {/* Subtle static gradient background */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[--bg-base]">
          <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[rgba(212,175,55,0.03)] via-transparent to-transparent" />
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

