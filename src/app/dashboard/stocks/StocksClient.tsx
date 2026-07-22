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
import { calculateEquityDeliveryCharges } from "@/lib/zerodha-charges";
import { getIndianMarketStatus, type MarketStatusInfo } from "@/lib/market-hours";

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
  const [isCustomCharges, setIsCustomCharges] = useState(false);

  // Zerodha Market Status & Clock State
  const [marketStatus, setMarketStatus] = useState<MarketStatusInfo>(() => getIndianMarketStatus());

  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getIndianMarketStatus());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
      const chosenAccount = defaultAccExists ? defaultAccId : accounts[0].id;
      setTimeout(() => {
        setFormData(prev => ({ ...prev, deduct_from_account: chosenAccount }));
      }, 0);
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

  // Zerodha Live Market Auto-Polling Engine (15s polling during live trading hours)
  useEffect(() => {
    if (marketStatus.isOpen && activeStocks.length > 0) {
      const interval = setInterval(() => {
        handleRefreshPrices();
      }, 15000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketStatus.isOpen, activeStocks.length]);

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
    <div className="flex w-full bg-[#191919] min-h-screen text-[#E0E0E0] relative font-sans">
      {/* Ambient Kite Glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-[#387ED1]/10 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 -left-32 w-[550px] h-[550px] bg-[#41B883]/5 rounded-full blur-[160px]" />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        
        {/* Zerodha Kite Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-3.5 border-b border-[#2B313A] bg-[#121212] gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            {/* Zerodha Kite Emblem */}
            <div className="w-9 h-9 rounded-lg bg-[#FF5722]/10 border border-[#FF5722]/30 flex items-center justify-center text-[#FF5722] shadow-[0_0_15px_rgba(255,87,34,0.25)]">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L2 12l10 10 10-10L12 2zm0 4.5l6.5 6.5-6.5 6.5-6.5-6.5L12 6.5z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-wider uppercase">Zerodha Kite Equity</h1>
                <span className="text-[0.5625rem] bg-[#387ED1]/20 text-[#387ED1] border border-[#387ED1]/30 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">KITE PRO</span>
                <span 
                  className="text-[0.625rem] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border tracking-wider"
                  style={{ 
                    backgroundColor: `${marketStatus.badgeColor}15`, 
                    color: marketStatus.badgeColor,
                    borderColor: `${marketStatus.badgeColor}40`
                  }}
                  title={marketStatus.nextSessionText}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: marketStatus.badgeColor }} />
                  {marketStatus.statusText} • {marketStatus.formattedTimeIST}
                </span>
              </div>
              <p className="text-[0.6875rem] text-[#848E9C] font-semibold flex items-center gap-1.5 mt-0.5">
                NSE / BSE Spot Watch • {marketStatus.nextSessionText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex gap-1 rounded-xl bg-[#191919] border border-[#2B313A] p-1 shadow-inner">
              <button 
                onClick={() => setActiveTab("dashboard")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'dashboard' 
                    ? 'bg-[#387ED1] text-white shadow-[0_0_12px_rgba(56,126,209,0.4)]' 
                    : 'text-[#848E9C] hover:text-white hover:bg-white/5'
                }`}
              >
                Overview
              </button>
              <button 
                onClick={() => setActiveTab("holdings")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'holdings' 
                    ? 'bg-[#387ED1] text-white shadow-[0_0_12px_rgba(56,126,209,0.4)]' 
                    : 'text-[#848E9C] hover:text-white hover:bg-white/5'
                }`}
              >
                Holdings ({activeStocks.length})
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'history' 
                    ? 'bg-[#387ED1] text-white shadow-[0_0_12px_rgba(56,126,209,0.4)]' 
                    : 'text-[#848E9C] hover:text-white hover:bg-white/5'
                }`}
              >
                Order Book
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleRefreshPrices} 
                disabled={isRefreshing || activeStocks.length === 0}
                className="bg-[#2B313A]/50 hover:bg-[#2B313A] border border-[#2B313A] text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isRefreshing ? (
                  <svg className="w-3.5 h-3.5 animate-spin text-[#387ED1]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-[#387ED1]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                )}
                Refresh LTP
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
                className="bg-[#41B883] hover:bg-[#38a373] text-black font-extrabold px-4 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(65,184,131,0.3)] cursor-pointer"
              >
                + New Order
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-7xl w-full mx-auto">
          {activeTab === "dashboard" && (
            <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-stretch mt-2">
              {/* Left: Large Allocation Donut */}
              <div className="flex-1 flex flex-col items-center justify-center bg-[#252525] p-8 border border-[#333333] rounded-2xl relative shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#FF5722] via-[#387ED1] to-[#41B883]" />
                <h3 className="text-xs font-bold text-[#848E9C] uppercase tracking-widest mb-6 absolute top-6 left-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#387ED1]" />
                  Sector / Equity Breakdown
                </h3>
                {mounted && pieChartData.length > 0 ? (
                  <div className="w-[300px] h-[300px] relative mt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={85} outerRadius={115} paddingAngle={3} dataKey="value" stroke="none">
                          {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "#191919", border: "1px solid #333", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.8)" }}
                          itemStyle={{ color: "#387ED1", fontSize: "12px", fontWeight: "bold" }}
                          formatter={(value) => [`${formatMoney(Number(value))}`, "Market Value"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[#848E9C] text-xs uppercase tracking-widest font-black">Current Portfolio</span>
                      <span className="text-white text-3xl font-extrabold tracking-tight mt-1">
                        {showUSD ? formatMoney(stats.totalCurrent) : stats.totalCurrent >= 10000000 ? "₹" + (stats.totalCurrent / 10000000).toFixed(2) + " Cr" : stats.totalCurrent >= 100000 ? "₹" + (stats.totalCurrent / 100000).toFixed(2) + " L" : formatMoney(stats.totalCurrent)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-[260px] flex flex-col items-center justify-center text-[#848E9C] text-xs font-medium gap-3">
                    <span>No stock holdings found in Zerodha Kite portfolio.</span>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="bg-[#387ED1] text-white font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-wider hover:bg-[#306eb8] transition-all shadow-md cursor-pointer"
                    >
                      + Place First Order
                    </button>
                  </div>
                )}
                
                {pieChartData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-4 mt-8">
                    {pieChartData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2 bg-[#191919] px-3 py-1.5 rounded-lg border border-[#333]">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                        <span className="text-xs text-[#E0E0E0] font-bold">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Zerodha Kite Summary Cards */}
              <div className="flex-1 flex flex-col justify-center bg-[#252525] p-8 border border-[#333333] rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="space-y-6">
                  <div>
                    <p className="text-[0.6875rem] font-bold text-[#848E9C] uppercase tracking-widest mb-1">Total Current Valuation</p>
                    <p className="text-4xl font-extrabold text-white tracking-tight">{formatMoney(stats.totalCurrent)}</p>
                  </div>
                  
                  <div>
                    <p className="text-[0.6875rem] font-bold text-[#848E9C] uppercase tracking-widest mb-1">Total Invested Cost</p>
                    <p className="text-2xl font-bold text-[#CCCCCC]">{formatMoney(stats.totalInvested)}</p>
                  </div>

                  <div className="h-px w-full bg-[#333]" />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-[#191919] p-4 rounded-xl border border-[#333]">
                      <p className="text-[0.65rem] text-[#848E9C] font-bold uppercase tracking-widest mb-1">Total P&amp;L</p>
                      <div className={`text-xl font-extrabold ${stats.totalPnL >= 0 ? 'text-[#41B883]' : 'text-[#FF5722]'}`}>
                        {stats.totalPnL >= 0 ? '+' : ''}{formatMoney(stats.totalPnL)}
                        <div className="text-xs font-bold mt-0.5">{stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%</div>
                      </div>
                    </div>
                    <div className="bg-[#191919] p-4 rounded-xl border border-[#333]">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[0.65rem] text-[#848E9C] font-bold uppercase tracking-widest">Day&apos;s P&amp;L</p>
                        <span 
                          className="text-[0.5625rem] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider"
                          style={{ 
                            backgroundColor: `${marketStatus.badgeColor}15`, 
                            color: marketStatus.badgeColor,
                            borderColor: `${marketStatus.badgeColor}30`
                          }}
                        >
                          {marketStatus.isOpen ? 'LIVE' : 'SETTLED'}
                        </span>
                      </div>
                      <div className={`text-xl font-extrabold ${stats.dayPnL >= 0 ? 'text-[#41B883]' : 'text-[#FF5722]'}`}>
                        {stats.dayPnL >= 0 ? '+' : ''}{formatMoney(stats.dayPnL)}
                        <div className="text-xs font-bold mt-0.5">{stats.dayPnLPercent >= 0 ? '+' : ''}{stats.dayPnLPercent.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>

                  {stats.totalRealizedPnL !== 0 && (
                    <>
                      <div className="h-px w-full bg-[#333]" />
                      <div className="grid grid-cols-2 gap-6 text-xs font-semibold text-[#848E9C]">
                        <div>
                          <p className="text-[0.65rem] text-[#848E9C] font-bold uppercase tracking-widest mb-1">Unrealized P&amp;L</p>
                          <span className={stats.unrealizedPnL >= 0 ? 'text-[#41B883] font-bold' : 'text-[#FF5722] font-bold'}>
                            {stats.unrealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.unrealizedPnL)}
                          </span>
                        </div>
                        <div>
                          <p className="text-[0.65rem] text-[#848E9C] font-bold uppercase tracking-widest mb-1">Realized P&amp;L</p>
                          <span className={stats.totalRealizedPnL >= 0 ? 'text-[#41B883] font-bold' : 'text-[#FF5722] font-bold'}>
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
                      <div className="absolute z-[120] left-0 right-0 top-[100%] mt-1 bg-[#191919] border border-[#387ED1]/40 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                        {searchResults.map((res, i) => (
                          <div 
                            key={i} 
                            className="px-3.5 py-2.5 hover:bg-[#387ED1]/10 cursor-pointer transition-colors border-b border-white/5 last:border-0 flex items-center justify-between"
                            onClick={() => handleSelectSearchResult(res)}
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{res.symbol}</div>
                              <div className="text-xs text-gray-400 truncate max-w-[220px]">{res.name}</div>
                            </div>
                            <span className="text-[0.625rem] bg-[#387ED1]/20 text-[#387ED1] px-2 py-0.5 rounded font-black uppercase">Select</span>
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

                {/* Hidden LTP (auto-fetched) */}
                <input type="hidden" value={formData.current_price} />

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

                    <div className="mt-4 space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notes</label>
                      <input 
                        type="text"
                        className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                        placeholder="Optional notes..."
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Live Premium Zerodha Margin & Tax Calculator Order Slip */}
                {((parseFloat(formData.quantity) || 0) > 0) && (
                  <div className="glass-card-static border border-[#387ED1]/30 p-4 rounded-xl space-y-2.5 text-xs bg-[#191919] animate-fade-in">
                    <div className="flex justify-between items-center border-b border-[#333] pb-2">
                      <span className="text-xs font-black uppercase tracking-widest text-[#387ED1]">
                        Zerodha Order Slip & Tax Breakdown
                      </span>
                      <span className="text-[0.625rem] bg-[#387ED1]/20 text-[#387ED1] px-2 py-0.5 rounded font-bold uppercase">
                        Equity Delivery
                      </span>
                    </div>

                    {(() => {
                      const q = parseFloat(formData.quantity) || 0;
                      const p = parseFloat(formData.buy_price) || 0;
                      const turnover = q * p;
                      const isBuy = formData.trade_type === "buy";
                      const calc = calculateEquityDeliveryCharges(turnover, isBuy);
                      const currentCharges = parseFloat(charges) || 0;

                      return (
                        <>
                          <div className="flex justify-between">
                            <span className="text-[#848E9C]">Gross Turnover:</span>
                            <span className="text-white font-bold">₹{turnover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>

                          {/* Mini Zerodha Tax Details */}
                          <div className="bg-[#202020] p-2.5 rounded-lg border border-[#333] space-y-1 text-[0.6875rem]">
                            <div className="flex justify-between text-[#CCCCCC]">
                              <span>Brokerage:</span>
                              <span className="font-bold text-[#41B883]">₹0.00 (Free)</span>
                            </div>
                            <div className="flex justify-between text-[#848E9C]">
                              <span>STT (0.1%):</span>
                              <span className="font-mono text-white">₹{calc.stt.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[#848E9C]">
                              <span>NSE Txn Fee (0.00297%):</span>
                              <span className="font-mono text-white">₹{calc.transactionFee.toFixed(2)}</span>
                            </div>
                            {isBuy ? (
                              <div className="flex justify-between text-[#848E9C]">
                                <span>Stamp Duty (0.015%):</span>
                                <span className="font-mono text-white">₹{calc.stampDuty.toFixed(2)}</span>
                              </div>
                            ) : (
                              <div className="flex justify-between text-[#848E9C]">
                                <span>DP Charges:</span>
                                <span className="font-mono text-white">₹15.93</span>
                              </div>
                            )}
                            <div className="flex justify-between text-[#848E9C]">
                              <span>GST (18%):</span>
                              <span className="font-mono text-white">₹{calc.gst.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Prominent Auto-Calculated Total Charges Display & Edit Row */}
                          <div className="flex justify-between items-center bg-[#202020] px-3.5 py-2.5 rounded-xl border border-[#387ED1]/30">
                            <div className="flex items-center gap-2">
                              <span className="text-[#CCCCCC] font-bold text-xs uppercase tracking-wider">Total Charges:</span>
                              {!isCustomCharges ? (
                                <span className="text-[0.5625rem] bg-[#387ED1]/20 text-[#387ED1] border border-[#387ED1]/30 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                                  Auto-Calculated
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCustomCharges(false);
                                    setCharges(calc.totalCharges.toString());
                                  }}
                                  className="text-[0.625rem] text-[#387ED1] hover:underline font-bold"
                                >
                                  (Reset Auto-Calc)
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono font-extrabold text-sm">
                                ₹{isCustomCharges ? (parseFloat(charges) || 0).toFixed(2) : calc.totalCharges.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isCustomCharges) {
                                    setIsCustomCharges(true);
                                    setCharges(calc.totalCharges.toString());
                                  }
                                }}
                                className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                                title="Manual Edit Charges"
                              >
                                ✏️
                              </button>
                            </div>
                          </div>

                          {isCustomCharges && (
                            <div className="flex items-center justify-between gap-2 bg-[#151515] p-2 rounded-lg border border-[#387ED1]/50 animate-fade-in">
                              <span className="text-[0.6875rem] text-gray-400 font-semibold">Custom Manual Charges (₹):</span>
                              <input
                                type="number"
                                step="0.01"
                                value={charges}
                                onChange={(e) => {
                                  setIsCustomCharges(true);
                                  setCharges(e.target.value);
                                }}
                                className="w-28 bg-[#202020] border border-[#387ED1] rounded px-2.5 py-1 text-xs text-white font-mono font-bold outline-none text-right"
                                placeholder="0.00"
                              />
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-2 border-t border-[#333] font-black text-xs">
                            <span className="text-white">Estimated Net {isBuy ? 'Outflow' : 'Inflow'}:</span>
                            <span className={isBuy ? 'text-[#FF5722]' : 'text-[#41B883]'}>
                              ₹{(isBuy ? turnover + currentCharges : turnover - currentCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </>
                      );
                    })()}
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
