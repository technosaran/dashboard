"use client";

import { useMemo, useState, useEffect } from "react";
import { format, endOfMonth, startOfMonth, parseISO, subMonths } from "date-fns";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { FinanceData } from "@/hooks/use-finance-data";
import { CHART_COLOURS } from "@/lib/chart-colours";
import DashboardMobile from "./components/DashboardMobile";
import DashboardDesktop from "./components/DashboardDesktop";
import OnboardingWizard from "@/components/onboarding-wizard";
import { useUser } from "@/context/user-context";

type TrendMapEntry = {
  name: string;
  income: number;
  expense: number;
};

type TrendEntry = {
  date: string;
  amount: number;
  category: string;
  type: string;
};

export default function DashboardClient({ initialData }: { initialData?: FinanceData }) {
  const { user_id } = useUser();
  const { data: financeData, isLoading, isValidating } = useFinanceData(initialData);
  
  const { 
    accounts = [], 
    transactions = [], 
    ledgerLogs: recentLogs = [], 
    investments = [], 
    mutualFunds = [], 
    incomes = [], 
    expenses = [], 
    bonds = [], 
    alternativeAssets = [], 
    liabilities = [] 
  } = financeData || {};

  const isMobile = useMediaQuery('(max-width: 767px)');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    if (!user_id) return;
    
    const storageKey = `onboarding_completed_${user_id}`;
    const completed = localStorage.getItem(storageKey);
    const hasData = accounts.length > 0 || incomes.length > 0 || expenses.length > 0;
    
    if (!completed && !hasData && !isLoading) {
      // Small delay to let the page load first
      const timer = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [accounts.length, incomes.length, expenses.length, isLoading, user_id]);

  const handleOnboardingComplete = () => {
    if (user_id) {
      localStorage.setItem(`onboarding_completed_${user_id}`, "true");
    }
    setShowOnboarding(false);
  };

  const stats = useMemo(() => {
    const cashBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
    const stockBalance = investments.reduce((sum, inv) => sum + (Number(inv.quantity) * Number(inv.current_price || 0)), 0);
    const mfBalance = mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0);
    const bondBalance = (bonds || []).filter(b => b.status === 'Active').reduce((sum, b) => sum + Number(b.current_value || 0), 0);
    
    const altBalance = (alternativeAssets || []).reduce((sum, asset) => sum + Number(asset.current_value || 0), 0);
    const debtBalance = (liabilities || []).reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0);
    
    const stockCount = investments.filter((inv) => Number(inv.quantity) > 0).length;
    const mfCount = mutualFunds.filter((mf) => Number(mf.units) > 0).length;
    
    const liquidBalance = cashBalance + stockBalance + mfBalance + bondBalance;
    const totalAssets = liquidBalance + altBalance;
    const netWorth = totalAssets - debtBalance;
    
    const now = new Date();
    const startOfCurrMonth = startOfMonth(now).getTime();
    const endOfCurrMonth = endOfMonth(now).getTime();
    
    let monthlySpend = 0;
    let monthlyIncome = 0;
    const expenseTrend: TrendEntry[] = [];
    const catMap: Record<string, number> = {};
    
    // Trend Map Initialization
    const trendMap: Record<string, TrendMapEntry> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const m = format(d, "MMM");
      trendMap[m] = { name: m, income: 0, expense: 0 };
    }

    // Single pass over transactions
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t.date) continue;
      
      const tDate = parseISO(t.date);
      const tTime = tDate.getTime();
      const tAmount = Number(t.amount);
      const tType = t.type;
      
      // Monthly Stats & Category Map
      if (tTime >= startOfCurrMonth && tTime <= endOfCurrMonth) {
        if (tType === "income") monthlyIncome += tAmount;
        if (tType === "expense") {
          monthlySpend += tAmount;
          const cat = t.category || "Others";
          catMap[cat] = (catMap[cat] || 0) + tAmount;
        }
      }

      // Expense Trend (Last 15)
      if (tType === "expense" && expenseTrend.length < 15) {
        expenseTrend.push({
          date: t.date,
          amount: tAmount,
          category: t.category || "Others",
          type: tType,
        });
      }

      // 6-Month Trend
      const m = format(tDate, "MMM");
      if (trendMap[m]) {
        if (tType === "income") trendMap[m].income += tAmount;
        if (tType === "expense") trendMap[m].expense += tAmount;
      }
    }

    const pieData = Object.entries(catMap).map(([name, value], index) => {
      const resolvedColor = CHART_COLOURS[index % CHART_COLOURS.length];
      return { name, value, fill: resolvedColor, color: resolvedColor, percentage: "0" };
    }).sort((a,b) => b.value - a.value);

    const totalDayPnL = (investments.reduce((sum, inv) => sum + (Number(inv.day_change || 0) * Number(inv.quantity || 0)), 0)) +
                        (mutualFunds.reduce((sum, mf) => sum + (Number(mf.day_change || 0) * Number(mf.units || 0)), 0));
    const prevDayNetWorth = netWorth - totalDayPnL;
    const totalDayPnLPercent = prevDayNetWorth > 0 ? (totalDayPnL / prevDayNetWorth) * 100 : 0;

    return { 
      totalBalance: netWorth,
      totalDayPnL,
      totalDayPnLPercent,
      liquidBalance,
      altBalance,
      bondBalance,
      debtBalance,
      totalAssets,
      cashBalance,
      monthlySpend, 
      monthlyIncome, 
      expenseTrend: expenseTrend.reverse(), 
      pieData, 
      stockCount, 
      mfCount, 
      stockBalance, 
      mfBalance, 
      trendData: Object.values(trendMap) 
    };
  }, [accounts, transactions, investments, mutualFunds, bonds, alternativeAssets, liabilities]);

  // Conditionally render only one view based on screen size
  if (isMobile) {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
        <DashboardMobile stats={stats} recentLogs={recentLogs} isLoading={isLoading} isValidating={isValidating} />
      </>
    );
  }

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      <DashboardDesktop stats={stats} recentLogs={recentLogs} isLoading={isLoading} isValidating={isValidating} />
    </>
  );
}
