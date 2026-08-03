"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo, memo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Greeting from "@/components/greeting";

import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS } from "@/lib/modules";
import { 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  ResponsiveContainer 
} from "@/components/ui/recharts";
import type { Tables } from "@/lib/database.types";

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

export type DashboardStats = {
  totalBalance: number;
  netWorth: number;
  netWorthINR: number;
  netWorthUSD: number;
  totalDayPnL: number;
  totalDayPnLINR: number;
  totalDayPnLUSD: number;
  totalDayPnLPercent: number;
  totalGrowthINR?: number;
  totalGrowthUSD?: number;
  totalGrowthPercent?: number;
  monthlySpend: number;
  monthlyIncome: number;
  expenseTrend: TrendEntry[];
  pieData: PieEntry[];
  stockCount: number;
  mfCount: number;
  stockBalance: number;
  mfBalance: number;
  mfBalanceINR: number;
  mfBalanceUSD: number;
  trendData: TrendDataEntry[];
  liquidBalance: number;
  liquidBalanceINR: number;
  liquidBalanceUSD: number;
  altBalance: number;
  altBalanceINR: number;
  altBalanceUSD: number;
  bondBalance: number;
  bondBalanceINR: number;
  bondBalanceUSD: number;
  debtBalance: number;
  debtBalanceINR: number;
  debtBalanceUSD: number;
  totalAssets: number;
  totalAssetsINR: number;
  totalAssetsUSD: number;
  cashBalance: number;
  cashBalanceINR: number;
  cashBalanceUSD: number;
  stockBalanceINR: number;
  stockBalanceUSD: number;
  forexBalance: number;
  forexBalanceINR: number;
  forexBalanceUSD: number;
  cryptoBalance: number;
  cryptoBalanceINR: number;
  cryptoBalanceUSD: number;
};

type Props = {
  stats: DashboardStats;
  recentLogs: FinanceData["ledgerLogs"];
  goals: Tables<"goals">[];
  accounts: FinanceData["accounts"];
  isLoading: boolean;
};

