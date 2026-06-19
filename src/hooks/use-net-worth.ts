import { useMemo } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS } from "@/lib/modules";

export function useNetWorth() {
  const { data } = useFinanceData();
  const {
    profile,
    accounts = [],
    investments = [],
    forexAccounts = [],
    mutualFunds = [],
    bonds = [],
    alternativeAssets = [],
    liabilities = [],
  } = data || {};

  return useMemo(() => {
    const enabledModules = profile?.settings?.enabled_modules || [...MODULE_KEYS];
    
    const hasStocks = enabledModules.includes("Stocks");
    const hasForex = enabledModules.includes("Forex");
    const hasMF = enabledModules.includes("Mutual Funds");
    const hasBonds = enabledModules.includes("Bonds");
    const hasAlt = enabledModules.includes("Alt Assets");
    const hasLiabilities = enabledModules.includes("Liabilities");

    // 1. Absolute INR calculations (excluding USD accounts/investments)
    const cashBalanceINR = accounts.reduce((sum, acc) => {
      const balance = Number(acc.balance || 0);
      return sum + (acc.currency !== 'USD' ? balance : 0);
    }, 0);
    
    const stockBalanceINR = hasStocks ? investments.reduce((sum, inv) => {
      const value = Number(inv.quantity || 0) * Number(inv.current_price || 0);
      return sum + (inv.currency !== 'USD' ? value : 0);
    }, 0) : 0;

    // 2. Absolute USD calculations (USD accounts/investments only)
    const cashBalanceUSD = accounts.reduce((sum, acc) => {
      const balance = Number(acc.balance || 0);
      return sum + (acc.currency === 'USD' ? balance : 0);
    }, 0);
    
    const stockBalanceUSD = hasStocks ? investments.reduce((sum, inv) => {
      const value = Number(inv.quantity || 0) * Number(inv.current_price || 0);
      return sum + (inv.currency === 'USD' ? value : 0);
    }, 0) : 0;

    // 3. Forex balances
    const forexBalanceINR = hasForex ? forexAccounts.reduce((sum, acc) => {
      const balance = Number(acc.balance || 0);
      return sum + (acc.currency !== 'USD' ? balance : 0);
    }, 0) : 0;
    
    const forexBalanceUSD = hasForex ? forexAccounts.reduce((sum, acc) => {
      const balance = Number(acc.balance || 0);
      return sum + (acc.currency === 'USD' ? balance : 0);
    }, 0) : 0;

    // 4. Separate calculations without conversion
    const cashBalance = cashBalanceINR; // legacy compatibility mapping to INR
    const stockBalance = stockBalanceINR;
    const forexBalance = forexBalanceINR;
    
    const mfBalance = hasMF ? mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0) : 0;
    const bondBalance = hasBonds ? (bonds || []).filter(b => b.status === 'Active').reduce((sum, b) => sum + Number(b.current_value || 0), 0) : 0;
    
    const altBalance = hasAlt ? (alternativeAssets || []).reduce((sum, asset) => sum + Number(asset.current_value || 0), 0) : 0;
    const debtBalance = hasLiabilities ? (liabilities || []).reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0) : 0;
    
    const liquidBalance = cashBalance + stockBalance + mfBalance + bondBalance + forexBalance;
    const totalAssets = liquidBalance + altBalance;
    const netWorth = totalAssets - debtBalance;

    // Calculate consolidated Net Worth metrics in different currencies without conversion
    const totalAssetsINR = totalAssets;
    const totalAssetsUSD = cashBalanceUSD + stockBalanceUSD + forexBalanceUSD;
    const netWorthINR = netWorth;
    const netWorthUSD = totalAssetsUSD;

    return {
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
      totalAssetsUSD
    };
  }, [accounts, investments, forexAccounts, mutualFunds, bonds, alternativeAssets, liabilities, profile]);
}

