"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { getColorByLabel } from "@/lib/chart-colours";
import dynamic from "next/dynamic";

const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), { ssr: false });
const RechartsTooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });

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
  const initialTab = searchParams.get("tab") || "overview";

  const { data: { investments, mutualFunds, bonds, forexAccounts, alternativeAssets, profile }, isLoading } = useFinanceData();
  const [activeTab, setActiveTab] = useState(initialTab);
  const mounted = useHasMounted();

  // Dynamic modules check
  const enabledModules = useMemo(() => {
    const raw = profile?.enabled_modules && profile.enabled_modules.length > 0
      ? profile.enabled_modules
      : ["Income & Expenses", "Budget", "Investments", "Alt Assets", "Liabilities", "Goals", "Family Management", "Ledger"];
    const populated = [...raw] as string[];
    
    if (raw.includes("Investments")) {
      populated.push("Stocks", "Mutual Funds", "Bonds", "FnO", "Forex");
    }
    if (raw.includes("Alt Assets") || raw.includes("Assets")) {
      populated.push("Alt Assets", "Assets");
    }
    return populated;
  }, [profile]);

  const hasStocks = enabledModules.includes("Stocks");
  const hasMF = enabledModules.includes("Mutual Funds");
  const hasBonds = enabledModules.includes("Bonds");
  const hasFnO = enabledModules.includes("FnO");
  const hasForex = enabledModules.includes("Forex");
  const hasAltAssets = enabledModules.includes("Alt Assets");

  const availableTabs = useMemo(() => {
    const list = [{ key: "overview", label: "Overview" }];
    if (hasStocks) list.push({ key: "stocks", label: "Stocks" });
    if (hasMF) list.push({ key: "mutual-funds", label: "Mutual Funds" });
    list.push({ key: "crypto", label: "Crypto" });
    if (hasBonds) list.push({ key: "bonds", label: "Bonds" });
    if (hasFnO) list.push({ key: "fno", label: "FnO Trading" });
    if (hasForex) list.push({ key: "forex", label: "Forex" });
    if (hasAltAssets) list.push({ key: "alt-assets", label: "Alternative Assets" });
    return list;
  }, [hasStocks, hasMF, hasBonds, hasFnO, hasForex, hasAltAssets]);

  // Adjust active tab if the requested tab isn't enabled
  useEffect(() => {
    const exists = availableTabs.some(t => t.key === activeTab);
    if (!exists && availableTabs.length > 0) {
      setTimeout(() => {
        setActiveTab("overview");
      }, 0);
    }
  }, [availableTabs, activeTab]);

  // Combined Portfolio Statistics (Separate INR and USD, zero conversion)
  const portfolioStats = useMemo(() => {
    // 1. Stocks (INR)
    const activeStocks = investments.filter(i => i.type === "stock" && Number(i.quantity) > 0);
    const stocksInvested = activeStocks.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.buy_price)), 0);
    const stocksCurrent = activeStocks.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.current_price)), 0);
    const stocksRealized = investments.filter(i => i.type === "stock").reduce((sum, i) => sum + Number(i.realized_pnl || 0), 0);

    // 2. Mutual Funds (INR)
    const activeMF = mutualFunds.filter(m => Number(m.units) > 0);
    const mfInvested = activeMF.reduce((sum, m) => sum + (Number(m.units) * Number(m.avg_nav)), 0);
    const mfCurrent = activeMF.reduce((sum, m) => sum + (Number(m.units) * Number(m.current_nav)), 0);
    const mfRealized = mutualFunds.reduce((sum, m) => sum + Number(m.realized_pnl || 0), 0);

    // 3. Bonds (INR)
    const bondsInvested = bonds.reduce((sum, b) => sum + Number(b.total_invested || 0), 0);
    const bondsCurrent = bonds.reduce((sum, b) => sum + Number(b.current_value || 0), 0);

    // 4. Alternative Assets (INR)
    const activeAlt = alternativeAssets || [];
    const altInvested = activeAlt.reduce((sum, a) => sum + Number(a.purchase_price || 0), 0);
    const altCurrent = activeAlt.reduce((sum, a) => sum + Number(a.current_value || 0), 0);

    const totalInvestedINR = stocksInvested + mfInvested + bondsInvested + altInvested;
    const totalCurrentINR = stocksCurrent + mfCurrent + bondsCurrent + altCurrent;
    const totalRealizedINR = stocksRealized + mfRealized;
    const totalPnLINR = (totalCurrentINR - totalInvestedINR) + totalRealizedINR;
    const totalPnLPercentINR = totalInvestedINR > 0 ? (totalPnLINR / totalInvestedINR) * 100 : 0;

    // 5. Forex (Separate USD)
    const activeForex = forexAccounts.filter(f => Number(f.balance) > 0);
    const forexInvestedUSD = activeForex.reduce((sum, f) => {
      const amount = Number(f.total_deposited || 0) - Number(f.total_withdrawn || 0);
      return sum + Math.max(0, amount);
    }, 0);
    const forexCurrentUSD = activeForex.reduce((sum, f) => sum + Number(f.balance || 0), 0);
    const forexRealizedUSD = forexAccounts.reduce((sum, f) => sum + Number(f.total_pnl || 0), 0);
    const forexPnLUSD = (forexCurrentUSD - forexInvestedUSD) + forexRealizedUSD;
    const forexPnLPercentUSD = forexInvestedUSD > 0 ? (forexPnLUSD / forexInvestedUSD) * 100 : 0;

    // 6. Crypto (Binance USDT / USD)
    const activeCrypto = investments.filter(i => i.type === "crypto" && Number(i.quantity) > 0);
    const cryptoInvestedUSD = activeCrypto.reduce((sum, c) => sum + (Number(c.quantity) * Number(c.buy_price)), 0);
    const cryptoCurrentUSD = activeCrypto.reduce((sum, c) => sum + (Number(c.quantity) * Number(c.current_price)), 0);
    const cryptoPnLUSD = cryptoCurrentUSD - cryptoInvestedUSD;
    const cryptoPnLPercentUSD = cryptoInvestedUSD > 0 ? (cryptoPnLUSD / cryptoInvestedUSD) * 100 : 0;

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
        totalInvested: forexInvestedUSD,
        totalCurrent: forexCurrentUSD,
        totalPnL: forexPnLUSD,
        totalPnLPercent: forexPnLPercentUSD,
        hasData: forexCurrentUSD > 0 || forexInvestedUSD > 0
      },
      crypto: {
        totalInvested: cryptoInvestedUSD,
        totalCurrent: cryptoCurrentUSD,
        totalPnL: cryptoPnLUSD,
        totalPnLPercent: cryptoPnLPercentUSD,
        hasData: cryptoCurrentUSD > 0 || cryptoInvestedUSD > 0
      }
    };
  }, [investments, mutualFunds, bonds, forexAccounts, alternativeAssets]);

  // Donut chart data for INR portfolio allocation
  const allocationData = useMemo(() => {
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 w-full">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
            Investments Portfolio
          </h1>
          <p className="text-xs text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Asset Allocation & Performance</p>
        </div>
      </div>

      {/* Premium Segmented Toggle Bar */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
        {availableTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          
          // Get specific color styling based on the active tab key
          let activeStyles = "bg-[--accent-primary] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]";
          if (tab.key === "stocks") activeStyles = "bg-sky-500 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)]";
          else if (tab.key === "mutual-funds") activeStyles = "bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]";
          else if (tab.key === "crypto") activeStyles = "bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]";
          else if (tab.key === "bonds") activeStyles = "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]";
          else if (tab.key === "fno") activeStyles = "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]";
          else if (tab.key === "forex") activeStyles = "bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]";
          else if (tab.key === "alt-assets") activeStyles = "bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]";

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer ${
                isActive
                  ? `${activeStyles} border border-transparent`
                  : "text-[--text-muted] hover:text-white hover:bg-white/5 border border-transparent"
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
          {/* INR Portfolio Summary stats */}
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

          {/* USD Forex Summary stats */}
          {portfolioStats.usd.hasData && (
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">USD Portfolio (Forex Trading)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Invested</p>
                  <p className="text-2xl md:text-3xl font-black text-white">{formatUSD(portfolioStats.usd.totalInvested)}</p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Forex Capital</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Current Balance</p>
                  <p className="text-2xl md:text-3xl font-black text-white">{formatUSD(portfolioStats.usd.totalCurrent)}</p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Forex Equity</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Forex P&amp;L</p>
                  <p className={`text-2xl md:text-3xl font-black ${portfolioStats.usd.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {portfolioStats.usd.totalPnL >= 0 ? "+" : ""}{formatUSD(portfolioStats.usd.totalPnL)}
                  </p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Net Profit/Loss</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Percentage ROI</p>
                  <p className={`text-2xl md:text-3xl font-black ${portfolioStats.usd.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {portfolioStats.usd.totalPnL >= 0 ? "+" : ""}{portfolioStats.usd.totalPnLPercent.toFixed(2)}%
                  </p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Forex ROI %</p>
                </div>
              </div>
            </div>
          )}

          {/* Crypto Portfolio Summary stats ($ USDT) */}
          {portfolioStats.crypto.hasData && (
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Crypto Portfolio ($ USDT)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Invested</p>
                  <p className="text-2xl md:text-3xl font-black text-white">{formatUSD(portfolioStats.crypto.totalInvested)}</p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Crypto Capital</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Current Value</p>
                  <p className="text-2xl md:text-3xl font-black text-white">{formatUSD(portfolioStats.crypto.totalCurrent)}</p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Market Value</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Crypto P&amp;L</p>
                  <p className={`text-2xl md:text-3xl font-black ${portfolioStats.crypto.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {portfolioStats.crypto.totalPnL >= 0 ? "+" : ""}{formatUSD(portfolioStats.crypto.totalPnL)}
                  </p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Net Profit/Loss</p>
                </div>
                <div className="glass-card-static p-6 border-white/5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Portfolio ROI</p>
                  <p className={`text-2xl md:text-3xl font-black ${portfolioStats.crypto.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                    {portfolioStats.crypto.totalPnL >= 0 ? "+" : ""}{portfolioStats.crypto.totalPnLPercent.toFixed(2)}%
                  </p>
                  <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Crypto ROI %</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Value Allocation Breakdown */}
            <div className="glass-card-static p-6 lg:col-span-2 flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] mb-6">Asset Value Distribution</h3>
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
              </div>
            </div>

            {/* Allocation Donut Chart */}
            <div className="glass-card-static p-6 flex flex-col items-center justify-center relative min-h-[350px]">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">INR Asset Allocation</h3>
              <div className="w-full h-[220px] mt-4">
                {mounted && portfolioStats.inr.hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocationData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                        {allocationData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />)}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                        itemStyle={{ color: "#fff", fontWeight: "bold" }}
                        formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Value"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                     <span className="text-3xl mb-2">📊</span>
                     <span className="text-xs uppercase tracking-widest font-black">No INR Assets Loaded</span>
                  </div>
                )}
              </div>
              {portfolioStats.inr.hasData && (
                <div className="flex flex-wrap justify-center gap-4 mt-2 w-full">
                  {allocationData.map((entry, index) => (
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

      {activeTab === "stocks" && hasStocks && <StocksClient />}
      {activeTab === "mutual-funds" && hasMF && <MutualFundsClient />}
      {activeTab === "crypto" && <CryptoClient />}
      {activeTab === "bonds" && hasBonds && <BondsClient />}
      {activeTab === "fno" && hasFnO && <FnoClient />}
      {activeTab === "forex" && hasForex && <ForexClient />}
      {activeTab === "alt-assets" && hasAltAssets && <AlternativeAssetsClient isSubComponent />}
    </div>
  );
}
