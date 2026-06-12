"use client";

import Link from "next/link";
import { format } from "date-fns";
import { memo, useState } from "react";
import type { FinanceData } from "@/hooks/use-finance-data";

type DashboardStats = {
  totalBalance: number;
  netWorthINR: number;
  netWorthUSD: number;
  totalDayPnL: number;
  totalDayPnLPercent: number;
  monthlySpend: number;
  monthlyIncome: number;
  expenseTrend: unknown[];
  pieData: unknown[];
  stockCount: number;
  mfCount: number;
  stockBalance: number;
  mfBalance: number;
  totalAssets: number;
  debtBalance: number;
};

type Props = {
  stats: DashboardStats;
  recentLogs: FinanceData["ledgerLogs"];
  isLoading: boolean;
  isValidating: boolean;
};

const DashboardMobile = memo(function DashboardMobile({ stats, recentLogs, isValidating }: Props) {
  const [showUSD, setShowUSD] = useState(false);

  return (
    <div className="relative z-20 flex min-h-screen flex-col gap-6 pb-[calc(var(--mobile-bottom-nav-height)+1rem)] md:hidden animate-fade-in">
      
      {/* INITIALIZATION PLAYGROUND BANNER */}
      {stats.totalAssets === 0 && recentLogs.length === 0 && (
        <div className="glass-card-static rich-border relative overflow-hidden p-6 border border-white/10 bg-white/[0.02] text-center">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-cyan-400" />
          <div className="flex flex-col items-center gap-4">
            <span className="text-3xl">🚀</span>
            <div className="space-y-1">
              <h2 className="text-base font-black text-white">Welcome to FinanceOS</h2>
              <p className="text-[10px] text-[--text-secondary] leading-relaxed">
                Your database is completely empty. Manually setup your accounts to get started!
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              <Link 
                href="/dashboard/accounts?action=new" 
                className="w-full h-11 text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[--accent-primary] to-indigo-500 shadow-md text-white rounded-xl active:scale-[0.98] transition-all flex items-center justify-center no-underline"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Header / Balance */}
      <div className="glass-card-static rich-border relative flex flex-col items-center justify-center overflow-hidden border border-white/10 p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] sm:p-6">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-emerald-500" />
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[--accent-primary]/10 blur-3xl rounded-full" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full" />
        
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[--text-muted]">Portfolio Net Worth</p>
        <div 
          className="flex flex-col items-center w-full gap-3 my-3 cursor-pointer group/nw select-none"
          onClick={() => setShowUSD(!showUSD)}
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[8px] font-black tracking-widest text-[--text-muted] uppercase transition-colors group-hover/nw:text-white">
                {showUSD ? 'Dollars (USD)' : 'Rupees (INR)'}
              </span>
              <svg className="w-2.5 h-2.5 text-[--text-muted] opacity-50 group-hover/nw:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h2 
              key={showUSD ? 'usd' : 'inr'}
              className={`animate-fade-in no-scrollbar w-full overflow-x-auto overflow-y-hidden bg-clip-text text-center text-[clamp(1.6rem,8vw,2.4rem)] font-[900] leading-none tracking-tighter text-transparent whitespace-nowrap transition-all duration-500 ${
              showUSD 
                ? "bg-gradient-to-b from-[--accent-primary-light] to-indigo-300"
                : "bg-gradient-to-b from-white to-white/70"
            }`}>
               {showUSD 
                 ? `$${stats.netWorthUSD.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
                 : `₹${stats.netWorthINR.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
               }
            </h2>
          </div>
        </div>
        <div className={`mb-4 flex flex-wrap items-center justify-center gap-2 ${stats.totalDayPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
          <span className="text-[11px] font-black tabular-nums sm:text-[12px] whitespace-nowrap">
            {stats.totalDayPnL >= 0 ? '+' : '-'}₹{Math.abs(stats.totalDayPnL).toLocaleString()}
          </span>
          <span className="text-[9px] font-black opacity-60 tabular-nums">
            ({stats.totalDayPnL >= 0 ? '+' : ''}{stats.totalDayPnLPercent.toFixed(2)}%)
          </span>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 border-t border-white/5 pt-4 sm:gap-3">
            <div className="flex min-w-0 flex-col items-center overflow-hidden rounded-xl border border-emerald-500/10 bg-emerald-500/5 py-2.5">
             <span className="w-full block overflow-x-auto no-scrollbar whitespace-nowrap px-1 text-[clamp(8px,2.6vw,10px)] font-black text-emerald-400 text-center">+₹{stats.totalAssets.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase font-black tracking-widest mt-0.5">Total Assets</span>
            </div>
            <div className="flex min-w-0 flex-col items-center overflow-hidden rounded-xl border border-rose-500/10 bg-rose-500/5 py-2.5">
             <span className="w-full block overflow-x-auto no-scrollbar whitespace-nowrap px-1 text-[clamp(8px,2.6vw,10px)] font-black text-rose-500 text-center">-₹{stats.debtBalance.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase font-black tracking-widest mt-0.5">Total Debt</span>
            </div>
        </div>

        <div className="mt-3 flex w-full justify-center gap-4 border-t border-white/5 pt-3">
           <div className="flex min-w-0 flex-col items-center">
            <span className="text-[10px] font-black text-success tracking-[0.12em]">+₹{stats.monthlyIncome.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase font-bold tracking-tighter">Income</span>
           </div>
           <div className="w-px h-8 bg-white/10" />
           <div className="flex min-w-0 flex-col items-center">
            <span className="text-[10px] font-black text-danger tracking-[0.12em]">-₹{stats.monthlySpend.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase font-bold tracking-tighter">Expenses</span>
           </div>
        </div>
      </div>



      {/* RECENT PULSE */}
      <div className="px-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted]">Financial Pulse</h3>
          <span className={`status-dot scale-50 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'}`} />
        </div>
        <div className="space-y-0 divide-y divide-white/5 border border-white/5 rounded-2xl overflow-hidden">
          {recentLogs.slice(0, 3).map((log) => {
             const isOut = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
             return (
               <div key={log.id} className="glass-card-static !border-0 !rounded-none flex items-center justify-between gap-3 p-4 hover:bg-white/[0.04]">
                 <div className="flex min-w-0 items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-base">
                      {log.action_type === "CREATE" ? "✨" : isOut ? "📉" : "📈"}
                    </div>
                   <div className="flex min-w-0 flex-col">
                     <span className="truncate text-[11px] font-bold text-white">{log.details}</span>
                     <span className="truncate text-[8px] font-black uppercase text-[--text-muted]">{log.created_at ? format(new Date(log.created_at), "HH:mm") : "—"} • {log.account_name}</span>
                    </div>
                  </div>
                 <span className={`shrink-0 text-[12px] font-black sm:text-[13px] ${isOut ? "text-danger" : "text-success"}`}>
                    {log.amount ? `${isOut ? "-" : "+"}₹${log.amount.toLocaleString()}` : "—"}
                  </span>
               </div>
             );
          })}
          {recentLogs.length === 0 && (
            <div className="py-8 text-center glass-card-static text-[10px] uppercase font-bold text-[--text-muted] border-dashed">
              Waiting for interaction...
            </div>
          )}
        </div>
      </div>

      {/* Investment Log */}
      <div className="px-1 mt-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted] mb-4">Invest & Capital</h3>
        <div className="flex flex-col gap-3">
           <Link href="/dashboard/stocks?action=new" className="glass-card-static flex min-w-0 items-center gap-3 p-4 transition-transform active:scale-95">
             <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(59,130,246,0.3)]">📈</div>
             <div className="flex min-w-0 flex-col">
               <span className="text-sm font-bold text-white">Record Stock Trade</span>
               <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Equities & Market</span>
             </div>
             <svg className="ml-auto h-5 w-5 shrink-0 text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </Link>
           <Link href="/dashboard/mutual-funds?action=new" className="glass-card-static flex min-w-0 items-center gap-3 p-4 transition-transform active:scale-95">
             <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(168,85,247,0.3)]">🏦</div>
             <div className="flex min-w-0 flex-col">
               <span className="text-sm font-bold text-white">Log Mutual Fund</span>
               <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">SIP & Lumpsum</span>
             </div>
             <svg className="ml-auto h-5 w-5 shrink-0 text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </Link>
           <Link href="/dashboard/goals?action=new" className="glass-card-static flex min-w-0 items-center gap-3 p-4 transition-transform active:scale-95">
             <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]">🎯</div>
             <div className="flex min-w-0 flex-col">
               <span className="text-sm font-bold text-white">Contribute To Goal</span>
               <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Milestone Tracking</span>
             </div>
             <svg className="ml-auto h-5 w-5 shrink-0 text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </Link>
         </div>
       </div>

       <div className="px-1">
         <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted] mb-3">Portfolio Snapshot</h3>
         <div className="grid grid-cols-2 gap-2">
           <div className="glass-card-static p-2 flex items-center gap-2 border-blue-500/20 bg-blue-500/5">
             <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs flex-shrink-0">📈</div>
             <div className="flex flex-col min-w-0 flex-1">
               <span className="text-[9px] font-black uppercase tracking-wider text-white/70">Stocks</span>
               <span className="text-[11px] font-black tabular-nums text-white block w-full overflow-x-auto no-scrollbar whitespace-nowrap">₹{stats.stockBalance.toLocaleString()}</span>
             </div>
           </div>
           <div className="glass-card-static p-2 flex items-center gap-2 border-purple-500/20 bg-purple-500/5">
             <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs flex-shrink-0">🏦</div>
             <div className="flex flex-col min-w-0 flex-1">
               <span className="text-[9px] font-black uppercase tracking-wider text-white/70">Funds</span>
               <span className="text-[11px] font-black tabular-nums text-white block w-full overflow-x-auto no-scrollbar whitespace-nowrap">₹{stats.mfBalance.toLocaleString()}</span>
             </div>
           </div>
         </div>
       </div>
    </div>
  );
});

export default DashboardMobile;
