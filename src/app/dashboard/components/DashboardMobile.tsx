"use client";

import Link from "next/link";
import { format } from "date-fns";
import { memo } from "react";
import type { FinanceData } from "@/hooks/use-finance-data";

type DashboardStats = {
  totalBalance: number;
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
  return (
    <div className="flex flex-col gap-6 md:hidden min-h-screen animate-fade-in relative z-20 pb-24">
      {/* Mobile Header / Balance */}
      <div className="glass-card-static p-8 text-center flex flex-col items-center justify-center relative overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[--accent-primary]/10 blur-3xl rounded-full" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full" />
        
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[--text-muted] mb-3">Portfolio Net Worth</p>
        <h2 className="text-5xl font-black text-white tracking-tighter mb-2 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
           ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
        </h2>
        <div className={`flex items-center gap-2 mb-6 ${stats.totalDayPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
          <span className="text-[12px] font-black tabular-nums">
            {stats.totalDayPnL >= 0 ? '+' : '-'}₹{Math.abs(stats.totalDayPnL).toLocaleString()}
          </span>
          <span className="text-[10px] font-black opacity-60 tabular-nums">
            ({stats.totalDayPnL >= 0 ? '+' : ''}{stats.totalDayPnLPercent.toFixed(2)}%)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full pt-6 border-t border-white/5">
           <div className="flex flex-col items-center bg-white/5 py-3 rounded-2xl border border-white/5">
             <span className="text-[11px] font-black text-emerald-400">₹{stats.totalAssets.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase font-black tracking-widest mt-1">Total Assets</span>
           </div>
           <div className="flex flex-col items-center bg-white/5 py-3 rounded-2xl border border-white/5">
             <span className="text-[11px] font-black text-rose-500">₹{stats.debtBalance.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase font-black tracking-widest mt-1">Total Debt</span>
           </div>
        </div>

        <div className="mt-4 flex gap-4 pt-4 border-t border-white/5 w-full justify-center">
           <div className="flex flex-col items-center">
             <span className="text-[10px] font-black text-[--success] tracking-widest">+₹{stats.monthlyIncome.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase font-bold tracking-tighter">Income</span>
           </div>
           <div className="w-px h-8 bg-white/10" />
           <div className="flex flex-col items-center">
             <span className="text-[10px] font-black text-[--danger] tracking-widest">-₹{stats.monthlySpend.toLocaleString()}</span>
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
               <div key={log.id} className="glass-card-static !border-0 !rounded-none p-4 flex items-center justify-between hover:bg-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-base">
                      {log.action_type === "CREATE" ? "✨" : isOut ? "📉" : "📈"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-white truncate max-w-[140px]">{log.details}</span>
                      <span className="text-[8px] font-black uppercase text-[--text-muted]">{log.created_at ? format(new Date(log.created_at), "HH:mm") : "—"} • {log.account_name}</span>
                    </div>
                  </div>
                  <span className={`text-[13px] font-black ${isOut ? "text-[--danger]" : "text-[--success]"}`}>
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
           <Link href="/dashboard/stocks?action=new" className="glass-card-static p-4 flex items-center gap-4 active:scale-95 transition-transform">
             <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(59,130,246,0.3)]">📈</div>
             <div className="flex flex-col">
               <span className="text-sm font-bold text-white">Record Stock Trade</span>
               <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Equities & Market</span>
             </div>
             <svg className="w-5 h-5 ml-auto text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </Link>
           <Link href="/dashboard/mutual-funds?action=new" className="glass-card-static p-4 flex items-center gap-4 active:scale-95 transition-transform">
             <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(168,85,247,0.3)]">🏦</div>
             <div className="flex flex-col">
               <span className="text-sm font-bold text-white">Log Mutual Fund</span>
               <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">SIP & Lumpsum</span>
             </div>
             <svg className="w-5 h-5 ml-auto text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </Link>
           <Link href="/dashboard/goals?action=new" className="glass-card-static p-4 flex items-center gap-4 active:scale-95 transition-transform">
             <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]">🎯</div>
             <div className="flex flex-col">
               <span className="text-sm font-bold text-white">Contribute To Goal</span>
               <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Milestone Tracking</span>
             </div>
             <svg className="w-5 h-5 ml-auto text-[--text-muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </Link>
         </div>
       </div>

       <div className="px-1">
         <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted] mb-3">Portfolio Snapshot</h3>
         <div className="grid grid-cols-2 gap-2">
           <div className="glass-card-static p-2 flex items-center gap-2 border-blue-500/20 bg-blue-500/5">
             <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs flex-shrink-0">📈</div>
             <div className="flex flex-col min-w-0">
               <span className="text-[9px] font-black uppercase tracking-wider text-white/70">Stocks</span>
               <span className="text-[11px] font-black tabular-nums text-white truncate">₹{stats.stockBalance.toLocaleString()}</span>
             </div>
           </div>
           <div className="glass-card-static p-2 flex items-center gap-2 border-purple-500/20 bg-purple-500/5">
             <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs flex-shrink-0">🏦</div>
             <div className="flex flex-col min-w-0">
               <span className="text-[9px] font-black uppercase tracking-wider text-white/70">Funds</span>
               <span className="text-[11px] font-black tabular-nums text-white truncate">₹{stats.mfBalance.toLocaleString()}</span>
             </div>
           </div>
         </div>
       </div>
    </div>
  );
});

export default DashboardMobile;
