"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { createInvestment, updateInvestment, searchStocks, fetchLiveStockPrice } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import { getColorByLabel } from "@/lib/chart-colours";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

import StocksDataTable from "./components/StocksDataTable";
import StocksHistoryTable from "./components/StocksHistoryTable";

type Stock = Tables<"investments"> & { day_change?: number; day_change_percent?: number };

export default function StocksClient({ initialData, showUSD = false }: { initialData?: FinanceData; showUSD?: boolean }) {
  const { data: { investments, accounts, profile, stockTrades }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [charges, setCharges] = useState("0");

  const [formData, setFormData] = useState({
    name: "", symbol: "", quantity: "", buy_price: "", current_price: "",
    currency: "INR", notes: "", bought_at: "",
    deduct_from_account: "",
    trade_type: "buy" as "buy" | "sell"
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFormData(prev => ({ ...prev, bought_at: new Date().toISOString().split("T")[0] }));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ symbol: string, name: string, fullSymbol?: string, exchange?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  useEffect(() => {
    if (searchQuery.length > 2) {
      setIsSearching(true);
      setShowSearchDropdown(true);
      const timeoutId = setTimeout(async () => {
        const results = await searchStocks(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  }, [searchQuery]);

  const handleSelectSearchResult = async (stock: { symbol: string, name: string }) => {
    setIsSearching(true);
    try {
      const liveData = await fetchLiveStockPrice(stock.symbol);
      const ltp = liveData?.price ? liveData.price.toString() : "0";
      setFormData(prev => ({
        ...prev,
        symbol: stock.symbol,
        name: stock.name,
        buy_price: ltp,
        current_price: ltp
      }));
    } catch (e) {
      console.error("Failed to fetch price for selected stock:", e);
      setFormData(prev => ({
        ...prev,
        symbol: stock.symbol,
        name: stock.name,
        buy_price: "0",
        current_price: "0"
      }));
    } finally {
      setIsSearching(false);
      setShowSearchDropdown(false);
      setSearchQuery("");
    }
  };

  useEffect(() => {
    if (accounts.length > 0 && showAddModal && !formData.deduct_from_account) {
      const defaultAccId = profile?.default_accounts?.stocks;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      if (defaultAccExists) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, deduct_from_account: defaultAccId }));
        }, 0);
      }
    }
  }, [accounts, profile, showAddModal, formData.deduct_from_account]);

  const stocks = useMemo(() => {
    return investments.filter(i => i.type === "stock").map(i => {
      const currentPrice = Number(i.current_price || 0);
      const prevClose = Number(i.previous_close || 0);
      
      let day_change = Number(i.day_change || 0);
      let day_change_percent = Number(i.day_change_percent || 0);

      if (prevClose > 0) {
        day_change = currentPrice - prevClose;
        day_change_percent = (day_change / prevClose) * 100;
      }
      return { ...i, day_change, day_change_percent } as Stock;
    });
  }, [investments]);

  const activeStocks = useMemo(() => 
    stocks
      .filter(s => Number(s.quantity) > 0)
      .filter(s => showUSD ? s.currency === "USD" : s.currency !== "USD"),
    [stocks, showUSD]
  );

  const stats = useMemo(() => {
    const totalInvested = activeStocks.reduce((s, i) => s + (Number(i.quantity) * Number(i.buy_price)), 0);
    const totalCurrent = activeStocks.reduce((s, i) => s + (Number(i.quantity) * Number(i.current_price)), 0);
    const unrealizedPnL = totalCurrent - totalInvested;
    
    // Include realized P&L from all stocks (partial sells on active + fully sold holdings) matching active currency
    const currencyStocks = stocks.filter(s => showUSD ? s.currency === "USD" : s.currency !== "USD");
    const totalRealizedPnL = currencyStocks.reduce((s, i) => s + Number(i.realized_pnl || 0), 0);
    const totalPnL = unrealizedPnL + totalRealizedPnL;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    const dayPnL = activeStocks.reduce((s, i) => s + (Number(i.day_change || 0) * Number(i.quantity || 0)), 0);
    const prevDayValue = totalCurrent - dayPnL;
    const dayPnLPercent = prevDayValue > 0 ? (dayPnL / prevDayValue) * 100 : 0;

    return { totalInvested, totalCurrent, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent, unrealizedPnL, totalRealizedPnL };
  }, [activeStocks, stocks, showUSD]);

  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {};
    activeStocks.forEach(s => {
      const name = s.symbol || s.name;
      map[name] = (map[name] || 0) + (Number(s.quantity) * Number(s.current_price));
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      fill: getColorByLabel(name)
    })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [activeStocks]);

  const startSell = (inv: Stock) => {
    setFormData({
      name: inv.name, 
      symbol: inv.symbol || "",
      quantity: "", 
      buy_price: inv.current_price.toString(), 
      current_price: inv.current_price.toString(), 
      currency: inv.currency,
      notes: "", 
      bought_at: new Date().toISOString().split("T")[0],
      deduct_from_account: "", 
      trade_type: "sell"
    });
    setEditingId(null); 
    setCharges("0");
    setShowAddModal(true);
  };

  const startBuy = (inv: Stock) => {
    setFormData({
      name: inv.name, 
      symbol: inv.symbol || "",
      quantity: "", 
      buy_price: inv.current_price.toString(), 
      current_price: inv.current_price.toString(), 
      currency: inv.currency,
      notes: "", 
      bought_at: new Date().toISOString().split("T")[0],
      deduct_from_account: "", 
      trade_type: "buy"
    });
    setEditingId(null); 
    setCharges("0");
    setShowAddModal(true);
  };

  const startEdit = (inv: Stock) => {
    setFormData({
      name: inv.name, 
      symbol: inv.symbol || "",
      quantity: inv.quantity.toString(), 
      buy_price: inv.buy_price.toString(),
      current_price: inv.current_price.toString(), 
      currency: inv.currency,
      notes: inv.notes || "", 
      bought_at: inv.bought_at || new Date().toISOString().split("T")[0],
      deduct_from_account: "", 
      trade_type: "buy"
    });
    setEditingId(inv.id);
    setCharges("0");
    setShowAddModal(true);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshPrices = async () => {
    setIsRefreshing(true);
    let updated = 0;
    try {
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
      if (updated > 0) {
        mutate();
        toast.success(`Refreshed live prices for ${updated} stocks!`);
      } else {
        toast.success("Prices are already up to date.");
      }
    } catch {
      toast.error("Failed to refresh some prices");
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshedRef = useRef(false);
  useEffect(() => {
    if (activeStocks.length > 0 && !refreshedRef.current) {
      refreshedRef.current = true;
      const today = new Date().toISOString().split("T")[0];
      if (localStorage.getItem("last_stocks_refresh") !== today) {
        localStorage.setItem("last_stocks_refresh", today);
        handleRefreshPrices();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStocks]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      try {
        const fullSymbol = formData.symbol ? formData.symbol.trim().toUpperCase() : undefined;
        const qty = parseFloat(formData.quantity);
        const price = parseFloat(formData.buy_price);
        const manualChargesValue = parseFloat(charges) || 0;
        const finalNetAmount = formData.trade_type === "buy" ? (qty * price) + manualChargesValue : (qty * price) - manualChargesValue;

        const payload = {
          name: formData.name, 
          symbol: fullSymbol,
          quantity: qty,
          buy_price: price,
          current_price: parseFloat(formData.current_price),
          currency: formData.currency,
          notes: formData.notes || undefined,
          bought_at: formData.bought_at,
          deduct_account_id: formData.deduct_from_account || undefined,
          total_cost_with_charges: !editingId ? finalNetAmount : undefined,
          trade_type: formData.trade_type
        };

        if (editingId) {
          const res = await updateInvestment(editingId, { 
            name: payload.name, symbol: payload.symbol, quantity: payload.quantity, buy_price: payload.buy_price, 
            current_price: payload.current_price, currency: payload.currency, notes: payload.notes, bought_at: payload.bought_at 
          });
          if (!res?.error) {
            toast.success("Stock holding updated successfully");
            setShowAddModal(false);
            setEditingId(null);
            mutate();
          } else {
            toast.error(res.error);
          }
        } else {
          if (!formData.deduct_from_account) {
            toast.error("Please select a channeling account");
            return;
          }
          const res = await createInvestment(payload);
          if (!res?.error) {
            toast.success(formData.trade_type === 'buy' ? "Stock purchased" : "Stock sold");
            setShowAddModal(false);
            mutate();
          } else {
            toast.error(res.error);
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to process stock trade.");
      }
    });
  }

  const [activeTab, setActiveTab] = useState<"dashboard" | "holdings" | "history">("dashboard");

  const formatMoney = (val: number) => {
    const locale = showUSD ? "en-US" : "en-IN";
    const symbol = showUSD ? "$" : "₹";
    return symbol + val.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex w-full bg-[var(--bg-base)] min-h-screen">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Kite-style Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-6">
            <div className="flex gap-1.5 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
              <button 
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === 'dashboard' 
                    ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary)/0.35] border border-transparent' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab("holdings")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === 'holdings' 
                    ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary)/0.35] border border-transparent' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                Holdings ({activeStocks.length})
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === 'history' 
                    ? 'bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary)/0.35] border border-transparent' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                Trade History
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleRefreshPrices} 
              disabled={isRefreshing || activeStocks.length === 0}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {isRefreshing ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
              Refresh Prices
            </button>
            <button 
              onClick={() => { 
                setFormData({
                  name: "", symbol: "", quantity: "", buy_price: "", current_price: "",
                  currency: "INR", notes: "", bought_at: new Date().toISOString().split("T")[0],
                  deduct_from_account: "", trade_type: "buy"
                });
                setEditingId(null);
                setShowAddModal(true); 
              }} 
              className="bg-[var(--accent-primary)] hover:brightness-90 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md shadow-[var(--accent-primary)]/10 hover:shadow-[var(--accent-primary)]/20"
            >
              Add Trade
            </button>
          </div>
        </div>

        <div className="p-6 max-w-6xl w-full mx-auto">
          {activeTab === "dashboard" && (
            <div className="flex flex-col lg:flex-row gap-12 items-center lg:items-stretch mt-4">
              {/* Left: Large Allocation Donut */}
              <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-card)] p-8 border border-white/5 rounded-lg">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Asset Allocation</h3>
                {mounted && pieChartData.length > 0 ? (
                  <div className="w-[280px] h-[280px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={2} dataKey="value" stroke="none">
                          {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: "4px" }}
                          itemStyle={{ color: "#fff", fontSize: "11px" }}
                          formatter={(value) => [`${formatMoney(Number(value))}`, "Value"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">Total Wealth</span>
                      <span className="text-white text-2xl font-normal mt-1">
                        {showUSD ? formatMoney(stats.totalCurrent) : stats.totalCurrent >= 10000000 ? "₹" + (stats.totalCurrent / 10000000).toFixed(2) + " Cr" : stats.totalCurrent >= 100000 ? "₹" + (stats.totalCurrent / 100000).toFixed(2) + " L" : formatMoney(stats.totalCurrent)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-[250px] h-[250px] rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">No Stock Holdings</span>
                  </div>
                )}
                
                {pieChartData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-4 mt-8">
                    {pieChartData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                        <span className="text-xs text-gray-400 font-semibold">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Stats summary */}
              <div className="flex-1 flex flex-col justify-center bg-[var(--bg-card)] p-8 border border-white/5 rounded-lg">
                <div className="space-y-6">
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Current value</p>
                    <p className="text-3xl font-normal text-white">{formatMoney(stats.totalCurrent)}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Invested value</p>
                    <p className="text-xl font-normal text-white/90">{formatMoney(stats.totalInvested)}</p>
                  </div>

                  <div className="h-px w-full bg-white/5" />

                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total returns</p>
                      <div className={`text-lg font-bold ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stats.totalPnL >= 0 ? '+' : ''}{formatMoney(stats.totalPnL)}
                        <div className="text-xs font-semibold mt-0.5 opacity-90">{stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%</div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Day&apos;s returns</p>
                      <div className={`text-lg font-bold ${stats.dayPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stats.dayPnL >= 0 ? '+' : ''}{formatMoney(stats.dayPnL)}
                        <div className="text-xs font-semibold mt-0.5 opacity-90">{stats.dayPnLPercent >= 0 ? '+' : ''}{stats.dayPnLPercent.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>

                  {stats.totalRealizedPnL !== 0 && (
                    <>
                      <div className="h-px w-full bg-white/5" />
                      <div className="grid grid-cols-2 gap-8 text-xs font-semibold text-gray-400">
                        <div>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Unrealized P&amp;L</p>
                          <span className={stats.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}>
                            {stats.unrealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.unrealizedPnL)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Realized P&amp;L</p>
                          <span className={stats.totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}>
                            {stats.totalRealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.totalRealizedPnL)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "holdings" && (
            <div className="animate-in fade-in">
              <StocksDataTable 
                stocks={activeStocks} 
                onEdit={startEdit} 
                onBuy={startBuy}
                onSell={startSell} 
                onAdd={() => setShowAddModal(true)} 
              />
            </div>
          )}

          {activeTab === "history" && (
            <div className="animate-in fade-in">
              <StocksHistoryTable trades={stockTrades} />
            </div>
          )}
        </div>
      </div>

      {/* High-Fidelity Zerodha Kite Order Ticket Modal */}
      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? `Edit ${formData.symbol}` : "Order Ticket"}
        >
          {/* Custom Kite style modal header override inside Content */}
          <div className="p-0 -mx-6 -mt-6">
            <div className={`p-4 rounded-t flex items-center justify-between ${
              formData.trade_type === "buy" ? "bg-[#4185f4]" : "bg-[var(--accent-primary)]"
            } text-white`}>
              <div>
                <span className="text-base font-bold uppercase tracking-wider">{editingId ? "Modify" : formData.trade_type === "buy" ? "Buy" : "Sell"} {formData.symbol || "Stock"}</span>
                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded font-black tracking-widest">NSE</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-white/70">LTP</span>
                <span className="ml-1 text-sm font-bold">₹{parseFloat(formData.current_price || "0").toFixed(2)}</span>
              </div>
            </div>

            <div className="p-5 space-y-5 bg-[var(--bg-card)]">
              {/* Product selector: CNC vs MIS */}
              <div className="flex gap-2">
                <button 
                  type="button" 
                  className="flex-1 py-1.5 text-xs font-bold rounded border border-[#4185f4]/30 text-[#4185f4] bg-[#4185f4]/5 hover:bg-[#4185f4]/10 transition-colors"
                >
                  CNC (Longterm)
                </button>
                <button 
                  type="button" 
                  disabled
                  className="flex-1 py-1.5 text-xs font-bold rounded border border-white/5 text-gray-500 cursor-not-allowed"
                >
                  MIS (Intraday)
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Autocomplete Stock Search (if adding new from scratch) */}
                {!formData.symbol ? (
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Search Stock Symbol / Company</label>
                    <div className="relative">
                      <input 
                        autoFocus
                        className="w-full bg-[#202020] border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-[#2185d0] placeholder-gray-500" 
                        placeholder="Search e.g. TCS, Reliance, Infosys..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-2.5">
                          <svg className="w-3.5 h-3.5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                        </div>
                      )}
                    </div>

                    {showSearchDropdown && searchResults.length > 0 && (
                      <div className="absolute z-[120] left-0 right-0 top-[100%] mt-1 bg-[#202020] border border-white/10 rounded shadow-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                        {searchResults.map((res, i) => (
                          <div 
                            key={i} 
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0 flex items-center justify-between"
                            onClick={() => handleSelectSearchResult(res)}
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{res.symbol}</div>
                              <div className="text-xs text-gray-400 truncate max-w-[220px]">{res.name}</div>
                            </div>
                            <span className="text-[0.5625rem] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-semibold">Select</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected Stock Card */
                  <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-white/[0.02] rounded-xl border border-white/5">📈</span>
                      <div>
                        <p className="text-xs font-bold text-white">{formData.symbol}</p>
                        <p className="text-xs text-gray-500 font-medium">{formData.name}</p>
                      </div>
                    </div>
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, symbol: "", name: "" }));
                        }}
                        className="text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-2 py-1 rounded transition-all font-bold"
                      >
                        Change Stock
                      </button>
                    )}
                  </div>
                )}

                {/* Averaging helper note */}
                {formData.symbol && !editingId && formData.trade_type === "buy" && investments.some(i => i.symbol === formData.symbol && i.type === "stock" && Number(i.quantity) > 0) && (
                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/10 text-xs text-sky-400 leading-relaxed flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <span>💡</span>
                    <span>You already own this stock. Buying more will automatically merge the shares and recalculate your <strong>weighted average buy price</strong>.</span>
                  </div>
                )}

                {/* Qty & Price row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Qty.</label>
                    <input 
                      required 
                      type="number" 
                      step="any"
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={formData.quantity} 
                      onChange={e => setFormData({...formData, quantity: e.target.value})} 
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {formData.trade_type === 'buy' ? 'Buy Price' : 'Sell Price'}
                    </label>
                    <input 
                      required 
                      type="number" 
                      step="any"
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={formData.buy_price} 
                      onChange={e => setFormData({...formData, buy_price: e.target.value})} 
                      inputMode="decimal"
                    />
                  </div>
                </div>

                {/* LTP Price row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">LTP (Latest price)</label>
                    <input 
                      required 
                      type="number" 
                      step="any"
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={formData.current_price} 
                      onChange={e => setFormData({...formData, current_price: e.target.value})} 
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Order Type</label>
                    <div className="flex border border-white/10 rounded overflow-hidden">
                      <button type="button" className="flex-1 py-1.5 bg-[#2185d0] text-white text-xs font-bold uppercase">Limit</button>
                      <button type="button" disabled className="flex-1 py-1.5 text-gray-500 text-xs font-bold uppercase cursor-not-allowed">Market</button>
                    </div>
                  </div>
                </div>

                {!editingId && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date</label>
                        <input 
                          type="date" 
                          className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                          value={formData.bought_at} 
                          onChange={e => setFormData({...formData, bought_at: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                          {formData.trade_type === 'buy' ? 'Deduct From' : 'Deposit To'}
                        </label>
                        <select 
                          className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                          value={formData.deduct_from_account} 
                          onChange={e => setFormData({...formData, deduct_from_account: e.target.value})}
                        >
                          <option value="" disabled>Select Account</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Brokerage &amp; Charges (₹)</label>
                        <input 
                          type="number" 
                          step="any"
                          className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                          value={charges} 
                          onChange={e => setCharges(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notes</label>
                        <input 
                          type="text"
                          className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                          placeholder="Optional notes..."
                          value={formData.notes}
                          onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Live Premium Margin Calculator & Order Slip */}
                {((parseFloat(formData.quantity) || 0) > 0) && (
                  <div className="glass-card-static border border-white/5 p-4 rounded-xl space-y-2.5 text-xs bg-white/[0.01] animate-fade-in">
                    <span className="text-xs font-black uppercase tracking-widest text-[--text-muted] block border-b border-white/5 pb-1.5">
                      Order Slip Preview
                    </span>
                    <div className="flex justify-between">
                      <span className="text-[--text-secondary]">Gross Turnover:</span>
                      <span className="text-white font-bold">
                        ₹{formatMoney((parseFloat(formData.quantity) || 0) * (parseFloat(formData.buy_price) || 0))}
                      </span>
                    </div>
                    
                    {/* Dynamic Stamp Duty mock */}
                    <div className="flex justify-between">
                      <span className="text-[--text-secondary]">Stamp Duty (0.015%):</span>
                      <span className="text-white font-mono">
                        ₹{formatMoney((parseFloat(formData.quantity) || 0) * (parseFloat(formData.buy_price) || 0) * 0.00015)}
                      </span>
                    </div>

                    {(parseFloat(charges) || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[--text-secondary]">Brokerage &amp; Fees:</span>
                        <span className="text-white font-bold">
                          ₹{formatMoney(parseFloat(charges) || 0)}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-2 border-t border-white/5 font-black text-xs">
                      <span className="text-white">Estimated {formData.trade_type === 'buy' ? 'Outflow' : 'Inflow'}:</span>
                      <span style={{ color: formData.trade_type === 'buy' ? '#ef4444' : '#10b981' }}>
                        ₹{formatMoney(
                          formData.trade_type === 'buy'
                            ? ((parseFloat(formData.quantity) || 0) * (parseFloat(formData.buy_price) || 0)) + (parseFloat(charges) || 0) + ((parseFloat(formData.quantity) || 0) * (parseFloat(formData.buy_price) || 0) * 0.00015)
                            : ((parseFloat(formData.quantity) || 0) * (parseFloat(formData.buy_price) || 0)) - (parseFloat(charges) || 0) - ((parseFloat(formData.quantity) || 0) * (parseFloat(formData.buy_price) || 0) * 0.00015)
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Modal actions */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className={`flex-1 py-2 rounded text-xs font-bold transition-all text-white shadow-md active:scale-[0.98] ${
                      editingId ? "bg-indigo-600 hover:bg-indigo-700" :
                      formData.trade_type === 'sell' ? "bg-[var(--accent-primary)] hover:brightness-90" : "bg-[#4185f4] hover:bg-[#3574d3]"
                    }`}
                  >
                    {submitting ? "Processing..." : (editingId ? "Modify" : formData.trade_type === 'buy' ? "Buy" : "Sell")}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowAddModal(false); setEditingId(null); }} 
                    className="px-4 py-2 rounded text-xs font-bold bg-[#333] hover:bg-[#444] text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
