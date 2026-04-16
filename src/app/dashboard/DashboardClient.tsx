"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { format, endOfMonth, isWithinInterval, startOfMonth , addMonths, startOfDay } from "date-fns";
import Link from "next/link";
import Greeting from "@/components/greeting";
import { useFinanceData } from "@/hooks/use-finance-data";
import { createClient } from "@/lib/supabase-browser";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false, loading: () => <div className="skeleton h-full w-full rounded-2xl border border-white/5" /> }
);
const AreaChart = dynamic(() => import("recharts").then((mod) => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((mod) => mod.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), { ssr: false });
const Legend = dynamic(() => import("recharts").then((mod) => mod.Legend), { ssr: false });
import { CATEGORIES } from "./expenses/ExpensesClient";
import { parseISO, subMonths } from "date-fns";


const supabase = createClient();
const CHART_COLOR_FALLBACKS = [
  "#6c5ce7",
  "#00cec9",
  "#00b894",
  "#fdcb6e",
  "#d63031",
  "#a29bfe",
  "#fab1a0",
  "#81ecec",
  "#ff7675",
  "#74b9ff",
];
const CSS_COLOR_MAP: Record<string, string> = {
  "var(--accent-primary)": "#6c5ce7",
  "var(--accent-primary-light)": "#a29bfe",
  "var(--accent-secondary)": "#00cec9",
  "var(--success)": "#00b894",
  "var(--warning)": "#fdcb6e",
  "var(--danger)": "#d63031",
  "var(--text-muted)": "#5a6180",
};

export default function DashboardClient() {
  const { data: { accounts, transactions, ledgerLogs: recentLogs, investments, mutualFunds }, isLoading, isValidating } = useFinanceData();

  const stats = useMemo(() => {
    const cashBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const stockBalance = investments.reduce((sum, inv) => sum + (Number(inv.quantity) * Number(inv.current_price || 0)), 0);
    const mfBalance = mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0);
    const stockCount = investments.filter((inv) => Number(inv.quantity) > 0).length;
    const mfCount = mutualFunds.filter((mf) => Number(mf.units) > 0).length;
    const totalBalance = cashBalance + stockBalance + mfBalance;
    
    const now = new Date();
    const currentMonthTxns = transactions.filter((transaction) =>
      isWithinInterval(new Date(transaction.date), {
        start: startOfMonth(now),
        end: endOfMonth(now),
      })
    );

    const monthlySpend = currentMonthTxns
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    const monthlyIncome = currentMonthTxns
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    const expenseTrend = transactions
      .filter((transaction) => transaction.type === "expense")
      .slice(0, 15)
      .reverse()
      .map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      }));

    // Income vs Expense past 6 months
    const trendMap: Record<string, {name: string, income: number, expense: number}> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const m = format(d, "MMM");
      trendMap[m] = { name: m, income: 0, expense: 0 };
    }
    transactions.forEach(t => {
      if (!t.date) return;
      try {
        const m = format(parseISO(t.date), "MMM");
        if (trendMap[m]) {
          if (t.type === "income") trendMap[m].income += Number(t.amount);
          if (t.type === "expense") trendMap[m].expense += Number(t.amount);
        }
      } catch (e) {}
    });
    const incomeExpenseData = Object.values(trendMap);

    // Category Pie Chart (Current Month)
    const catMap: Record<string, number> = {};
    currentMonthTxns.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category || "Others"] = (catMap[t.category || "Others"] || 0) + Number(t.amount);
    });
    const pieData = Object.entries(catMap).map(([name, value], index) => {
      const dashboardColors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", 
        "#F7DC6F", "#BB8FCE", "#82E0AA", "#F1948A", "#85C1E9"
      ];
      const resolvedColor = dashboardColors[index % dashboardColors.length];
      return { 
        name, 
        value,
        fill: resolvedColor,
        color: resolvedColor
      };
    }).sort((a,b) => b.value - a.value);

    // Spending Velocity (Alternative to Forecast)
    const velocityData = currentMonthTxns
        .filter(t => t.type === 'expense')
        .slice(-10)
        .map(t => ({ name: t.date, amount: Number(t.amount) }));

    return {
      velocityData,
      currentMonthTxns,
      totalBalance,
      monthlySpend,
      monthlyIncome,
      expenseTrend,
      incomeExpenseData,
      pieData,
      accountCount: accounts.length,
      stockBalance,
      mfBalance,
      stockCount,
      mfCount,
    };
  }, [accounts, transactions, investments, mutualFunds]);

  return (
    <>
      {/* 📱 MOBILE EXCLUSIVE: DATA ENTRY HUB */}
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

        {/* 📱 RECENT PULSE (Exclusive for Mobile visibility) */}
        <div className="px-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted]">Financial Pulse</h3>
            <span className={`status-dot scale-50 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'}`} title={isValidating ? "Syncing..." : "Real-time Synced"} />
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
                        <span className="text-[8px] font-black uppercase text-[--text-muted]">{format(new Date(log.created_at), "HH:mm")} • {log.account_name}</span>
                      </div>
                    </div>
                    <span className={`text-[13px] font-black ${isOut ? "text-red-400" : "text-emerald-400"}`}>
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
           <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted] mb-4">Portfolio Snapshot</h3>
           <div className="grid grid-cols-1 gap-3">
             <div className="glass-card-static p-4 flex items-center justify-between border-blue-500/20 bg-blue-500/5">
               <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">📈</div>
                 <div className="flex flex-col">
                   <span className="text-xs font-black uppercase tracking-wider text-white">Stocks</span>
                   <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">{stats.stockCount} holding{stats.stockCount === 1 ? "" : "s"}</span>
                 </div>
               </div>
               <span className="text-sm font-black tabular-nums text-white">₹{stats.stockBalance.toLocaleString()}</span>
             </div>
             <div className="glass-card-static p-4 flex items-center justify-between border-purple-500/20 bg-purple-500/5">
               <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">🏦</div>
                 <div className="flex flex-col">
                   <span className="text-xs font-black uppercase tracking-wider text-white">Mutual Funds</span>
                   <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">{stats.mfCount} fund{stats.mfCount === 1 ? "" : "s"}</span>
                 </div>
               </div>
               <span className="text-sm font-black tabular-nums text-white">₹{stats.mfBalance.toLocaleString()}</span>
             </div>
           </div>
         </div>
      </div>

      {/* 💻 DESKTOP EXCLUSIVE: FULL ANALYTICS */}
      <div className="hidden md:flex flex-col gap-[var(--section-gap)] animate-fade-in relative z-20">

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <Greeting />
        <div className="flex gap-3">
        </div>
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
              <div className="mt-8" />
            </div>

            {/* SECTOR ALLOCATION MERGED HERE */}
            <div className="flex-1 max-w-md w-full">
              <div className="flex items-center gap-6 h-full">
                {stats.pieData.length === 0 ? (
                  <div className="w-full flex h-[200px] items-center justify-center italic text-[--text-muted] text-sm bg-white/5 rounded-3xl">No expenses recorded.</div>
                ) : (
                  <>
                    <div className="w-1/2 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[--text-muted] mb-3">Sector Allocation</p>
                      {stats.pieData.slice(0, 4).map((item) => (
                        <div key={item.name} className="flex justify-between items-center group">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            <span className="text-[10px] font-bold text-[--text-secondary] truncate max-w-[80px]">{item.name}</span>
                          </div>
                          <span className="text-[10px] font-black tabular-nums">₹{item.value.toLocaleString()}</span>
                        </div>
                      ))}
                      {stats.pieData.length > 4 && (
                        <div className="text-[9px] text-[--text-muted] pt-1 font-bold uppercase tracking-wider group-hover:text-[--accent-primary-light] transition-colors">
                          + {stats.pieData.length - 4} more
                        </div>
                      )}
                    </div>
                    <div className="h-[180px] w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={6} dataKey="value">
                            {stats.pieData.map((entry, index) => (
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
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
              Spending Velocity (Recent Trend)
            </h3>
            <Link
              href="/dashboard/expenses"
              className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary] underline-offset-4 decoration-2 hover:underline"
            >
              Analyze
            </Link>
          </div>
          <div className="h-[280px] w-full">
            {stats.expenseTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] text-sm italic text-[--text-muted]">
                Expense data will appear here once activity is recorded.
              </div>
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
                  <XAxis hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "12px",
                    }}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--accent-primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>



        <div className="glass-card-static p-6 md:p-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
              Recent Activities
            </h3>
            <Link
              href="/dashboard/ledger"
              className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary] underline-offset-4 decoration-2 hover:underline"
            >
              View Ledger
            </Link>
          </div>
          <div className="space-y-4">
            {recentLogs.length === 0 ? (
              <div className="py-12 text-center text-sm italic text-[--text-muted]">
                No recent activities found.
              </div>
            ) : (
              recentLogs.map((log) => {
                const isOutflow =
                  log.action_type === "DELETE" ||
                  log.action_type === "TRANSFER_OUT" ||
                  log.action_type === "SEND_MONEY" ||
                  log.action_type === "ADJUST_DOWN";

                return (
                  <div
                    key={log.id}
                    className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04] md:p-5"
                  >
                    <div className="flex min-w-0 items-center gap-3 md:gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[--accent-primary]/10 text-lg shadow-inner md:h-12 md:w-12 md:rounded-2xl md:text-xl">
                        {log.action_type === "CREATE" ? "✨" : log.action_type === "DELETE" ? "🗑️" : "💰"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-[--text-primary] transition-colors group-hover:text-[--accent-primary-light] md:text-sm">
                          {log.details}
                        </p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[--text-muted] md:text-[10px]">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="pl-4 text-right">
                      <p
                        className={`whitespace-nowrap text-[13px] font-black md:text-sm ${
                          isOutflow ? "text-[--danger]" : "text-[--success]"
                        }`}
                      >
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
    </>
  );
}
