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
    const raw = profile?.enabled_modules || [...MODULE_KEYS];
    const enabledModules = [...raw] as string[];
    
    // Bidirectional fallback mapping for Cashflow
    if (raw.includes("Income & Expenses")) {
      enabledModules.push("Income", "Expenses");
    } else if (raw.includes("Income") || raw.includes("Expenses")) {
      enabledModules.push("Income & Expenses");
    }
    
    // Bidirectional fallback mapping for Investments
    if (raw.includes("Investments")) {
      enabledModules.push("Stocks", "Mutual Funds", "Bonds", "FnO", "Forex");
    } else if (
      raw.includes("Stocks") || 
      raw.includes("Mutual Funds") || 
      raw.includes("Bonds") || 
      raw.includes("FnO") || 
      raw.includes("Forex")
    ) {
      enabledModules.push("Investments");
    }
    
    const hasStocks = enabledModules.includes("Stocks");
    const hasForex = enabledModules.includes("Forex");
    const hasMF = enabledModules.includes("Mutual Funds");
    const hasBonds = enabledModules.includes("Bonds");
    const hasAlt = enabledModules.includes("Alt Assets");
    const hasLiabilities = enabledModules.includes("Liabilities");

    // Calculate strict consolidated values in INR (No conversion)
    const cashBalanceINR = accounts.filter(a => a.currency !== 'USD').reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const stockBalanceINR = hasStocks ? investments.filter(i => i.currency !== 'USD').reduce((sum, inv) => sum + (Number(inv.quantity || 0) * Number(inv.current_price || 0)), 0) : 0;
    const forexBalanceINR = hasForex ? forexAccounts.filter(f => f.currency !== 'USD').reduce((sum, acc) => sum + Number(acc.balance || 0), 0) : 0;
    
    // Mutual funds, bonds, alt assets, liabilities are assumed INR unless specified
    const mfBalanceINR = hasMF ? mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0) : 0;
    const bondBalanceINR = hasBonds ? (bonds || []).filter(b => b.status === 'Active').reduce((sum, b) => sum + Number(b.current_value || 0), 0) : 0;
    const altBalanceINR = hasAlt ? (alternativeAssets || []).reduce((sum, asset) => sum + Number(asset.current_value || 0), 0) : 0;
    const debtBalanceINR = hasLiabilities ? liabilities.reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0) : 0;

    // Total INR Net Worth
    const liquidBalanceINR = cashBalanceINR + stockBalanceINR + mfBalanceINR + bondBalanceINR + forexBalanceINR;
    const totalAssetsINR = liquidBalanceINR + altBalanceINR;
    const netWorthINR = totalAssetsINR - debtBalanceINR;

    // Calculate strict consolidated values in USD (No conversion)
    const cashBalanceUSD = accounts.filter(a => a.currency === 'USD').reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const stockBalanceUSD = hasStocks ? investments.filter(i => i.currency === 'USD').reduce((sum, inv) => sum + (Number(inv.quantity || 0) * Number(inv.current_price || 0)), 0) : 0;
    const forexBalanceUSD = hasForex ? forexAccounts.filter(f => f.currency === 'USD').reduce((sum, acc) => sum + Number(acc.balance || 0), 0) : 0;
    
    // Assume 0 for USD unless they have an explicit currency field
    const mfBalanceUSD = 0;
    const bondBalanceUSD = 0;
    const altBalanceUSD = 0;
    const debtBalanceUSD = 0;

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

