import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#6c5ce7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "FinanceOS — Premium Financial Control",
    template: "%s | FinanceOS"
  },
  description: "Your private wealth dashboard. Track net worth, cash flow, and portfolio performance at a glance.",
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
    title: "FinanceOS — Private Wealth Dashboard",
    description: "Institutional-grade wealth management for elite traders and investors.",
    siteName: "FinanceOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinanceOS — Wealth Refined",
    description: "Track your global financial footprint from a single premium console.",
    creator: "@technosaran",
  },
  manifest: "/manifest.webmanifest?v=2.1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinanceOS",
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
import { Suspense } from "react";
import ProgressBar from "@/components/progress-bar";
import { cn } from "@/lib/utils";
import PwaSecurityManager from "@/components/pwa-security-manager";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "dark", "font-sans", "theme-google")}
    >
      <head />
      <body className="min-h-full flex flex-col overflow-x-hidden bg-[--bg-base] text-[--text-primary] font-sans relative">
        {/* Background Depth Effects */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-5%] left-[-5%] w-[50%] h-[50%] bg-[var(--circle-color-1,rgba(14,165,233,0.15))] blur-[140px] rounded-full animate-pulse-glow" />
          <div className="absolute bottom-[5%] right-[-5%] w-[45%] h-[45%] bg-[var(--circle-color-2,rgba(56,189,248,0.12))] blur-[120px] rounded-full animate-pulse-glow delay-2" />
          <div className="absolute top-[25%] right-[5%] w-[35%] h-[35%] bg-[var(--circle-color-3,rgba(186,230,253,0.15))] blur-[100px] rounded-full animate-pulse-glow delay-5" />
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-multiply pointer-events-none" />
        </div>

        <PwaSecurityManager />

        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: "rgba(18, 18, 18, 0.9)",
              backdropFilter: "blur(16px)",
              color: "var(--text-primary)",
              border: "1.5px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              padding: "16px 28px",
              fontSize: "18px",
              fontWeight: "700",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              maxWidth: "600px",
              textAlign: "center",
              letterSpacing: "0.01em",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#ffffff",
              },
              style: {
                border: "1.5px solid rgba(16, 185, 129, 0.4)",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.15)",
              }
            },
            error: {
              iconTheme: {
                primary: "#f43f5e",
                secondary: "#ffffff",
              },
              style: {
                border: "1.5px solid rgba(244, 63, 94, 0.4)",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 20px rgba(244, 63, 94, 0.15)",
              }
            }
          }}
        />
      </body>
    </html>
  );
}
