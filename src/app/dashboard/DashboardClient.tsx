"use client";

import { useCallback, useEffect, useState, startTransition, useMemo } from "react";
import Greeting from "@/components/greeting";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import Link from "next/link";

const supabase = createClient();

type Account = Tables<"accounts">;
type Transaction = Tables<"transactions">;
type LedgerLog = Tables<"ledger_logs">;

interface DashboardClientProps {
  initialAccounts: Account[];
  initialTransactions: Transaction[];
  initialLogs: LedgerLog[];
}

export default function DashboardClient({ 
  initialAccounts, 
  initialTransactions, 
  initialLogs 
}: DashboardClientProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [recentLogs, setRecentLogs] = useState<LedgerLog[]>(initialLogs);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [accRes, transRes, logRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("ledger_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
    ]);

    if (accRes.data) setAccounts(accRes.data);
    if (transRes.data) setTransactions(transRes.data);
    if (logRes.data) setRecentLogs(logRes.data as LedgerLog[]);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime-master")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "incomes" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_logs" }, () => startTransition(fetchData))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Derived Stats
  const stats = useMemo(() => {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const now = new Date();
    const currentMonthTxns = transactions.filter(t => 
      isWithinInterval(new Date(t.date), { start: startOfMonth(now), end: endOfMonth(now) })
    );

    const monthlySpend = currentMonthTxns
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const monthlyIncome = currentMonthTxns
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Category Data for Pie
    const catMap: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .slice(0, 50) // Use more data for better pie
      .forEach(t => {
        const cat = t.category || "Others";
        catMap[cat] = (catMap[cat] || 0) + Number(t.amount);
      });

    const pieData = Object.entries(catMap).map(([name, value]) => ({ 
      name, 
      value,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    })).sort((a,b) => b.value - a.value);

    return { totalBalance, monthlySpend, monthlyIncome, pieData, accountCount: accounts.length };
  }, [accounts, transactions]);

  const COLORS = ["#6c5ce7", "#00cec9", "#fd79a8", "#fdcb6e", "#a29bfe"];

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <Greeting />
        <div className="flex gap-3">
          <Link href="/dashboard/accounts?action=new" className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Add Account
          </Link>
        </div>
      </div>

      {/* Hero Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card-static p-6 md:p-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-40 h-40" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <div className="status-dot scale-75" />
              <span className="text-xs md:text-sm font-bold uppercase tracking-[0.4em] text-[--text-muted]">Portfolio Net Worth</span>
            </div>
            <h2 className="text-[3.5rem] sm:text-7xl md:text-[6.5rem] font-[800] tracking-[-0.04em] text-[--text-primary] leading-none [font-family:'Outfit',sans-serif] bg-gradient-to-r from-white via-white to-[--text-secondary] bg-clip-text text-transparent drop-shadow-[0_10px_30px_rgba(108,92,231,0.2)]">
              ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </h2>
            <div className="mt-8 flex flex-wrap gap-4">
              <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-[--text-muted]">
                +2.4% vs last month
              </div>
              <div className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Secure & Verified
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="glass-card-static p-6 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5"><svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[--text-muted] mb-2">Monthly Cashflow</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-emerald-400 font-bold">+₹{stats.monthlyIncome.toLocaleString()}</span>
              <span className="text-xs text-rose-400 font-bold">-₹{stats.monthlySpend.toLocaleString()}</span>
            </div>
            <h3 className="text-4xl font-black [font-family:'Outfit',sans-serif] text-[--text-primary] mt-1">
              ₹{(stats.monthlyIncome - stats.monthlySpend).toLocaleString()}
            </h3>
            <p className="text-[10px] mt-2 text-[--text-muted] font-bold uppercase tracking-tighter">Net savings this month</p>
          </div>
          <div className="glass-card-static p-6 flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5"><svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg></div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[--text-muted] mb-2">Active Channels</p>
            <h3 className="text-4xl font-black [font-family:'Outfit',sans-serif] text-[--text-primary]">
              {stats.accountCount} <span className="text-lg text-[--text-muted]">Sources</span>
            </h3>
            <p className="text-[10px] mt-2 text-emerald-400 font-bold uppercase tracking-tighter">All systems operational</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card-static p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Wealth Velocity</h3>
            <Link href="/dashboard/ledger" className="text-[10px] font-black uppercase text-[--accent-primary] hover:underline decoration-2 underline-offset-4 tracking-widest">
              View History
            </Link>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={transactions.filter(t => t.type === 'expense').slice(0, 10).reverse()}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="amount" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card-static p-6 md:p-8">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-8">Recent Activities</h3>
          <div className="space-y-4">
            {recentLogs.length === 0 ? (
              <div className="text-center py-12 text-[--text-muted] text-sm italic">No recent activities found.</div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[--accent-primary]/10 flex items-center justify-center text-lg shadow-inner">
                      {log.action_type === 'CREATE' ? '✨' : log.action_type === 'DELETE' ? '🗑️' : '💰'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[--text-primary] group-hover:text-[--accent-primary] transition-colors">{log.details}</p>
                      <p className="text-[10px] text-[--text-muted] uppercase tracking-tighter mt-0.5">{format(new Date(log.created_at), "MMM d, HH:mm")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${log.action_type === 'DELETE' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {log.amount ? `₹${log.amount.toLocaleString()}` : '—'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
