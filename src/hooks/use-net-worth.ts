import { useMemo } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { getCanonicalEnabledModules } from "@/lib/modules";

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
    const enabledModules = getCanonicalEnabledModules(profile?.enabled_modules);
    
    const hasStocks = enabledModules.includes("Stocks");
    const hasForex = enabledModules.includes("Forex");
    const hasMF = enabledModules.includes("Mutual Funds");
    const hasBonds = enabledModules.includes("Bonds");
    const hasAlt = enabledModules.includes("Alt Assets");
    const hasLiabilities = enabledModules.includes("Liabilities");

    const getConvertedValues = (val: number, currency?: string) => {
      const amount = Number(val || 0);
      const isUSD = currency === "USD";
      const inr = isUSD ? 0 : amount;
      const usd = isUSD ? amount : 0;
      return { inr, usd };
    };

    // For investment categories, separate INR and USD totals without exchange conversion
    const getInvestmentValues = (val: number, currency?: string) => {
      const amount = Number(val || 0);
      const isUSD = currency === "USD";
      const inr = isUSD ? 0 : amount;
      const usd = isUSD ? amount : 0;
      return { inr, usd };
    };

    // Accounts / Cash
    let cashBalanceINR = 0;
    let cashBalanceUSD = 0;
    accounts.forEach(acc => {
      const { inr, usd } = getConvertedValues(acc.balance, acc.currency);
      cashBalanceINR += inr;
      cashBalanceUSD += usd;
    });

    // Investments (Stocks & Crypto)
    let stockBalanceINR = 0;
    let stockBalanceUSD = 0;
    let cryptoBalanceINR = 0;
    let cryptoBalanceUSD = 0;

    const isCryptoAsset = (inv: any) => {
      if (inv.type === "crypto") return true;
      const s = (inv.symbol || "").toUpperCase();
      const n = (inv.name || "").toLowerCase();
      const cryptoKeywords = /^(btc|eth|sol|usdt|bnb|xrp|ada|doge|shib|dot|link|matic|avax|uni|ltc|crypto|bitcoin|ethereum|tether|cardano|solana|pepe|wif|bonk|sui|arb|op|ord|rndr|inj|near|atom|ftm)$/i;
      return cryptoKeywords.test(s) || /crypto|bitcoin|ethereum|tether|cardano|solana/i.test(n);
    };

    if (hasStocks) {
      investments.forEach(inv => {
        const val = Number(inv.quantity || 0) * Number(inv.current_price || 0);
        const { inr, usd } = getInvestmentValues(val, inv.currency);

        if (isCryptoAsset(inv)) {
          cryptoBalanceINR += inr;
          cryptoBalanceUSD += usd;
        } else {
          stockBalanceINR += inr;
          stockBalanceUSD += usd;
        }
      });
    }

    // Forex Accounts
    let forexBalanceINR = 0;
    let forexBalanceUSD = 0;
    if (hasForex) {
      forexAccounts.forEach(acc => {
        const { inr, usd } = getConvertedValues(acc.balance, acc.currency);
        forexBalanceINR += inr;
        forexBalanceUSD += usd;
      });
    }

    // Mutual Funds
    let mfBalanceINR = 0;
    let mfBalanceUSD = 0;
    if (hasMF) {
      mutualFunds.forEach(mf => {
        const val = Number(mf.units || 0) * Number(mf.current_nav || 0);
        const { inr, usd } = getInvestmentValues(val, (mf as any).currency);
        mfBalanceINR += inr;
        mfBalanceUSD += usd;
      });
    }

    // Bonds
    let bondBalanceINR = 0;
    let bondBalanceUSD = 0;
    if (hasBonds) {
      (bonds || []).filter(b => b.status === "Active").forEach(b => {
        const { inr, usd } = getInvestmentValues(b.current_value, (b as any).currency);
        bondBalanceINR += inr;
        bondBalanceUSD += usd;
      });
    }

    // Alternative Assets
    let altBalanceINR = 0;
    let altBalanceUSD = 0;
    if (hasAlt) {
      (alternativeAssets || []).forEach(asset => {
        const { inr, usd } = getInvestmentValues(asset.current_value, (asset as any).currency);
        altBalanceINR += inr;
        altBalanceUSD += usd;
      });
    }

    // Liabilities / Debt
    let debtBalanceINR = 0;
    let debtBalanceUSD = 0;
    if (hasLiabilities) {
      liabilities.forEach(debt => {
        const { inr, usd } = getConvertedValues(debt.remaining_amount, (debt as any).currency);
        debtBalanceINR += inr;
        debtBalanceUSD += usd;
      });
    }

    const liquidBalanceINR = cashBalanceINR + stockBalanceINR + mfBalanceINR + bondBalanceINR + forexBalanceINR + cryptoBalanceINR;
    const totalAssetsINR = liquidBalanceINR + altBalanceINR;
    const netWorthINR = totalAssetsINR - debtBalanceINR;

    const liquidBalanceUSD = cashBalanceUSD + stockBalanceUSD + mfBalanceUSD + bondBalanceUSD + forexBalanceUSD + cryptoBalanceUSD;
    const totalAssetsUSD = liquidBalanceUSD + altBalanceUSD;
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

    // Calculate total all-time unrealized investment growth
    let totalInvestedINR = 0;
    let totalInvestedUSD = 0;
    let totalGrowthINR = 0;
    let totalGrowthUSD = 0;

    investments.forEach(inv => {
      const buyPrice = Number(inv.buy_price || 0);
      const currPrice = Number(inv.current_price || 0);
      const qty = Number(inv.quantity || 0);
      const cost = qty * buyPrice;
      const currentVal = qty * currPrice;
      const gain = currentVal - cost;

      const { inr: costINR, usd: costUSD } = getInvestmentValues(cost, inv.currency);
      const { inr: gainINR, usd: gainUSD } = getInvestmentValues(gain, inv.currency);
      totalInvestedINR += costINR;
      totalInvestedUSD += costUSD;
      totalGrowthINR += gainINR;
      totalGrowthUSD += gainUSD;
    });

    mutualFunds.forEach(mf => {
      const avgNav = Number(mf.avg_nav || 0);
      const currNav = Number(mf.current_nav || 0);
      const units = Number(mf.units || 0);
      const cost = units * avgNav;
      const currentVal = units * currNav;
      const gain = currentVal - cost;

      const { inr: costINR, usd: costUSD } = getInvestmentValues(cost, (mf as any).currency);
      const { inr: gainINR, usd: gainUSD } = getInvestmentValues(gain, (mf as any).currency);
      totalInvestedINR += costINR;
      totalInvestedUSD += costUSD;
      totalGrowthINR += gainINR;
      totalGrowthUSD += gainUSD;
    });

    const totalGrowthPercent = totalInvestedINR > 0 ? (totalGrowthINR / totalInvestedINR) * 100 : 0;
    const totalGrowth = isUSD ? totalGrowthUSD : totalGrowthINR;

    return {
      netWorth,
      netWorthINR,
      netWorthUSD,
      totalGrowth,
      totalGrowthINR,
      totalGrowthUSD,
      totalGrowthPercent,
      totalInvestedINR,
      totalInvestedUSD,
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
      cryptoBalanceINR,
      cryptoBalanceUSD,
      mfBalance,
      mfBalanceINR,
      mfBalanceUSD,
      bondBalance,
      bondBalanceINR,
      bondBalanceUSD,
      altBalance,
      altBalanceINR,
      altBalanceUSD,
      debtBalance,
      debtBalanceINR,
      debtBalanceUSD,
      liquidBalance,
      liquidBalanceINR,
      liquidBalanceUSD,
      totalAssets,
      totalAssetsINR,
      totalAssetsUSD
    };
  }, [accounts, investments, forexAccounts, mutualFunds, bonds, alternativeAssets, liabilities, profile]);
}
