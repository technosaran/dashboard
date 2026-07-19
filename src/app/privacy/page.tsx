"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#03050a] text-gray-200 font-sans selection:bg-cyan-500 selection:text-black py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Navigation Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-10">
          <Link href="/login" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              F
            </div>
            <div>
              <span className="text-lg font-black text-white tracking-tight">FinanceOS</span>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest -mt-0.5">Privacy & Security</span>
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
              Privacy Policy
            </h1>
            <p className="text-xs sm:text-sm text-cyan-400 font-semibold">
              Last Updated: July 19, 2026 • Effective Date: July 19, 2026
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              1. Introduction & Overview
            </h2>
            <p>
              Welcome to <strong className="text-white font-semibold">FinanceOS</strong> (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We respect your privacy and are committed to protecting your personal wealth data, transaction logs, and authentication credentials. This Privacy Policy details how our personal wealth terminal collects, processes, encrypts, and safeguards your information when you use our web application and associated Google OAuth services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              2. Information We Collect
            </h2>
            <p>
              When using FinanceOS, we collect and process the following categories of data:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-300">
              <li>
                <strong className="text-white">Authentication & Identity Data:</strong> When you sign in using Google OAuth or Email/Password, we receive your email address, full name, and profile avatar picture provided by Google authentication servers (`openid`, `email`, `profile` scopes).
              </li>
              <li>
                <strong className="text-white">Financial & Portfolio Records:</strong> Ledger entries, bank account titles, income entries, expense tracking data, mutual fund holdings, stock portfolio orders, bond allocations, and derivative trades that you explicitly input or synchronize into your dashboard.
              </li>
              <li>
                <strong className="text-white">Email & SMS Transaction Alert Sync (`gmail.readonly` scope):</strong> If you explicitly opt-in and authorize automated transaction synchronization, our server extracts read-only bank debit and credit transaction notifications sent to your Gmail inbox from verified banking institutions. We strictly read only transactional alert emails and never access personal correspondence, contacts, or send emails on your behalf.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              3. Google API Services Disclosure
            </h2>
            <p className="bg-cyan-950/20 border border-cyan-500/20 rounded-2xl p-4 text-xs sm:text-sm text-cyan-200">
              FinanceOS&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold hover:text-white"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="text-sm">
              Specifically, data retrieved via Google OAuth (such as your profile address or financial debit alerts) is utilized exclusively to calculate your personal net worth, display your categorized spending, and present analytical reports on your private dashboard. We do not sell, rent, share, or broker your Google account data or financial history with third-party advertisers or data aggregators under any circumstances.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              4. Data Protection & Security Architecture
            </h2>
            <p>
              Your financial records are secured using enterprise-grade security protocols:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-300">
              <li>
                <strong className="text-white">Row-Level Security (RLS):</strong> Every database row in our Supabase infrastructure is strictly isolated to your individual unique User ID. No other tenant, user, or administrator can query or inspect your private ledger.
              </li>
              <li>
                <strong className="text-white">Encryption at Rest & in Transit:</strong> All data transmissions are encrypted via TLS/SSL 1.3, and sensitive database columns are protected by AES-256 encryption at rest.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              5. Your Rights & Data Deletion
            </h2>
            <p className="text-sm">
              You retain absolute ownership and control over your financial records. You may export all your transaction histories, mutual funds, and portfolio reports to CSV/PDF at any time from the Settings dashboard. You may also request permanent deletion of your account and all associated database records by contacting us or invoking the account deletion procedure in the Console Settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white border-l-2 border-cyan-500 pl-3">
              6. Contact Us
            </h2>
            <p className="text-sm">
              If you have any questions, security concerns, or inquiries regarding this Privacy Policy or your Google OAuth consent preferences, please contact our administrative team directly:
            </p>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-gray-400 block uppercase">Developer & Support Contact</span>
                <span className="text-sm font-semibold text-white">saransci2006@gmail.com</span>
              </div>
              <a
                href="mailto:saransci2006@gmail.com?subject=Privacy%20Policy%20Inquiry%20-%20FinanceOS"
                className="text-xs font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 px-4 py-2 rounded-xl transition-colors text-center"
              >
                Send Email Inquiry
              </a>
            </div>
          </section>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8">
          © {new Date().getFullYear()} FinanceOS Wealth Terminal. All rights reserved. •{" "}
          <Link href="/terms" className="hover:text-gray-300 underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
