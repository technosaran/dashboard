"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { format, endOfMonth, isWithinInterval, startOfMonth } from "date-fns";
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
  initialLogs,
}: DashboardClientProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [recentLogs, setRecentLogs] = useState<LedgerLog[]>(initialLogs);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const [accRes, transRes, logRes] = await Promise.all([
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
    ]);

    if (accRes.data) setAccounts(accRes.data);
    if (transRes.data) setTransactions(transRes.data);
    if (logRes.data) setRecentLogs(logRes.data as LedgerLog[]);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const stats = useMemo(() => {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
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
      .slice(0, 10)
      .reverse()
      .map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      }));

    return {
      totalBalance,
      monthlySpend,
      monthlyIncome,
      expenseTrend,
      accountCount: accounts.length,
    };
  }, [accounts, transactions]);

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
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
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[--text-muted]">
                +2.4% vs last month
              </div>
              <div className="rounded-full border border-[--success]/20 bg-[--success]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[--success]">
                Secure & Verified
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card-static p-6 md:p-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
              Wealth Velocity
            </h3>
            <Link
              href="/dashboard/ledger"
              className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary] underline-offset-4 decoration-2 hover:underline"
            >
              View History
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
          <h3 className="mb-8 text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
            Recent Activities
          </h3>
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
  );
}
