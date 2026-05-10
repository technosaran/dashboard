"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo, memo } from "react";
import Greeting from "@/components/greeting";
import type { FinanceData } from "@/hooks/use-finance-data";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from "recharts";

import { CHART_COLOURS } from "@/lib/chart-colours";

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
  cashBalance: number;
};

type Props = {
  stats: DashboardStats;
  recentLogs: FinanceData["ledgerLogs"];
  isLoading: boolean;
  isValidating: boolean;
};

const DashboardDesktop = memo(function DashboardDesktop({ stats, recentLogs, isLoading, isValidating }: Props) {
  // Extract portfolio data computation into a single useMemo
  const portfolioData = useMemo<PieEntry[]>(() => {
    if (stats.totalAssets <= 0) return [];
    
    return [
      { 
        name: 'Cash', 
        value: stats.cashBalance, 
        fill: CHART_COLOURS[0],
        color: CHART_COLOURS[0],
        percentage: ((stats.cashBalance / stats.totalAssets) * 100).toFixed(1)
      },
      { 
        name: 'Stocks', 
        value: stats.stockBalance, 
        fill: CHART_COLOURS[1],
        color: CHART_COLOURS[1],
        percentage: ((stats.stockBalance / stats.totalAssets) * 100).toFixed(1)
      },
      { 
        name: 'Mutual Funds', 
        value: stats.mfBalance, 
        fill: CHART_COLOURS[2],
        color: CHART_COLOURS[2],
        percentage: ((stats.mfBalance / stats.totalAssets) * 100).toFixed(1)
      },
      { 
        name: 'Assets', 
        value: stats.altBalance, 
        fill: CHART_COLOURS[3],
        color: CHART_COLOURS[3],
        percentage: ((stats.altBalance / stats.totalAssets) * 100).toFixed(1)
      },
      { 
        name: 'Bonds', 
        value: stats.bondBalance, 
        fill: CHART_COLOURS[4],
        color: CHART_COLOURS[4],
        percentage: ((stats.bondBalance / stats.totalAssets) * 100).toFixed(1)
      }
    ].filter(item => item.value > 0);
  }, [stats.totalAssets, stats.cashBalance, stats.stockBalance, stats.mfBalance, stats.altBalance, stats.bondBalance]);

  return (
    <div className="hidden md:flex flex-col gap-[var(--section-gap)] animate-fade-in relative z-20">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <Greeting />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-card-static group relative overflow-hidden p-6 md:p-10 lg:col-span-3">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="relative z-10">
              <div className="mb-4 flex items-center gap-2 md:mb-6">
                <div className={`status-dot scale-75 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'}`} />
                <span className="text-xs font-bold uppercase tracking-[0.4em] text-[--text-muted] md:text-sm">
                  Portfolio Net Worth {isLoading && <span className="text-[10px] lowercase italic">(loading...)</span>}
                </span>
              </div>
              <h2 className="bg-gradient-to-r from-white via-white to-[--text-secondary] bg-clip-text text-[clamp(2.5rem,10vw,4rem)] font-[900] leading-none tracking-[-0.05em] text-transparent drop-shadow-[0_10px_30px_rgba(108,92,231,0.2)] [font-family:'Outfit',sans-serif]">
                ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </h2>

              <div className="mt-8 flex flex-wrap items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Total Assets</span>
                  <span className="text-lg font-bold text-emerald-400">₹{stats.totalAssets.toLocaleString()}</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Total Debt</span>
                  <span className="text-lg font-bold text-rose-500">₹{stats.debtBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* PORTFOLIO ALLOCATION */}
            <div className="flex-1 max-w-md w-full">
              <div className="flex items-center gap-6 h-full">
                {portfolioData.length === 0 ? (
                  <div className="w-full flex h-[200px] items-center justify-center italic text-[--text-muted] text-sm bg-white/5 rounded-3xl">No portfolio data available.</div>
                ) : (
                  <>
                    <div className="w-1/2 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[--text-muted] mb-3">Portfolio Allocation</p>
                      {portfolioData.map((item) => (
                        <div key={item.name} className="flex justify-between items-center group">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            <span className="text-[10px] font-bold text-[--text-secondary] truncate max-w-[80px]">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-[--text-muted]">{item.percentage}%</span>
                            <span className="text-[10px] font-black tabular-nums">₹{item.value.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-[180px] w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={portfolioData} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={55} 
                            outerRadius={80} 
                            paddingAngle={6} 
                            dataKey="value"
                          >
                            {portfolioData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }}
                            formatter={(value) => `₹${Number(value || 0).toLocaleString()}`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card-static p-6 md:p-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Spending Velocity</h3>
            <Link href="/dashboard/expenses" className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary] underline">Analyze</Link>
          </div>
          <div className="h-[280px] w-full">
            {stats.expenseTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] text-sm italic text-[--text-muted]">Expense data will appear here.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.expenseTrend}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }} />
                  <Area type="monotone" dataKey="amount" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      <div className="glass-card-static rounded-[32px] overflow-hidden border-white/5 lg:col-span-2">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white">Institutional Ledger Pulse</h3>
          <Link href="/dashboard/ledger" className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] hover:text-white transition-colors">View Complete History →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[9px] text-[--text-muted] uppercase font-black tracking-widest bg-white/[0.01]">
                <th className="py-4 px-8">Timestamp</th>
                <th className="py-4 px-8">Classification</th>
                <th className="py-4 px-8">Activity Detail</th>
                <th className="py-4 px-8 text-right">Value Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentLogs.slice(0, 10).map((log) => {
                const isOut = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
                return (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-5 px-8">
                      <p className="text-[11px] font-bold text-white/80">{log.created_at ? format(new Date(log.created_at), "MMM d, HH:mm") : "N/A"}</p>
                    </td>
                    <td className="py-5 px-8">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        log.action_type === "CREATE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        isOut ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-5 px-8">
                      <p className="text-[12px] font-bold text-white group-hover:text-[--accent-primary-light] transition-colors">{log.details}</p>
                    </td>
                    <td className="py-5 px-8 text-right tabular-nums">
                      <p className={`text-[12px] font-black ${isOut ? "text-rose-400" : "text-emerald-400"}`}>
                        {log.amount ? `${isOut ? "-" : "+"}₹${log.amount.toLocaleString()}` : "—"}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* 6-Month Income vs Expense Trend */}
      <div className="glass-card-static p-6 md:p-8">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Income vs Expense (6 Months)</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[--success]" />
              <span className="text-[10px] font-bold text-[--text-muted]">Income</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[--danger]" />
              <span className="text-[10px] font-bold text-[--text-muted]">Expense</span>
            </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          {stats.trendData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] text-sm italic text-[--text-muted]">Transaction data will appear here.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 'bold' }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }} 
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--bg-surface)', 
                    border: '1px solid var(--border-default)', 
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  formatter={(value) => `₹${Number(value || 0).toLocaleString()}`}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="income" fill="var(--success)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" fill="var(--danger)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS / COMMAND CENTER */}
      <div className="flex flex-col gap-4">
        <div className="glass-card-static p-6 h-full flex flex-col justify-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[--text-muted] mb-6">Command Center</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Record Expense", href: "/dashboard/expenses?action=new", icon: "🔴", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
              { label: "Log Income", href: "/dashboard/income?action=new", icon: "🟢", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
              { label: "Internal Transfer", href: "/dashboard/transfers?action=new", icon: "🔄", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
              { label: "Asset Entry", href: "/dashboard/alternative-assets?action=new", icon: "🏛️", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
            ].map((action, i) => (
              <Link key={i} href={action.href} className={`flex flex-col items-center justify-center p-4 rounded-3xl border transition-all hover:scale-105 active:scale-95 ${action.color}`}>
                 <span className="text-2xl mb-2">{action.icon}</span>
                 <span className="text-[9px] font-black uppercase tracking-widest text-center">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default DashboardDesktop;
