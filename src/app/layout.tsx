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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinanceOS",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
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
      className={`${outfit.variable} ${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden bg-[--bg-base] text-[--text-primary] font-sans">
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#131833",
              color: "#f0f2ff",
              border: "1px solid rgba(99, 115, 255, 0.2)",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
              maxWidth: "90vw",
            },
          }}
        />
      </body>
    </html>
  );
}
