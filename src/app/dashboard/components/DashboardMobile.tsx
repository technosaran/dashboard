"use client";

import Link from "next/link";
import { format } from "date-fns";
import { memo, useState, useMemo } from "react";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS } from "@/lib/modules";

type DashboardStats = {
  totalBalance: number;
  netWorth: number;
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
  totalAssetsINR?: number;
  totalAssetsUSD?: number;
  forexBalance?: number;
  debtBalance: number;
};

type Props = {
  stats: DashboardStats;
  recentLogs: FinanceData["ledgerLogs"];
  accounts: FinanceData["accounts"];
  isLoading: boolean;
  isValidating: boolean;
};

const secondaryQuickActions = [
  { label: "Stock Trade", href: "/dashboard/stocks?action=new", icon: "📈", color: "#3b82f6", desc: "Equities market", module: "Stocks" },
  { label: "Mutual Fund", href: "/dashboard/mutual-funds?action=new", icon: "🏦", color: "#a855f7", desc: "SIP & Lumpsum", module: "Mutual Funds" },
  { label: "FnO Trade", href: "/dashboard/fno?action=new", icon: "📊", color: "#10b981", desc: "Derivatives", module: "FnO" },
  { label: "Bonds", href: "/dashboard/bonds?action=new", icon: "🔏", color: "#eab308", desc: "Fixed income", module: "Bonds" },
  { label: "Forex", href: "/dashboard/forex?action=new", icon: "💱", color: "#fbbf24", desc: "Currencies", module: "Forex" },
  { label: "Liability", href: "/dashboard/liabilities?action=new", icon: "💸", color: "#ec4899", desc: "Loans & EMIs", module: "Liabilities" },
  { label: "Alt Asset", href: "/dashboard/alternative-assets?action=new", icon: "🏢", color: "#14b8a6", desc: "Gold & Property", module: "Alt Assets" },
  { label: "Family Send", href: "/dashboard/family?action=send", icon: "👨‍👩‍👧‍👦", color: "#8b5cf6", desc: "Send to members", module: "Family Management" },
];

