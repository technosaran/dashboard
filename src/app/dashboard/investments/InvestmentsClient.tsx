"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { getColorByLabel } from "@/lib/chart-colours";
import { getCanonicalEnabledModules } from "@/lib/modules";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "@/components/ui/recharts";

// Import sub-clients
import StocksClient from "@/app/dashboard/stocks/StocksClient";
import MutualFundsClient from "@/app/dashboard/mutual-funds/MutualFundsClient";
import BondsClient from "@/app/dashboard/bonds/BondsClient";
import FnoClient from "@/app/dashboard/fno/FnoClient";
import ForexClient from "@/app/dashboard/forex/ForexClient";
import AlternativeAssetsClient from "@/app/dashboard/alternative-assets/AlternativeAssetsClient";
import CryptoClient from "@/app/dashboard/crypto/CryptoClient";

export default function InvestmentsClient() {
  const searchParams = useSearchParams();

  const { data: { investments, mutualFunds, bonds, forexAccounts, alternativeAssets, profile }, isLoading } = useFinanceData();
  const mounted = useHasMounted();
  const [currencyMode, setCurrencyMode] = useState<"INR" | "USD">("INR");

  // Dynamic modules check
  const enabledModules = useMemo(() => {
    return getCanonicalEnabledModules(profile?.enabled_modules);
  }, [profile]);

  const hasStocks = enabledModules.includes("Stocks");
  const hasMF = enabledModules.includes("Mutual Funds");
  const hasBonds = enabledModules.includes("Bonds");
  const hasFnO = enabledModules.includes("FnO");
  const hasForex = enabledModules.includes("Forex");
  const hasAltAssets = enabledModules.includes("Alt Assets");

  const availableTabs = useMemo(() => {
    const list = [{ key: "overview", label: "Overview" }];
    if (currencyMode === "USD") {
      // USD mode: Overview + US Equities + Forex + Crypto
      if (hasStocks) list.push({ key: "stocks-usd", label: "US Equities" });
      if (hasForex) list.push({ key: "forex", label: "Forex" });
      list.push({ key: "crypto", label: "Crypto ($ USDT)" });
    } else {
      // INR mode: show sub-tabs for active/enabled investments
      if (hasStocks) list.push({ key: "stocks", label: "Stocks" });
      if (hasMF) list.push({ key: "mutual-funds", label: "Mutual Funds" });
      if (hasBonds) list.push({ key: "bonds", label: "Bonds" });
      if (hasFnO) list.push({ key: "fno", label: "FnO Trading" });
      if (hasAltAssets) list.push({ key: "alt-assets", label: "Alternative Assets" });
      list.push({ key: "crypto", label: "Crypto" });
    }
    return list;
  }, [hasStocks, hasMF, hasBonds, hasFnO, hasForex, hasAltAssets, currencyMode]);


  const tabParam = searchParams.get("tab");
  const validTabParam = useMemo(() => {
    return tabParam && availableTabs.some(t => t.key === tabParam) ? tabParam : null;
  }, [tabParam, availableTabs]);

  const [customTab, setCustomTab] = useState<string | null>(null);

  const activeTab = useMemo(() => {
    if (customTab && availableTabs.some(t => t.key === customTab)) {
      return customTab;
    }
    if (validTabParam) {
      return validTabParam;
    }
    return availableTabs[0]?.key || "overview";
  }, [customTab, validTabParam, availableTabs]);

  const setActiveTab = (tab: string) => {
    setCustomTab(tab);
  };

  // Combined Portfolio Statistics (Separate INR and USD, zero conversion)
  const portfolioStats = useMemo(() => {
    // 1. Stocks (INR) - filter out USD equities
    const activeStocks = investments.filter(i => i.type === "stock" && Number(i.quantity) > 0 && i.currency !== "USD");
    const stocksInvested = activeStocks.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.buy_price)), 0);
    const stocksCurrent = activeStocks.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.current_price)), 0);
    const stocksRealized = investments.filter(i => i.type === "stock" && i.currency !== "USD").reduce((sum, i) => sum + Number(i.realized_pnl || 0), 0);

    // 2. USD Equities / Stocks (Separate USD)
    const activeUsdStocks = investments.filter(i => i.type === "stock" && Number(i.quantity) > 0 && i.currency === "USD");
    const usdStocksInvested = activeUsdStocks.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.buy_price)), 0);
    const usdStocksCurrent = activeUsdStocks.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.current_price)), 0);
    const usdStocksRealized = investments.filter(i => i.type === "stock" && i.currency === "USD").reduce((sum, i) => sum + Number(i.realized_pnl || 0), 0);

    // 3. Mutual Funds (INR)
    const activeMF = mutualFunds.filter(m => Number(m.units) > 0);
    const mfInvested = activeMF.reduce((sum, m) => sum + (Number(m.units) * Number(m.avg_nav)), 0);
    const mfCurrent = activeMF.reduce((sum, m) => sum + (Number(m.units) * Number(m.current_nav)), 0);
    const mfRealized = mutualFunds.reduce((sum, m) => sum + Number(m.realized_pnl || 0), 0);

    // 4. Bonds (INR)
    const bondsInvested = bonds.reduce((sum, b) => sum + Number(b.total_invested || 0), 0);
    const bondsCurrent = bonds.reduce((sum, b) => sum + Number(b.current_value || 0), 0);

    // 5. Alternative Assets (INR)
    const activeAlt = alternativeAssets || [];
    const altInvested = activeAlt.reduce((sum, a) => sum + Number(a.purchase_price || 0), 0);
    const altCurrent = activeAlt.reduce((sum, a) => sum + Number(a.current_value || 0), 0);

    const totalInvestedINR = stocksInvested + mfInvested + bondsInvested + altInvested;
    const totalCurrentINR = stocksCurrent + mfCurrent + bondsCurrent + altCurrent;
    const totalRealizedINR = stocksRealized + mfRealized;
    const totalPnLINR = (totalCurrentINR - totalInvestedINR) + totalRealizedINR;
    const rawPnLPercentINR = totalInvestedINR > 0 ? (totalPnLINR / totalInvestedINR) * 100 : 0;
    const totalPnLPercentINR = Number.isFinite(rawPnLPercentINR) ? rawPnLPercentINR : 0;

    // 6. Forex & USD Stocks & Crypto (Unified USD Portfolio)
    const activeForex = forexAccounts.filter(f => Number(f.balance) > 0);
    const forexInvestedUSD = activeForex.reduce((sum, f) => {
      const amount = Number(f.total_deposited || 0) - Number(f.total_withdrawn || 0);
      return sum + Math.max(0, amount);
    }, 0);
    const forexCurrentUSD = activeForex.reduce((sum, f) => sum + Number(f.balance || 0), 0);
    const forexRealizedUSD = forexAccounts.reduce((sum, f) => sum + Number(f.total_pnl || 0), 0);

    // Crypto (Binance USDT / USD)
    const activeCrypto = investments.filter(i => i.type === "crypto" && Number(i.quantity) > 0);
    const cryptoInvestedUSD = activeCrypto.reduce((sum, c) => sum + (Number(c.quantity) * Number(c.buy_price)), 0);
    const cryptoCurrentUSD = activeCrypto.reduce((sum, c) => sum + (Number(c.quantity) * Number(c.current_price)), 0);

    const totalInvestedUSDCombined = forexInvestedUSD + usdStocksInvested + cryptoInvestedUSD;
    const totalCurrentUSDCombined = forexCurrentUSD + usdStocksCurrent + cryptoCurrentUSD;
    const totalRealizedUSDCombined = forexRealizedUSD + usdStocksRealized;
    const totalPnLUSDCombined = (totalCurrentUSDCombined - totalInvestedUSDCombined) + totalRealizedUSDCombined;
    const rawPnLPercentUSDCombined = totalInvestedUSDCombined > 0 ? (totalPnLUSDCombined / totalInvestedUSDCombined) * 100 : 0;
    const totalPnLPercentUSDCombined = Number.isFinite(rawPnLPercentUSDCombined) ? rawPnLPercentUSDCombined : 0;

    return {
      inr: {
        stocksValue: stocksCurrent,
        mfValue: mfCurrent,
        bondsValue: bondsCurrent,
        altValue: altCurrent,
        totalInvested: totalInvestedINR,
        totalCurrent: totalCurrentINR,
        totalPnL: totalPnLINR,
        totalPnLPercent: totalPnLPercentINR,
        hasData: totalCurrentINR > 0 || totalInvestedINR > 0
      },
      usd: {
        forexValue: forexCurrentUSD,
        usdStocksValue: usdStocksCurrent,
        cryptoValue: cryptoCurrentUSD,
        totalInvested: totalInvestedUSDCombined,
        totalCurrent: totalCurrentUSDCombined,
        totalPnL: totalPnLUSDCombined,
        totalPnLPercent: totalPnLPercentUSDCombined,
        hasData: totalCurrentUSDCombined > 0 || totalInvestedUSDCombined > 0
      }
    };
  }, [investments, mutualFunds, bonds, forexAccounts, alternativeAssets]);

  // Donut chart data for INR portfolio allocation
  const allocationDataINR = useMemo(() => {
    const data = [];
    if (portfolioStats.inr.stocksValue > 0) {
      data.push({ name: "Stocks", value: portfolioStats.inr.stocksValue, fill: getColorByLabel("Stocks") });
    }
    if (portfolioStats.inr.mfValue > 0) {
      data.push({ name: "Mutual Funds", value: portfolioStats.inr.mfValue, fill: getColorByLabel("Mutual Funds") });
    }
    if (portfolioStats.inr.bondsValue > 0) {
      data.push({ name: "Bonds", value: portfolioStats.inr.bondsValue, fill: getColorByLabel("Bonds") });
    }
    if (portfolioStats.inr.altValue > 0) {
      data.push({ name: "Alternative Assets", value: portfolioStats.inr.altValue, fill: getColorByLabel("Alt Assets") });
    }
    return data;
  }, [portfolioStats]);

  // Donut chart data for USD portfolio allocation
  const allocationDataUSD = useMemo(() => {
    const data = [];
    if (portfolioStats.usd.forexValue > 0) {
      data.push({ name: "Forex Trading", value: portfolioStats.usd.forexValue, fill: "#06B6D4" });
    }
    if (portfolioStats.usd.usdStocksValue > 0) {
      data.push({ name: "US Equities", value: portfolioStats.usd.usdStocksValue, fill: "#38BDF8" });
    }
    if (portfolioStats.usd.cryptoValue > 0) {
      data.push({ name: "Crypto (USDT)", value: portfolioStats.usd.cryptoValue, fill: "#8B5CF6" });
    }
    return data;
  }, [portfolioStats]);

  const formatINR = (val: number) => {
    return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUSD = (val: number) => {
    return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (isLoading) {
    return <div className="skeleton w-full h-[600px] rounded-2xl border border-white/5" />;
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal tracking-tight text-white">Investment Portfolio</h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">Track asset allocation, net returns, and market valuations across domestic and global holdings.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {/* Currency Switcher Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => { setCurrencyMode("INR"); setCustomTab("overview"); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
                currencyMode === "INR"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="text-sm">🇮🇳</span> INR (₹)
            </button>
            <button
              type="button"
              onClick={() => { setCurrencyMode("USD"); setCustomTab("overview"); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
                currencyMode === "USD"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="text-sm">💵</span> USD ($)
            </button>
          </div>
        </div>
      </div>

      {/* Segmented Navigation Bar */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1 max-w-fit">
        {availableTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-slate-800 text-amber-300 border border-slate-700/80 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Rendering */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {currencyMode === "INR" ? (
            /* INR Portfolio Summary stats */
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">INR Portfolio (Stocks, Mutual Funds, Bonds, Alt Assets)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Invested</p>
                  <p className="text-2xl md:text-3xl font-black text-white">{formatINR(portfolioStats.inr.totalInvested)}</p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">INR Principal</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Current Value</p>
                  <p className="text-2xl md:text-3xl font-black text-white">{formatINR(portfolioStats.inr.totalCurrent)}</p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Market Value</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Portfolio P&amp;L</p>
                  <p className={`text-2xl md:text-3xl font-black ${portfolioStats.inr.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {portfolioStats.inr.totalPnL >= 0 ? "+" : ""}{formatINR(portfolioStats.inr.totalPnL)}
                  </p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Return</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Percentage ROI</p>
                  <p className={`text-2xl md:text-3xl font-black ${portfolioStats.inr.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {portfolioStats.inr.totalPnL >= 0 ? "+" : ""}{portfolioStats.inr.totalPnLPercent.toFixed(2)}%
                  </p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Net Gain/Loss %</p>
                </div>
              </div>
            </div>
          ) : (
            /* USD Portfolio Summary stats */
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">USD Dollars Portfolio (Forex Trading, US Equities, Crypto USDT)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Invested</p>
                  <p className="text-2xl md:text-3xl font-black text-white">{formatUSD(portfolioStats.usd.totalInvested)}</p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">USD Principal ($)</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Current Equity</p>
                  <p className="text-2xl md:text-3xl font-black text-white">{formatUSD(portfolioStats.usd.totalCurrent)}</p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Market Value ($)</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">USD P&amp;L</p>
                  <p className={`text-2xl md:text-3xl font-black ${portfolioStats.usd.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {portfolioStats.usd.totalPnL >= 0 ? "+" : ""}{formatUSD(portfolioStats.usd.totalPnL)}
                  </p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Net Gain/Loss ($)</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Percentage ROI</p>
                  <p className={`text-2xl md:text-3xl font-black ${portfolioStats.usd.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {portfolioStats.usd.totalPnL >= 0 ? "+" : ""}{portfolioStats.usd.totalPnLPercent.toFixed(2)}%
                  </p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">USD ROI %</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Value Allocation Breakdown */}
            <div className="glass-card-static p-6 lg:col-span-2 flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] mb-6">
                  {currencyMode === "INR" ? "INR Asset Value Distribution" : "USD Asset Value Distribution"}
                </h3>
                {currencyMode === "INR" ? (
                  <div className="space-y-6">
                    {hasStocks && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-white">Equity Holdings (Stocks)</span>
                          <span className="text-[--text-secondary]">{formatINR(portfolioStats.inr.stocksValue)}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${portfolioStats.inr.totalCurrent > 0 ? (portfolioStats.inr.stocksValue / portfolioStats.inr.totalCurrent) * 100 : 0}%`,
                              backgroundColor: getColorByLabel("Stocks")
                            }} 
                          />
                        </div>
                      </div>
                    )}

                    {hasMF && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-white">Mutual Funds Portfolio</span>
                          <span className="text-[--text-secondary]">{formatINR(portfolioStats.inr.mfValue)}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${portfolioStats.inr.totalCurrent > 0 ? (portfolioStats.inr.mfValue / portfolioStats.inr.totalCurrent) * 100 : 0}%`,
                              backgroundColor: getColorByLabel("Mutual Funds")
                            }} 
                          />
                        </div>
                      </div>
                    )}

                    {hasBonds && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-white">Fixed Income (Bonds)</span>
                          <span className="text-[--text-secondary]">{formatINR(portfolioStats.inr.bondsValue)}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${portfolioStats.inr.totalCurrent > 0 ? (portfolioStats.inr.bondsValue / portfolioStats.inr.totalCurrent) * 100 : 0}%`,
                              backgroundColor: getColorByLabel("Bonds")
                            }} 
                          />
                        </div>
                      </div>
                    )}

                    {hasAltAssets && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-white">Alternative Assets</span>
                          <span className="text-[--text-secondary]">{formatINR(portfolioStats.inr.altValue)}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${portfolioStats.inr.totalCurrent > 0 ? (portfolioStats.inr.altValue / portfolioStats.inr.totalCurrent) * 100 : 0}%`,
                              backgroundColor: getColorByLabel("Alt Assets")
                            }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-white">Forex Trading Accounts</span>
                        <span className="text-[--text-secondary]">{formatUSD(portfolioStats.usd.forexValue)}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-400 rounded-full" 
                          style={{ 
                            width: `${portfolioStats.usd.totalCurrent > 0 ? (portfolioStats.usd.forexValue / portfolioStats.usd.totalCurrent) * 100 : 0}%` 
                          }} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-white">US Equities / Stocks</span>
                        <span className="text-[--text-secondary]">{formatUSD(portfolioStats.usd.usdStocksValue)}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-sky-400 rounded-full" 
                          style={{ 
                            width: `${portfolioStats.usd.totalCurrent > 0 ? (portfolioStats.usd.usdStocksValue / portfolioStats.usd.totalCurrent) * 100 : 0}%` 
                          }} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-white">Crypto Assets ($ USDT)</span>
                        <span className="text-[--text-secondary]">{formatUSD(portfolioStats.usd.cryptoValue)}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-violet-400 rounded-full" 
                          style={{ 
                            width: `${portfolioStats.usd.totalCurrent > 0 ? (portfolioStats.usd.cryptoValue / portfolioStats.usd.totalCurrent) * 100 : 0}%` 
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Allocation Donut Chart */}
            <div className="glass-card-static p-6 flex flex-col items-center justify-center relative min-h-[350px]">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">
                {currencyMode === "INR" ? "INR Allocation" : "USD Allocation"}
              </h3>
              <div className="w-full h-[220px] mt-4">
                {mounted && (currencyMode === "INR" ? portfolioStats.inr.hasData : portfolioStats.usd.hasData) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={currencyMode === "INR" ? allocationDataINR : allocationDataUSD} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={55} 
                        outerRadius={75} 
                        paddingAngle={4} 
                        dataKey="value"
                      >
                        {(currencyMode === "INR" ? allocationDataINR : allocationDataUSD).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                        itemStyle={{ color: "#fff", fontWeight: "bold" }}
                        formatter={(value: any) => [
                          currencyMode === "INR" 
                            ? `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          "Value"
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                     <span className="text-3xl mb-2">📊</span>
                     <span className="text-xs uppercase tracking-widest font-black">
                       {currencyMode === "INR" ? "No INR Assets Loaded" : "No USD Assets Loaded"}
                     </span>
                  </div>
                )}
              </div>
              {(currencyMode === "INR" ? portfolioStats.inr.hasData : portfolioStats.usd.hasData) && (
                <div className="flex flex-wrap justify-center gap-4 mt-2 w-full">
                  {(currencyMode === "INR" ? allocationDataINR : allocationDataUSD).map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <span className="text-[--text-secondary] font-semibold">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INR sub-clients */}
      {currencyMode === "INR" && activeTab === "stocks" && hasStocks && <StocksClient />}
      {currencyMode === "INR" && activeTab === "mutual-funds" && hasMF && <MutualFundsClient />}
      {currencyMode === "INR" && activeTab === "bonds" && hasBonds && <BondsClient />}
      {currencyMode === "INR" && activeTab === "fno" && hasFnO && <FnoClient />}
      {currencyMode === "INR" && activeTab === "alt-assets" && hasAltAssets && <AlternativeAssetsClient isSubComponent />}
      {activeTab === "crypto" && <CryptoClient />}

      {/* USD sub-clients: US Equities + Forex + Crypto */}
      {currencyMode === "USD" && activeTab === "stocks-usd" && hasStocks && <StocksClient showUSD={true} />}
      {currencyMode === "USD" && activeTab === "forex" && hasForex && <ForexClient />}
    </div>
  );

}
