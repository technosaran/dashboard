"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useMemo, memo } from "react";
import Greeting from "@/components/greeting";
import type { FinanceData } from "@/hooks/use-finance-data";
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";

import { CHART_SERIES_COLOURS, getChartColour } from "@/lib/chart-colours";

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
          fill: getChartColour(0),
          color: getChartColour(0),
          percentage: ((stats.cashBalance / stats.totalAssets) * 100).toFixed(1)
        },
        { 
          name: 'Stocks', 
          value: stats.stockBalance, 
          fill: getChartColour(1),
          color: getChartColour(1),
          percentage: ((stats.stockBalance / stats.totalAssets) * 100).toFixed(1)
        },
        { 
          name: 'Mutual Funds', 
          value: stats.mfBalance, 
          fill: getChartColour(2),
          color: getChartColour(2),
          percentage: ((stats.mfBalance / stats.totalAssets) * 100).toFixed(1)
        },
        { 
          name: 'Assets', 
          value: stats.altBalance, 
          fill: getChartColour(3),
          color: getChartColour(3),
          percentage: ((stats.altBalance / stats.totalAssets) * 100).toFixed(1)
        },
        { 
          name: 'Bonds', 
          value: stats.bondBalance, 
          fill: getChartColour(4),
          color: getChartColour(4),
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
              <div className="flex items-baseline gap-4 flex-wrap">
                <h2 className="bg-gradient-to-r from-white via-white to-[--text-secondary] bg-clip-text text-[clamp(2.5rem,10vw,4rem)] font-[900] leading-none tracking-[-0.05em] text-transparent drop-shadow-[0_10px_30px_rgba(108,92,231,0.2)] [font-family:'Outfit',sans-serif]">
                  ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                </h2>
                <div className={`flex flex-col mb-2 ${stats.totalDayPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  <span className="text-[14px] font-black tabular-nums">
                    {stats.totalDayPnL >= 0 ? '+' : '-'}₹{Math.abs(stats.totalDayPnL).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-black opacity-60 tabular-nums">
                    ({stats.totalDayPnL >= 0 ? '+' : ''}{stats.totalDayPnLPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Total Assets</span>
                  <span className="text-lg font-bold text-emerald-400">+₹{stats.totalAssets.toLocaleString()}</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Total Debt</span>
                  <span className="text-lg font-bold text-rose-500">-₹{stats.debtBalance.toLocaleString()}</span>
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
                        <div key={item.name} className="flex justify-between items-center group gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                            <span className="text-[10px] font-bold text-[--text-secondary] truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[9px] font-bold text-[--text-muted]">{item.percentage}%</span>
                            <span className="text-[10px] font-black tabular-nums whitespace-nowrap">₹{item.value.toLocaleString()}</span>
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




    </div>
  );
});

export default DashboardDesktop;
