"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { login } from "./actions";
import Link from "next/link";
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
        startLockout(until - Date.now(), until);
      } else {
        localStorage.removeItem("lockoutUntil");
        localStorage.removeItem("failCount");
        failCountRef.current = 0;
      }
    }
  }, [startLockout]);

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
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  const isLockedOut = lockoutSeconds > 0;

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-grid" />
        <div className="login-orb login-orb--1" />
        <div className="login-orb login-orb--2" />
        <div className="login-orb login-orb--3" />
        <div className="login-radial" />
      </div>

      <div className="login-content">
        {/* Logo */}
        <div className="login-logo-group">
          <div className="login-logo-icon">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="login-logo-text">
            <span className="login-logo-name">FinanceOS</span>
            <span className="login-logo-sub">Premium Dashboard</span>
          </div>
        </div>

        {/* Card */}
        <div className="login-card-wrapper">
          <div className="login-card">
            {/* Card top glow */}
            <div className="login-card-glow" />

            <div className="login-card-inner">
              <h1 className="login-title">Welcome back</h1>
              <p className="login-subtitle">
                Sign in to access your financial dashboard
              </p>

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
                  <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                    <Link href="/reset-password" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="login-error animate-fade-in">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* Lockout message */}
                {isLockedOut && (
                  <div className="login-lockout animate-fade-in">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  )}
                  <div className="login-submit-shimmer" />
                </button>

                <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  This is a private site. For access, please mail <a href="mailto:saransci2006@gmail.com" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'bold' }}>saransci2006@gmail.com</a>
                </p>

              </form>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="login-footer">
          Premium financial management, made simple.
        </p>
      </div>
    </div>
  );
}
