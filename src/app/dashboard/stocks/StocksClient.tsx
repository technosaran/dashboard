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

export default function StocksClient({ initialData }: { initialData?: FinanceData }) {
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

  const activeStocks = useMemo(() => stocks.filter(s => Number(s.quantity) > 0), [stocks]);

  const stats = useMemo(() => {
    const totalInvested = activeStocks.reduce((s, i) => s + (Number(i.quantity) * Number(i.buy_price)), 0);
    const totalCurrent = activeStocks.reduce((s, i) => s + (Number(i.quantity) * Number(i.current_price)), 0);
    const unrealizedPnL = totalCurrent - totalInvested;
    
    // Include realized P&L from all stocks (partial sells on active + fully sold holdings)
    const totalRealizedPnL = stocks.reduce((s, i) => s + Number(i.realized_pnl || 0), 0);
    const totalPnL = unrealizedPnL + totalRealizedPnL;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    const dayPnL = activeStocks.reduce((s, i) => s + (Number(i.day_change || 0) * Number(i.quantity || 0)), 0);
    const prevDayValue = totalCurrent - dayPnL;
    const dayPnLPercent = prevDayValue > 0 ? (dayPnL / prevDayValue) * 100 : 0;

    return { totalInvested, totalCurrent, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent, unrealizedPnL, totalRealizedPnL };
  }, [activeStocks, stocks]);

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
      quantity: inv.quantity.toString(), 
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
    } catch (e) {
      toast.error("Failed to refresh some prices");
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshedRef = useRef(false);
  useEffect(() => {
    if (activeStocks.length > 0 && !refreshedRef.current) {
      refreshedRef.current = true;
      handleRefreshPrices();
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

  const [activeTab, setActiveTab] = useState<"holdings" | "history">("holdings");

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex w-full bg-[#121212] min-h-screen">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Kite-style Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#151515]">
          <div className="flex items-center gap-6">
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab("holdings")}
                className={`text-sm font-semibold transition-colors tracking-wide ${activeTab === 'holdings' ? 'text-[#ff5722]' : 'text-gray-400 hover:text-white'}`}
              >
                Holdings ({activeStocks.length})
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={`text-sm font-semibold transition-colors tracking-wide ${activeTab === 'history' ? 'text-[#ff5722]' : 'text-gray-400 hover:text-white'}`}
              >
                Trade History
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleRefreshPrices} 
              disabled={isRefreshing || activeStocks.length === 0}
              className="bg-transparent border border-white/10 hover:bg-white/5 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
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
              className="bg-[#2185d0] hover:bg-[#1678c2] text-white px-4 py-1.5 rounded text-xs font-bold transition-colors"
            >
              Add Trade
            </button>
          </div>
        </div>

        <div className="p-6 max-w-6xl w-full mx-auto">
          {/* Kite-style Summary Bar */}
          {activeStocks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 bg-[#151515] p-5 border border-white/5 rounded">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total investment</p>
                <p className="text-xl font-normal text-white">₹{formatMoney(stats.totalInvested)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Current value</p>
                <p className="text-xl font-normal text-white">₹{formatMoney(stats.totalCurrent)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Day&apos;s P&amp;L</p>
                <p className={`text-xl font-medium ${stats.dayPnL >= 0 ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                  {stats.dayPnL >= 0 ? '+' : ''}{formatMoney(stats.dayPnL)} <span className="text-xs font-semibold ml-1">({stats.dayPnL >= 0 ? '+' : ''}{stats.dayPnLPercent.toFixed(2)}%)</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total P&amp;L</p>
                <p className={`text-xl font-medium ${stats.totalPnL >= 0 ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                  {stats.totalPnL >= 0 ? '+' : ''}{formatMoney(stats.totalPnL)} <span className="text-xs font-semibold ml-1">({stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%)</span>
                </p>
                {stats.totalRealizedPnL !== 0 && (
                  <div className="flex gap-3 mt-1.5 text-[9px] font-semibold text-gray-500">
                    <span className={stats.unrealizedPnL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}>
                      Unrealized: {stats.unrealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.unrealizedPnL)}
                    </span>
                    <span className={stats.totalRealizedPnL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}>
                      Realized: {stats.totalRealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.totalRealizedPnL)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "holdings" ? (
            <StocksDataTable 
              stocks={activeStocks} 
              onEdit={startEdit} 
              onSell={startSell} 
              onAdd={() => setShowAddModal(true)} 
            />
          ) : (
            <StocksHistoryTable trades={stockTrades} />
          )}

          {/* Allocation Donut */}
          {activeStocks.length > 0 && (
            <div className="mt-8 bg-[#151515] border border-white/5 rounded p-6 max-w-md">
              <h3 className="text-xs font-bold text-white tracking-wider uppercase mb-4">Portfolio Allocation</h3>
              <div className="flex items-center">
                <div className="w-[150px] h-[150px]">
                  {mounted && pieChartData.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={2} dataKey="value" stroke="none">
                          {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "#1e1e1e", border: "1px solid #333", borderRadius: "4px" }}
                          itemStyle={{ color: "#fff", fontSize: "11px" }}
                          formatter={(value) => [`₹${formatMoney(Number(value))}`, "Value"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="ml-6 flex-1 flex flex-col gap-2">
                  {pieChartData.slice(0, 5).map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.fill }} />
                      <span className="text-gray-400 font-semibold truncate max-w-[120px]">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
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
              formData.trade_type === "buy" ? "bg-[#4185f4]" : "bg-[#ff5722]"
            } text-white`}>
              <div>
                <span className="text-base font-bold uppercase tracking-wider">{editingId ? "Modify" : formData.trade_type === "buy" ? "Buy" : "Sell"} {formData.symbol || "Stock"}</span>
                <span className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black tracking-widest">NSE</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-white/70">LTP</span>
                <span className="ml-1 text-sm font-bold">₹{parseFloat(formData.current_price || "0").toFixed(2)}</span>
              </div>
            </div>

            <div className="p-5 space-y-5 bg-[#151515]">
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
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Search Stock Symbol / Company</label>
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
                              <div className="text-[10px] text-gray-400 truncate max-w-[220px]">{res.name}</div>
                            </div>
                            <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-semibold">Select</span>
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
                        <p className="text-[10px] text-gray-500 font-medium">{formData.name}</p>
                      </div>
                    </div>
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, symbol: "", name: "" }));
                        }}
                        className="text-[10px] bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-2 py-1 rounded transition-all font-bold"
                      >
                        Change Stock
                      </button>
                    )}
                  </div>
                )}

                {/* Qty & Price row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Qty.</label>
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
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
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
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">LTP (Latest price)</label>
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
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Order Type</label>
                    <div className="flex border border-white/10 rounded overflow-hidden">
                      <button type="button" className="flex-1 py-1.5 bg-[#2185d0] text-white text-[10px] font-bold uppercase">Limit</button>
                      <button type="button" disabled className="flex-1 py-1.5 text-gray-500 text-[10px] font-bold uppercase cursor-not-allowed">Market</button>
                    </div>
                  </div>
                </div>

                {!editingId && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Date</label>
                        <input 
                          type="date" 
                          className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                          value={formData.bought_at} 
                          onChange={e => setFormData({...formData, bought_at: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                          {formData.trade_type === 'buy' ? 'Deduct From' : 'Deposit To'}
                        </label>
                        <select 
                          className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                          value={formData.deduct_from_account} 
                          onChange={e => setFormData({...formData, deduct_from_account: e.target.value})}
                        >
                          <option value="">No Transaction (Track Only)</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Brokerage &amp; Charges (₹)</label>
                      <input 
                        type="number" 
                        step="any"
                        className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                        value={charges} 
                        onChange={e => setCharges(e.target.value)} 
                      />
                    </div>
                  </>
                )}

                {/* Notes (Optional) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Notes</label>
                  <textarea 
                    className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0] resize-none h-12" 
                    placeholder="Optional notes..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                {/* Live Margin Calculation details */}
                <div className="bg-white/5 rounded p-3 flex justify-between items-center text-xs text-gray-400">
                  <div>
                    <span>Margin required</span>
                    <span className="ml-1 text-white font-bold">
                      ₹{formatMoney((parseFloat(formData.quantity) || 0) * (parseFloat(formData.buy_price) || 0))}
                    </span>
                  </div>
                  <div>
                    <span>Charges: </span>
                    <span className="text-white font-bold">₹{parseFloat(charges || "0").toFixed(2)}</span>
                  </div>
                </div>

                {/* Modal actions */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className={`flex-1 py-2 rounded text-xs font-bold transition-all text-white shadow-md active:scale-[0.98] ${
                      editingId ? "bg-indigo-600 hover:bg-indigo-700" :
                      formData.trade_type === 'sell' ? "bg-[#ff5722] hover:bg-[#e64a19]" : "bg-[#4185f4] hover:bg-[#3574d3]"
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
