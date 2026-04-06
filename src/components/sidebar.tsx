"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const nav = [
  {
    label: "Dashboard",
    href: "/dashboard",
    description: "Snapshot and trends",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Accounts",
    href: "/dashboard/accounts",
    description: "Balances and allocation",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path d="M3 10h18M7 15h2m4 0h2M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
      </svg>
    ),
  },
  {
    label: "Transfers",
    href: "/dashboard/transfers",
    description: "Move money internally",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3-3m-3 3 3 3" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    description: "Profile and workspace",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <div className="fixed inset-x-4 top-4 z-40 flex items-center justify-between rounded-2xl border border-white/10 bg-[rgba(7,14,25,0.82)] px-4 py-3 shadow-2xl backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] text-slate-950 shadow-lg shadow-emerald-500/20">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">FinanceOS</p>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Control center</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {menuOpen ? (
              <path d="M6 18 18 6M6 6l12 12" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`app-panel fixed inset-y-4 left-4 z-50 flex w-[280px] max-w-[calc(100vw-2rem)] flex-col rounded-[28px] p-4 transition duration-300 ease-out lg:sticky lg:top-6 lg:z-10 lg:h-[calc(100vh-3rem)] lg:translate-x-0 ${
          menuOpen
            ? "translate-x-0 opacity-100"
            : "-translate-x-[calc(100%+1rem)] opacity-0 lg:opacity-100"
        }`}
      >
        <div className="flex items-start justify-between gap-3 rounded-[22px] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] text-slate-950 shadow-lg shadow-emerald-500/20">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-white">FinanceOS</p>
              <p className="text-xs text-[var(--muted)]">Calm, connected money management.</p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 lg:hidden"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 rounded-[24px] border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(88,213,170,0.12),rgba(120,199,255,0.08))] px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Workspace signal</p>
          <p className="mt-2 text-sm font-semibold text-white">Realtime sync is active</p>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">
            Accounts and transfers update live as your data changes.
          </p>
        </div>

        <nav className="mt-6 flex-1 space-y-2">
          <p className="px-3 text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
            Navigate
          </p>
          {nav.map(({ label, href, icon, description }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`group flex items-center gap-3 rounded-[20px] px-3 py-3 transition ${
                  active
                    ? "border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(88,213,170,0.16),rgba(120,199,255,0.1))] text-white shadow-lg shadow-emerald-500/5"
                    : "border border-transparent text-[var(--muted-strong)] hover:border-white/8 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    active
                      ? "bg-white/12 text-[var(--accent)]"
                      : "bg-white/5 text-[var(--muted)] transition group-hover:bg-white/10 group-hover:text-[var(--accent-cool)]"
                  }`}
                >
                  {icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold tracking-tight">{label}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {description}
                  </span>
                </span>

                {active && <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_18px_rgba(88,213,170,0.8)]" />}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3">
          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">Focus</p>
            <p className="mt-2 text-sm text-white">
              Keep balances tidy, then use transfers to automate your monthly sweep.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-between rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-[var(--muted-strong)] transition hover:border-[var(--border-strong)] hover:bg-white/10 hover:text-white"
          >
            <span className="flex items-center gap-3">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
              </svg>
              Sign out
            </span>
            <svg className="h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
