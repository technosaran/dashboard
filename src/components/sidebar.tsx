"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { useState } from "react";

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
    label: "Income",
    href: "/dashboard/income",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    label: "Stocks",
    href: "/dashboard/stocks",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
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
    label: "Mutual Funds",
    href: "/dashboard/mutual-funds",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    label: "Goals",
    href: "/dashboard/goals",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
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
  const [isMoreOpen, setIsMoreOpen] = useState(false);

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
        <span className="font-semibold text-[13px] tracking-tight">{label}</span>
      </Link>
    );
  };

  // Split nav for mobile
  const mainNav = nav.slice(0, 4);
  const moreNav = nav.slice(4);

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
        <div className="px-6 pt-10 pb-4">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-white tracking-tighter">Finance<span className="text-[--accent-primary-light]">OS</span></h2>
            <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em] leading-none mt-1">Institutional Build</p>
          </div>
        </div>

        <div className="divider-glow mx-6" />

        <nav className="flex-1 px-4 pt-6 space-y-2 overflow-y-auto no-scrollbar">
          <p className="px-4 pb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[--text-muted] opacity-60">
            Navigation
          </p>
          {nav.map((item, index) => (
            <NavItem key={item.href} {...item} index={index} />
          ))}
        </nav>

        <div className="divider-glow mx-4" />

        <div className="px-3 py-6">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-bold uppercase tracking-widest transition-all hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 text-[--text-muted]"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile More Overlay — Hardened Native-feel Drawer */}
      <div 
        className={`md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-md transition-all duration-500 ease-in-out ${isMoreOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsMoreOpen(false)}
      >
        <div 
          className={`fixed bottom-0 left-0 right-0 glass-card rounded-t-[32px] p-8 pb-12 transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) transform ${isMoreOpen ? "translate-y-0" : "translate-y-full"}`}
          onClick={(e) => e.stopPropagation()}
          style={{ 
            background: "rgba(12, 16, 33, 0.98)",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.4)" 
          }}
        >
          <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
          <div className="grid grid-cols-2 gap-4">
            {moreNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMoreOpen(false)}
                className="flex flex-col items-center gap-3 p-5 rounded-[24px] bg-white/[0.03] border border-white/5 active:bg-white/10 active:scale-95 transition-all no-underline"
              >
                <div className="w-12 h-12 rounded-2xl bg-[--accent-primary]/10 flex items-center justify-center text-[--accent-primary-light]">
                  {item.icon}
                </div>
                <span className="text-[10px] font-black text-[--text-primary] uppercase tracking-[0.2em]">{item.label}</span>
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="col-span-2 flex items-center justify-center gap-4 h-16 rounded-[24px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-xs uppercase tracking-[0.2em] active:bg-rose-500/20 active:scale-[0.98] transition-all mt-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Terminate Session
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation (Premium Refined) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1 pb-safe border-t border-white/5"
        style={{
          background: "rgba(8, 11, 26, 0.96)",
          backdropFilter: "blur(30px) saturate(2)",
          WebkitBackdropFilter: "blur(30px) saturate(2)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.5)",
        }}
      >
        {mainNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center min-h-[60px] relative transition-all duration-300 active:scale-90"
              style={{
                color: active ? "var(--accent-primary-light)" : "var(--text-muted)",
              }}
            >
              {active && (
                <div className="absolute inset-x-2 -top-1 h-0.5 bg-gradient-to-r from-transparent via-[--accent-primary-light] to-transparent blur-[0.5px] rounded-full animate-fade-in" />
              )}
              <div className={`${active ? "scale-110 -translate-y-2 text-[--accent-primary-light]" : "opacity-60"} transition-all duration-300 flex items-center justify-center`}>
                {item.icon}
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest transition-all duration-300 absolute bottom-2 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
        
        {/* More Toggle */}
        <button
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          className={`flex-1 flex flex-col items-center justify-center min-h-[60px] transition-all active:scale-90 relative ${isMoreOpen ? "text-[--accent-primary-light]" : "text-[--text-muted]"}`}
        >
          <div className={`${isMoreOpen ? "scale-110 -translate-y-2 rotate-90" : "opacity-60"} transition-all duration-500 flex items-center justify-center`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <span className={`text-[8px] font-black uppercase tracking-widest transition-all duration-300 absolute bottom-2 ${isMoreOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
            More
          </span>
        </button>
      </nav>
    </>
  );
}
