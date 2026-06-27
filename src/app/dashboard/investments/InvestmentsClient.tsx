"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { getColorByLabel } from "@/lib/chart-colours";
import { Tabs } from "@/components/ui/tabs";
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

export default function InvestmentsClient() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const { data: { investments, mutualFunds, bonds, fnoTrades, profile }, isLoading } = useFinanceData();
  const mounted = useHasMounted();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Dynamic modules check
  const enabledModules = profile?.enabled_modules || [];
  const hasStocks = enabledModules.includes("Stocks");
  const hasMF = enabledModules.includes("Mutual Funds");
  const hasBonds = enabledModules.includes("Bonds");
  const hasFnO = enabledModules.includes("FnO");

  const availableTabs = useMemo(() => {
    const list = [{ key: "overview", label: "Overview" }];
    if (hasStocks) list.push({ key: "stocks", label: "Stocks" });
    if (hasMF) list.push({ key: "mutual-funds", label: "Mutual Funds" });
    if (hasBonds) list.push({ key: "bonds", label: "Bonds" });
    if (hasFnO) list.push({ key: "fno", label: "FnO Trading" });
    return list;
  }, [hasStocks, hasMF, hasBonds, hasFnO]);

  // Adjust active tab if the requested tab isn't enabled
  useEffect(() => {
    const exists = availableTabs.some(t => t.key === activeTab);
    if (!exists && availableTabs.length > 0) {
      setActiveTab("overview");
    }
  }, [availableTabs, activeTab]);

  // Combined Portfolio Statistics
  const portfolioStats = useMemo(() => {
    // 1. Stocks
    const activeStocks = investments.filter(i => i.type === "stock" && Number(i.quantity) > 0);
    const stocksInvested = activeStocks.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.buy_price)), 0);
    const stocksCurrent = activeStocks.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.current_price)), 0);
    const stocksRealized = investments.filter(i => i.type === "stock").reduce((sum, i) => sum + Number(i.realized_pnl || 0), 0);

    // 2. Mutual Funds
    const activeMF = mutualFunds.filter(m => Number(m.units) > 0);
    const mfInvested = activeMF.reduce((sum, m) => sum + (Number(m.units) * Number(m.avg_nav)), 0);
    const mfCurrent = activeMF.reduce((sum, m) => sum + (Number(m.units) * Number(m.current_nav)), 0);
    const mfRealized = mutualFunds.reduce((sum, m) => sum + Number(m.realized_pnl || 0), 0);

    // 3. Bonds
    const bondsInvested = bonds.reduce((sum, b) => sum + Number(b.total_invested || 0), 0);
    const bondsCurrent = bonds.reduce((sum, b) => sum + Number(b.current_value || 0), 0);

    // 4. FnO Realized PnL
    const fnoRealized = fnoTrades.reduce((sum, f) => sum + Number(f.pnl || 0), 0);

    const totalInvested = stocksInvested + mfInvested + bondsInvested;
    const totalCurrent = stocksCurrent + mfCurrent + bondsCurrent;
    const totalRealized = stocksRealized + mfRealized + fnoRealized;

    const totalPnL = (totalCurrent - totalInvested) + totalRealized;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      stocksValue: stocksCurrent,
      mfValue: mfCurrent,
      bondsValue: bondsCurrent,
      totalInvested,
      totalCurrent,
      totalPnL,
      totalPnLPercent,
      hasData: (stocksCurrent + mfCurrent + bondsCurrent) > 0
    };
  }, [investments, mutualFunds, bonds, fnoTrades]);

  // Donut chart data for portfolio allocation
  const allocationData = useMemo(() => {
    const data = [];
    if (portfolioStats.stocksValue > 0) {
      data.push({ name: "Stocks", value: portfolioStats.stocksValue, fill: getColorByLabel("Stocks") });
    }
    if (portfolioStats.mfValue > 0) {
      data.push({ name: "Mutual Funds", value: portfolioStats.mfValue, fill: getColorByLabel("Mutual Funds") });
    }
    if (portfolioStats.bondsValue > 0) {
      data.push({ name: "Bonds", value: portfolioStats.bondsValue, fill: getColorByLabel("Bonds") });
    }
    return data;
  }, [portfolioStats]);

  const formatMoney = (val: number) => {
    return val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (isLoading) {
    return <div className="skeleton w-full h-[600px] rounded-2xl border border-white/5" />;
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">Investments Portfolio</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Asset Allocation & Performance</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        variant="underline"
        items={availableTabs}
        active={activeTab}
        onChange={(key) => setActiveTab(key)}
      />

      {/* Content Rendering */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card-static p-6 border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Invested</p>
              <p className="text-2xl md:text-3xl font-black text-white">₹{formatMoney(portfolioStats.totalInvested)}</p>
              <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Portfolio Principal</p>
            </div>
            <div className="glass-card-static p-6 border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Current Value</p>
              <p className="text-2xl md:text-3xl font-black text-white">₹{formatMoney(portfolioStats.totalCurrent)}</p>
              <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Market Value</p>
            </div>
            <div className="glass-card-static p-6 border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Portfolio P&amp;L</p>
              <p className={`text-2xl md:text-3xl font-black ${portfolioStats.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                {portfolioStats.totalPnL >= 0 ? "+" : ""}₹{formatMoney(portfolioStats.totalPnL)}
              </p>
              <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Return</p>
            </div>
            <div className="glass-card-static p-6 border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Percentage ROI</p>
              <p className={`text-2xl md:text-3xl font-black ${portfolioStats.totalPnL >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                {portfolioStats.totalPnL >= 0 ? "+" : ""}{portfolioStats.totalPnLPercent.toFixed(2)}%
              </p>
              <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Net Gain/Loss %</p>
            </div>
          </div>

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
                        <span className="text-[--text-secondary]">₹{formatMoney(portfolioStats.stocksValue)}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${portfolioStats.totalCurrent > 0 ? (portfolioStats.stocksValue / portfolioStats.totalCurrent) * 100 : 0}%`,
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
                        <span className="text-[--text-secondary]">₹{formatMoney(portfolioStats.mfValue)}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${portfolioStats.totalCurrent > 0 ? (portfolioStats.mfValue / portfolioStats.totalCurrent) * 100 : 0}%`,
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
                        <span className="text-[--text-secondary]">₹{formatMoney(portfolioStats.bondsValue)}</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${portfolioStats.totalCurrent > 0 ? (portfolioStats.bondsValue / portfolioStats.totalCurrent) * 100 : 0}%`,
                            backgroundColor: getColorByLabel("Bonds")
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
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Asset Allocation</h3>
              <div className="w-full h-[220px] mt-4">
                {mounted && portfolioStats.hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocationData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                        {allocationData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />)}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                        itemStyle={{ color: "#fff", fontWeight: "bold" }}
                        formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Value"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                     <span className="text-3xl mb-2">📊</span>
                     <span className="text-xs uppercase tracking-widest font-black">No Assets Loaded</span>
                  </div>
                )}
              </div>
              {portfolioStats.hasData && (
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
      {activeTab === "bonds" && hasBonds && <BondsClient />}
      {activeTab === "fno" && hasFnO && <FnoClient />}
    </div>
  );
}
