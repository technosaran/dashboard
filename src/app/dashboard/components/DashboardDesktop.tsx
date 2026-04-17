"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "date-fns";
import Greeting from "@/components/greeting";
import type { FinanceData } from "@/hooks/use-finance-data";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-2xl border border-white/5" /> }
);
const AreaChart = dynamic(() => import("recharts").then((mod) => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((mod) => mod.Area), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), { ssr: false });

type DashboardStats = {
  totalBalance: number;
  monthlySpend: number;
  monthlyIncome: number;
  expenseTrend: any[];
  pieData: any[];
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

export default function DashboardDesktop({ stats, recentLogs, isLoading, isValidating }: Props) {
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
            </div>

            {/* SECTOR ALLOCATION */}
            <div className="flex-1 max-w-md w-full">
              <div className="flex items-center gap-6 h-full">
                {stats.pieData.length === 0 ? (
                  <div className="w-full flex h-[200px] items-center justify-center italic text-[--text-muted] text-sm bg-white/5 rounded-3xl">No expenses recorded.</div>
                ) : (
                  <>
                    <div className="w-1/2 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[--text-muted] mb-3">Sector Allocation</p>
                      {stats.pieData.slice(0, 4).map((item: any) => (
                        <div key={item.name} className="flex justify-between items-center group">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            <span className="text-[10px] font-bold text-[--text-secondary] truncate max-w-[80px]">{item.name}</span>
                          </div>
                          <span className="text-[10px] font-black tabular-nums">₹{item.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="h-[180px] w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={6} dataKey="value">
                            {stats.pieData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }} />
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

        <div className="glass-card-static p-6 md:p-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Recent Activities</h3>
            <Link href="/dashboard/ledger" className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary] underline">View Ledger</Link>
          </div>
          <div className="space-y-4">
            {recentLogs.length === 0 ? (
              <div className="py-12 text-center text-sm italic text-[--text-muted]">No recent activities found.</div>
            ) : (
              recentLogs.map((log) => {
                const isOutflow = ["DELETE", "TRANSFER_OUT", "SEND_MONEY", "ADJUST_DOWN"].includes(log.action_type);
                return (
                  <div key={log.id} className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--accent-primary]/10 text-lg shadow-inner">
                        {log.action_type === "CREATE" ? "✨" : log.action_type === "DELETE" ? "🗑️" : "💰"}
                      </div>
                      <div>
                        <p className="truncate text-[13px] font-bold text-[--text-primary] group-hover:text-[--accent-primary-light]">{log.details}</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[--text-muted]">{format(new Date(log.created_at), "MMM d, HH:mm")}</p>
                      </div>
                    </div>
                    <div className="pl-4 text-right">
                      <p className={`text-[13px] font-black ${isOutflow ? "text-[--danger]" : "text-[--success]"}`}>
                        {log.amount ? `${isOutflow ? "-" : "+"}₹${log.amount.toLocaleString()}` : "—"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