const DashboardMobile = memo(function DashboardMobile({ stats, recentLogs, accounts, isValidating }: Props) {
  const { data: { profile } = {} } = useFinanceData();
  
  const enabledModules = useMemo(() => {
    const raw = profile?.enabled_modules || [...MODULE_KEYS];
    const populated = [...raw] as string[];
    
    // Bidirectional fallback mapping for Cashflow
    if (raw.includes("Income & Expenses")) {
      populated.push("Income", "Expenses");
    } else if (raw.includes("Income") || raw.includes("Expenses")) {
      populated.push("Income & Expenses");
    }
    
    // Bidirectional fallback mapping for Investments
    if (raw.includes("Investments")) {
      populated.push("Stocks", "Mutual Funds", "Bonds", "FnO", "Forex");
    } else if (
      raw.includes("Stocks") || 
      raw.includes("Mutual Funds") || 
      raw.includes("Bonds") || 
      raw.includes("FnO") || 
      raw.includes("Forex")
    ) {
      populated.push("Investments");
    }
    
    return populated;
  }, [profile]);

  const [showUSD, setShowUSD] = useState(false);

  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };

  const filteredSecondaryActions = useMemo(() => {
    return secondaryQuickActions.filter(action => !action.module || enabledModules.includes(action.module));
  }, [enabledModules]);

  return (
    <div className="relative z-20 flex min-h-screen flex-col gap-5 md:hidden animate-fade-in pb-16">
      
      {/* Console Header */}
      <div className="flex items-center justify-between pt-2 px-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[--accent-primary]">Console</span>
          <h2 className="text-lg font-black text-white tracking-tighter">Dashboard</h2>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 px-2.5 py-1 rounded-full">
          <span className={`w-1.5 h-1.5 rounded-full ${isValidating ? 'animate-pulse bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'}`} />
          <span className="text-[8px] font-black uppercase tracking-wider text-[--text-muted]">{isValidating ? "Syncing" : "Synced"}</span>
        </div>
      </div>

      {/* Portfolio Net Asset Value Card */}
      <div className="glass-card-static relative flex flex-col overflow-hidden border border-white/5 p-5 shadow-2xl rounded-3xl bg-gradient-to-b from-[#181a20] to-[#111216]">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600" />
        <div className="absolute -right-16 -top-16 w-36 h-36 bg-[--accent-primary]/10 blur-3xl rounded-full" />
        <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full" />
        
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[--text-muted]">Net Asset Value</p>
          <span className="text-[8px] font-black uppercase tracking-widest text-[--accent-primary] bg-[--accent-primary]/10 px-2 py-0.5 rounded-full border border-[--accent-primary]/10">
            Live
          </span>
        </div>
        
        <div 
          className="flex items-baseline gap-2 mt-2.5 cursor-pointer select-none"
          onClick={() => setShowUSD(!showUSD)}
        >
          <h1 className="text-3xl font-[900] tracking-tight text-white">
            {showUSD 
              ? `$${stats.netWorthUSD.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
              : `₹${stats.netWorthINR.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
            }
          </h1>
          <span className="text-[9px] font-black tracking-widest text-[--text-muted] uppercase">
            {showUSD ? 'USD' : 'INR'}
          </span>
        </div>

        {/* Quick Month Cashflow Inflow vs Outflow */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
          <div>
            <span className="text-[8px] font-black uppercase tracking-wider text-[--text-muted] block mb-0.5">Month Inflow</span>
            <span className="text-[13px] font-extrabold text-emerald-400">
              +₹{stats.monthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div>
            <span className="text-[8px] font-black uppercase tracking-wider text-[--text-muted] block mb-0.5">Month Outflow</span>
            <span className="text-[13px] font-extrabold text-rose-400">
              -₹{stats.monthlySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Fast Record actions */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Fast Logs</h3>
          <span className="text-[8px] text-[--text-muted] font-bold">Frequent entries</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {enabledModules.includes("Expenses") && (
            <Link 
              href="/dashboard/expenses?action=new" 
              prefetch={true}
              className="glass-card-static flex flex-col items-center justify-center p-3.5 rounded-2xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/15 active:scale-95 transition-all text-center no-underline"
            >
              <span className="text-2xl mb-1 filter drop-shadow-[0_4px_8px_rgba(239,68,68,0.25)]">🔴</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">Expense</span>
            </Link>
          )}
          {enabledModules.includes("Income") && (
            <Link 
              href="/dashboard/income?action=new" 
              prefetch={true}
              className="glass-card-static flex flex-col items-center justify-center p-3.5 rounded-2xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 active:scale-95 transition-all text-center no-underline"
            >
              <span className="text-2xl mb-1 filter drop-shadow-[0_4px_8px_rgba(16,185,129,0.25)]">🟢</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Income</span>
            </Link>
          )}
          <Link 
            href="/dashboard/accounts?action=transfer" 
            prefetch={true}
            className="glass-card-static flex flex-col items-center justify-center p-3.5 rounded-2xl bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/15 active:scale-95 transition-all text-center no-underline"
          >
            <span className="text-2xl mb-1 filter drop-shadow-[0_4px_8px_rgba(14,165,233,0.25)]">🔄</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">Transfer</span>
          </Link>
        </div>
      </div>

      {/* Assets & Trades registration */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Assets & Markets</h3>
          <span className="text-[8px] text-[--text-muted] font-bold">Investments</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filteredSecondaryActions.map((action) => (
            <Link 
              key={action.label} 
              href={action.href} 
              prefetch={true} 
              className="glass-card-static p-3 flex items-center gap-3 no-underline transition-all active:scale-[0.97] bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 shadow-sm rounded-2xl animate-fade-in"
              style={{ borderLeft: `3px solid ${action.color}40` }}
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-lg shrink-0">
                {action.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-white tracking-tight leading-snug">{action.label}</span>
                <span className="text-[8.5px] text-[--text-muted] font-medium truncate w-full">{action.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Financial Pulse (Recent Logs feed) */}
      {enabledModules.includes("Ledger") && (
        <div className="flex flex-col gap-2.5 px-0.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Financial Pulse</h3>
            <Link href="/dashboard/ledger" className="text-[9px] font-black uppercase tracking-wider text-[--accent-primary] no-underline">Statement</Link>
          </div>
          <div className="space-y-2">
            {recentLogs.slice(0, 4).map((log) => {
               const isOut = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
               const logCurrencySymbol = getAccountCurrency(log.account_id) === 'USD' ? '$' : '₹';
               return (
                 <div key={log.id} className="glass-card-static flex items-center justify-between gap-3 p-3 bg-white/[0.01] border border-white/5 rounded-2xl">
                   <div className="flex min-w-0 items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${isOut ? "bg-rose-500/5 text-rose-400 border border-rose-500/10" : "bg-emerald-500/5 text-emerald-400 border border-emerald-500/10"}`}>
                        {log.action_type === "CREATE" ? "✨" : isOut ? "📉" : "📈"}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[10.5px] font-bold text-white leading-tight">{log.details}</span>
                        <span className="truncate text-[8px] font-black uppercase text-[--text-muted] tracking-wide mt-0.5">{log.created_at ? format(new Date(log.created_at), "HH:mm") : "—"} • {log.account_name}</span>
                      </div>
                    </div>
                   <span className={`shrink-0 text-[11.5px] font-black tabular-nums ${isOut ? "text-rose-400" : "text-emerald-400"}`}>
                      {log.amount ? `${isOut ? "-" : "+"}${logCurrencySymbol}${log.amount.toLocaleString()}` : "—"}
                    </span>
                 </div>
               );
            })}
            {recentLogs.length === 0 && (
              <div className="py-8 text-center glass-card-static text-[9px] uppercase font-bold tracking-[0.2em] text-[--text-muted] border-dashed rounded-2xl">
                Ready for data entry
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
});

export default DashboardMobile;
