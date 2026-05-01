import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const viewport: Viewport = {
  themeColor: "#6c5ce7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "FinanceOS — Premium Financial Control",
    template: "%s | FinanceOS"
  },
  description: "Next-gen personal wealth management console. Securely track accounts, stocks, mutual funds, and net worth with institutional-grade precision.",
  keywords: ["personal finance", "stock tracker", "wealth management", "budgeting", "net worth", "investment dashboard"],
  authors: [{ name: "FinanceOS Team" }],
  creator: "FinanceOS",
  publisher: "TechnoSaran",
  metadataBase: new URL("https://finance-os.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://finance-os.app",
    title: "FinanceOS — Your Financial Command Center",
    description: "Institutional-grade wealth management for elite traders and investors.",
    siteName: "FinanceOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinanceOS — Wealth Refined",
    description: "Track your global financial footprint from a single premium console.",
    creator: "@technosaran",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinanceOS",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

import { Toaster } from "react-hot-toast";
import { Suspense } from "react";
import ProgressBar from "@/components/progress-bar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden bg-[--bg-base] text-[--text-primary] font-sans relative">
        {/* Background Depth Effects */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-5%] left-[-5%] w-[50%] h-[50%] bg-[rgba(14,165,233,0.15)] blur-[140px] rounded-full animate-pulse-glow" />
          <div className="absolute bottom-[5%] right-[-5%] w-[45%] h-[45%] bg-[rgba(56,189,248,0.12)] blur-[120px] rounded-full animate-pulse-glow delay-2" />
          <div className="absolute top-[25%] right-[5%] w-[35%] h-[35%] bg-[rgba(186,230,253,0.15)] blur-[100px] rounded-full animate-pulse-glow delay-5" />
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-multiply pointer-events-none" />
        </div>

        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              maxWidth: "90vw",
            },
          }}
        />
      </body>
    </html>
  );
}
