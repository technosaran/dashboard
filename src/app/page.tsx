"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        window.location.href = "/dashboard";
      } else {
        setIsAuthenticated(false);
      }
    });
  }, []);

  // Show nothing while checking auth (will redirect if logged in)
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#03050a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#03050a] text-gray-200 font-sans selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-cyan-500/8 via-indigo-500/5 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-gradient-to-tl from-purple-500/5 via-transparent to-transparent blur-[100px] pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-20 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-cyan-500/20">
            A
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-tight">arthaX</span>
            <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] -mt-0.5">Wealth Terminal</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/privacy"
            className="text-xs font-semibold text-gray-500 hover:text-gray-300 transition-colors hidden sm:inline"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-xs font-semibold text-gray-500 hover:text-gray-300 transition-colors hidden sm:inline"
          >
            Terms
          </Link>
          <Link
            href="/login"
            className="text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:-translate-y-0.5"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-8 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            PERSONAL WEALTH MANAGEMENT TERMINAL
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1] mb-6">
            Track Your Wealth
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              With arthaX
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            arthaX is a comprehensive personal finance dashboard that helps you track stocks, mutual funds, expenses, income, budgets, and automate bank transaction alerts — all secured with enterprise-grade Row-Level Security and end-to-end encryption.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link
              href="/login"
              className="text-base font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-8 py-3.5 rounded-2xl transition-all shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:-translate-y-0.5 flex items-center gap-2"
            >
              Get Started
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/privacy"
              className="text-sm font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-2xl transition-colors"
            >
              Privacy & Security →
            </Link>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto"
        >
          {[
            {
              icon: "📈",
              title: "Stock Portfolio Tracking",
              desc: "Monitor your equity holdings, track real-time prices, and analyze portfolio performance with live market data.",
            },
            {
              icon: "🏦",
              title: "Mutual Fund Analytics",
              desc: "Track mutual fund NAVs, XIRR returns, scheme-wise holdings, and AMC-branded fund visualization.",
            },
            {
              icon: "💰",
              title: "Expense & Income Tracking",
              desc: "Categorize and analyze spending patterns, income sources, and monthly cash flow with detailed breakdowns.",
            },
            {
              icon: "🤖",
              title: "Automated Transaction Sync",
              desc: "Auto-detect bank debit and credit alerts from Gmail and SMS to eliminate manual data entry.",
            },
            {
              icon: "📊",
              title: "Budget & Goals Management",
              desc: "Set monthly budgets, financial goals, and track progress with visual indicators and alerts.",
            },
            {
              icon: "🛡️",
              title: "Enterprise-Grade Security",
              desc: "Row-Level Security (RLS) isolation, AES-256 encryption at rest, TLS 1.3 in transit, and Google OAuth 2.0.",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="bg-[#06090e]/80 border border-white/[0.06] rounded-2xl p-6 hover:border-cyan-500/20 transition-all hover:bg-[#080c14] group"
            >
              <span className="text-2xl mb-3 block">{feature.icon}</span>
              <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Tech Stack Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.25em] mb-4">Built With</p>
          <div className="flex items-center justify-center gap-6 flex-wrap text-xs font-semibold text-gray-500">
            <span>Next.js</span>
            <span className="text-gray-700">•</span>
            <span>Supabase</span>
            <span className="text-gray-700">•</span>
            <span>TypeScript</span>
            <span className="text-gray-700">•</span>
            <span>Google OAuth 2.0</span>
            <span className="text-gray-700">•</span>
            <span>Vercel</span>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} arthaX by TechnoSaran. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-gray-300 transition-colors underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors underline">Terms of Service</Link>
            <a href="mailto:saransci2006@gmail.com" className="hover:text-gray-300 transition-colors underline">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
