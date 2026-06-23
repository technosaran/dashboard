"use client";

import { useState } from "react";
import { resetPassword } from "./actions";
import "../login/login.css";
import Link from "next/link";

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
            <span className="login-logo-sub">Security</span>
          </div>
        </div>

        <div className="login-card-wrapper">
          <div className="login-card">
            <div className="login-card-glow" />
            <div className="login-card-inner">
              <h1 className="login-title">Reset Password</h1>
              <p className="login-subtitle">
                Enter your email to receive a password reset link
              </p>

              {message ? (
                <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                  <div className="login-lockout" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    {message}
                  </div>
                  <Link href="/login" className="login-submit" style={{ marginTop: '2rem', textDecoration: 'none' }}>
                    Return to login
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

                  {error && <div className="login-error animate-fade-in">{error}</div>}

                  <button type="submit" disabled={loading} className="login-submit">
                    {loading ? "Sending link..." : "Send Reset Link"}
                  </button>
                  
                  <Link href="/login" style={{ display: 'block', textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none' }}>
                    Back to login
                  </Link>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
