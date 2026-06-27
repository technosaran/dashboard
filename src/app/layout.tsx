import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Premium Financial Control",
    template: "%s | Portfolio"
  },
  description: "Your private wealth dashboard. Track net worth, cash flow, and portfolio performance at a glance.",
  keywords: ["personal finance", "stock tracker", "wealth management", "budgeting", "net worth", "investment dashboard"],
  authors: [{ name: "Wealth Team" }],
  creator: "TechnoSaran",
  publisher: "TechnoSaran",
  metadataBase: new URL("https://finance-os.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://finance-os.app",
    title: "Private Wealth Dashboard",
    description: "Institutional-grade wealth management for elite traders and investors.",
    siteName: "Portfolio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wealth Refined",
    description: "Track your global financial footprint from a single premium console.",
    creator: "@technosaran",
  },
  manifest: "/manifest.webmanifest?v=2.1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Portfolio",
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
      </body>
    </html>
  );
}
