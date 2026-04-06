"use client";

import { useState } from "react";
import { login } from "./actions";

const highlights = [
  "Track the full shape of your balances in one calm workspace.",
  "Move money between accounts without leaving the dashboard.",
  "Keep the interface personal with live account sync and local profile settings.",
];

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(new FormData(event.currentTarget));

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-72 w-72 bg-[radial-gradient(circle,rgba(120,199,255,0.18),transparent_65%)]" />
        <div className="absolute right-0 top-24 h-80 w-80 bg-[radial-gradient(circle,rgba(88,213,170,0.16),transparent_65%)]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 bg-[radial-gradient(circle,rgba(255,186,107,0.12),transparent_65%)]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-stretch gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="app-panel hidden rounded-[36px] p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] text-slate-950">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-white">FinanceOS</p>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Command center</p>
              </div>
            </div>

            <h1 className="mt-10 max-w-xl text-5xl font-semibold tracking-tight text-white">
              A sharper finance workspace with calmer colors and clearer movement.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted-strong)]">
              Designed for daily money decisions: balances, transfers, and a cleaner sense
              of what needs attention next.
            </p>
          </div>

          <div className="grid gap-4">
            {highlights.map((item) => (
              <div
                key={item}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm leading-6 text-[var(--muted-strong)]"
              >
                {item}
              </div>
            ))}

            <div className="grid grid-cols-3 gap-4">
              <div className="metric-tile rounded-[24px] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Mood</p>
                <p className="mt-3 text-xl font-semibold text-white">Focused</p>
              </div>
              <div className="metric-tile rounded-[24px] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Sync</p>
                <p className="mt-3 text-xl font-semibold text-white">Live</p>
              </div>
              <div className="metric-tile rounded-[24px] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Layout</p>
                <p className="mt-3 text-xl font-semibold text-white">Responsive</p>
              </div>
            </div>
          </div>
        </section>

        <section className="app-panel flex w-full max-w-xl flex-col justify-center justify-self-center rounded-[32px] px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] text-slate-950 shadow-lg shadow-emerald-500/20">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-white">FinanceOS</p>
              <p className="text-sm text-[var(--muted)]">Welcome back</p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-3xl font-semibold tracking-tight text-white">Sign in to continue</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">
              Access your accounts, review transfers, and pick up exactly where you left off.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-3 w-full rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:bg-white/[0.08]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-3 w-full rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:bg-white/[0.08]"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <p className="rounded-[18px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? "Signing in..." : "Enter dashboard"}
            </button>
          </form>

          <p className="mt-6 text-sm leading-6 text-[var(--muted)]">
            This workspace uses Supabase authentication and keeps your profile personalization
            local to this browser session.
          </p>
        </section>
      </div>
    </div>
  );
}
