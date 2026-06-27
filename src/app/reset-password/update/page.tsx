"use client";

import { useState } from "react";
import { updatePassword } from "../actions";
import "../../login/login.css";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await updatePassword(new FormData(e.currentTarget));
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/login?message=Password updated successfully");
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
              <rect x="3" y="11" width="18" height="11" rx="3" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <div className="login-logo-text">
            <span className="login-logo-name">Dashboard</span>
            <span className="login-logo-sub">Security</span>
          </div>
        </div>

        <div className="login-card-wrapper">
          <div className="login-card">
            <div className="login-card-glow" />
            <div className="login-card-inner">
              <h1 className="login-title">New Password</h1>
              <p className="login-subtitle">
                Enter your new secure password below
              </p>

              <form method="post" onSubmit={handleSubmit} className="login-form">
                <div className={`login-field ${focused === "password" ? "login-field--focused" : ""}`}>
                  <label className="login-label" htmlFor="update-password">New Password</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="3" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    </span>
                    <input
                      id="update-password"
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
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
