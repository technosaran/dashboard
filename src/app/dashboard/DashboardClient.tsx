"use client";


import { useMemo, useState, useEffect, useRef } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { format, parseISO, subMonths } from "date-fns";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useNetWorth } from "@/hooks/use-net-worth";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getChartColour } from "@/lib/chart-colours";
import DashboardMobile from "./components/DashboardMobile";
import DashboardDesktop from "./components/DashboardDesktop";
import OnboardingWizard from "@/components/onboarding-wizard";
import { useUser } from "@/context/user-context";
import LoadingSkeleton from "./loading";
import { fetchLiveStockPrice, updateInvestment } from "@/app/dashboard/stocks/actions";
import { fetchLiveMFNAV, updateMFHolding, searchMFSchemes } from "@/app/dashboard/mutual-funds/actions";

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

export default function DashboardClient() {
  const { user_id } = useUser();
  const { data: financeData, isLoading, isValidating } = useFinanceData();
  
  const { 
    accounts = [], 
    transactions = [], 
    ledgerLogs: recentLogs = [], 
    investments = [], 
    mutualFunds = [], 
    incomes = [], 
    expenses = [], 
    goals = []
  } = financeData || {};

  const isMobile = useMediaQuery('(max-width: 767.98px)');
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

  const refreshedRef = useRef(false);
  const { mutate } = useFinanceData();

  useEffect(() => {
    if (isLoading) return;
    if (refreshedRef.current) return;
    
    const runBackgroundRefresh = async () => {
      refreshedRef.current = true;
      let updated = 0;
      try {
        // 1. Sync Stocks
        const activeStocks = investments.filter(i => i.type === "stock" && Number(i.quantity) > 0);
        for (const stock of activeStocks) {
          if (!stock.symbol) continue;
          const liveData = await fetchLiveStockPrice(stock.symbol);
          if (liveData && (liveData.price !== stock.current_price || liveData.previousClose !== stock.previous_close)) {
            const updatePayload: { current_price: number; previous_close?: number } = { current_price: liveData.price };
            if (liveData.previousClose) updatePayload.previous_close = liveData.previousClose;
            await updateInvestment(stock.id, updatePayload);
            updated++;
          }
        }

        // 2. Sync Mutual Funds
        const rawMfs = mutualFunds.filter(m => Number(m.units) > 0);
        for (const mf of rawMfs) {
          let code: string | undefined = mf.scheme_code || undefined;
          if (!code) {
            const searchResults = await searchMFSchemes(mf.fund_name);
            if (searchResults && searchResults.length > 0 && searchResults[0].schemeCode) {
              code = searchResults[0].schemeCode;
              await updateMFHolding(mf.id, { scheme_code: code, fund_symbol: code });
            }
          }
          if (!code) continue;
          const liveData = await fetchLiveMFNAV(code);
          if (liveData && (liveData.nav !== mf.current_nav || liveData.previousNav !== mf.previous_nav)) {
            const updatePayload: { current_nav: number; previous_nav?: number } = { current_nav: liveData.nav };
            if (liveData.previousNav) updatePayload.previous_nav = liveData.previousNav;
            await updateMFHolding(mf.id, updatePayload);
            updated++;
          }
        }

        if (updated > 0) {
          mutate();
        }
      } catch (err) {
        console.error("Failed to run dashboard background sync:", err);
      }
    };

    runBackgroundRefresh();
  }, [investments, mutualFunds, isLoading, mutate]);

  const netWorthData = useNetWorth();

  const stats = useMemo(() => {
    const {
      netWorth,
      netWorthINR,
      netWorthUSD,
      cashBalance,
      cashBalanceINR,
      cashBalanceUSD,
      stockBalance,
      stockBalanceINR,
      stockBalanceUSD,
      forexBalance,
      forexBalanceINR,
      forexBalanceUSD,
      mfBalance,
      bondBalance,
      altBalance,
      debtBalance,
      liquidBalance,
      totalAssets,
      totalAssetsINR,
      totalAssetsUSD,
      cryptoBalance
    } = netWorthData;

    const stockCount = investments.filter((inv) => Number(inv.quantity) > 0).length;
    const mfCount = mutualFunds.filter((mf) => Number(mf.units) > 0).length;

    
    const now = new Date();
    const currentMonthNum = now.getMonth();
    const currentYearNum = now.getFullYear();
    
    let monthlySpend = 0;
    let monthlyIncome = 0;
    const expenseTrend: TrendEntry[] = [];
    const catMap: Record<string, number> = {};
    
    // Trend Map Initialization
    const trendMap: Record<string, TrendMapEntry> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const m = format(d, "MMM yy");
      trendMap[m] = { name: m, income: 0, expense: 0 };
    }

    // Single pass over transactions
    // Only count actual expenses (source_type "expense" or null) — skip investment purchases
    const EXPENSE_SOURCE_TYPES = new Set(["expense", null, undefined, ""]);

    const sortedForLoop = [...transactions].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return b.date.localeCompare(a.date);
    });

    for (let i = 0; i < sortedForLoop.length; i++) {
      const t = sortedForLoop[i];
      if (!t.date) continue;
      
      const tDate = parseISO(t.date);
      const tAmount = Number(t.amount);
      const tType = t.type;
      const isRealExpense = tType === "expense" && EXPENSE_SOURCE_TYPES.has(t.source_type);
      
      // Monthly Stats & Category Map - Timezone-robust direct comparison
      if (tDate.getMonth() === currentMonthNum && tDate.getFullYear() === currentYearNum) {
        if (tType === "income") monthlyIncome += tAmount;
        if (isRealExpense) {
          monthlySpend += tAmount;
          const cat = t.category || "Others";
          catMap[cat] = (catMap[cat] || 0) + tAmount;
        }
      }

      // Expense Trend (Last 15)
      if (isRealExpense && expenseTrend.length < 15) {
        expenseTrend.push({
          date: t.date,
          amount: tAmount,
          category: t.category || "Others",
          type: tType,
        });
      }

      // 6-Month Trend
      const m = format(tDate, "MMM yy");
      if (trendMap[m]) {
        if (tType === "income") trendMap[m].income += tAmount;
        if (isRealExpense) trendMap[m].expense += tAmount;
      }
    }

    // Calculate historical curves walking backward
    const monthsKeys = Object.keys(trendMap);
    let runningNetWorth = (netWorthINR || 100000);
    let runningInvestments = (stockBalanceINR || 0) + (mfBalance || 0) + (bondBalance || 0);

    for (let i = monthsKeys.length - 1; i >= 0; i--) {
      const key = monthsKeys[i];
      const entry = trendMap[key] as any;
      const netMonthlyChange = entry.income - entry.expense;
      const investmentDelta = Math.max(0, entry.income * 0.3 - entry.expense * 0.1);

      entry.netWorth = Math.max(0, runningNetWorth);
      entry.investments = Math.max(0, runningInvestments);

      runningNetWorth -= netMonthlyChange;
      runningInvestments -= investmentDelta;
    }

    const pieData = Object.entries(catMap).map(([name, value], index) => {
      const resolvedColor = getChartColour(index);
      return { name, value, fill: resolvedColor, color: resolvedColor, percentage: "0" };
    }).sort((a,b) => b.value - a.value);

    const totalDayPnL = (investments.reduce((sum, inv) => {
      const dayChange = Number(inv.day_change || 0) * Number(inv.quantity || 0);
      return sum + dayChange;
    }, 0)) +
    (mutualFunds.reduce((sum, mf) => sum + (Number(mf.day_change || 0) * Number(mf.units || 0)), 0));
    const prevDayNetWorth = netWorth - totalDayPnL;
    const totalDayPnLPercent = prevDayNetWorth > 0 ? (totalDayPnL / prevDayNetWorth) * 100 : 0;

    return { 
      totalBalance: netWorth,
      netWorth,
      netWorthINR,
      netWorthUSD,
      totalDayPnL,
      totalDayPnLPercent,
      liquidBalance,
      altBalance,
      bondBalance,
      debtBalance,
      totalAssets,
      totalAssetsINR,
      totalAssetsUSD,
      cashBalance,
      cashBalanceINR,
      cashBalanceUSD,
      stockBalance,
      stockBalanceINR,
      stockBalanceUSD,
      forexBalance,
      forexBalanceINR,
      forexBalanceUSD,
      cryptoBalance,
      monthlySpend, 
      monthlyIncome, 
      expenseTrend: expenseTrend.reverse(), 
      pieData, 
      stockCount, 
      mfCount, 
      mfBalance, 
      trendData: Object.values(trendMap) 
    };
  }, [transactions, netWorthData, investments, mutualFunds]);

  const isMounted = useHasMounted();

  if (!isMounted) return null; // Prevent hydration mismatch

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Conditionally render only one view based on screen size
  if (isMobile) {
    return (
      <>
        {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
        <DashboardMobile stats={stats} recentLogs={recentLogs} accounts={accounts} isLoading={isLoading} isValidating={isValidating} />
      </>
    );
  }

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      <DashboardDesktop stats={stats} recentLogs={recentLogs} goals={goals} accounts={accounts} isLoading={isLoading} />
    </>
  );
}
