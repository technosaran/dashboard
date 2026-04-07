"use client";

import { useState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Ambient background orbs */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "-20%",
          left: "-10%",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(108,92,231,0.12) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          bottom: "-15%",
          right: "-10%",
          width: "500px",
          height: "500px",
          background: "radial-gradient(circle, rgba(0,206,201,0.08) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          top: "40%",
          right: "20%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(253,121,168,0.06) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />

      <div className="w-full max-w-[400px] relative z-10 animate-scale-in">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse-glow"
            style={{
              background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 50%, #00cec9 100%)",
              boxShadow: "0 4px 25px rgba(108, 92, 231, 0.4)",
            }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight gradient-text">FinanceOS</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
              Premium Dashboard
            </span>
          </div>
        </div>

        {/* Login Card */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: "var(--radius-2xl)",
            padding: "1px",
            background: "linear-gradient(135deg, rgba(108,92,231,0.3), rgba(0,206,201,0.15), rgba(108,92,231,0.1))",
          }}
        >
          <div
            className="relative"
            style={{
              borderRadius: "calc(var(--radius-2xl) - 1px)",
              background: "var(--bg-surface)",
              padding: "36px 32px",
            }}
          >
            {/* Subtle inner glow */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: 0,
                left: 0,
                right: 0,
                height: "120px",
                background: "linear-gradient(180deg, rgba(108,92,231,0.05) 0%, transparent 100%)",
                borderRadius: "calc(var(--radius-2xl) - 1px) calc(var(--radius-2xl) - 1px) 0 0",
              }}
            />

            <div className="relative z-10">
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                Welcome back
              </h1>
              <p
                className="text-sm mt-1.5 mb-7"
                style={{ color: "var(--text-secondary)" }}
              >
                Sign in to access your financial dashboard
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="input-premium"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Password
                  </label>
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="input-premium"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div
                    className="animate-fade-in"
                    style={{
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(255, 71, 87, 0.08)",
                      border: "1px solid rgba(255, 71, 87, 0.2)",
                      color: "#ff6b81",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-2"
                  style={{
                    padding: "12px 20px",
                    fontSize: "0.9375rem",
                    borderRadius: "var(--radius-md)",
                    opacity: loading ? 0.6 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: "var(--text-muted)" }}
        >
          Premium financial management, made simple.
        </p>
      </div>
    </div>
  );
}
