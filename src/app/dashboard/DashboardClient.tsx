"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { format, endOfMonth, isWithinInterval, startOfMonth } from "date-fns";
import { useFinanceData } from "@/hooks/use-finance-data";
import type { FinanceData } from "@/hooks/use-finance-data";
import { parseISO, subMonths } from "date-fns";

// Lazy load the specific views to keep initial bundle size minimal
const DashboardMobile = dynamic(() => import("./components/DashboardMobile"), {
  loading: () => <div className="p-8"><div className="skeleton h-40 w-full rounded-3xl" /></div>
});
const DashboardDesktop = dynamic(() => import("./components/DashboardDesktop"), {
  loading: () => <div className="p-10"><div className="skeleton h-96 w-full rounded-3xl" /></div>
});

export default function DashboardClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { accounts, transactions, ledgerLogs: recentLogs, investments, mutualFunds }, isLoading, isValidating } = useFinanceData(initialData);

  const stats = useMemo(() => {
    const cashBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
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

    // Category Pie Chart (Current Month)
    const catMap: Record<string, number> = {};
    currentMonthTxns.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category || "Others"] = (catMap[t.category || "Others"] || 0) + Number(t.amount);
    });
    const pieData = Object.entries(catMap).map(([name, value], index) => {
      const dashboardColors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#82E0AA", "#F1948A", "#85C1E9"];
      const resolvedColor = dashboardColors[index % dashboardColors.length];
      return { name, value, fill: resolvedColor, color: resolvedColor };
    }).sort((a,b) => b.value - a.value);

    return { totalBalance, monthlySpend, monthlyIncome, expenseTrend, pieData, stockCount, mfCount, stockBalance, mfBalance };
  }, [accounts, transactions, investments, mutualFunds]);

  return (
    <>
      <DashboardMobile stats={stats} recentLogs={recentLogs} isLoading={isLoading} isValidating={isValidating} />
      <DashboardDesktop stats={stats} recentLogs={recentLogs} isLoading={isLoading} isValidating={isValidating} />
    </>
  );
}
