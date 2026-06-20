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
    const enabledModules = profile?.enabled_modules || [...MODULE_KEYS];
    
    const hasStocks = enabledModules.includes("Stocks");
    const hasForex = enabledModules.includes("Forex");
    const hasMF = enabledModules.includes("Mutual Funds");
    const hasBonds = enabledModules.includes("Bonds");
    const hasAlt = enabledModules.includes("Alt Assets");
    const hasLiabilities = enabledModules.includes("Liabilities");

    const USD_TO_INR = 84.0;

    const convertToINR = (amount: number, currency: string) => {
      return currency === 'USD' ? amount * USD_TO_INR : amount;
    };

    const convertToUSD = (amount: number, currency: string) => {
      return currency !== 'USD' ? amount / USD_TO_INR : amount;
    };

    // Calculate consolidated values in INR
    const cashBalanceINR = accounts.reduce((sum, acc) => sum + convertToINR(Number(acc.balance || 0), acc.currency), 0);
    const stockBalanceINR = hasStocks ? investments.reduce((sum, inv) => sum + convertToINR(Number(inv.quantity || 0) * Number(inv.current_price || 0), inv.currency), 0) : 0;
    const forexBalanceINR = hasForex ? forexAccounts.reduce((sum, acc) => sum + convertToINR(Number(acc.balance || 0), acc.currency), 0) : 0;
    
    // Mutual funds, bonds, alt assets, liabilities are assumed INR
    const mfBalanceINR = hasMF ? mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0) : 0;
    const bondBalanceINR = hasBonds ? (bonds || []).filter(b => b.status === 'Active').reduce((sum, b) => sum + Number(b.current_value || 0), 0) : 0;
    const altBalanceINR = hasAlt ? (alternativeAssets || []).reduce((sum, asset) => sum + Number(asset.current_value || 0), 0) : 0;
    const debtBalanceINR = hasLiabilities ? (liabilities || []).reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0) : 0;

    // Total INR Net Worth
    const liquidBalanceINR = cashBalanceINR + stockBalanceINR + mfBalanceINR + bondBalanceINR + forexBalanceINR;
    const totalAssetsINR = liquidBalanceINR + altBalanceINR;
    const netWorthINR = totalAssetsINR - debtBalanceINR;

    // Calculate consolidated values in USD
    const cashBalanceUSD = accounts.reduce((sum, acc) => sum + convertToUSD(Number(acc.balance || 0), acc.currency), 0);
    const stockBalanceUSD = hasStocks ? investments.reduce((sum, inv) => sum + convertToUSD(Number(inv.quantity || 0) * Number(inv.current_price || 0), inv.currency), 0) : 0;
    const forexBalanceUSD = hasForex ? forexAccounts.reduce((sum, acc) => sum + convertToUSD(Number(acc.balance || 0), acc.currency), 0) : 0;
    const mfBalanceUSD = mfBalanceINR / USD_TO_INR;
    const bondBalanceUSD = bondBalanceINR / USD_TO_INR;
    const altBalanceUSD = altBalanceINR / USD_TO_INR;
    const debtBalanceUSD = debtBalanceINR / USD_TO_INR;

    const liquidBalanceUSD = cashBalanceUSD + stockBalanceUSD + mfBalanceUSD + bondBalanceUSD + forexBalanceUSD;
    const totalAssetsUSD = liquidBalanceUSD + altBalanceUSD;
    const netWorthUSD = totalAssetsUSD - debtBalanceUSD;

    // Maintain backwards compatibility for legacy names
    const cashBalance = cashBalanceINR;
    const stockBalance = stockBalanceINR;
    const forexBalance = forexBalanceINR;
    const mfBalance = mfBalanceINR;
    const bondBalance = bondBalanceINR;
    const altBalance = altBalanceINR;
    const debtBalance = debtBalanceINR;
    const liquidBalance = liquidBalanceINR;
    const totalAssets = totalAssetsINR;
    const netWorth = netWorthINR;

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

