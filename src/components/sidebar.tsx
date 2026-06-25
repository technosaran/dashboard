"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { useEffect, useState, useMemo } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS } from "@/lib/modules";
import type { ModuleKey } from "@/lib/modules";

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
    label: "Budget",
    href: "/dashboard/budget",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    label: "FnO",
    href: "/dashboard/fno",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M9 15l3-3 3 3 5-5" />
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
    label: "Assets",
    href: "/dashboard/alternative-assets",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: "Forex",
    href: "/dashboard/forex",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 000 20M12 2a14.5 14.5 0 010 20M2 12h20" />
      </svg>
    ),
  },
  {
    label: "Loans",
    href: "/dashboard/liabilities",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function NavItem({ label, href, icon, pathname }: (typeof nav)[0] & { pathname: string }) {
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  return (
    <Link
      href={href}
      prefetch={true}
      aria-label={label}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 no-underline border ${
        active 
          ? "text-[--accent-primary-light] bg-[--sidebar-active] border-[rgba(99,102,241,0.15)] shadow-[0_0_15px_rgba(99,102,241,0.08)] font-bold" 
          : "text-[--text-secondary] border-transparent hover:bg-[var(--glass-hover)] hover:text-[--text-primary] hover:pl-4 group"
      }`}
    >
      {active && (
        <span 
          className="absolute left-0 top-1/4 bottom-1/4 w-0.5 rounded-r-md bg-[--accent-primary]"
          aria-hidden="true"
        />
      )}
      <span className={`transition-transform duration-300 ${active ? "text-[--accent-primary-light] scale-110" : "text-[--text-muted] group-hover:text-[--text-primary] group-hover:scale-105"}`} aria-hidden="true">
        {icon}
      </span>
      <span className="font-semibold text-[13px] tracking-tight">{label}</span>
    </Link>
  );
}

const quickActions = [
  { label: "Expense", href: "/dashboard/expenses?action=new", icon: "🔴", color: "var(--danger)" },
  { label: "Income", href: "/dashboard/income?action=new", icon: "🟢", color: "var(--success)" },
  { label: "Transfer", href: "/dashboard/accounts?action=transfer", icon: "🔄", color: "var(--accent-primary-light)" },
  { label: "Trade", href: "/dashboard/stocks?action=new", icon: "📈", color: "#3b82f6" },
  { label: "FnO", href: "/dashboard/fno?action=new", icon: "📊", color: "#10b981" },
  { label: "Funds", href: "/dashboard/mutual-funds?action=new", icon: "🏦", color: "#a855f7" },
  { label: "Bonds", href: "/dashboard/bonds?action=new", icon: "🔏", color: "#eab308" },
  { label: "Forex", href: "/dashboard/forex?action=new", icon: "💱", color: "#fbbf24" },
  { label: "Liability", href: "/dashboard/liabilities?action=new", icon: "💸", color: "#ec4899" },
  { label: "Alt Asset", href: "/dashboard/alternative-assets?action=new", icon: "🏢", color: "#14b8a6" },
];

const actionModuleMap: Record<string, string> = {
  "Expense": "Expenses",
  "Income": "Income",
  "Trade": "Stocks",
  "FnO": "FnO",
  "Funds": "Mutual Funds",
  "Bonds": "Bonds",
  "Forex": "Forex",
  "Liability": "Liabilities",
  "Alt Asset": "Alt Assets",
};

export default function Sidebar() {
  const { data: { profile } } = useFinanceData();
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);

  const enabledModules = useMemo(() => {
    return profile?.enabled_modules || [...MODULE_KEYS];
  }, [profile]);

  const filteredNav = useMemo(() => {
    return nav.filter(item => {
      if (["Dashboard", "Accounts", "Wallet", "Settings"].includes(item.label)) return true;
      const dbLabel: ModuleKey | string = item.label === "Assets" ? "Alt Assets" : item.label === "Loans" ? "Liabilities" : item.label;
      return enabledModules.includes(dbLabel);
    });
  }, [enabledModules]);

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

  const filteredQuickActions = useMemo(() => {
    return quickActions.filter(action => {
      const mod = actionModuleMap[action.label];
      return !mod || enabledModules.includes(mod);
    });
  }, [enabledModules]);


  const mobileNavLeft = filteredNav.slice(0, 2); 
  const ledgerItem = filteredNav.find(n => n.label === "Ledger");
  const mobileNavRight = ledgerItem ? [ledgerItem] : [];
  const moreNav = filteredNav.filter(n => !mobileNavLeft.includes(n) && !mobileNavRight.includes(n));

  return (
    <>
      {/* Universal Quick Action Hub */}
      <div className={`md:hidden fixed inset-0 z-[100] bg-black/80 backdrop-blur-md transition-all duration-500 ${isQuickActionOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setIsQuickActionOpen(false)}>
        <div className={`absolute bottom-[calc(var(--mobile-bottom-nav-height)+0.5rem)] left-4 right-4 max-h-[75vh] overflow-y-auto no-scrollbar grid grid-cols-2 gap-2.5 sm:gap-3 transition-all duration-500 ${isQuickActionOpen ? "translate-y-0 scale-100" : "translate-y-16 scale-90"}`} onClick={e => e.stopPropagation()}>
          {filteredQuickActions.map((action) => (
            <Link key={action.label} href={action.href} prefetch={true} onClick={() => setIsQuickActionOpen(false)} aria-label={`Add new ${action.label}`} className="glass-card-static p-4 flex flex-col items-center justify-center gap-2.5 no-underline transition-all active:scale-95 shadow-lg bg-[--bg-surface] animate-fade-in" style={{ border: `1px solid ${action.color}30` }}>
              <div className="text-2xl filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.1)]" aria-hidden="true">{action.icon}</div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: action.color }}>{action.label}</span>
            </Link>
          ))}
          <button type="button" onClick={() => setIsQuickActionOpen(false)} aria-label="Cancel quick actions" className="col-span-2 glass-card-static py-3 flex items-center justify-center bg-white/5 border-white/10 mt-1 backdrop-blur-md">
            <span className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Cancel</span>
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col h-screen sticky top-0" style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)", backdropFilter: "blur(20px) saturate(1.2)", WebkitBackdropFilter: "blur(20px) saturate(1.2)" }}>
        <div className="px-6 pt-6 pb-2"><div className="flex flex-col"><h2 className="text-xl font-black text-[--text-primary] tracking-tighter">Finance<span className="text-[--accent-primary]">OS</span></h2></div></div>
        <nav className="flex-1 px-4 pt-2 space-y-0.5 overflow-y-auto no-scrollbar">
          <p className="px-4 pb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[--text-muted] opacity-60">Navigation</p>
          {filteredNav.map((item) => (<NavItem key={item.href} {...item} pathname={pathname} />))}
        </nav>
        <div className="px-3 py-2 mt-auto pb-8">
          <button type="button" onClick={handleLogout} className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600 hover:shadow-rose-500/30 active:scale-[0.98]">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile More Overlay */}
      <div className={`md:hidden fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-md transition-all duration-500 ease-in-out ${isMoreOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setIsMoreOpen(false)}>
        <div className={`fixed bottom-0 left-0 right-0 rounded-t-[40px] p-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] max-h-[85vh] overflow-y-auto no-scrollbar transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) transform ${isMoreOpen ? "translate-y-0" : "translate-y-full"}`} onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-surface)", boxShadow: "0 -20px 60px rgba(15, 23, 42, 0.15)", borderTop: "1px solid var(--border-default)" }}>
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-8 opacity-60" />
          <div className="grid grid-cols-3 gap-3 mb-6">
            {moreNav.map((item) => (
              <Link key={item.label} href={item.href} prefetch={true} onClick={() => setIsMoreOpen(false)} className="flex flex-col items-center justify-center p-4 rounded-[28px] bg-white/[0.02] border border-white/[0.04] active:bg-white/10 transition-all no-underline gap-2 aspect-square">
                <div className="w-10 h-10 rounded-full bg-[--accent-primary]/10 flex items-center justify-center text-[--accent-primary-light]">{item.icon}</div>
                <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.15em] text-center">{item.label}</span>
              </Link>
            ))}
          </div>
          <button type="button" onClick={handleLogout} className="w-full flex items-center justify-between px-6 h-14 rounded-[24px] bg-rose-500 text-white font-black text-[11px] uppercase tracking-[0.2em] active:scale-[0.98] transition-all shadow-xl shadow-rose-500/20">
            <div className="flex items-center gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg><span>Terminate Session</span></div>
            <div className="text-[10px] font-black opacity-60 tracking-tight">V2.0.4</div>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation (FAB Optimized) */}
      <nav 
        className="md:hidden fixed left-3 right-3 z-[90] flex h-[68px] items-center justify-between rounded-[28px] border border-[--accent-primary]/10 px-1 transition-transform duration-300 sm:left-4 sm:right-4 sm:h-[72px] sm:rounded-[32px]"
        style={{
          bottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
          background: "rgba(21, 25, 34, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Left Side */}
        {mobileNavLeft.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
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
             type="button"
             onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
             aria-label={isQuickActionOpen ? "Close quick actions" : "Open quick actions"}
             className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 active:scale-95 absolute -top-4 z-[110] ${isQuickActionOpen ? "bg-rose-500 rotate-45" : "bg-gradient-to-br from-sky-500 to-cyan-400"}`}
             style={{ boxShadow: isQuickActionOpen ? "0 8px 32px rgba(244,63,94,0.5)" : "0 8px 24px rgba(108,92,231,0.4)" }}
           >
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16m8-8H4" /></svg>
           </button>
        </div>

        {/* Right Side */}
        {mobileNavRight.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
          return (
            <Link key={item.label} href={item.href} prefetch={true} className={`flex-1 flex flex-col items-center justify-center h-full relative transition-all active:scale-90 ${active ? "text-[--accent-primary-light]" : "text-[--text-muted]"}`}>
              <div className={`${active ? "scale-110 -translate-y-1" : "opacity-40"} transition-all duration-300`}>{item.icon}</div>
              <span className={`text-[8px] font-black uppercase tracking-widest absolute bottom-2 transition-all duration-300 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>{item.label}</span>
            </Link>
          );
        })}
        
        <button type="button" onClick={() => setIsMoreOpen(true)} className={`flex-1 flex flex-col items-center justify-center h-full relative transition-all active:scale-90 ${isMoreOpen ? "text-[--accent-primary-light]" : "text-[--text-muted]"}`}>
          <div className={`${isMoreOpen ? "scale-110 translate-y-0" : "opacity-40"} transition-all duration-300`}><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg></div>
          <span className={`text-[8px] font-black uppercase tracking-widest absolute bottom-2 transition-all duration-300 ${isMoreOpen ? "opacity-100" : "opacity-0 translate-y-2"}`}>More</span>
        </button>
      </nav>
    </>
  );
}
