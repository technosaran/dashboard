"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { format, endOfMonth, isWithinInterval, startOfMonth , addMonths, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import Greeting from "@/components/greeting";
import { useRealTimeSync } from "@/hooks/use-realtime-sync";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false }
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

type Account = Tables<"accounts">;
type Transaction = Tables<"transactions">;
type LedgerLog = Tables<"ledger_logs">;

interface DashboardClientProps {
  initialAccounts: Account[];
  initialTransactions: Transaction[];
  initialLogs: LedgerLog[];
  initialInvestments: Tables<"investments">[];
  initialMutualFunds: Tables<"mutual_funds">[];
}

export default function DashboardClient({
  initialAccounts,
  initialTransactions,
  initialLogs,
  initialInvestments,
  initialMutualFunds
}: DashboardClientProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [recentLogs, setRecentLogs] = useState<LedgerLog[]>(initialLogs);
  const [investments, setInvestments] = useState<Tables<"investments">[]>(initialInvestments || []);
  const [mutualFunds, setMutualFunds] = useState<Tables<"mutual_funds">[]>(initialMutualFunds || []);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const [accRes, transRes, logRes, invRes, mfRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false }),
      supabase
        .from("ledger_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("investments").select("*").eq("user_id", user.id),
      supabase.from("mutual_funds").select("*").eq("user_id", user.id),
    ]);

    if (accRes.data) setAccounts(accRes.data);
    if (transRes.data) setTransactions(transRes.data);
    if (logRes.data) setRecentLogs(logRes.data as LedgerLog[]);
    if (invRes.data) setInvestments(invRes.data);
    if (mfRes.data) setMutualFunds(mfRes.data);
  }, []);

  useRealTimeSync(fetchData);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime-master")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "incomes" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_logs" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "investments" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "mutual_funds" }, () => startTransition(fetchData))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const stats = useMemo(() => {
    const cashBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const stockBalance = investments.reduce((sum, inv) => sum + (Number(inv.quantity) * Number(inv.current_price || 0)), 0);
    const mfBalance = mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0);
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
    const pieData = Object.entries(catMap).map(([name, value]) => {
      const categoryTheme = CATEGORIES.find(c => c.label === name);
      return { 
        name, 
        value,
        color: categoryTheme ? categoryTheme.color : "#8884d8"
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
    };
  }, [accounts, transactions]);

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
      </div>

      {/* 💻 DESKTOP EXCLUSIVE: FULL ANALYTICS */}
      <div className="hidden md:flex flex-col gap-[var(--section-gap)] animate-fade-in relative z-20">

      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <Greeting />
        <div className="flex gap-3">
          <Link href="/dashboard/accounts?action=new" className="btn-primary flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" />
            </svg>
            Add Account
          </Link>
        </div>
      </div>

      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        <div className="glass-card-static group relative overflow-hidden p-6 md:p-10 lg:col-span-2">
          <div className="absolute right-0 top-0 p-8 opacity-10 transition-opacity group-hover:opacity-20">
            <svg className="h-40 w-40" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="mb-4 flex items-center gap-2 md:mb-6">
              <div className="status-dot scale-75" />
              <span className="text-xs font-bold uppercase tracking-[0.4em] text-[--text-muted] md:text-sm">
                Portfolio Net Worth
              </span>
            </div>
            <h2 className="bg-gradient-to-r from-white via-white to-[--text-secondary] bg-clip-text text-[clamp(2.5rem,10vw,5rem)] font-[900] leading-none tracking-[-0.05em] text-transparent drop-shadow-[0_10px_30px_rgba(108,92,231,0.2)] [font-family:'Outfit',sans-serif]">
              ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-full border border-[--accent-primary]/20 bg-[--accent-primary]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[--accent-primary-light]">
                Institutional Grade
              </div>
              <div className="rounded-full border border-[--success]/20 bg-[--success]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[--success]">
                Live Sync Active
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="glass-card-static group relative flex flex-col justify-center overflow-hidden p-6">
            <div className="absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
              <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[--text-muted]">
              Monthly Cashflow
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-[--success]">
                +₹{stats.monthlyIncome.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-[--danger]">
                -₹{stats.monthlySpend.toLocaleString()}
              </span>
            </div>
            <h3 className="mt-1 text-4xl font-black text-[--text-primary] [font-family:'Outfit',sans-serif]">
              ₹{(stats.monthlyIncome - stats.monthlySpend).toLocaleString()}
            </h3>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[--text-muted]">
              Net savings this month
            </p>
          </div>
          <div className="glass-card-static group relative flex flex-col justify-center overflow-hidden p-6">
            <div className="absolute right-0 top-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
              <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
              </svg>
            </div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[--text-muted]">
              Active Channels
            </p>
            <h3 className="text-4xl font-black text-[--text-primary] [font-family:'Outfit',sans-serif]">
              {stats.accountCount} <span className="text-lg text-[--text-muted]">Sources</span>
            </h3>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[--success]">
              All systems operational
            </p>
          </div>
        </div>
      </div>

{/* Visual Analytics Row 1 */}
      <h2 className="text-xl font-bold tracking-tight text-[--text-primary] mt-4 mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-[--accent-primary]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m12-11a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Visual Analytics
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Income vs Expense Graph */}
        <div className="glass-card-static p-6 md:p-8">
          <h3 className="mb-8 text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
            Cashflow Engine (6 Months)
          </h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={10} />
                <YAxis hide />
                <Tooltip
                  cursor={{fill: 'rgba(255,255,255,0.02)'}}
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="glass-card-static p-6 md:p-8">
          <h3 className="mb-8 text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
            Sector Allocation (Current Month)
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 h-full min-h-[280px]">
            {stats.pieData.length === 0 ? (
               <div className="w-full flex h-full items-center justify-center italic text-[--text-muted] text-sm">No expenses this month.</div>
            ) : (
              <>
                <div className="h-[200px] w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie onClick={(data) => setSelectedCategory(data.name || null)} data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value">
                        {stats.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-3 pb-8">
                  {stats.pieData.slice(0, 5).map((item) => (
                    <div key={item.name} className="flex justify-between items-center group">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-[12px] font-bold text-[--text-secondary] transition-colors group-hover:text-white">{item.name}</span>
                      </div>
                      <span className="text-[12px] font-black tabular-nums">₹{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                  {stats.pieData.length > 5 && (
                    <div className="text-[10px] text-[--text-muted] pt-2 font-bold uppercase tracking-wider">+ {stats.pieData.length - 5} more categories</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Visual Analytics Row 2 */}
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

