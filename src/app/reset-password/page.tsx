"use client";

import { useState } from "react";
import { resetPassword } from "./actions";
import "../login/login.css";
import Link from "next/link";
import { motion } from "framer-motion";

export default function ResetPasswordPage() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const result = await resetPassword(new FormData(e.currentTarget));
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setMessage("Check your email for the reset link");
    }
  }

  return (
    <div className="login-page">
      {/* LEFT PANEL: Branding & Innovative Visuals (Desktop only) */}
      <div className="login-brand-panel">
        <div className="login-brand-grid" />
        <div className="login-brand-orb login-brand-orb--1" />
        <div className="login-brand-orb login-brand-orb--2" />
        
        <div className="login-brand-content">
          <div className="login-brand-header">
            <div className="login-logo-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="login-logo-text">
              <span className="login-logo-name !text-white">arthaX</span>
              <span className="login-logo-sub text-white/50">Personal Wealth Terminal</span>
            </div>
          </div>

          <div className="login-brand-visual" style={{ opacity: 0.7 }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="terminal-shell"
            >
              <div className="terminal-header">
                <div className="terminal-dot red" />
                <div className="terminal-dot yellow" />
                <div className="terminal-dot green" />
                <span className="terminal-title">auth_recovery.sh</span>
              </div>
              <div className="terminal-body">
                <p className="text-sky-400 font-bold">$ generate-secure-token --type=reset</p>
                <p className="text-white/60">[2026-07-20 10:45] INIT: Establishing secure tunnel...</p>
                <p className="text-emerald-400 font-semibold">[2026-07-20 10:45] READY: Awaiting email verification</p>
                <div className="terminal-cursor" />
              </div>
            </motion.div>
          </div>

          <div className="login-brand-footer">
            <div className="feature-item">
              <span className="feature-icon">🛡️</span>
              <div>
                <h4 className="feature-title">Bank-Grade Encryption</h4>
                <p className="feature-desc">Your credentials are never stored in plaintext</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Form Container */}
      <div className="login-form-panel">
        <div className="login-form-container">
          
          <div className="login-logo-group mobile-only">
            <div className="login-logo-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="login-logo-text">
              <span className="login-logo-name !text-white text-lg">arthaX</span>
              <span className="login-logo-sub text-white/50 text-[9px] tracking-wider">Console</span>
            </div>
          </div>

          <h1 className="login-title">Reset Password</h1>
          <p className="login-subtitle">
            Enter your email to receive a secure password reset link
          </p>

          {message ? (
            <div className="animate-fade-in" style={{ textAlign: 'center', marginTop: '2rem' }}>
              <div className="login-lockout" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {message}
              </div>
              <Link href="/login" className="login-submit" style={{ marginTop: '2rem', textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
                Return to Login
              </Link>
            </div>
          ) : (
            <form method="post" onSubmit={handleSubmit} className="login-form">
              <div className={`login-field ${focused === "email" ? "login-field--focused" : ""}`}>
                <label className="login-label" htmlFor="reset-email">Email</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <rect x="2" y="4" width="20" height="16" rx="3" />
                      <path d="M22 7l-10 7L2 7" />
                    </svg>
                  </span>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                  />
                </div>
              </div>

              {error && (
                <div className="login-error animate-fade-in">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="login-submit">
                {loading ? (
                  <span className="login-submit-loading">
                    <svg className="login-spinner" fill="none" viewBox="0 0 24 24">
                      <circle className="login-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
                      <path className="login-spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Sending link...
                  </span>
                ) : (
                  <span className="login-submit-inner">Send Reset Link</span>
                )}
              </button>
              
              <Link href="/login" style={{ display: 'block', textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none' }}>
                Back to login
              </Link>
            </form>
          )}
          
          <div className="login-footer flex flex-col items-center gap-1.5 mt-6">
            <span className="text-white/40">arthaX Wealth Dashboard</span>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500">
              <Link href="/privacy" className="hover:text-gray-300 transition-colors underline">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-gray-300 transition-colors underline">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
