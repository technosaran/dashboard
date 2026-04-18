"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { useEffect, useState } from "react";

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
    label: "Income",
    href: "/dashboard/income",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
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
    label: "Stocks",
    href: "/dashboard/stocks",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
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
    label: "Bonds",
    href: "/dashboard/bonds",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    label: "Family",
    href: "/dashboard/family",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);

  useEffect(() => {
    if (!isMoreOpen && !isQuickActionOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isMoreOpen, isQuickActionOpen]);

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
        prefetch={true}
        className={`flex items-center gap-3 px-3 py-1 rounded-xl transition-all duration-300 ${active ? "" : "hover:bg-[var(--glass-hover)] group"}`}
        style={{
          color: active ? "var(--accent-primary-light)" : "var(--text-secondary)",
          background: active ? "var(--sidebar-active)" : "transparent",
          border: active ? "1px solid rgba(108, 92, 231, 0.2)" : "1px solid transparent",
          textDecoration: "none",
        }}
      >
        <span className={`${active ? "text-[--accent-primary-light]" : "group-hover:text-[--text-primary]"}`}>{icon}</span>
        <span className="font-semibold text-[13px] tracking-tight">{label}</span>
      </Link>
    );
  };

  const quickActions = [
    { label: "Expense", href: "/dashboard/expenses?action=new", icon: "🔴", color: "var(--danger)" },
    { label: "Income", href: "/dashboard/income?action=new", icon: "🟢", color: "var(--success)" },
    { label: "Transfer", href: "/dashboard/transfers?action=new", icon: "🔄", color: "var(--accent-primary-light)" },
    { label: "Trade", href: "/dashboard/stocks?action=new", icon: "📈", color: "#3b82f6" },
    { label: "Funds", href: "/dashboard/mutual-funds?action=new", icon: "🏦", color: "#a855f7" },
  ];

  const mobileNavLeft = nav.slice(0, 2); // Dashboard, Accounts
  const mobileNavRight = [nav[9]]; // Ledger
  const moreNav = nav.slice(2, 9).concat(nav[10]); // Income, Expenses, Stocks, Mutual Funds, Bonds, Goals, Family + Settings

  return (
    <>
      {/* Universal Quick Action Hub */}
      <div className={`md:hidden fixed inset-0 z-[100] bg-black/80 backdrop-blur-md transition-all duration-500 ${isQuickActionOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setIsQuickActionOpen(false)}>
        <div className={`absolute bottom-32 left-8 right-8 grid grid-cols-2 gap-4 transition-all duration-500 ${isQuickActionOpen ? "translate-y-0 scale-100" : "translate-y-16 scale-90"}`} onClick={e => e.stopPropagation()}>
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} prefetch={true} onClick={() => setIsQuickActionOpen(false)} className="glass-card-static p-6 flex flex-col items-center justify-center gap-3 no-underline transition-all active:scale-95 shadow-lg" style={{ background: "var(--bg-surface)", border: `1px solid ${action.color}30` }}>
              <div className="text-3xl filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.1)]">{action.icon}</div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: action.color }}>{action.label}</span>
            </Link>
          ))}
          <button onClick={() => setIsQuickActionOpen(false)} className="col-span-2 glass-card-static py-4 flex items-center justify-center bg-white/40 border-white/60 mt-2 backdrop-blur-md">
            <span className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Cancel</span>
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[210px] shrink-0 flex-col h-screen sticky top-0" style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)", backdropFilter: "blur(20px) saturate(1.2)", WebkitBackdropFilter: "blur(20px) saturate(1.2)" }}>
        <div className="px-6 pt-4 pb-2"><div className="flex flex-col"><h2 className="text-xl font-black text-[--text-primary] tracking-tighter">Finance<span className="text-[--accent-primary]">OS</span></h2><p className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em] leading-none mt-1">Institutional Build</p></div></div>
        <div className="divider-glow mx-6" />
        <nav className="flex-1 px-4 pt-2 space-y-0.5 overflow-visible no-scrollbar">
          <p className="px-4 pb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[--text-muted] opacity-60">Navigation</p>
          {nav.map((item, index) => (<NavItem key={item.href} {...item} index={index} />))}
        </nav>
        <div className="divider-glow mx-4" />
        <div className="px-3 py-2 mt-auto pb-6">
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600 hover:shadow-rose-500/30 active:scale-[0.98]">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile More Overlay */}
      <div className={`md:hidden fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-md transition-all duration-500 ease-in-out ${isMoreOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setIsMoreOpen(false)}>
        <div className={`fixed bottom-0 left-0 right-0 rounded-t-[40px] p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) transform ${isMoreOpen ? "translate-y-0" : "translate-y-full"}`} onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-surface)", boxShadow: "0 -20px 60px rgba(15, 23, 42, 0.15)", borderTop: "1px solid var(--border-default)" }}>
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-8 opacity-60" />
          <div className="grid grid-cols-3 gap-3 mb-6">
            {moreNav.map((item) => (
              <Link key={item.label} href={item.href} prefetch={true} onClick={() => setIsMoreOpen(false)} className="flex flex-col items-center justify-center p-4 rounded-[28px] bg-white/[0.02] border border-white/[0.04] active:bg-white/10 transition-all no-underline gap-2">
                <div className="w-10 h-10 rounded-full bg-[--accent-primary]/10 flex items-center justify-center text-[--accent-primary-light]">{item.icon}</div>
                <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.15em] text-center">{item.label}</span>
              </Link>
            ))}
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-between px-6 h-14 rounded-[24px] bg-rose-500 text-white font-black text-[11px] uppercase tracking-[0.2em] active:scale-[0.98] transition-all shadow-xl shadow-rose-500/20">
            <div className="flex items-center gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg><span>Terminate Session</span></div>
            <div className="text-[10px] font-black opacity-60 tracking-tight">V2.0.4</div>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation (FAB Optimized) */}
      <nav 
        className="md:hidden fixed bottom-2 left-4 right-4 z-[90] flex items-center justify-between px-1 h-[72px] border border-[--accent-primary]/10 rounded-[32px] transition-transform duration-300"
        style={{
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 10px 40px rgba(13, 165, 233, 0.15)",
        }}
      >
        {/* Left Side */}
        {mobileNavLeft.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.label} href={item.href} prefetch={true} className={`flex-1 flex flex-col items-center justify-center h-full relative transition-all active:scale-90 ${active ? "text-[--accent-primary-light]" : "text-[--text-muted]"}`}>
              <div className={`${active ? "scale-110 -translate-y-1" : "opacity-40"} transition-all duration-300`}>{item.icon}</div>
              <span className={`text-[8px] font-black uppercase tracking-widest absolute bottom-2 transition-all duration-300 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>{item.label}</span>
            </Link>
          );
        })}

        {/* UNIVERSAL FAB */}
        <div className="flex-1 flex justify-center h-full items-center relative">
           <button 
             onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
             className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 active:scale-95 absolute -top-4 z-[110] ${isQuickActionOpen ? "bg-rose-500 rotate-45" : "bg-gradient-to-br from-[--accent-primary] to-[--accent-primary-light]"}`}
             style={{ boxShadow: isQuickActionOpen ? "0 8px 32px rgba(244,63,94,0.5)" : "0 8px 24px rgba(108,92,231,0.4)" }}
           >
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
           </button>
        </div>

        {/* Right Side */}
        {mobileNavRight.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.label} href={item.href} prefetch={true} className={`flex-1 flex flex-col items-center justify-center h-full relative transition-all active:scale-90 ${active ? "text-[--accent-primary-light]" : "text-[--text-muted]"}`}>
              <div className={`${active ? "scale-110 -translate-y-1" : "opacity-40"} transition-all duration-300`}>{item.icon}</div>
              <span className={`text-[8px] font-black uppercase tracking-widest absolute bottom-2 transition-all duration-300 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>{item.label}</span>
            </Link>
          );
        })}
        
        <button onClick={() => setIsMoreOpen(true)} className={`flex-1 flex flex-col items-center justify-center h-full relative transition-all active:scale-90 ${isMoreOpen ? "text-[--accent-primary-light]" : "text-[--text-muted]"}`}>
          <div className={`${isMoreOpen ? "scale-110 translate-y-0" : "opacity-40"} transition-all duration-300`}><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg></div>
          <span className={`text-[8px] font-black uppercase tracking-widest absolute bottom-2 transition-all duration-300 ${isMoreOpen ? "opacity-100" : "opacity-0 translate-y-2"}`}>More</span>
        </button>
      </nav>
    </>
  );
}
