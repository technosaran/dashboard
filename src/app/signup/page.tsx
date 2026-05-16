"use client";

import { useState } from "react";
import { signup } from "./actions";
import "../login/login.css";
import Link from "next/link";

export default function SignupPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signup(new FormData(e.currentTarget));
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-grid" />
        <div className="login-orb login-orb--1" />
        <div className="login-orb login-orb--2" />
        <div className="login-orb login-orb--3" />
        <div className="login-radial" />
      </div>

      <div className="login-content">
        <div className="login-logo-group">
          <div className="login-logo-icon">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="login-logo-text">
            <span className="login-logo-name">FinanceOS</span>
            <span className="login-logo-sub">Create Account</span>
          </div>
        </div>

        <div className="login-card-wrapper">
          <div className="login-card">
            <div className="login-card-glow" />
            <div className="login-card-inner">
              <h1 className="login-title">Join FinanceOS</h1>
              <p className="login-subtitle">
                Institutional-grade wealth management for everyone
              </p>

              <form onSubmit={handleSubmit} className="login-form">
                <div className={`login-field ${focused === "username" ? "login-field--focused" : ""}`}>
                  <label className="login-label" htmlFor="signup-username">Username</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      id="signup-username"
                      name="username"
                      type="text"
                      required
                      placeholder="Your name"
                      onFocus={() => setFocused("username")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                </div>

                <div className={`login-field ${focused === "email" ? "login-field--focused" : ""}`}>
                  <label className="login-label" htmlFor="signup-email">Email</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <rect x="2" y="4" width="20" height="16" rx="3" />
                        <path d="M22 7l-10 7L2 7" />
                      </svg>
                    </span>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                </div>

                <div className={`login-field ${focused === "password" ? "login-field--focused" : ""}`}>
                  <label className="login-label" htmlFor="signup-password">Password</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="3" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                        <circle cx="12" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
                      </svg>
                    </span>
                    <input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      placeholder="••••••••"
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                </div>

                {error && <div className="login-error animate-fade-in">{error}</div>}

                <button type="submit" disabled={loading} className="login-submit">
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </form>

              <div className="divider-glow" style={{ margin: '2rem 0' }} />
              
              <p className="login-subtitle" style={{ fontSize: '13px' }}>
                Already have an account? <Link href="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
