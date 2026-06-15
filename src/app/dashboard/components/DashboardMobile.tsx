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

  const quickActions = [
    { label: "Expense", href: "/dashboard/expenses?action=new", icon: "🔴", color: "var(--danger)", desc: "Deduct money" },
    { label: "Income", href: "/dashboard/income?action=new", icon: "🟢", color: "var(--success)", desc: "Add earnings" },
    { label: "Transfer", href: "/dashboard/accounts?action=transfer", icon: "🔄", color: "#6366f1", desc: "Between accounts" },
    { label: "Stock Trade", href: "/dashboard/stocks?action=new", icon: "📈", color: "#3b82f6", desc: "Equities market" },
    { label: "Mutual Fund", href: "/dashboard/mutual-funds?action=new", icon: "🏦", color: "#a855f7", desc: "SIP & Lumpsum" },
    { label: "FnO Trade", href: "/dashboard/fno?action=new", icon: "📊", color: "#10b981", desc: "Derivatives" },
    { label: "Bonds", href: "/dashboard/bonds?action=new", icon: "🔏", color: "#eab308", desc: "Fixed income" },
    { label: "Forex", href: "/dashboard/forex?action=new", icon: "💱", color: "#fbbf24", desc: "Currencies" },
    { label: "Liability", href: "/dashboard/liabilities?action=new", icon: "💸", color: "#ec4899", desc: "Loans & EMIs" },
    { label: "Alt Asset", href: "/dashboard/alternative-assets?action=new", icon: "🏢", color: "#14b8a6", desc: "Gold & Property" },
  ];

  return (
    <div className="relative z-20 flex min-h-screen flex-col gap-6 pb-[calc(var(--mobile-bottom-nav-height)+1.5rem)] md:hidden animate-fade-in">
      
      {/* Portfolio Net Worth Mini Card */}
      <div className="glass-card-static rich-border relative flex flex-col items-center justify-center overflow-hidden border border-white/5 p-4 text-center shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-emerald-500" />
        <div className="absolute -right-10 -top-10 w-28 h-28 bg-[--accent-primary]/5 blur-2xl rounded-full" />
        
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Net Worth</p>
        <div 
          className="flex items-center gap-1.5 mt-1 cursor-pointer select-none"
          onClick={() => setShowUSD(!showUSD)}
        >
          <h2 className="text-xl font-[900] leading-none tracking-tight text-white">
            {showUSD 
              ? `$${stats.netWorthUSD.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
              : `₹${stats.netWorthINR.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
            }
          </h2>
          <span className="text-[7px] font-black tracking-widest text-[--text-muted] uppercase">
            {showUSD ? 'USD' : 'INR'}
          </span>
        </div>
      </div>

      {/* QUICK RECORD HUB */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Quick Record Hub</h3>
          <span className="text-[8px] text-[--text-muted] font-medium">Select item to log</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((action) => (
            <Link 
              key={action.label} 
              href={action.href} 
              prefetch={true} 
              className="glass-card-static p-3 flex flex-col items-start gap-1.5 no-underline transition-all active:scale-[0.97] bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 shadow-md rounded-2xl"
              style={{ borderLeft: `3px solid ${action.color}` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{action.icon}</span>
                <span className="text-[11px] font-bold text-white tracking-tight">{action.label}</span>
              </div>
              <span className="text-[8px] text-[--text-muted] font-medium truncate w-full">{action.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* FINANCIAL PULSE (RECENT CONFIRMATIONS) */}
      <div className="px-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Financial Pulse</h3>
          <span className={`status-dot scale-50 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'}`} />
        </div>
        <div className="space-y-1.5">
          {recentLogs.slice(0, 4).map((log) => {
             const isOut = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
             return (
               <div key={log.id} className="glass-card-static flex items-center justify-between gap-3 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                 <div className="flex min-w-0 items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-xs shrink-0">
                      {log.action_type === "CREATE" ? "✨" : isOut ? "📉" : "📈"}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[10px] font-bold text-white">{log.details}</span>
                      <span className="truncate text-[7px] font-black uppercase text-[--text-muted]">{log.created_at ? format(new Date(log.created_at), "HH:mm") : "—"} • {log.account_name}</span>
                    </div>
                  </div>
                 <span className={`shrink-0 text-[11px] font-black tabular-nums ${isOut ? "text-danger" : "text-success"}`}>
                    {log.amount ? `${isOut ? "-" : "+"}₹${log.amount.toLocaleString()}` : "—"}
                  </span>
               </div>
             );
          })}
          {recentLogs.length === 0 && (
            <div className="py-6 text-center glass-card-static text-[8px] uppercase font-bold text-[--text-muted] border-dashed rounded-xl">
              Waiting for data entry...
            </div>
          )}
        </div>
      </div>

    </div>
  );
});

export default DashboardMobile;
