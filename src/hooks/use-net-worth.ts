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

    // Determine USD to INR exchange rate (from USD forex account or default 83.5)
    const usdForexAccount = forexAccounts.find(f => f.currency === "USD" && Number((f as any).exchange_rate || 0) > 0);
    const usdToInrRate = usdForexAccount ? Number((usdForexAccount as any).exchange_rate) : 83.5;

    // Calculate INR values (converting USD components using FX rate)
    const cashBalanceINR = accounts.reduce((sum, acc) => {
      const val = Number(acc.balance || 0);
      return sum + (acc.currency === 'USD' ? val * usdToInrRate : val);
    }, 0);

    const stockBalanceINR = hasStocks ? investments.filter(i => i.type === 'stock').reduce((sum, inv) => {
      const val = Number(inv.quantity || 0) * Number(inv.current_price || 0);
      return sum + (inv.currency === 'USD' ? val * usdToInrRate : val);
    }, 0) : 0;

    const forexBalanceINR = hasForex ? forexAccounts.reduce((sum, acc) => {
      const val = Number(acc.balance || 0);
      return sum + (acc.currency === 'USD' ? val * usdToInrRate : val);
    }, 0) : 0;

    const cryptoBalanceUSD = investments.filter(i => i.type === 'crypto').reduce((sum, inv) => sum + (Number(inv.quantity || 0) * Number(inv.current_price || 0)), 0);
    const cryptoBalanceINR = cryptoBalanceUSD * usdToInrRate;

    // Mutual funds, bonds, alt assets, liabilities
    const mfBalanceINR = hasMF ? mutualFunds.reduce((sum, mf) => sum + (Number(mf.units) * Number(mf.current_nav || 0)), 0) : 0;
    const bondBalanceINR = hasBonds ? (bonds || []).filter(b => b.status === 'Active').reduce((sum, b) => sum + Number(b.current_value || 0), 0) : 0;
    const altBalanceINR = hasAlt ? (alternativeAssets || []).reduce((sum, asset) => sum + Number(asset.current_value || 0), 0) : 0;
    const debtBalanceINR = hasLiabilities ? liabilities.reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0) : 0;

    // Total INR Net Worth (Including converted USD & Crypto)
    const liquidBalanceINR = cashBalanceINR + stockBalanceINR + mfBalanceINR + bondBalanceINR + forexBalanceINR + cryptoBalanceINR;
    const totalAssetsINR = liquidBalanceINR + altBalanceINR;
    const netWorthINR = totalAssetsINR - debtBalanceINR;

    // Converted USD Net Worth values
    const cashBalanceUSD = cashBalanceINR / usdToInrRate;
    const stockBalanceUSD = stockBalanceINR / usdToInrRate;
    const forexBalanceUSD = forexBalanceINR / usdToInrRate;
    const mfBalanceUSD = mfBalanceINR / usdToInrRate;
    const bondBalanceUSD = bondBalanceINR / usdToInrRate;
    const altBalanceUSD = altBalanceINR / usdToInrRate;
    const debtBalanceUSD = debtBalanceINR / usdToInrRate;
    const liquidBalanceUSD = liquidBalanceINR / usdToInrRate;
    const totalAssetsUSD = totalAssetsINR / usdToInrRate;
    const netWorthUSD = totalAssetsUSD - debtBalanceUSD;

    // Default unified properties aligned to user currency preference
    const isUSD = profile?.base_currency === "USD";
    const netWorth = isUSD ? netWorthUSD : netWorthINR;
    const cashBalance = isUSD ? cashBalanceUSD : cashBalanceINR;
    const stockBalance = isUSD ? stockBalanceUSD : stockBalanceINR;
    const forexBalance = isUSD ? forexBalanceUSD : forexBalanceINR;
    const cryptoBalance = isUSD ? cryptoBalanceUSD : cryptoBalanceINR;
    const mfBalance = isUSD ? mfBalanceUSD : mfBalanceINR;
    const bondBalance = isUSD ? bondBalanceUSD : bondBalanceINR;
    const altBalance = isUSD ? altBalanceUSD : altBalanceINR;
    const debtBalance = isUSD ? debtBalanceUSD : debtBalanceINR;
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

