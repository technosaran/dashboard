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
type Expense = Tables<"expenses">;
type LedgerLog = Tables<"ledger_logs">;

interface DashboardClientProps {
  initialAccounts: Account[];
  initialExpenses: Expense[];
  initialLogs: LedgerLog[];
}

export default function DashboardClient({ 
  initialAccounts, 
  initialExpenses, 
  initialLogs 
}: DashboardClientProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [recentLogs, setRecentLogs] = useState<LedgerLog[]>(initialLogs);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [accRes, expRes, logRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("ledger_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
    ]);

    if (accRes.data) setAccounts(accRes.data);
    if (expRes.data) setExpenses(expRes.data);
    if (logRes.data) setRecentLogs(logRes.data as LedgerLog[]);
  }, []);

  useEffect(() => {
    // We don't need to refetch on mount because we have initialData!
    // But we setup real-time listeners for future updates
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
      <div className="grid grid-cols-1 gap-4 md:gap-8">
        <div className="glass-card-static p-5 md:p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 md:p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-24 h-24 md:w-32 md:h-32" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          
          <div className="relative z-10 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="status-dot scale-75" />
                <span className="text-xl md:text-2xl font-black uppercase tracking-[0.1em] text-[--text-primary] opacity-90">Net Worth</span>
              </div>
              <h2 className="text-[4rem] sm:text-7xl md:text-8xl font-black tracking-tighter text-[--text-primary] leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] italic">
                ₹{stats.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </h2>
            </div>

            </div>
          </div>
        </div>
      </div>
    );
}
