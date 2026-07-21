"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#03050a] text-gray-200 font-sans selection:bg-cyan-500 selection:text-black py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Navigation Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-10">
          <Link href="/login" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              A
            </div>
            <div>
              <span className="text-lg font-black text-white tracking-tight">arthaX</span>
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest -mt-0.5">Terms of Service</span>
            </div>
          </Link>
          <Link
            href="/login"
            className="text-xs sm:text-sm font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-colors"
          >
            ← Back to Login
          </Link>
        </div>

        {/* Content Box */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-[#06090e]/90 border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl leading-relaxed text-gray-300 space-y-8"
        >
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2">
              Terms of Service
            </h1>
            <p className="text-xs sm:text-sm text-cyan-400 font-semibold">
              Last Updated: July 19, 2026 • Effective Date: July 19, 2026
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              1. Acceptance of Terms
            </h2>
            <p className="text-sm">
              By accessing, registering an account, or using <strong className="text-white font-semibold">arthaX</strong> (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not access or use the application console.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              2. Description of Service & Financial Disclaimer
            </h2>
            <p className="text-sm">
              arthaX is a personal wealth, portfolio tracking, and analytical management tool designed to help you aggregate bank transactions, mutual fund schemes, stock holdings, and budget analytics.
            </p>
            <p className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4 text-xs sm:text-sm text-amber-200">
              <strong className="font-bold block mb-1 uppercase tracking-wide">Not Financial Advice Disclaimer:</strong>
              arthaX is strictly a data visualization, accounting, and portfolio tracking software. We are NOT a registered broker-dealer, investment advisor, tax authority, or financial institution. Nothing displayed on this dashboard constitutes personalized investment advice, a recommendation to buy or sell securities, or legal/tax counsel. You bear full responsibility for your financial decisions and calculations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              3. Account Security & Credentials
            </h2>
            <p className="text-sm">
              You are responsible for maintaining the confidentiality of your login credentials (whether authenticated via Google OAuth or Email/Password) and any activities performed under your user session. You agree to immediately notify us of any unauthorized access to your account. We employ Row-Level Security (RLS) to ensure multi-tenant data privacy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              4. Prohibited Uses
            </h2>
            <p className="text-sm">
              You agree not to use arthaX for any unlawful purposes, including but not limited to money laundering, fraudulent accounting practices, unauthorized scraping of financial institutions, or attempting to compromise or bypass the Row-Level Security infrastructure of our database servers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              5. Limitation of Liability
            </h2>
            <p className="text-sm">
              To the maximum extent permitted by applicable law, arthaX and its developers shall not be held liable for any direct, indirect, incidental, consequential, or trading losses arising out of your use of the service, temporary network downtimes, or discrepancies in third-party API data (e.g., market quotes, mutual fund NAV updates, or bank alert processing).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              6. Contact Information
            </h2>
            <p className="text-sm">
              For any questions or legal inquiries regarding these Terms of Service, reach out to our administrative contact:
            </p>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-gray-400 block uppercase">Legal & Support Email</span>
                <span className="text-sm font-semibold text-white">saransci2006@gmail.com</span>
              </div>
              <a
                href="mailto:saransci2006@gmail.com?subject=Terms%20of%20Service%20Inquiry%20-%20arthaX"
                className="text-xs font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 px-4 py-2 rounded-xl transition-colors text-center"
              >
                Send Inquiry
              </a>
            </div>
          </section>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8">
          © {new Date().getFullYear()} arthaX Wealth Terminal. All rights reserved. •{" "}
          <Link href="/privacy" className="hover:text-gray-300 underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
