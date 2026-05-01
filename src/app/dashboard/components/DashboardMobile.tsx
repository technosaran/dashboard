"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { FinanceData } from "@/hooks/use-finance-data";

type DashboardStats = {
  totalBalance: number;
  monthlySpend: number;
  monthlyIncome: number;
  expenseTrend: unknown[];
  pieData: unknown[];
  stockCount: number;
  mfCount: number;
  stockBalance: number;
  mfBalance: number;
};

type Props = {
  stats: DashboardStats;
  recentLogs: FinanceData["ledgerLogs"];
  isLoading: boolean;
  isValidating: boolean;
};

export default function DashboardMobile({ stats, recentLogs, isValidating }: Props) {
  return (
    <div className="flex flex-col gap-6 md:hidden min-h-screen animate-fade-in relative z-20 pb-24">
      {/* Mobile Header / Balance */}
      <div className="glass-card-static p-8 text-center flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[--accent-primary]/10 blur-3xl rounded-full" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[--text-muted] mb-2">Net Worth</p>
        <h2 className="text-4xl font-black text-white tracking-tighter">
           ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
        </h2>
        <div className="mt-4 flex gap-4">
           <div className="flex flex-col items-center">
             <span className="text-[9px] font-bold uppercase text-[--success] tracking-widest">+₹{stats.monthlyIncome.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase">In</span>
           </div>
           <div className="w-px h-6 bg-white/10" />
           <div className="flex flex-col items-center">
             <span className="text-[9px] font-bold uppercase text-[--danger] tracking-widest">-₹{stats.monthlySpend.toLocaleString()}</span>
             <span className="text-[8px] text-[--text-muted] uppercase">Out</span>
           </div>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="px-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted] mb-4">Command Center</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/expenses?action=new" className="glass-card-static p-4 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform border-[--danger]/20 bg-[--danger]/5 hover:bg-[--danger]/10">
             <div className="w-12 h-12 rounded-full bg-[--danger]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(255,118,117,0.3)]">🔴</div>
             <span className="text-xs font-bold uppercase tracking-wider text-[--danger]">Expense</span>
          </Link>
          <Link href="/dashboard/income?action=new" className="glass-card-static p-4 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform border-[--success]/20 bg-[--success]/5 hover:bg-[--success]/10">
             <div className="w-12 h-12 rounded-full bg-[--success]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(0,184,148,0.3)]">🟢</div>
             <span className="text-xs font-bold uppercase tracking-wider text-[--success]">Income</span>
          </Link>
          <Link href="/dashboard/transfers?action=new" className="glass-card-static p-4 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform border-[--accent-primary]/20 bg-[--accent-primary]/5 hover:bg-[--accent-primary]/10">
             <div className="w-12 h-12 rounded-full bg-[--accent-primary]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(108,92,231,0.3)]">🔄</div>
             <span className="text-xs font-bold uppercase tracking-wider text-[--accent-primary-light]">Transfer</span>
          </Link>
          <Link href="/dashboard/family" className="glass-card-static p-4 flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform border-[--warning]/20 bg-[--warning]/5 hover:bg-[--warning]/10">
             <div className="w-12 h-12 rounded-full bg-[--warning]/20 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(253,203,110,0.3)]">👥</div>
             <span className="text-xs font-bold uppercase tracking-wider text-[--warning]">Send Money</span>
          </Link>
        </div>
      </div>

      {/* RECENT PULSE */}
      <div className="px-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted]">Financial Pulse</h3>
          <span className={`status-dot scale-50 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'}`} />
        </div>
        <div className="space-y-3">
          {recentLogs.slice(0, 3).map((log) => {
             const isOut = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
             return (
               <div key={log.id} className="glass-card-static p-4 flex items-center justify-between hover:bg-white/[0.04]">
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
}
