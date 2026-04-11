"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const nav = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    label: "Accounts",
    href: "/dashboard/accounts",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M3 10h18M7 15h2m4 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Ledger",
    href: "/dashboard/ledger",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Expenses",
    href: "/dashboard/expenses",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Family",
    href: "/dashboard/family",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const NavItem = ({ label, href, icon }: (typeof nav)[0] & { index: number }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 ${
          active ? "" : "hover:bg-[var(--glass-hover)] group"
        }`}
        style={{
          color: active ? "var(--accent-primary-light)" : "var(--text-secondary)",
          background: active ? "var(--sidebar-active)" : "transparent",
          border: active ? "1px solid rgba(108, 92, 231, 0.2)" : "1px solid transparent",
          textDecoration: "none",
        }}
      >
        <span className={`${active ? "text-[--accent-primary-light]" : "group-hover:text-[--text-primary]"}`}>
          {icon}
        </span>
        <span className="font-medium text-sm">{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex w-[210px] shrink-0 flex-col h-screen sticky top-0"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          backdropFilter: "blur(24px) saturate(1.3)",
          WebkitBackdropFilter: "blur(24px) saturate(1.3)",
        }}
      >
        {/* Logo Section */}
        <div className="px-5 pt-8 pb-5">
          <div className="flex items-center justify-start">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse-glow"
              style={{
                background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 50%, #00cec9 100%)",
                boxShadow: "0 8px 32px rgba(108, 92, 231, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
            >
              <svg className="w-[30px] h-[30px] text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
        </div>

        <div className="divider-glow mx-4" />

        <nav className="flex-1 px-3 pt-6 space-y-1">
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[--text-muted]">
            Navigation
          </p>
          {nav.map((item, index) => (
            <NavItem key={item.href} {...item} index={index} />
          ))}
        </nav>

        <div className="divider-glow mx-4" />

        <div className="px-3 py-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 text-[--text-secondary]"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (Premium Refined) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-4 py-3 pb-safe border-t border-white/5"
        style={{
          background: "rgba(8, 11, 25, 0.95)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
        }}
      >
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5 px-4 py-1.5 rounded-2xl relative transition-all duration-300 active:scale-90"
              style={{
                color: active ? "var(--accent-primary-light)" : "var(--text-muted)",
              }}
            >
              {active && (
                <div className="absolute inset-0 bg-white/5 rounded-2xl animate-scale-in" />
              )}
              <div className={`${active ? "scale-110" : ""} transition-transform duration-300`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-bold tracking-tight ${active ? "opacity-100" : "opacity-70"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1.5 px-4 py-1.5 rounded-2xl transition-all active:scale-90 text-[--text-muted]"
        >
          <svg className="w-[18px] h-[18px] opacity-70" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-[10px] font-bold tracking-tight opacity-70">Exit</span>
        </button>
      </nav>
    </>
  );
}
