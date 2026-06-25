"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { createInvestment, updateInvestment, searchStocks, fetchLiveStockPrice } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

import StocksDataTable from "./components/StocksDataTable";

type Stock = Tables<"investments"> & { day_change?: number; day_change_percent?: number };

const getColorByLabel = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#06B6D4", "#F97316", "#8B5CF6", "#22C55E", "#EC4899", 
    "#EAB308", "#3B82F6", "#F43F5E", "#14B8A6", "#84CC16", 
    "#6366F1", "#FB7185"
  ];
  return colors[Math.abs(hash) % colors.length];
};

export default function StocksClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { investments, accounts, profile }, mutate } = useFinanceData(initialData);
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
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
    const totalPnL = totalCurrent - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    const dayPnL = activeStocks.reduce((s, i) => s + (Number(i.day_change || 0) * Number(i.quantity || 0)), 0);
    const prevDayValue = totalCurrent - dayPnL;
    const dayPnLPercent = prevDayValue > 0 ? (dayPnL / prevDayValue) * 100 : 0;

    return { totalInvested, totalCurrent, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent };
  }, [activeStocks]);

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
        const livePrice = await fetchLiveStockPrice(stock.symbol);
        if (livePrice && livePrice !== stock.current_price) {
          await updateInvestment(stock.id, { current_price: livePrice });
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

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col animate-in fade-in duration-700 w-full bg-[#121212] min-h-screen">
      {/* Kite-style Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-[--text-primary]">Holdings ({activeStocks.length})</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefreshPrices} 
            disabled={isRefreshing || activeStocks.length === 0}
            className="bg-transparent border border-white/20 hover:bg-white/5 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRefreshing ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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
            className="bg-[#2185d0] hover:bg-[#1678c2] text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Add Trade
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Holdings Table */}
        <StocksDataTable 
          stocks={activeStocks} 
          onEdit={startEdit} 
          onSell={startSell}
          onAdd={() => setShowAddModal(true)} 
        />

        {/* Kite-style Summary Bar */}
        {activeStocks.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 bg-[#0a0a0a] p-4 border border-white/10 rounded-md">
            <div>
              <p className="text-xs text-[--text-muted] mb-1">Total investment</p>
              <p className="text-xl font-normal text-[--text-primary]">₹{formatMoney(stats.totalInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-[--text-muted] mb-1">Current value</p>
              <p className="text-xl font-normal text-[--text-primary]">₹{formatMoney(stats.totalCurrent)}</p>
            </div>
            <div>
              <p className="text-xs text-[--text-muted] mb-1">Day's P&L</p>
              <p className={`text-xl font-medium ${stats.dayPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stats.dayPnL >= 0 ? '+' : ''}{formatMoney(stats.dayPnL)} <span className="text-xs">({stats.dayPnL >= 0 ? '+' : ''}{stats.dayPnLPercent.toFixed(2)}%)</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[--text-muted] mb-1">Total P&L</p>
              <p className={`text-xl font-medium ${stats.totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stats.totalPnL >= 0 ? '+' : ''}{formatMoney(stats.totalPnL)} <span className="text-xs">({stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%)</span>
              </p>
            </div>
          </div>
        )}

        {/* Allocation Donut (optional below the table like Kite's overview) */}
        {activeStocks.length > 0 && (
          <div className="mt-8 bg-[#0a0a0a] border border-white/10 rounded-md p-6 max-w-md">
            <h3 className="text-sm font-medium text-[--text-primary] mb-4">Portfolio Allocation</h3>
            <div className="flex items-center">
              <div className="w-[160px] h-[160px]">
                {mounted && pieChartData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                        {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "#1e1e1e", border: "1px solid #333", borderRadius: "4px" }}
                        itemStyle={{ color: "#fff", fontSize: "12px" }}
                        formatter={(value: any) => [`₹${formatMoney(Number(value))}`, "Value"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="ml-6 flex-1 flex flex-col gap-2">
                {pieChartData.slice(0, 5).map((entry, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.fill }} />
                    <span className="text-[--text-secondary] font-medium truncate max-w-[100px]">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? "Update Stock Holding" : "Record Stock Trade"}
        >
          <div className="p-2 max-w-lg mx-auto w-full">
            {!editingId && (
              <div className="flex bg-[#1e1e1e] rounded-md p-1 border border-white/10 mb-6">
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, trade_type: "buy" })}
                  className={`flex-1 py-2 rounded text-xs font-semibold transition-all ${
                    formData.trade_type === "buy" ? "bg-[#2185d0] text-white shadow-md" : "text-[--text-muted] hover:text-white"
                  }`}
                >
                  Buy
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, trade_type: "sell" })}
                  className={`flex-1 py-2 rounded text-xs font-semibold transition-all ${
                    formData.trade_type === "sell" ? "bg-rose-500 text-white shadow-md" : "text-[--text-muted] hover:text-white"
                  }`}
                >
                  Sell
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-xs font-medium text-[--text-muted]">Search Stock</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" 
                      placeholder="e.g. Reliance, AAPL" 
                      value={searchQuery || formData.name} 
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        setFormData({...formData, name: e.target.value});
                      }} 
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-2.5">
                        <svg className="w-4 h-4 animate-spin text-[--text-muted]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                      </div>
                    )}
                  </div>
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-[100%] mt-1 bg-[#2a2a2a] border border-white/10 rounded-md shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                      {searchResults.map((res, i) => (
                        <div 
                          key={i} 
                          className="px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                          onClick={async () => {
                            setFormData({...formData, name: res.name, symbol: res.symbol});
                            setSearchQuery("");
                            setShowSearchDropdown(false);
                            // Auto fetch current price
                            const livePrice = await fetchLiveStockPrice(res.symbol);
                            if (livePrice) {
                              setFormData(prev => ({...prev, current_price: livePrice.toString()}));
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white truncate max-w-[70%]">{res.name}</span>
                            <span className="text-xs font-bold text-[#2185d0]">{res.symbol}</span>
                          </div>
                          <div className="text-[10px] text-[--text-muted] mt-0.5">{res.exchange}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Symbol</label>
                  <input className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none uppercase" placeholder="e.g. RELIANCE" value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Quantity</label>
                  <input required type="number" step="any" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">{formData.trade_type === 'buy' ? 'Buy Price' : 'Sell Price'}</label>
                  <input required type="number" step="any" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={formData.buy_price} onChange={e => setFormData({...formData, buy_price: e.target.value})} inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Current Price (LTP)</label>
                  <input required type="number" step="any" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={formData.current_price} onChange={e => setFormData({...formData, current_price: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Currency</label>
                  <select className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {!editingId && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[--text-muted]">Date</label>
                    <input type="date" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={formData.bought_at} onChange={e => setFormData({...formData, bought_at: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[--text-muted]">
                      {formData.trade_type === 'buy' ? 'Deduct From' : 'Deposit To'}
                    </label>
                    <select className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={formData.deduct_from_account} onChange={e => setFormData({...formData, deduct_from_account: e.target.value})}>
                      <option value="">No Transaction (Track Only)</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[--text-muted]">Charges (₹)</label>
                  <input type="number" step="any" className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#2185d0] outline-none" value={charges} onChange={e => setCharges(e.target.value)} />
                </div>
                </>
              )}

              <div className="pt-6">
                <button type="submit" disabled={submitting} className={`w-full py-2.5 rounded text-sm font-semibold transition-colors ${!editingId && formData.trade_type === 'sell' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-[#2185d0] hover:bg-[#1678c2] text-white'}`}>
                  {submitting ? "Processing..." : (editingId ? "Update" : formData.trade_type === 'buy' ? "Buy" : "Sell")}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
}
