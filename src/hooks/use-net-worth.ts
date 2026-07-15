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

    // Calculate INR values (only non-USD accounts)
    const cashBalanceINR = accounts.filter(a => a.currency !== 'USD').reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const stockBalanceINR = hasStocks ? investments.filter(i => i.type === 'stock' && i.currency !== 'USD').reduce((sum, inv) => sum + (Number(inv.quantity || 0) * Number(inv.current_price || 0)), 0) : 0;
    const forexBalanceINR = hasForex ? forexAccounts.filter(f => f.currency !== 'USD').reduce((sum, acc) => sum + Number(acc.balance || 0), 0) : 0;
    
    // Mutual funds, bonds, alt assets, liabilities are assumed INR
    const mfBalanceINR = hasMF ? mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0) : 0;
    const bondBalanceINR = hasBonds ? (bonds || []).filter(b => b.status === 'Active').reduce((sum, b) => sum + Number(b.current_value || 0), 0) : 0;
    const altBalanceINR = hasAlt ? (alternativeAssets || []).reduce((sum, asset) => sum + Number(asset.current_value || 0), 0) : 0;
    const debtBalanceINR = hasLiabilities ? liabilities.reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0) : 0;

    // Total INR Net Worth (No USD elements)
    const liquidBalanceINR = cashBalanceINR + stockBalanceINR + mfBalanceINR + bondBalanceINR + forexBalanceINR;
    const totalAssetsINR = liquidBalanceINR + altBalanceINR;
    const netWorthINR = totalAssetsINR - debtBalanceINR;

    // Calculate USD values (only USD accounts)
    const cashBalanceUSD = accounts.filter(a => a.currency === 'USD').reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
    const stockBalanceUSD = hasStocks ? investments.filter(i => i.type === 'stock' && i.currency === 'USD').reduce((sum, inv) => sum + (Number(inv.quantity || 0) * Number(inv.current_price || 0)), 0) : 0;
    const forexBalanceUSD = hasForex ? forexAccounts.filter(f => f.currency === 'USD').reduce((sum, acc) => sum + Number(acc.balance || 0), 0) : 0;
    const cryptoBalanceUSD = investments.filter(i => i.type === 'crypto').reduce((sum, inv) => sum + (Number(inv.quantity || 0) * Number(inv.current_price || 0)), 0);

    // Total USD Net Worth (No INR elements)
    const liquidBalanceUSD = cashBalanceUSD + stockBalanceUSD + 0 + 0 + forexBalanceUSD + cryptoBalanceUSD;
    const totalAssetsUSD = liquidBalanceUSD;
    const debtBalanceUSD = 0;
    const netWorthUSD = totalAssetsUSD - debtBalanceUSD;

    // Default unified properties aligned to user currency preference (without exchange rate conversions)
    const isUSD = profile?.base_currency === "USD";
    const netWorth = isUSD ? netWorthUSD : netWorthINR;
    const cashBalance = isUSD ? cashBalanceUSD : cashBalanceINR;
    const stockBalance = isUSD ? stockBalanceUSD : stockBalanceINR;
    const forexBalance = isUSD ? forexBalanceUSD : forexBalanceINR;
    const cryptoBalance = cryptoBalanceUSD;
    const mfBalance = isUSD ? 0 : mfBalanceINR;
    const bondBalance = isUSD ? 0 : bondBalanceINR;
    const altBalance = isUSD ? 0 : altBalanceINR;
    const debtBalance = isUSD ? 0 : debtBalanceINR;
    const liquidBalance = isUSD ? liquidBalanceUSD : liquidBalanceINR;
    const totalAssets = isUSD ? totalAssetsUSD : totalAssetsINR;

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
      cryptoBalance,
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

