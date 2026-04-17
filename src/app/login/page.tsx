"use client";

import { useState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(new FormData(e.currentTarget));
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

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

              <form onSubmit={handleSubmit} className="login-form">
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
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                    />
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

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="login-submit"
                  style={{
                    opacity: loading ? 0.65 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
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
              </form>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="login-footer">
          Premium financial management, made simple.
        </p>
      </div>

      <style>{`
        /* ── Login Page Scoped Styles ──────────────────── */

        .login-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          overflow: hidden;
          background: var(--bg-base);
          font-family: var(--font-inter), sans-serif;
        }

        /* ── Animated Background ────────────────────────── */

        .login-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 80%);
        }

        .login-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          will-change: transform;
        }

        .login-orb--1 {
          width: 500px;
          height: 500px;
          top: -15%;
          left: -8%;
          background: radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, transparent 70%);
          animation: loginOrbFloat1 12s ease-in-out infinite;
        }

        .login-orb--2 {
          width: 400px;
          height: 400px;
          bottom: -10%;
          right: -8%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%);
          animation: loginOrbFloat2 15s ease-in-out infinite;
        }

        .login-orb--3 {
          width: 300px;
          height: 300px;
          top: 50%;
          left: 60%;
          background: radial-gradient(circle, rgba(186, 230, 253, 0.08) 0%, transparent 70%);
          animation: loginOrbFloat3 18s ease-in-out infinite;
        }

        .login-radial {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 70% at 50% 40%, rgba(14, 165, 233, 0.04) 0%, transparent 70%);
        }

        @keyframes loginOrbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, 25px) scale(1.05); }
          66% { transform: translate(-15px, 10px) scale(0.97); }
        }

        @keyframes loginOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, -20px) scale(1.03); }
          66% { transform: translate(20px, -10px) scale(0.98); }
        }

        @keyframes loginOrbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, -25px) scale(1.08); }
        }

        /* ── Content ────────────────────────────────────── */

        .login-content {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          animation: loginEnter 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes loginEnter {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* ── Logo ───────────────────────────────────────── */

        .login-logo-group {
          display: flex;
          align-items: center;
          gap: 14px;
          justify-content: center;
          margin-bottom: 40px;
        }

        .login-logo-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-primary);
          box-shadow:
            0 6px 20px rgba(14, 165, 233, 0.2),
            0 0 0 1px rgba(14, 165, 233, 0.1);
          color: white;
          animation: loginLogoPulse 4s ease-in-out infinite;
        }

        @keyframes loginLogoPulse {
          0%, 100% { box-shadow: 0 6px 20px rgba(14, 165, 233, 0.15), 0 0 0 1px rgba(14, 165, 233, 0.1); }
          50% { box-shadow: 0 6px 30px rgba(14, 165, 233, 0.3), 0 0 0 1px rgba(14, 165, 233, 0.2); }
        }

        .login-logo-text {
          display: flex;
          flex-direction: column;
        }

        .login-logo-name {
          font-family: var(--font-outfit), sans-serif;
          font-size: 1.35rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: var(--accent-primary);
        }

        .login-logo-sub {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--text-muted);
          margin-top: 1px;
        }

        /* ── Card ────────────────────────────────────────── */

        .login-card-wrapper {
          position: relative;
          border-radius: 28px;
          padding: 1px;
          background: var(--border-strong);
          box-shadow: var(--shadow-lg);
        }

        .login-card {
          position: relative;
          border-radius: 27px;
          background: var(--bg-surface);
          overflow: hidden;
        }

        .login-card-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 140px;
          background: linear-gradient(
            180deg,
            rgba(14, 165, 233, 0.05) 0%,
            transparent 100%
          );
          pointer-events: none;
        }

        .login-card-inner {
          position: relative;
          z-index: 1;
          padding: 40px 36px 36px;
        }

        @media (max-width: 480px) {
          .login-card-inner {
            padding: 32px 24px 28px;
          }
        }

        /* ── Typography ─────────────────────────────────── */

        .login-title {
          font-family: var(--font-outfit), sans-serif;
          font-size: 1.75rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          color: var(--text-primary);
          line-height: 1.1;
        }

        .login-subtitle {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-top: 8px;
          margin-bottom: 32px;
          line-height: 1.5;
        }

        /* ── Form ────────────────────────────────────────── */

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        /* ── Field ───────────────────────────────────────── */

        .login-field {
          position: relative;
        }

        .login-label {
          display: block;
          font-size: 0.725rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin-bottom: 8px;
          margin-left: 2px;
          transition: color 0.3s ease;
        }

        .login-field--focused .login-label {
          color: var(--accent-primary);
        }

        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .login-input-icon {
          position: absolute;
          left: 16px;
          display: flex;
          align-items: center;
          color: var(--text-muted);
          transition: color 0.3s ease;
          z-index: 2;
          pointer-events: none;
        }

        .login-field--focused .login-input-icon {
          color: var(--accent-primary);
        }

        .login-input-wrap input {
          width: 100%;
          height: 52px;
          padding: 0 18px 0 48px;
          border-radius: 14px;
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-family: var(--font-inter), sans-serif;
          font-size: 0.9375rem !important;
          font-weight: 600;
          outline: none;
          transition: all 0.2s ease;
        }

        .login-input-wrap input::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
          font-weight: 500;
        }

        .login-input-wrap input:focus {
          border-color: var(--accent-primary);
          background: var(--bg-surface);
          box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.08);
        }

        /* ── Error ───────────────────────────────────────── */

        .login-error {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.1);
          color: var(--danger);
          font-size: 0.8125rem;
          font-weight: 600;
          line-height: 1.4;
        }

        .login-error svg {
          flex-shrink: 0;
        }

        /* ── Submit Button ───────────────────────────────── */

        .login-submit {
          position: relative;
          width: 100%;
          height: 54px;
          margin-top: 4px;
          border: none;
          border-radius: 15px;
          background: var(--gradient-primary);
          color: white;
          font-size: 0.9375rem;
          font-weight: 800;
          letter-spacing: 0.01em;
          text-transform: uppercase;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 6px 20px rgba(14, 165, 233, 0.25);
        }

        .login-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(14, 165, 233, 0.4);
        }

        .login-submit:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }

        .login-submit-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          position: relative;
          z-index: 1;
        }

        .login-submit-inner svg {
          transition: transform 0.3s ease;
        }

        .login-submit:hover:not(:disabled) .login-submit-inner svg {
          transform: translateX(4px);
        }

        .login-submit-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 35%,
            rgba(255, 255, 255, 0.2) 45%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0.2) 55%,
            transparent 65%
          );
          background-size: 250% 100%;
          animation: loginShimmer 4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes loginShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Loading Spinner ──────────────────────────────── */

        .login-submit-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          position: relative;
          z-index: 1;
        }

        .login-spinner {
          width: 18px;
          height: 18px;
          animation: spin 0.75s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-spinner-track {
          opacity: 0.2;
        }

        .login-spinner-head {
          opacity: 0.9;
        }

        /* ── Footer ──────────────────────────────────────── */

        .login-footer {
          text-align: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 28px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
