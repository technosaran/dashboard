"use client";

import { useMemo, useState, useEffect } from "react";
import { format, endOfMonth, isWithinInterval, startOfMonth, parseISO, subMonths } from "date-fns";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { FinanceData } from "@/hooks/use-finance-data";
import { CHART_COLOURS } from "@/lib/chart-colours";
import DashboardMobile from "./components/DashboardMobile";
import DashboardDesktop from "./components/DashboardDesktop";
import OnboardingWizard from "@/components/onboarding-wizard";

type TrendMapEntry = {
  name: string;
  income: number;
  expense: number;
};

export default function DashboardClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { accounts, transactions, ledgerLogs: recentLogs, investments, mutualFunds, incomes, expenses }, isLoading, isValidating } = useFinanceData(initialData);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    const completed = localStorage.getItem("onboarding_completed");
    const hasData = accounts.length > 0 || incomes.length > 0 || expenses.length > 0;
    
    if (!completed && !hasData && !isLoading) {
      // Small delay to let the page load first
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [accounts.length, incomes.length, expenses.length, isLoading]);

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
        date: transaction.date,
        amount: Number(transaction.amount),
        category: transaction.category || "Others",
        type: transaction.type,
      }));

    // Income vs Expense past 6 months
    const trendMap: Record<string, TrendMapEntry> = {};
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
      } catch (e) {
        console.warn('Bad transaction date:', t.date, e);
      }
    });

    // Category Pie Chart (Current Month)
    const catMap: Record<string, number> = {};
    currentMonthTxns.filter(t => t.type === 'expense').forEach(t => {
      catMap[t.category || "Others"] = (catMap[t.category || "Others"] || 0) + Number(t.amount);
    });
    const pieData = Object.entries(catMap).map(([name, value], index) => {
      const resolvedColor = CHART_COLOURS[index % CHART_COLOURS.length];
      return { name, value, fill: resolvedColor, color: resolvedColor, percentage: "0" };
    }).sort((a,b) => b.value - a.value);

    return { totalBalance, monthlySpend, monthlyIncome, expenseTrend, pieData, stockCount, mfCount, stockBalance, mfBalance, trendData: Object.values(trendMap) };
  }, [accounts, transactions, investments, mutualFunds]);

  // Conditionally render only one view based on screen size
  if (isMobile) {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
        <DashboardMobile stats={stats} recentLogs={recentLogs} isLoading={isLoading} isValidating={isValidating} />
      </>
    );
  }

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <DashboardDesktop stats={stats} recentLogs={recentLogs} isLoading={isLoading} isValidating={isValidating} />
    </>
  );
}
