"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { login } from "./actions";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { motion } from "framer-motion";
import "./login.css";

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15000; // 15 seconds initial lockout

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const failCountRef = useRef(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLockout = useCallback((durationMs: number, customUntil?: number) => {
    const until = customUntil || (Date.now() + durationMs);
    setLockoutUntil(until);
    setLockoutSeconds(Math.ceil((until - Date.now()) / 1000));

    if (!customUntil) {
      localStorage.setItem("lockoutUntil", until.toString());
    }

    if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
    lockoutTimerRef.current = setInterval(() => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutSeconds(0);
        localStorage.removeItem("lockoutUntil");
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
      } else {
        setLockoutSeconds(remaining);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    const savedUntil = localStorage.getItem("lockoutUntil");
    const savedFails = localStorage.getItem("failCount");
    
    if (savedFails) {
      failCountRef.current = parseInt(savedFails, 10);
    }
    
    if (savedUntil) {
      const until = parseInt(savedUntil, 10);
      if (until > Date.now()) {
        setTimeout(() => {
          startLockout(until - Date.now(), until);
        }, 0);
      } else {
        localStorage.removeItem("lockoutUntil");
        localStorage.removeItem("failCount");
        failCountRef.current = 0;
      }
    }
  }, [startLockout]);

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message || "Failed to sign in with Google.");
        setLoading(false);
      }
    } catch {
      setError("An unexpected error occurred during Google sign-in.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) return;

    setError("");
    setLoading(true);
    
    try {
      const result = await login(new FormData(e.currentTarget));
      if (result?.error) {
        failCountRef.current += 1;
        localStorage.setItem("failCount", failCountRef.current.toString());
        setError(result.error);
        setLoading(false);

        // Progressive lockout after MAX_ATTEMPTS failures
        if (failCountRef.current >= MAX_ATTEMPTS) {
          const multiplier = Math.pow(2, failCountRef.current - MAX_ATTEMPTS);
          startLockout(LOCKOUT_DURATION_MS * multiplier);
        }
      } else {
        // Reset on success
        failCountRef.current = 0;
        localStorage.removeItem("failCount");
        localStorage.removeItem("lockoutUntil");
        window.location.href = "/dashboard";
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  const isLockedOut = lockoutSeconds > 0;

  return (
    <div className="login-page">
      
      {/* LEFT PANEL: Branding & Innovative Visuals (Desktop only) */}
      <div className="login-brand-panel">
        <div className="login-brand-grid" />
        <div className="login-brand-orb login-brand-orb--1" />
        <div className="login-brand-orb login-brand-orb--2" />
        
        <div className="login-brand-content">
          {/* Logo Group */}
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

          {/* Interactive terminal and visualization elements */}
          <div className="login-brand-visual">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="terminal-shell"
            >
              <div className="terminal-header">
                <div className="terminal-dot red" />
                <div className="terminal-dot yellow" />
                <div className="terminal-dot green" />
                <span className="terminal-title">live_ledger_feed.sh</span>
              </div>
              <div className="terminal-body">
                <p className="text-sky-400 font-bold">$ tail -f /var/log/finance_ledger</p>
                <p className="text-white/60">[2026-07-16 19:05] ACCOUNT_INIT: cash_vault_usd +$48,500</p>
                <p className="text-white/60">[2026-07-16 19:06] STOCK_TRADE: BUY AAPL 50 shares @ $189.20</p>
                <p className="text-cyan-400 font-semibold">[2026-07-16 19:07] NET_WORTH_CALC: INR 4,850,210 (base: USD)</p>
                <p className="text-emerald-400 font-semibold">[2026-07-16 19:08] RLS_ENFORCED: policy_select_accounts SUCCESS</p>
                <div className="terminal-cursor" />
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="visual-chart-card"
            >
              <span className="text-[10px] font-bold text-white/40 tracking-wider">PORTFOLIO YIELD</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-400">+12.4%</span>
                <span className="text-[10px] text-emerald-400/80">▲ Year-over-Year</span>
              </div>
              <svg className="w-full h-12 mt-4 text-emerald-400/30" viewBox="0 0 100 30" preserveAspectRatio="none">
                <path d="M0,25 Q15,10 30,18 T60,8 T90,3 T100,5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <path d="M0,25 Q15,10 30,18 T60,8 T90,3 T100,5 L100,30 L0,30 Z" fill="url(#chartGlow)" />
                <defs>
                  <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </div>

          {/* Footer Features */}
          <div className="login-brand-footer">
            <div className="feature-item">
              <span className="feature-icon">🛡️</span>
              <div>
                <h4 className="feature-title">Row-Level Security</h4>
                <p className="feature-desc">Encrypted single-tenant isolation</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <div>
                <h4 className="feature-title">Realtime PubSub</h4>
                <p className="feature-desc">Supabase transaction streaming</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Form Container */}
      <div className="login-form-panel">
        <div className="login-form-container">
          
          {/* Logo only visible on mobile (small screen flow) */}
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

          <h1 className="login-title">Welcome to arthaX</h1>
          <p className="login-subtitle">
            Your personal wealth management terminal — track stocks, mutual funds, expenses, income, and automate bank transaction alerts with enterprise-grade security.
          </p>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || isLockedOut}
            className="login-google-btn"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="login-divider">
            <span className="login-divider-line" />
            <span className="login-divider-text">OR SIGN IN WITH EMAIL</span>
            <span className="login-divider-line" />
          </div>

          <form method="post" onSubmit={handleSubmit} className="login-form">
            {/* Email field */}
            <div className={`login-field ${focused === "email" ? "login-field--focused" : ""}`}>
              <label className="login-label" htmlFor="login-email">
                Email
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="2" y="4" width="20" height="16" rx="3" />
                    <path d="M22 7l-10 7L2 7" />
                  </svg>
                </span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isLockedOut}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                />
              </div>
            </div>

            {/* Password field */}
            <div className={`login-field ${focused === "password" ? "login-field--focused" : ""}`}>
              <label className="login-label" htmlFor="login-password">
                Password
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="3" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                    <circle cx="12" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isLockedOut}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                />
              </div>
              <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
                <Link href="/reset-password" style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="login-error animate-fade-in">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </div>
            )}

            {/* Lockout message */}
            {isLockedOut && (
              <div className="login-lockout animate-fade-in">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Too many failed attempts. Try again in {lockoutSeconds}s
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || isLockedOut}
              className="login-submit"
              style={{
                opacity: (loading || isLockedOut) ? 0.65 : 1,
                cursor: (loading || isLockedOut) ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <span className="login-submit-loading">
                  <svg className="login-spinner" fill="none" viewBox="0 0 24 24">
                    <circle className="login-spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
                    <path className="login-spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                <span className="login-submit-inner">
                  Sign in
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              )}
              <div className="login-submit-shimmer" />
            </button>

            {/* Private Banner */}
            <div className="login-private-banner">
              <div className="login-private-badge">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span>Private Console</span>
              </div>
              <p className="login-private-text">
                This is an invite-only financial dashboard. Request credentials to gain access.
              </p>
              <a href="mailto:saransci2006@gmail.com?subject=Access%20Request%20-%20Finance%20Dashboard" className="login-private-link">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                Request Access
              </a>
            </div>

          </form>

          {/* Footer */}
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
