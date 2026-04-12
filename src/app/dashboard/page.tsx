"use client";

export const dynamic = "force-dynamic";

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
type Expense = Tables<"expenses">;
type LedgerLog = Tables<"ledger_logs">;

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recentLogs, setRecentLogs] = useState<LedgerLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [accRes, expRes, logRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("ledger_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
    ]);

    if (accRes.data) setAccounts(accRes.data);
    if (expRes.data) setExpenses(expRes.data);
    if (logRes.data) setRecentLogs(logRes.data as LedgerLog[]);
    
    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(fetchData);

    const channel = supabase
      .channel("dashboard-realtime-master")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "incomes" }, () => startTransition(fetchData))
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
    const currentMonthExpenses = expenses.filter(e => 
      isWithinInterval(new Date(e.date), { start: startOfMonth(now), end: endOfMonth(now) })
    );
    const monthlySpend = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    // Category Data for Pie
    const catMap: Record<string, number> = {};
    expenses.slice(0, 20).forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
    });
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    return { totalBalance, monthlySpend, pieData, accountCount: accounts.length };
  }, [accounts, expenses]);

  const COLORS = ["#6c5ce7", "#00cec9", "#fd79a8", "#fdcb6e", "#a29bfe"];

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-12 w-64 bg-white/5 rounded-xl" />
        <div className="h-48 bg-white/5 rounded-3xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-64 bg-white/5 rounded-3xl" />
          <div className="h-64 bg-white/5 rounded-3xl" />
        </div>
      </div>
    );
  }

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card-static p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-32 h-32" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          
          <div className="relative z-10 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="status-dot scale-75" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Consolidated Net Worth</span>
              </div>
              <h2 className="text-5xl font-black tracking-tighter text-[--text-primary]">
                ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </h2>
            </div>

            <div className="flex flex-wrap gap-8 items-center pt-4 border-t border-white/5">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Monthly Burn</p>
                <p className="text-xl font-black text-rose-400">₹{stats.monthlySpend.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Active Channels</p>
                <p className="text-xl font-black text-[--accent-primary-light]">{stats.accountCount} Accounts</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Updates</p>
                <p className="text-xl font-black text-[#55efc4]">Real-time</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card-static p-8 flex flex-col items-center justify-center text-center">
            <div className="mb-4">
              <div className="w-16 h-16 rounded-2xl bg-[--accent-primary]/10 border border-[--accent-primary]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-[--accent-primary]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-lg font-bold">Smart Allocation</h3>
              <p className="text-xs text-[--text-muted] mt-1 max-w-[200px]">Automated analysis of your spending distribution.</p>
            </div>
            
            <div className="w-full h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData.length > 0 ? stats.pieData : [{name: 'Empty', value: 1}]}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={50}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    {stats.pieData.length === 0 && <Cell fill="rgba(255,255,255,0.05)" />}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Main Grid: Activity & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="glass-card-static flex flex-col overflow-hidden">
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Recent Activity</h3>
            <Link href="/dashboard/ledger" className="text-[10px] font-bold text-[--accent-primary] hover:underline">View Full Audit</Link>
          </div>
          <div className="flex-1 divide-y divide-white/5">
            {recentLogs.length === 0 ? (
              <div className="p-10 text-center text-xs text-[--text-muted]">No recent operations logged.</div>
            ) : (
              recentLogs.map((log, i) => (
                <div key={log.id} className="p-5 hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                      {log.action_type.includes("TRANSFER") ? "🔄" : log.action_type.includes("ADJUST") ? "⚡" : "📝"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[--text-primary] group-hover:text-[--accent-primary-light] transition-colors">{log.details}</p>
                      <p className="text-[10px] text-[--text-muted]">{format(new Date(log.created_at), "MMM d, HH:mm")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${log.action_type.includes("DOWN") || log.action_type.includes("OUT") ? "text-rose-400" : "text-emerald-400"}`}>
                      {log.amount ? `₹${log.amount.toLocaleString()}` : "—"}
                    </p>
                    <p className="text-[10px] font-medium text-[--text-muted]">Verified</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Insights / Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <Link href="/dashboard/expenses" className="glass-card p-8 flex flex-col justify-between group no-underline">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h4 className="text-lg font-bold text-[--text-primary]">Analyze Spend</h4>
              <p className="text-xs text-[--text-muted] mt-1">Deep-dive into your expenditure patterns.</p>
            </div>
          </Link>

          <Link href="/dashboard/family" className="glass-card p-8 flex flex-col justify-between group no-underline">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <div>
              <h4 className="text-lg font-bold text-[--text-primary]">Family Sync</h4>
              <p className="text-xs text-[--text-muted] mt-1">Manage shared funds and transfers.</p>
            </div>
          </Link>

          <div className="col-span-1 sm:col-span-2 glass-card-static p-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-[--text-primary]">System Status</p>
                <p className="text-[10px] text-[--text-muted]">All accounts synchronized.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
