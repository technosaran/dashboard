"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { logFnoTrade, closeFnoTrade, deleteFnoTrade } from "./actions";
import { fetchLiveStockPrice, searchStocks } from "../stocks/actions";
import { useFinanceData, type FinanceData, type FnoTrade } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

import FNODataTable from "./components/FNODataTable";

export default function FnoClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { fnoTrades, accounts, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showLogForm, setShowLogForm] = useState(searchParams?.get("action") === "new");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<FnoTrade | null>(null);
  const [submitting, withLock] = useSubmitLock();
  
  // Kite uses tabs: Positions (Open), History (Closed)
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");

  // Watchlist states
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistPrices, setWatchlistPrices] = useState<Record<string, { price: number; prevClose?: number }>>({});
  const [watchlistSearchQuery, setWatchlistSearchQuery] = useState("");
  const [watchlistSearchResults, setWatchlistSearchResults] = useState<{ symbol: string, name: string, fullSymbol?: string, exchange?: string }[]>([]);
  const [isWatchlistSearching, setIsWatchlistSearching] = useState(false);
  const [showWatchlistDropdown, setShowWatchlistDropdown] = useState(false);

  const activePositions = useMemo(() => fnoTrades.filter(t => t.status === "OPEN"), [fnoTrades]);
  const closedHistory = useMemo(() => fnoTrades.filter(t => t.status === "CLOSED"), [fnoTrades]);

  const allSymbols = useMemo(() => {
    const syms = new Set(watchlist);
    activePositions.forEach(p => {
      if (p.symbol) syms.add(p.symbol);
    });
    return Array.from(syms);
  }, [watchlist, activePositions]);

  // Load watchlist on mount
  useEffect(() => {
    const saved = localStorage.getItem("stocks_watchlist");
    if (saved) {
      setWatchlist(JSON.parse(saved));
    } else {
      const defaultWatchlist = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"];
      setWatchlist(defaultWatchlist);
      localStorage.setItem("stocks_watchlist", JSON.stringify(defaultWatchlist));
    }
  }, []);

  // Fetch prices for watchlist
  const fetchWatchlistPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    const prices: Record<string, { price: number; prevClose?: number }> = {};
    await Promise.all(symbols.map(async (sym) => {
      try {
        const data = await fetchLiveStockPrice(sym);
        if (data) prices[sym] = data;
      } catch (e) {
        console.error("Failed to fetch price for", sym, e);
      }
    }));
    setWatchlistPrices(prev => ({ ...prev, ...prices }));
  }, []);

  useEffect(() => {
    if (allSymbols.length > 0) {
      fetchWatchlistPrices(allSymbols);
    }
  }, [allSymbols, fetchWatchlistPrices]);

  // Watchlist Search
  useEffect(() => {
    if (watchlistSearchQuery.length > 2) {
      setIsWatchlistSearching(true);
      setShowWatchlistDropdown(true);
      const timeoutId = setTimeout(async () => {
        const results = await searchStocks(watchlistSearchQuery);
        setWatchlistSearchResults(results);
        setIsWatchlistSearching(false);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setWatchlistSearchResults([]);
      setShowWatchlistDropdown(false);
    }
  }, [watchlistSearchQuery]);

  const mounted = useHasMounted();

  const [logFormData, setLogFormData] = useState({
    symbol: "", instrument_type: "FUT" as "FUT" | "CE" | "PE", strike_price: "",
    expiry_date: "", trade_type: "BUY" as "BUY" | "SELL", quantity: "",
    entry_price: "", account_id: "", notes: "", trade_date: ""
  });

  const [closeFormData, setCloseFormData] = useState({
    exit_price: "", close_date: ""
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setLogFormData(prev => ({ ...prev, trade_date: new Date().toISOString().split("T")[0] }));
      setCloseFormData(prev => ({ ...prev, close_date: new Date().toISOString().split("T")[0] }));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && showLogForm && !logFormData.account_id) {
      const defaultAccId = profile?.default_accounts?.fno;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      if (defaultAccExists) {
        setTimeout(() => {
          setLogFormData(prev => ({ ...prev, account_id: defaultAccId }));
        }, 0);
      }
    }
  }, [accounts, profile, showLogForm, logFormData.account_id]);

  const stats = useMemo(() => {
    const totalRealizedPnL = closedHistory.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
    const activeCost = activePositions.reduce((acc, t) => acc + (Number(t.quantity) * Number(t.entry_price)), 0);
    
    let totalUnrealizedPnL = 0;
    activePositions.forEach(t => {
      const ltp = watchlistPrices[t.symbol]?.price;
      if (ltp) {
        const diff = t.trade_type === 'BUY' 
          ? (ltp - Number(t.entry_price)) * Number(t.quantity)
          : (Number(t.entry_price) - ltp) * Number(t.quantity);
        totalUnrealizedPnL += diff;
      }
    });

    return { totalRealizedPnL, activeCost, totalUnrealizedPnL };
  }, [activePositions, closedHistory, watchlistPrices]);

  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fnoTrades.forEach(t => {
      map[t.instrument_type] = (map[t.instrument_type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      fill: name === "FUT" ? "#2185d0" : name === "CE" ? "#10b981" : "#f43f5e"
    }));
  }, [fnoTrades]);

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      try {
        const qty = parseFloat(logFormData.quantity);
        const price = parseFloat(logFormData.entry_price);
        const strike = logFormData.strike_price ? parseFloat(logFormData.strike_price) : undefined;
        if (isNaN(qty) || qty <= 0) { toast.error("Valid quantity required"); return; }
        if (isNaN(price) || price < 0) { toast.error("Valid entry price required"); return; }

        const res = await logFnoTrade({
          symbol: logFormData.symbol.toUpperCase().trim(),
          instrument_type: logFormData.instrument_type,
          strike_price: strike,
          expiry_date: logFormData.expiry_date,
          trade_type: logFormData.trade_type,
          quantity: qty,
          entry_price: price,
          account_id: logFormData.account_id || undefined,
          notes: logFormData.notes || undefined,
          trade_date: logFormData.trade_date
        });
        if (!res.error) {
          toast.success("FnO Trade logged successfully!");
          setShowLogForm(false);
          setLogFormData({
            symbol: "", instrument_type: "FUT", strike_price: "", expiry_date: "",
            trade_type: "BUY", quantity: "", entry_price: "", account_id: "", notes: "", trade_date: new Date().toISOString().split("T")[0]
          });
          mutate();
        } else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to log trade.");
      }
    });
  }

  async function handleCloseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTrade) return;
    await withLock(async () => {
      try {
        const exitPrice = parseFloat(closeFormData.exit_price);
        if (isNaN(exitPrice) || exitPrice < 0) { toast.error("Valid exit price required"); return; }

        const res = await closeFnoTrade(selectedTrade.id, {
          exit_price: exitPrice,
          close_date: closeFormData.close_date
        });
        if (!res.error) {
          toast.success("Position closed successfully!");
          setShowCloseForm(false);
          setSelectedTrade(null);
          setCloseFormData({ exit_price: "", close_date: new Date().toISOString().split("T")[0] });
          mutate();
        } else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to close position.");
      }
    });
  }

  async function handleDeleteTrade(id: string) {
    if (!confirm("Are you sure you want to delete this trade log? Reverting this log will restore linked bank/broker accounts to their pre-trade balances.")) return;
    await withLock(async () => {
      try {
        const res = await deleteFnoTrade(id);
        if (!res.error) {
          toast.success("Trade deleted");
          mutate();
        } else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete trade.");
      }
    });
  }

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex w-full bg-[#121212] min-h-screen">
      {/* Zerodha Watchlist Sidebar (Left Column, hidden on small screens) */}
      <div className="hidden lg:flex flex-col w-[340px] shrink-0 border-r border-white/10 bg-[#151515] select-none h-screen sticky top-0 overflow-y-auto custom-scrollbar">
        {/* Watchlist Search Bar */}
        <div className="p-3 border-b border-white/5 relative">
          <div className="relative">
            <input 
              className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-[#2185d0] outline-none" 
              placeholder="Search eg: nifty ce, reliance fut" 
              value={watchlistSearchQuery} 
              onChange={e => setWatchlistSearchQuery(e.target.value)} 
            />
            {isWatchlistSearching && (
              <div className="absolute right-3 top-2">
                <svg className="w-3.5 h-3.5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
              </div>
            )}
          </div>

          {/* Watchlist Search Results Dropdown */}
          {showWatchlistDropdown && watchlistSearchResults.length > 0 && (
            <div className="absolute z-50 left-3 right-3 top-[100%] mt-1 bg-[#202020] border border-white/10 rounded shadow-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
              {watchlistSearchResults.map((res, i) => (
                <div 
                  key={i} 
                  className="px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0 flex items-center justify-between"
                  onClick={() => {
                    if (!watchlist.includes(res.symbol)) {
                      const updated = [...watchlist, res.symbol];
                      setWatchlist(updated);
                      localStorage.setItem("stocks_watchlist", JSON.stringify(updated));
                    }
                    setWatchlistSearchQuery("");
                    setShowWatchlistDropdown(false);
                  }}
                >
                  <div>
                    <div className="text-xs font-bold text-white">{res.symbol}</div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[180px]">{res.name}</div>
                  </div>
                  <button className="text-[10px] bg-[#2185d0]/20 text-[#2185d0] hover:bg-[#2185d0] hover:text-white px-2 py-0.5 rounded transition-all font-semibold">
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist Items */}
        <div className="flex-1 divide-y divide-white/5">
          {watchlist.map((sym) => {
            const data = watchlistPrices[sym];
            const price = data?.price ?? 0;
            const prevClose = data?.prevClose ?? price;
            const change = price - prevClose;
            const pctChange = prevClose > 0 ? (change / prevClose) * 100 : 0;
            const isUp = change >= 0;

            return (
              <div 
                key={sym} 
                className="group relative px-4 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-white tracking-wide">{sym}</div>
                  <div className="text-[9px] text-gray-500 font-semibold tracking-wider uppercase">NSE</div>
                </div>

                {/* Normal view */}
                <div className="flex items-center gap-4 group-hover:opacity-0 transition-opacity duration-150">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-white">
                      {price > 0 ? `₹${formatMoney(price)}` : "—"}
                    </div>
                    <div className={`text-[10px] font-medium ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
                      {price > 0 ? `${isUp ? "+" : ""}${pctChange.toFixed(2)}%` : ""}
                    </div>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 bg-[#151515] px-4 items-center justify-end gap-2 hidden group-hover:flex">
                  <button 
                    onClick={() => {
                      setLogFormData({
                        symbol: sym, instrument_type: "FUT", strike_price: "", expiry_date: "",
                        trade_type: "BUY", quantity: "1", entry_price: price.toString(),
                        account_id: "", notes: "", trade_date: new Date().toISOString().split("T")[0]
                      });
                      setShowLogForm(true);
                    }}
                    className="w-7 h-7 rounded bg-[#4185f4] hover:bg-[#3574d3] text-white flex items-center justify-center text-[10px] font-bold shadow-md transition-transform active:scale-95"
                  >
                    B
                  </button>
                  <button 
                    onClick={() => {
                      setLogFormData({
                        symbol: sym, instrument_type: "FUT", strike_price: "", expiry_date: "",
                        trade_type: "SELL", quantity: "1", entry_price: price.toString(),
                        account_id: "", notes: "", trade_date: new Date().toISOString().split("T")[0]
                      });
                      setShowLogForm(true);
                    }}
                    className="w-7 h-7 rounded bg-[#ff5722] hover:bg-[#e64a19] text-white flex items-center justify-center text-[10px] font-bold shadow-md transition-transform active:scale-95"
                  >
                    S
                  </button>
                  <button 
                    onClick={() => {
                      const updated = watchlist.filter(s => s !== sym);
                      setWatchlist(updated);
                      localStorage.setItem("stocks_watchlist", JSON.stringify(updated));
                    }}
                    className="w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center text-[11px] transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}

          {watchlist.length === 0 && (
            <div className="p-8 text-center text-xs text-gray-500">
              Watchlist is empty. Search and add symbols above.
            </div>
          )}
        </div>
      </div>

      {/* Main positions panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Kite Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#151515]">
          <div className="flex items-center gap-6">
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab("positions")} 
                className={`text-sm font-semibold transition-colors tracking-wide ${activeTab === "positions" ? "text-[#ff5722]" : "text-gray-400 hover:text-white"}`}
              >
                Positions ({activePositions.length})
              </button>
              <button 
                onClick={() => setActiveTab("history")} 
                className={`text-sm font-semibold transition-colors tracking-wide ${activeTab === "history" ? "text-[#ff5722]" : "text-gray-400 hover:text-white"}`}
              >
                History ({closedHistory.length})
              </button>
            </div>
          </div>
          <button 
            onClick={() => {
              setLogFormData({
                symbol: "", instrument_type: "FUT", strike_price: "", expiry_date: "",
                trade_type: "BUY", quantity: "", entry_price: "", account_id: "", notes: "", trade_date: new Date().toISOString().split("T")[0]
              });
              setShowLogForm(true);
            }}
            className="bg-[#2185d0] hover:bg-[#1678c2] text-white px-4 py-1.5 rounded text-xs font-bold transition-colors"
          >
            Add Trade
          </button>
        </div>

        <div className="p-6 max-w-6xl w-full mx-auto">
          {activeTab === "positions" && (
            <div className="animate-in fade-in">
              <FNODataTable 
                trades={activePositions}
                onCloseTrade={(trade) => {
                  setSelectedTrade(trade);
                  setCloseFormData(prev => ({ ...prev, close_date: new Date().toISOString().split("T")[0], exit_price: "" }));
                  setShowCloseForm(true);
                }}
                onDeleteTrade={handleDeleteTrade}
                onAdd={() => setShowLogForm(true)}
                showActions={true}
                livePrices={watchlistPrices}
              />
              
              {activePositions.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 bg-[#151515] p-5 border border-white/5 rounded">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total invested</p>
                    <p className="text-xl font-normal text-white">₹{formatMoney(stats.activeCost)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Unrealized P&L</p>
                    <p className={`text-xl font-medium ${stats.totalUnrealizedPnL >= 0 ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                      {stats.totalUnrealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.totalUnrealizedPnL)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="animate-in fade-in">
              <FNODataTable 
                trades={closedHistory}
                onDeleteTrade={handleDeleteTrade}
                showActions={true}
              />

              {closedHistory.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 bg-[#151515] p-5 border border-white/5 rounded">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Realized P&L</p>
                    <p className={`text-xl font-medium ${stats.totalRealizedPnL >= 0 ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                      {stats.totalRealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.totalRealizedPnL)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Breakdown donut */}
          {fnoTrades.length > 0 && (
            <div className="mt-8 bg-[#151515] border border-white/5 rounded p-6 max-w-md">
              <h3 className="text-xs font-bold text-white tracking-wider uppercase mb-4">Instrument Split</h3>
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
                          formatter={(value: any) => [`${value} Trades`, "Count"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="ml-6 flex-1 flex flex-col gap-2">
                  {pieChartData.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-xs w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.fill }} />
                        <span className="text-gray-400 font-semibold">{entry.name}</span>
                      </div>
                      <span className="text-white font-bold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* High-Fidelity Zerodha Kite FnO Buy/Sell Order Ticket */}
      {showLogForm && (
        <Drawer
          isOpen={showLogForm}
          onClose={() => setShowLogForm(false)}
          title="New Position"
        >
          {/* Custom Kite header override */}
          <div className="p-0 -mx-6 -mt-6">
            <div className={`p-4 rounded-t flex items-center justify-between ${
              logFormData.trade_type === "BUY" ? "bg-[#4185f4]" : "bg-[#ff5722]"
            } text-white`}>
              <div>
                <span className="text-base font-bold uppercase tracking-wider">{logFormData.trade_type === "BUY" ? "Buy" : "Sell"} {logFormData.symbol || "FnO"}</span>
                <span className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black tracking-widest">{logFormData.instrument_type}</span>
              </div>
            </div>

            <div className="p-5 space-y-5 bg-[#151515]">
              {/* Product type tabs */}
              <div className="flex gap-2">
                <button 
                  type="button" 
                  className="flex-1 py-1.5 text-xs font-bold rounded border border-[#4185f4]/30 text-[#4185f4] bg-[#4185f4]/5 hover:bg-[#4185f4]/10 transition-colors"
                >
                  NRML (Carry Forward)
                </button>
                <button 
                  type="button" 
                  disabled
                  className="flex-1 py-1.5 text-xs font-bold rounded border border-white/5 text-gray-500 cursor-not-allowed"
                >
                  MIS (Intraday)
                </button>
              </div>

              <form onSubmit={handleLogSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Instrument Symbol</label>
                    <input 
                      required 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white uppercase outline-none focus:border-[#2185d0]" 
                      placeholder="e.g. NIFTY" 
                      value={logFormData.symbol} 
                      onChange={e => setLogFormData({...logFormData, symbol: e.target.value.toUpperCase()})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Instrument Type</label>
                    <select 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={logFormData.instrument_type} 
                      onChange={e => setLogFormData({...logFormData, instrument_type: e.target.value as any})}
                    >
                      <option value="FUT">Futures (FUT)</option>
                      <option value="CE">Call Option (CE)</option>
                      <option value="PE">Put Option (PE)</option>
                    </select>
                  </div>
                </div>

                {logFormData.instrument_type !== "FUT" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Strike Price</label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      placeholder="e.g. 21000" 
                      value={logFormData.strike_price} 
                      onChange={e => setLogFormData({...logFormData, strike_price: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Quantity (Lot Size)</label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      placeholder="e.g. 50" 
                      value={logFormData.quantity} 
                      onChange={e => setLogFormData({...logFormData, quantity: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Avg. Price</label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={logFormData.entry_price} 
                      onChange={e => setLogFormData({...logFormData, entry_price: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Trade Date</label>
                    <input 
                      required 
                      type="date" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={logFormData.trade_date} 
                      onChange={e => setLogFormData({...logFormData, trade_date: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Expiry Date (Optional)</label>
                    <input 
                      type="date" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={logFormData.expiry_date} 
                      onChange={e => setLogFormData({...logFormData, expiry_date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Deduct Margin Account</label>
                  <select 
                    className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                    value={logFormData.account_id} 
                    onChange={e => setLogFormData({...logFormData, account_id: e.target.value})}
                  >
                    <option value="">No Account (Track Only)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Notes</label>
                  <textarea 
                    className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0] resize-none h-12" 
                    placeholder="Optional notes..."
                    value={logFormData.notes}
                    onChange={e => setLogFormData({ ...logFormData, notes: e.target.value })}
                  />
                </div>

                {/* Calculation */}
                <div className="bg-white/5 rounded p-3 flex justify-between items-center text-xs text-gray-400">
                  <div>
                    <span>Margin required</span>
                    <span className="ml-1 text-white font-bold">
                      ₹{formatMoney((parseFloat(logFormData.quantity) || 0) * (parseFloat(logFormData.entry_price) || 0))}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className={`flex-1 py-2 rounded text-xs font-bold text-white shadow-md active:scale-[0.98] transition-all ${
                      logFormData.trade_type === 'SELL' ? "bg-[#ff5722] hover:bg-[#e64a19]" : "bg-[#4185f4] hover:bg-[#3574d3]"
                    }`}
                  >
                    {submitting ? "Processing..." : logFormData.trade_type === 'BUY' ? "Buy" : "Sell"}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowLogForm(false)} 
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

      {/* Exit / Square Off Position Ticket */}
      {showCloseForm && selectedTrade && (
        <Drawer
          isOpen={showCloseForm}
          onClose={() => { setShowCloseForm(false); setSelectedTrade(null); }}
          title={`Exit ${selectedTrade.symbol}`}
        >
          {/* Custom Kite header override */}
          <div className="p-0 -mx-6 -mt-6">
            <div className="p-4 rounded-t flex items-center justify-between bg-[#ff5722] text-white">
              <div>
                <span className="text-base font-bold uppercase tracking-wider">Exit {selectedTrade.symbol}</span>
                <span className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black tracking-widest">{selectedTrade.instrument_type}</span>
              </div>
            </div>

            <div className="p-5 space-y-5 bg-[#151515]">
              <div className="bg-[#202020] p-4 rounded border border-white/5">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Entry details</p>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-300 font-bold">{selectedTrade.quantity} Lot / Qty</span>
                  <span className="text-white font-bold">@ ₹{formatMoney(Number(selectedTrade.entry_price))}</span>
                </div>
              </div>

              <form onSubmit={handleCloseSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Exit Price</label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      placeholder="e.g. 150" 
                      value={closeFormData.exit_price} 
                      onChange={e => setCloseFormData({...closeFormData, exit_price: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Exit Date</label>
                    <input 
                      required 
                      type="date" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={closeFormData.close_date} 
                      onChange={e => setCloseFormData({...closeFormData, close_date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className="flex-1 py-2 rounded text-xs font-bold bg-[#ff5722] hover:bg-[#e64a19] text-white shadow-md active:scale-[0.98] transition-all"
                  >
                    {submitting ? "Processing..." : "Exit Position"}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowCloseForm(false); setSelectedTrade(null); }} 
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
