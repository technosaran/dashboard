"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo, memo, useState } from "react";
import Greeting from "@/components/greeting";
import type { FinanceData } from "@/hooks/use-finance-data";
import dynamic from "next/dynamic";
import { 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts";
import type { Tables } from "@/lib/database.types";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

import { getChartColour } from "@/lib/chart-colours";

type PieEntry = {
  name: string;
  value: number;
  fill: string;
  color: string;
  percentage: string;
};

type TrendEntry = {
  date: string;
  amount: number;
  category: string;
  type: string;
};

type TrendDataEntry = {
  name: string;
  income: number;
  expense: number;
};

type DashboardStats = {
  totalBalance: number;
  netWorthINR: number;
  netWorthUSD: number;
  totalDayPnL: number;
  totalDayPnLPercent: number;
  monthlySpend: number;
  monthlyIncome: number;
  expenseTrend: TrendEntry[];
  pieData: PieEntry[];
  stockCount: number;
  mfCount: number;
  stockBalance: number;
  mfBalance: number;
  trendData: TrendDataEntry[];
  liquidBalance: number;
  altBalance: number;
  bondBalance: number;
  debtBalance: number;
  totalAssets: number;
  totalAssetsINR: number;
  totalAssetsUSD: number;
  cashBalance: number;
  cashBalanceINR: number;
  cashBalanceUSD: number;
  stockBalanceINR: number;
  stockBalanceUSD: number;
  forexBalanceINR: number;
  forexBalanceUSD: number;
};

type Props = {
  stats: DashboardStats;
  recentLogs: FinanceData["ledgerLogs"];
  goals: Tables<"goals">[];
  accounts: FinanceData["accounts"];
  isLoading: boolean;
  isValidating: boolean;
};

const DashboardDesktop = memo(function DashboardDesktop({ stats, recentLogs, goals, accounts, isLoading }: Props) {
  const [showUSD, setShowUSD] = useState(false);
  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };
  // Extract portfolio data computation into a single useMemo
  const portfolioData = useMemo<PieEntry[]>(() => {
    const totalAssets = showUSD ? stats.totalAssetsUSD : stats.totalAssetsINR;
    if (totalAssets <= 0) return [];
    
    const rawData = showUSD ? [
        { 
          name: 'Cash', 
          value: stats.cashBalanceUSD, 
          fill: getChartColour(0),
          color: getChartColour(0),
        },
        { 
          name: 'Stocks', 
          value: stats.stockBalanceUSD, 
          fill: getChartColour(1),
          color: getChartColour(1),
        },
        { 
          name: 'Forex', 
          value: stats.forexBalanceUSD, 
          fill: getChartColour(3),
          color: getChartColour(3),
        }
    ] : [
        { 
          name: 'Cash', 
          value: stats.cashBalanceINR, 
          fill: getChartColour(0),
          color: getChartColour(0),
        },
        { 
          name: 'Stocks', 
          value: stats.stockBalanceINR, 
          fill: getChartColour(1),
          color: getChartColour(1),
        },
        { 
          name: 'Mutual Funds', 
          value: stats.mfBalance, 
          fill: getChartColour(2),
          color: getChartColour(2),
        },
        { 
          name: 'Assets', 
          value: stats.altBalance, 
          fill: getChartColour(3),
          color: getChartColour(3),
        },
        { 
          name: 'Bonds', 
          value: stats.bondBalance, 
          fill: getChartColour(4),
          color: getChartColour(4),
        }
    ];

    return rawData
      .filter(item => item.value > 0)
      .map(item => ({
        ...item,
        percentage: ((item.value / totalAssets) * 100).toFixed(1)
      }));
  }, [
    showUSD,
    stats.totalAssetsUSD,
    stats.totalAssetsINR,
    stats.cashBalanceUSD,
    stats.stockBalanceUSD,
    stats.forexBalanceUSD,
    stats.cashBalanceINR,
    stats.stockBalanceINR,
    stats.mfBalance,
    stats.altBalance,
    stats.bondBalance
  ]);

  return (
    <div className="hidden md:flex flex-col gap-8 animate-fade-in relative z-20 pb-10">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between px-2">
        <Greeting />
      </div>

      {/* INITIALIZATION PLAYGROUND BANNER */}
      {stats.totalAssets === 0 && recentLogs.length === 0 && (
        <div className="glass-card-static rich-border relative overflow-hidden p-8 md:p-10 border border-white/10 bg-white/[0.02]">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-cyan-400" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚀</span>
                <h2 className="text-xl font-black text-white">Welcome to your FinanceOS Terminal</h2>
              </div>
              <p className="text-xs text-[--text-secondary] leading-relaxed max-w-2xl">
                Your database is initialized and completely clean. Let&apos;s breathe life into your dashboard! Manually construct your financial system to see allocations, investments, cash flows, and forex logs in action.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-shrink-0">
              <Link 
                href="/dashboard/accounts?action=new" 
                className="btn-primary !h-12 !px-8 text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-[--accent-primary] to-indigo-500 shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_25px_rgba(99,102,241,0.35)] active:scale-[0.98] transition-all rounded-xl flex items-center justify-center no-underline"
              >
                Create First Account
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* NET WORTH PROFESSIONAL OVERVIEW CARD */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card-static rich-border group relative overflow-hidden p-8 md:p-10 lg:col-span-3">
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-emerald-500 animate-pulse-glow" />
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="relative z-10 w-full lg:w-auto">
              <div className="mb-4 flex items-center gap-2 md:mb-6">
                <span className="text-xs font-black uppercase tracking-[0.4em] text-[--text-muted]">
                  Portfolio Net Worth {isLoading && <span className="text-[10px] lowercase italic">(loading...)</span>}
                </span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-12 flex-wrap max-w-full">
                <div 
                  className="flex flex-col cursor-pointer group/nw select-none" 
                  onClick={() => setShowUSD(!showUSD)}
                  title="Click to toggle currency"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black tracking-widest text-[--text-muted] uppercase transition-colors group-hover/nw:text-white">
                      {showUSD ? 'Dollars (USD)' : 'Rupees (INR)'}
                    </span>
                    <svg className="w-3 h-3 text-[--text-muted] opacity-50 group-hover/nw:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <h2 
                    key={showUSD ? 'usd' : 'inr'} 
                    className={`animate-fade-in bg-clip-text bg-gradient-to-r text-[clamp(2.2rem,5vw,3.5rem)] font-[950] leading-none tracking-[-0.04em] text-transparent [font-family:'Outfit',sans-serif] whitespace-nowrap overflow-x-auto no-scrollbar transition-all duration-500 ${
                    showUSD 
                      ? "from-white via-sky-200 to-indigo-300 drop-shadow-[0_10px_35px_rgba(99,102,241,0.3)]" 
                      : "from-white via-white to-slate-300 drop-shadow-[0_10px_35px_rgba(14,165,233,0.3)]"
                  }`}>
                    {showUSD 
                      ? `$${stats.netWorthUSD.toLocaleString(undefined, { minimumFractionDigits: 0 })}` 
                      : `₹${stats.netWorthINR.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
                    }
                  </h2>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 px-5 py-3.5 rounded-2xl transition-all hover:bg-emerald-500/10">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-base shadow-inner">📈</div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Liquid Assets</span>
                    <span className="text-sm sm:text-base font-black text-emerald-400">
                      {showUSD 
                        ? `+$${stats.totalAssetsUSD.toLocaleString()}` 
                        : `+₹${stats.totalAssetsINR.toLocaleString()}`
                      }
                    </span>
                  </div>
                </div>
                {!showUSD && stats.debtBalance > 0 && (
                  <div className="flex items-center gap-3 bg-rose-500/5 border border-rose-500/10 px-5 py-3.5 rounded-2xl transition-all hover:bg-rose-500/10">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 text-base shadow-inner">📉</div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Outstanding Debt</span>
                      <span className="text-sm sm:text-base font-black text-rose-500">
                        -₹{stats.debtBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PORTFOLIO ALLOCATION PIE CHART */}
            <div className="flex-1 max-w-md w-full bg-white/[0.01] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-center gap-6 h-full justify-between">
                {portfolioData.length === 0 ? (
                  <div className="w-full flex h-[200px] items-center justify-center italic text-[--text-muted] text-sm rounded-3xl">No portfolio data available.</div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 space-y-2.5 w-full">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-3">Portfolio Allocation</p>
                      {portfolioData.map((item) => (
                        <div key={item.name} className="flex justify-between items-center group gap-3 min-w-0 py-1.5 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                            <span className="text-[11px] font-bold text-[--text-secondary] truncate group-hover:text-white transition-colors">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 text-right">
                            <span className="text-[9px] font-bold text-[--text-muted]">{item.percentage}%</span>
                            <span className="text-[11px] font-black tabular-nums whitespace-nowrap" style={{ color: item.color }}>
                              {showUSD ? '$' : '₹'}{item.value > 10000000 ? Intl.NumberFormat(showUSD ? 'en-US' : 'en-IN', { notation: 'compact', maximumFractionDigits: 2 }).format(item.value) : item.value.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-[140px] w-[140px] flex-shrink-0 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={portfolioData} cx="50%" cy="50%" innerRadius={50} outerRadius={65} paddingAngle={5} dataKey="value">
                            {portfolioData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }}
                            formatter={(value) => showUSD ? `$${Number(value || 0).toLocaleString()}` : `₹${Number(value || 0).toLocaleString()}`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <span className="text-[8px] uppercase font-black tracking-widest text-[--text-muted]">Assets</span>
                        <span className="text-[12px] font-black text-white mt-0.5">
                          {showUSD 
                            ? `$${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.totalAssetsUSD)}`
                            : `₹${Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.totalAssetsINR)}`
                          }
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* THREE-COLUMN BENTO GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* LEFT COLUMN: CASH FLOW TRENDS & LEDGER PULSE (Span 2) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* CASH FLOW VELOCITY AREA CHART */}
          <div className="glass-card-static rich-border p-6 md:p-8">
            <div className="flex justify-between items-center mb-8">
              <div className="flex flex-col">
                <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted]">Cash Flow Velocity</h3>
                <span className="text-[10px] text-[--text-secondary] mt-1">Income streams vs Expense consumption trends</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[--accent-primary]" />
                  <span className="text-[10px] font-bold text-white/70">Income</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-bold text-white/70">Expenses</span>
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trendData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} dx={-10} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--bg-surface)', 
                      border: '1px solid var(--border-default)', 
                      borderRadius: '16px',
                      boxShadow: 'var(--shadow-lg)',
                      fontWeight: 700
                    }} 
                  />
                  <Area type="monotone" dataKey="income" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#incomeGlow)" />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#expenseGlow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FINANCIAL PULSE - LEDGER ACTIVITY */}
          <div className="glass-card-static rich-border p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted]">Financial Ledger Pulse</h3>
                <p className="text-[10px] text-[--text-secondary] mt-1">Real-time cryptographic logging audit trail</p>
              </div>
              <Link href="/dashboard/ledger" className="btn-secondary !h-9 !px-4 text-[10px]">Audit Trail</Link>
            </div>

            <div className="divide-y divide-white/5 border border-white/5 rounded-2xl overflow-hidden">
              {recentLogs.slice(0, 4).map((log) => {
                const isOut = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
                return (
                  <div key={log.id} className="flex items-center justify-between gap-4 p-5 hover:bg-white/[0.015] transition-all group">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                        {log.action_type === "CREATE" ? "✨" : isOut ? "📉" : "📈"}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[13px] font-bold text-white group-hover:text-[--accent-primary-light] transition-colors truncate">{log.details}</span>
                        <span className="text-[9px] font-black uppercase text-[--text-muted] tracking-wider mt-1">
                          {log.created_at ? format(new Date(log.created_at), "MMM d, h:mm a") : "N/A"} • {log.account_name}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[14px] font-black tabular-nums ${isOut ? "text-danger" : "text-success"}`}>
                        {log.amount ? `${isOut ? "-" : "+"}${getAccountCurrency(log.account_id) === 'USD' ? '$' : '₹'}${log.amount.toLocaleString()}` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {recentLogs.length === 0 && (
                <div className="py-16 text-center text-[11px] font-bold uppercase text-[--text-muted] tracking-widest italic bg-white/[0.01]">
                  System initialized. Waiting for transaction input logs...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIONS, STATS & ACTIVE GOALS (Span 1) */}
        <div className="flex flex-col gap-6">
          
          {/* QUICK ACTIONS PANEL */}
          <div className="glass-card-static rich-border p-6 md:p-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted] mb-6">Operations Hub</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard/expenses?action=new" className="flex flex-col items-center justify-center p-4 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-2xl text-center transition-all group hover:-translate-y-1">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">💸</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-rose-400">Log Expense</span>
              </Link>
              <Link href="/dashboard/income?action=new" className="flex flex-col items-center justify-center p-4 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-2xl text-center transition-all group hover:-translate-y-1">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">💼</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Log Income</span>
              </Link>
              <Link href="/dashboard/stocks?action=new" className="flex flex-col items-center justify-center p-4 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 rounded-2xl text-center transition-all group hover:-translate-y-1">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📈</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-blue-400">Add Stock</span>
              </Link>
              <Link href="/dashboard/accounts?action=new" className="flex flex-col items-center justify-center p-4 bg-sky-500/5 hover:bg-sky-500/10 border border-sky-500/10 rounded-2xl text-center transition-all group hover:-translate-y-1">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">💳</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-sky-400">Add Account</span>
              </Link>
            </div>
          </div>

          {/* ACTIVE FINANCIAL GOALS MILestones */}
          <div className="glass-card-static rich-border p-6 md:p-8 flex-1">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted]">Wealth Milestones</h3>
              <Link href="/dashboard/goals" className="text-[10px] font-black uppercase text-[--accent-primary-light] hover:underline">Track</Link>
            </div>

            <div className="space-y-6">
              {goals.slice(0, 3).map((goal) => {
                const saved = Number(goal.current_amount || 0);
                const target = Number(goal.target_amount || 1);
                const pct = Math.min((saved / target) * 100, 100);
                
                return (
                  <div key={goal.id} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-black text-white">{goal.name}</span>
                        <span className="text-[9px] font-bold text-[--text-muted] tracking-tight uppercase mt-0.5">Target: ₹{target.toLocaleString()}</span>
                      </div>
                      <span className="text-[11px] font-black text-[--accent-primary-light] tabular-nums">{pct.toFixed(0)}%</span>
                    </div>

                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-3">
                      <div 
                        className="h-full bg-gradient-to-r from-[--accent-primary] to-[--accent-secondary] rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] font-bold text-[--text-secondary]">
                      <span>Saved: ₹{saved.toLocaleString()}</span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-[--text-muted]">
                        {goal.deadline ? format(new Date(goal.deadline), "MMM yyyy") : "No limit"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {goals.length === 0 && (
                <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl">
                  <p className="text-xs text-[--text-secondary] mb-4">No active milestones registered</p>
                  <Link href="/dashboard/goals?action=new" className="btn-secondary !h-9 text-[10px]">Establish Goal</Link>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
});

export default DashboardDesktop;