const DashboardDesktop = memo(function DashboardDesktop({ stats, recentLogs, goals: _goals, accounts, isLoading }: Props) {
  const { data: { profile } = {} } = useFinanceData();
  const [activeChartMetric, setActiveChartMetric] = useState<"cashflow" | "assets" | "investments">("cashflow");
  const [timeframe, setTimeframe] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("6M");

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
      populated.push("Stocks", "Mutual Funds", "Bonds", "FnO", "Forex", "Crypto");
    } else if (
      raw.includes("Stocks") || 
      raw.includes("Mutual Funds") || 
      raw.includes("Bonds") || 
      raw.includes("FnO") || 
      raw.includes("Forex") ||
      raw.includes("Crypto")
    ) {
      populated.push("Investments");
    }
    
    return populated;
  }, [profile]);

  const [showUSD, setShowUSD] = useState(false);

  useEffect(() => {
    if (profile?.base_currency) {
      setShowUSD(profile.base_currency === "USD");
    }
  }, [profile?.base_currency]);

  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };

  const portfolioData = useMemo<PieEntry[]>(() => {
    const rawData = showUSD ? [
        { name: 'Cash', value: stats.cashBalanceUSD, fill: getChartColour(0), color: getChartColour(0), module: 'Accounts' },
        { name: 'Stocks', value: stats.stockBalanceUSD, fill: getChartColour(1), color: getChartColour(1), module: 'Stocks' },
        { name: 'Mutual Funds', value: stats.mfBalanceUSD, fill: getChartColour(2), color: getChartColour(2), module: 'Mutual Funds' },
        { name: 'Assets', value: stats.altBalanceUSD, fill: getChartColour(3), color: getChartColour(3), module: 'Alt Assets' },
        { name: 'Bonds', value: stats.bondBalanceUSD, fill: getChartColour(4), color: getChartColour(4), module: 'Bonds' },
        { name: 'Forex', value: stats.forexBalanceUSD, fill: getChartColour(5), color: getChartColour(5), module: 'Forex' },
        { name: 'Crypto', value: stats.cryptoBalanceUSD, fill: getChartColour(6), color: getChartColour(6), module: 'Crypto' }
    ] : [
        { name: 'Cash', value: stats.cashBalanceINR, fill: getChartColour(0), color: getChartColour(0), module: 'Accounts' },
        { name: 'Stocks', value: stats.stockBalanceINR, fill: getChartColour(1), color: getChartColour(1), module: 'Stocks' },
        { name: 'Mutual Funds', value: stats.mfBalanceINR, fill: getChartColour(2), color: getChartColour(2), module: 'Mutual Funds' },
        { name: 'Assets', value: stats.altBalanceINR, fill: getChartColour(3), color: getChartColour(3), module: 'Alt Assets' },
        { name: 'Bonds', value: stats.bondBalanceINR, fill: getChartColour(4), color: getChartColour(4), module: 'Bonds' },
        { name: 'Forex', value: stats.forexBalanceINR, fill: getChartColour(5), color: getChartColour(5), module: 'Forex' },
        { name: 'Crypto', value: stats.cryptoBalanceINR, fill: getChartColour(6), color: getChartColour(6), module: 'Crypto' }
    ];

    const activeItems = rawData.filter(item => item.value > 0 && (item.module === 'Accounts' || enabledModules.includes(item.module)));
    const totalActive = activeItems.reduce((acc, curr) => acc + curr.value, 0);
    if (totalActive <= 0) return [];

    return activeItems.map(item => ({
      ...item,
      percentage: ((item.value / totalActive) * 100).toFixed(1)
    }));
  }, [
    showUSD,
    enabledModules,
    stats.cashBalanceUSD,
    stats.stockBalanceUSD,
    stats.mfBalanceUSD,
    stats.altBalanceUSD,
    stats.bondBalanceUSD,
    stats.forexBalanceUSD,
    stats.cryptoBalanceUSD,
    stats.cashBalanceINR,
    stats.stockBalanceINR,
    stats.mfBalanceINR,
    stats.altBalanceINR,
    stats.bondBalanceINR,
    stats.forexBalanceINR,
    stats.cryptoBalanceINR,
  ]);

  const chartData = useMemo(() => {
    return stats.trendData.map(d => ({
      ...d,
      income: d.income,
      expense: d.expense,
      netWorth: (d as any).netWorth || 0,
      investments: (d as any).investments || 0,
    }));
  }, [stats.trendData]);

  const filteredChartData = useMemo(() => {
    if (timeframe === "1M") return chartData.slice(-1);
    if (timeframe === "3M") return chartData.slice(-3);
    if (timeframe === "6M") return chartData.slice(-6);
    if (timeframe === "1Y") return chartData.slice(-12);
    return chartData; // ALL
  }, [chartData, timeframe]);

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="border border-white/10 bg-slate-950/80 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md px-4 py-3 rounded-2xl flex flex-col gap-1 z-50">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: data.payload.color || data.payload.fill || data.color }} />
            <span className="text-xs font-bold text-white uppercase tracking-wider">{data.name}</span>
          </div>
          <span className="text-xs font-black text-[--text-secondary] tabular-nums mt-1" style={{ color: data.payload.color || data.payload.fill || data.color }}>
            {showUSD ? "$" : "₹"}{Number(data.value || 0).toLocaleString()} ({data.payload.percentage}%)
          </span>
        </div>
      );
    }
    return null;
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="border border-white/10 bg-slate-950/80 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md px-4 py-3 rounded-2xl flex flex-col gap-1.5 z-50">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[--text-muted]">{label}</p>
          <div className="flex flex-col gap-1">
            {payload.map((pld: any) => (
              <div key={pld.name} className="flex items-center gap-4 justify-between min-w-[120px]">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pld.stroke || pld.color || pld.fill }} />
                  <span className="text-xs text-[--text-secondary] font-medium capitalize">{pld.name}</span>
                </div>
                <span className="text-xs font-black tabular-nums" style={{ color: pld.stroke || pld.color || pld.fill }}>
                  {showUSD ? "$" : "₹"}{Number(pld.value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-fade-in relative z-20 pb-10">
      
      {/* Dynamic Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between px-2">
          <Greeting monthlySpend={stats.monthlySpend} monthlyIncome={stats.monthlyIncome} budgetLimit={stats.monthlyIncome * 0.7} />
        </div>
      </div>


      {!isLoading && stats.totalAssets === 0 && recentLogs.length === 0 && (
        <div className="glass-card-static rich-border relative overflow-hidden p-8 md:p-10 border border-white/10 bg-white/[0.02]">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-cyan-400" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚀</span>
                <h2 className="text-xl font-black text-white">Welcome to your Dashboard Terminal</h2>
              </div>
              <p className="text-xs text-[--text-secondary] leading-relaxed max-w-2xl">
                Your database is initialized and completely clean. Let&apos;s breathe life into your dashboard! Manually construct your financial system to see allocations, investments, cash flows, and forex logs in action.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-shrink-0">
              <Link 
                href="/dashboard/accounts?action=new" 
                className="btn-primary !h-11 px-6 text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[--accent-primary] to-indigo-500 shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_25px_rgba(99,102,241,0.35)] active:scale-[0.98] transition-all flex items-center justify-center no-underline"
              >
                Create First Account
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          whileHover={{ y: -2 }}
          className="glass-card-static rich-border group relative overflow-hidden p-8 md:p-10 lg:col-span-3 border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/80 to-slate-900/90 hover:border-sky-500/30 hover:shadow-[0_25px_60px_rgba(14,165,233,0.18)] transition-all duration-500 backdrop-blur-2xl rounded-3xl"
        >
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-emerald-500 animate-pulse-glow" />
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-center justify-between gap-10 relative z-10">
            <div className="relative z-10 w-full lg:w-auto">
              <div 
                role="button"
                tabIndex={0}
                aria-label="Toggle currency between INR and USD"
                className="flex flex-col select-none cursor-pointer group/nw outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-2xl p-1 -m-1"
                onClick={() => setShowUSD(prev => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowUSD(prev => !prev);
                  }
                }}
                title="Click or press Space/Enter to toggle currency (INR / USD)"
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-[--text-muted] group-hover/nw:text-white transition-colors flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                    <span>Portfolio Net Worth</span>
                    <span className="text-[0.625rem] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-md">
                      {showUSD ? 'USD $' : 'INR ₹'}
                    </span>
                    <svg className="w-3.5 h-3.5 text-sky-400 group-hover/nw:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </span>

                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.6875rem] font-extrabold tracking-tight border backdrop-blur-md transition-all ${
                    stats.totalDayPnL >= 0 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-[0_0_15px_rgba(52,211,153,0.2)]' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/25 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                  }`}>
                    <span>Today: {stats.totalDayPnL >= 0 ? "+" : "-"}</span>
                    <span>
                      {showUSD 
                        ? `$${Math.abs(stats.totalDayPnLUSD).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : `₹${Math.abs(stats.totalDayPnLINR).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                      }
                    </span>
                    <span className="opacity-80">
                      ({stats.totalDayPnLPercent >= 0 ? "+" : ""}{(stats.totalDayPnLPercent || 0).toFixed(2)}%)
                    </span>
                  </span>
                </div>
                <div className="relative flex items-center justify-start h-[3.5rem] md:h-[4rem] w-[280px] sm:w-[450px]">
                  <AnimatePresence>
                    <motion.h2 
                      key={showUSD ? 'usd' : 'inr'} 
                      initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className={`absolute left-0 bg-clip-text bg-gradient-to-r text-[clamp(2.4rem,5vw,3.8rem)] font-[950] leading-none tracking-[-0.04em] text-transparent [font-family:'Outfit',sans-serif] whitespace-nowrap overflow-hidden transition-all duration-500 ${
                        showUSD 
                          ? "from-white via-sky-200 to-indigo-300 drop-shadow-[0_10px_35px_rgba(99,102,241,0.35)]" 
                          : "from-white via-white to-slate-200 drop-shadow-[0_10px_35px_rgba(14,165,233,0.35)]"
                      }`}
                    >
                    {showUSD 
                      ? `$${stats.netWorthUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
                      : `₹${stats.netWorthINR.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    }
                  </motion.h2>
                  </AnimatePresence>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-5">
                <motion.div 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex items-center gap-3 border px-5 py-3.5 rounded-2xl transition-all cursor-default backdrop-blur-md ${
                    stats.totalDayPnL >= 0 
                      ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15 shadow-[0_4px_20px_rgba(16,185,129,0.1)]' 
                      : 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15 shadow-[0_4px_20px_rgba(239,68,68,0.1)]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shadow-inner ${
                    stats.totalDayPnL >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {stats.totalDayPnL >= 0 ? "⚡" : "📉"}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[--text-muted]">Today&apos;s Return</span>
                    <span className={`text-sm sm:text-base font-black ${stats.totalDayPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stats.totalDayPnL >= 0 ? "+" : "-"}
                      {showUSD 
                        ? `$${Math.abs(stats.totalDayPnLUSD).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
                        : `₹${Math.abs(stats.totalDayPnLINR).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                      }
                      <span className="text-xs font-bold ml-1.5 opacity-80">
                        ({stats.totalDayPnLPercent >= 0 ? "+" : ""}{(stats.totalDayPnLPercent || 0).toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-5 py-3.5 rounded-2xl transition-all hover:bg-emerald-500/15 shadow-[0_4px_20px_rgba(16,185,129,0.1)] backdrop-blur-md cursor-default"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 text-base shadow-inner">📈</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[--text-muted]">Liquid Assets</span>
                    <span className="text-sm sm:text-base font-black text-emerald-400">
                      {showUSD 
                        ? `+$${stats.liquidBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
                        : `+₹${stats.liquidBalanceINR.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                      }
                    </span>
                  </div>
                </motion.div>

                {/* Total All-Time Growth Badge */}
                <motion.div 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex items-center gap-3 border px-5 py-3.5 rounded-2xl transition-all backdrop-blur-md cursor-default ${
                    (stats.totalGrowthINR || 0) >= 0 
                      ? 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15 shadow-[0_4px_20px_rgba(168,85,247,0.1)]' 
                      : 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15 shadow-[0_4px_20px_rgba(239,68,68,0.1)]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shadow-inner ${
                    (stats.totalGrowthINR || 0) >= 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    🏆
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[--text-muted]">Total Growth</span>
                    <span className={`text-sm sm:text-base font-black ${(stats.totalGrowthINR || 0) >= 0 ? 'text-purple-400' : 'text-rose-400'}`}>
                      {(stats.totalGrowthINR || 0) >= 0 ? "+" : "-"}
                      {showUSD 
                        ? `$${Math.abs(stats.totalGrowthUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
                        : `₹${Math.abs(stats.totalGrowthINR || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                      }
                      <span className="text-xs font-bold ml-1.5 opacity-80">
                        ({(stats.totalGrowthPercent || 0) >= 0 ? "+" : ""}{(stats.totalGrowthPercent || 0).toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="flex-1 max-w-md w-full">
              <div className="flex flex-col sm:flex-row items-center gap-6 h-full justify-between">
                {portfolioData.length === 0 ? (
                  <div className="w-full flex h-[200px] items-center justify-center italic text-[--text-muted] text-sm">No portfolio data available.</div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 space-y-2.5 w-full">
                      <p className="text-xs font-semibold text-[--text-muted] mb-3">Portfolio allocation</p>
                      {portfolioData.map((item) => (
                        <div key={item.name} className="flex justify-between items-center gap-3 min-w-0 py-1.5 px-2 rounded-lg">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                            <span className="text-xs font-bold text-[--text-secondary] truncate group-hover:text-white transition-colors">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 text-right">
                            <span className="text-[0.5625rem] font-bold text-[--text-muted]">{item.percentage}%</span>
                            <span className="text-xs font-black tabular-nums whitespace-nowrap" style={{ color: item.color }}>
                              {showUSD ? '$' : '₹'}{item.value > 10000000 
                                ? Intl.NumberFormat(showUSD ? 'en-US' : 'en-IN', { notation: 'compact', maximumFractionDigits: 2 }).format(item.value) 
                                : item.value.toLocaleString(showUSD ? 'en-US' : 'en-IN', { minimumFractionDigits: showUSD && item.value % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-[140px] w-[140px] flex-shrink-0 relative">
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <PieChart>
                          <Pie data={portfolioData} cx="50%" cy="50%" innerRadius={50} outerRadius={65} paddingAngle={5} dataKey="value" isAnimationActive={false}>
                            {portfolioData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                        <span className="text-xs font-semibold text-[--text-muted]">Assets</span>
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
        </motion.div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6">
          {(enabledModules.includes("Income") || enabledModules.includes("Expenses")) && (
            <div className="glass-card-static rich-border p-6 md:p-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-white">
                    {activeChartMetric === "cashflow" ? "Cash Flow" : activeChartMetric === "assets" ? "Net Worth Over Time" : "Investment Growth"}
                  </h3>
                  <span className="text-xs text-[--text-muted] mt-1">
                    {activeChartMetric === "cashflow" ? `Income vs expenses (${timeframe} view)` : activeChartMetric === "assets" ? `Cumulative net worth trend (${timeframe} view)` : `Portfolio performance (${timeframe} view)`}
                  </span>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Timeframe Control Bar */}
                    <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
                      {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-black tracking-wider transition-all cursor-pointer ${
                            timeframe === tf
                              ? "bg-white/20 text-white shadow-sm"
                              : "text-[--text-muted] hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>

                    {/* Chart Metric Control Bar */}
                    <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
                      {[
                        { key: "cashflow", label: "Cash Flow" },
                        { key: "assets", label: "Net Worth" },
                        { key: "investments", label: "Investments" },
                      ].map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setActiveChartMetric(m.key as any)}
                          aria-pressed={activeChartMetric === m.key}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeChartMetric === m.key
                              ? "bg-[--accent-primary] text-white shadow-md shadow-[--accent-primary]/20"
                              : "text-[--text-muted] hover:text-white"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeChartMetric === "cashflow" && (
                    <div className="flex items-center gap-3 mt-1">
                      {enabledModules.includes("Income") && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[--accent-primary]" />
                          <span className="text-xs font-medium text-white/60">Income</span>
                        </div>
                      )}
                      {enabledModules.includes("Expenses") && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-xs font-medium text-white/60">Expenses</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <AreaChart data={filteredChartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="netWorthGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="investmentGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }} dy={10} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }} 
                      dx={-10}
                      tickFormatter={(value) => {
                        const formatted = Intl.NumberFormat(showUSD ? 'en-US' : 'en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
                        return showUSD ? `$${formatted}` : `₹${formatted}`;
                      }}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    {activeChartMetric === "cashflow" && enabledModules.includes("Income") && (
                      <Area type="monotone" dataKey="income" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#incomeGlow)" isAnimationActive={false} />
                    )}
                    {activeChartMetric === "cashflow" && enabledModules.includes("Expenses") && (
                      <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#expenseGlow)" isAnimationActive={false} />
                    )}
                    {activeChartMetric === "assets" && (
                      <Area type="monotone" dataKey="netWorth" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#netWorthGlow)" isAnimationActive={false} />
                    )}
                    {activeChartMetric === "investments" && (
                      <Area type="monotone" dataKey="investments" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#investmentGlow)" isAnimationActive={false} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* FINANCIAL PULSE - LEDGER ACTIVITY */}
          {enabledModules.includes("Ledger") && (
            <div className="glass-card-static rich-border p-6 md:p-8 animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-[--text-secondary]">Financial ledger</h3>
                  <p className="text-xs text-[--text-secondary] mt-1">Recent account activity</p>
                </div>
                <Link href="/dashboard/ledger" className="btn-secondary !h-9 !px-4 text-xs">Audit Trail</Link>
              </div>

              <div className="divide-y divide-white/5 border border-white/5 rounded-2xl overflow-hidden">
                {recentLogs.slice(0, 4).map((log) => {
                  const isOut = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
                  return (
                    <div key={log.id} className="flex items-center justify-between gap-4 p-5">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                          {log.action_type === "CREATE" ? "✨" : isOut ? "📉" : "📈"}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="text-sm font-bold text-white group-hover:text-[--accent-primary-light] transition-colors truncate">{log.details}</span>
                          <span className="text-[0.5625rem] font-black uppercase text-[--text-muted] tracking-wider mt-1">
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
                  <div className="py-16 text-center text-xs font-bold uppercase text-[--text-muted] tracking-widest italic bg-white/[0.01]">
                    System initialized. Waiting for transaction input logs...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
});


export default DashboardDesktop;
