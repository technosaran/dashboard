"use client";

import { useState, useMemo, useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { logFnoTrade, closeFnoTrade, deleteFnoTrade } from "./actions";

import { useFinanceData, type FinanceData, type FnoTrade } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

import FNODataTable from "./components/FNODataTable";
import { calculateFnoFuturesCharges, calculateFnoOptionsCharges } from "@/lib/zerodha-charges";
import { getIndianMarketStatus, type MarketStatusInfo } from "@/lib/market-hours";



export default function FnoClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { fnoTrades, accounts, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showLogForm, setShowLogForm] = useState(searchParams?.get("action") === "new");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<FnoTrade | null>(null);
  const [submitting, withLock] = useSubmitLock();

  // Zerodha Market Status & Clock State
  const [marketStatus, setMarketStatus] = useState<MarketStatusInfo>(() => getIndianMarketStatus());

  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getIndianMarketStatus());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Kite uses tabs: Positions (Open), History (Closed)
  const [activeTab, setActiveTab] = useState<"dashboard" | "positions" | "history">("dashboard");

  const activePositions = useMemo(() => fnoTrades.filter(t => t.status === "OPEN"), [fnoTrades]);
  const closedHistory = useMemo(() => fnoTrades.filter(t => t.status === "CLOSED"), [fnoTrades]);

  const mounted = useHasMounted();

  // Lot Size Resolver for Zerodha F&O
  const getFnoLotSize = (symbol: string): number => {
    const sym = (symbol || "").toUpperCase().trim();
    if (sym.includes("BANKNIFTY")) return 15;
    if (sym.includes("FINNIFTY")) return 25;
    if (sym.includes("MIDCPNIFTY")) return 50;
    if (sym.includes("RELIANCE")) return 250;
    if (sym.includes("TCS")) return 175;
    if (sym.includes("INFY")) return 400;
    if (sym.includes("HDFCBANK")) return 550;
    if (sym.includes("ICICIBANK")) return 700;
    if (sym.includes("TATAMOTORS")) return 1425;
    return 25; // Default NIFTY lot size
  };

  // Next Thursday Expiry Generator
  const getNextThursdayExpiry = (offsetWeeks = 0): string => {
    const d = new Date();
    const currentDay = d.getDay();
    let daysUntilThursday = (4 - currentDay + 7) % 7;
    if (daysUntilThursday === 0) daysUntilThursday = 7;
    d.setDate(d.getDate() + daysUntilThursday + offsetWeeks * 7);
    return d.toISOString().split("T")[0];
  };

  const defaultExpiry = useMemo(() => getNextThursdayExpiry(0), []);

  const [logFormData, setLogFormData] = useState({
    symbol: "NIFTY",
    instrument_type: "CE" as "FUT" | "CE" | "PE",
    strike_price: "24500",
    expiry_date: defaultExpiry,
    trade_type: "BUY" as "BUY" | "SELL",
    quantity: "25",
    entry_price: "",
    account_id: "",
    notes: "",
    trade_date: new Date().toISOString().split("T")[0],
    charges: ""
  });

  const [isCustomCharges, setIsCustomCharges] = useState(false);

  // Auto-calculate Zerodha F&O Futures / Options Charges
  useEffect(() => {
    if (!isCustomCharges) {
      const q = parseFloat(logFormData.quantity) || 0;
      const p = parseFloat(logFormData.entry_price) || 0;
      const turnover = q * p;
      const isBuy = logFormData.trade_type === "BUY";
      const calc = logFormData.instrument_type === "FUT"
        ? calculateFnoFuturesCharges(turnover, isBuy)
        : calculateFnoOptionsCharges(turnover, isBuy);
      const timer = setTimeout(() => {
        setLogFormData(prev => ({ ...prev, charges: calc.totalCharges.toString() }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [logFormData.quantity, logFormData.entry_price, logFormData.instrument_type, logFormData.trade_type, isCustomCharges]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Dynamic Zerodha Contract Generator
  const contractSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toUpperCase().trim();

    const symbols = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "TATAMOTORS"];
    const matchedSym = symbols.find(s => q.includes(s)) || (symbols.find(s => s.startsWith(q)) || "NIFTY");

    const lotSize = getFnoLotSize(matchedSym);
    const exp = defaultExpiry;

    // Check if query contains numbers (strike)
    const numMatch = q.match(/\d+/);
    const baseStrike = numMatch ? parseInt(numMatch[0], 10) : (matchedSym === "BANKNIFTY" ? 52000 : matchedSym.includes("NIFTY") ? 24500 : 2500);

    const step = matchedSym === "BANKNIFTY" ? 100 : matchedSym.includes("NIFTY") ? 50 : 20;

    const strikes = [baseStrike - step, baseStrike, baseStrike + step];
    const results = [];

    // FUT Contract
    results.push({
      displayName: `${matchedSym} ${exp.split("-")[1]}/${exp.split("-")[2]} FUT`,
      symbol: matchedSym,
      type: "FUT" as const,
      strike: "",
      expiry: exp,
      lotSize,
    });

    // Option Contracts (CE & PE)
    for (const st of strikes) {
      results.push({
        displayName: `${matchedSym} ${st} CE`,
        symbol: matchedSym,
        type: "CE" as const,
        strike: st.toString(),
        expiry: exp,
        lotSize,
      });
      results.push({
        displayName: `${matchedSym} ${st} PE`,
        symbol: matchedSym,
        type: "PE" as const,
        strike: st.toString(),
        expiry: exp,
        lotSize,
      });
    }

    return results.filter(r => r.displayName.includes(q) || matchedSym.includes(q));
  }, [searchQuery, defaultExpiry]);

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
      const chosenAccount = defaultAccExists ? defaultAccId : accounts[0].id;
      setTimeout(() => {
        setLogFormData(prev => ({ ...prev, account_id: chosenAccount }));
      }, 0);
    }
  }, [accounts, profile, showLogForm, logFormData.account_id]);

  const stats = useMemo(() => {
    const totalRealizedPnL = closedHistory.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
    const activeCost = activePositions.reduce((acc, t) => acc + (Number(t.quantity) * Number(t.entry_price)), 0);
    const totalUnrealizedPnL = 0;
    const totalCharges = fnoTrades.reduce((acc, t) => acc + Number((t as any).charges || 0), 0);
    return { totalRealizedPnL, activeCost, totalUnrealizedPnL, totalCharges };
  }, [activePositions, closedHistory, fnoTrades]);

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
        const fnoCharges = parseFloat(logFormData.charges) || 0;
        const strike = logFormData.strike_price ? parseFloat(logFormData.strike_price) : undefined;
        if (isNaN(qty) || qty <= 0) { toast.error("Valid quantity required"); return; }
        if (isNaN(price) || price < 0) { toast.error("Valid entry price required"); return; }
        if (fnoCharges < 0) { toast.error("Charges cannot be negative"); return; }
        if (!logFormData.account_id) { toast.error("Please select a margin account"); return; }

        const res = await logFnoTrade({
          symbol: logFormData.symbol.toUpperCase().trim(),
          instrument_type: logFormData.instrument_type,
          strike_price: strike,
          expiry_date: logFormData.expiry_date,
          trade_type: logFormData.trade_type,
          quantity: qty,
          entry_price: price,
          account_id: logFormData.account_id,
          notes: logFormData.notes || undefined,
          trade_date: logFormData.trade_date,
          charges: fnoCharges
        });
        if (!res.error) {
          toast.success("F&O trade logged successfully");
          setShowLogForm(false);
          setLogFormData({
            symbol: "", instrument_type: "FUT", strike_price: "", expiry_date: "",
            trade_type: "BUY", quantity: "", entry_price: "", account_id: "", notes: "", trade_date: new Date().toISOString().split("T")[0], charges: ""
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
          toast.success("F&O trade deleted successfully");
          mutate();
        } else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete trade.");
      }
    });
  }

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex w-full bg-[#191919] min-h-screen text-[#E0E0E0] relative font-sans">
      {/* Ambient Kite Glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-[#387ED1]/10 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 -left-32 w-[550px] h-[550px] bg-[#FF5722]/5 rounded-full blur-[160px]" />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        
        {/* Zerodha Kite FnO Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-3.5 border-b border-[#2B313A] bg-[#121212] gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            {/* Zerodha Kite Chevron */}
            <div className="w-9 h-9 rounded-lg bg-[#FF5722]/10 border border-[#FF5722]/30 flex items-center justify-center text-[#FF5722] shadow-[0_0_15px_rgba(255,87,34,0.25)]">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L2 12l10 10 10-10L12 2zm0 4.5l6.5 6.5-6.5 6.5-6.5-6.5L12 6.5z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-wider uppercase">Zerodha Kite F&amp;O</h1>
                <span className="text-[0.5625rem] bg-[#387ED1]/20 text-[#387ED1] border border-[#387ED1]/30 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">DERIVATIVES PRO</span>
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
                NIFTY / BANKNIFTY Derivatives Watch • {marketStatus.nextSessionText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex gap-1.5 rounded-xl bg-[#191919] border border-[#2B313A] p-1 shadow-inner">
              <button 
                onClick={() => setActiveTab("dashboard")} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "dashboard" 
                    ? "bg-[#387ED1] text-white shadow-[0_0_12px_rgba(56,126,209,0.4)]" 
                    : "text-[#848E9C] hover:text-white hover:bg-white/5"
                }`}
              >
                Overview
              </button>
              <button 
                onClick={() => setActiveTab("positions")} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "positions" 
                    ? "bg-[#387ED1] text-white shadow-[0_0_12px_rgba(56,126,209,0.4)]" 
                    : "text-[#848E9C] hover:text-white hover:bg-white/5"
                }`}
              >
                Positions ({activePositions.length})
              </button>
              <button 
                onClick={() => setActiveTab("history")} 
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "history" 
                    ? "bg-[#387ED1] text-white shadow-[0_0_12px_rgba(56,126,209,0.4)]" 
                    : "text-[#848E9C] hover:text-white hover:bg-white/5"
                }`}
              >
                Closed P&amp;L ({closedHistory.length})
              </button>
            </div>

            <button 
              onClick={() => {
                setLogFormData({
                  symbol: "", instrument_type: "FUT", strike_price: "", expiry_date: "",
                  trade_type: "BUY", quantity: "", entry_price: "", account_id: "", notes: "", trade_date: new Date().toISOString().split("T")[0], charges: ""
                });
                setShowLogForm(true);
              }}
              className="bg-[#387ED1] hover:bg-[#306eb8] text-white font-extrabold px-4 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(56,126,209,0.3)] cursor-pointer"
            >
              + New F&amp;O Position
            </button>
          </div>
        </div>

        <div className="p-6 max-w-7xl w-full mx-auto">
          {activeTab === "dashboard" && (
            <div className="animate-in fade-in space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-[#252525] p-6 border border-[#333333] rounded-2xl shadow-xl">
                <div>
                  <p className="text-[0.65rem] text-[#848E9C] font-bold uppercase tracking-widest mb-1">Active Margin Invested</p>
                  <p className="text-2xl font-extrabold text-white">₹{formatMoney(stats.activeCost)}</p>
                </div>
                <div>
                  <p className="text-[0.65rem] text-[#848E9C] font-bold uppercase tracking-widest mb-1">Unrealized P&amp;L</p>
                  <p className={`text-2xl font-extrabold ${stats.totalUnrealizedPnL >= 0 ? 'text-[#41B883]' : 'text-[#FF5722]'}`}>
                    {stats.totalUnrealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.totalUnrealizedPnL)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.65rem] text-[#848E9C] font-bold uppercase tracking-widest mb-1">Realized P&amp;L</p>
                  <p className={`text-2xl font-extrabold ${stats.totalRealizedPnL >= 0 ? 'text-[#41B883]' : 'text-[#FF5722]'}`}>
                    {stats.totalRealizedPnL >= 0 ? '+' : ''}{formatMoney(stats.totalRealizedPnL)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.65rem] text-[#848E9C] font-bold uppercase tracking-widest mb-1">Total Brokerage Charges</p>
                  <p className="text-2xl font-extrabold text-[#FF5722]">
                    -₹{formatMoney(stats.totalCharges)}
                  </p>
                </div>
              </div>
            </div>
          )}

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
                livePrices={{}}
              />
              
              {activePositions.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 bg-[#151515] p-5 border border-white/5 rounded">
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total invested</p>
                    <p className="text-xl font-normal text-white">₹{formatMoney(stats.activeCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Unrealized P&L</p>
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
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Realized P&L</p>
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

      {/* High-Fidelity Premium Search & Select F&O Order Ticket */}
      {showLogForm && (
        <Drawer
          isOpen={showLogForm}
          onClose={() => { setShowLogForm(false); setSearchQuery(""); setShowSearchDropdown(false); }}
          title="New F&O Position Ticket"
        >
          <div className="p-4 max-w-2xl mx-auto w-full">
            <form onSubmit={handleLogSubmit} className="space-y-5">
              
              {/* Zerodha Kite Search & Presets Bar */}
              <div className="relative z-[120] space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Search Zerodha F&O Contract / Option Chain</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. NIFTY 24500 CE, BANKNIFTY 52000 PE, RELIANCE..."
                    className="w-full bg-[#181A20] border border-[#387ED1]/40 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-gray-500 focus:outline-none focus:border-[#387ED1] transition-all shadow-xl"
                    value={searchQuery}
                    onFocus={() => setShowSearchDropdown(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setShowSearchDropdown(false); }}
                      className="absolute right-3 top-3 text-xs text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Underlying Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK"].map(sym => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        const lot = getFnoLotSize(sym);
                        setLogFormData(prev => ({
                          ...prev,
                          symbol: sym,
                          quantity: lot.toString(),
                          strike_price: sym === "BANKNIFTY" ? "52000" : sym.includes("NIFTY") ? "24500" : "2500"
                        }));
                        setSearchQuery(sym);
                        setShowSearchDropdown(true);
                      }}
                      className={`text-[0.6875rem] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                        logFormData.symbol === sym
                          ? "bg-[#387ED1]/20 text-[#387ED1] border-[#387ED1]/50 shadow-[0_0_10px_rgba(56,126,209,0.3)]"
                          : "bg-[#202020] text-gray-400 border-white/5 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {/* Floating Option Chain Contract Search Results */}
                {showSearchDropdown && contractSearchResults.length > 0 && (
                  <div className="absolute top-[100%] left-0 right-0 mt-1 bg-[#181A20] border border-[#387ED1]/50 rounded-xl overflow-hidden shadow-2xl z-[150] max-h-60 overflow-y-auto custom-scrollbar">
                    {contractSearchResults.map((contract, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setLogFormData(prev => ({
                            ...prev,
                            symbol: contract.symbol,
                            instrument_type: contract.type,
                            strike_price: contract.strike,
                            expiry_date: contract.expiry,
                            quantity: contract.lotSize.toString()
                          }));
                          setSearchQuery("");
                          setShowSearchDropdown(false);
                          toast.success(`Selected ${contract.displayName}`);
                        }}
                        className="px-4 py-2.5 hover:bg-[#387ED1]/10 cursor-pointer border-b border-white/5 last:border-0 transition-colors flex justify-between items-center"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[0.625rem] px-1.5 py-0.5 rounded font-black uppercase ${
                            contract.type === "CE" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                            contract.type === "PE" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                            "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          }`}>
                            {contract.type}
                          </span>
                          <span className="text-xs font-bold text-white">{contract.displayName}</span>
                        </div>
                        <span className="text-[0.6875rem] text-gray-400 font-mono">Lot: {contract.lotSize} Qty</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Content - Always Rendered & Active */}
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Instrument Symbol</label>
                    <input 
                      required 
                      className="input-premium uppercase font-black" 
                      placeholder="e.g. NIFTY" 
                      value={logFormData.symbol} 
                      onChange={e => {
                        const sym = e.target.value.toUpperCase();
                        const lot = getFnoLotSize(sym);
                        setLogFormData({...logFormData, symbol: sym, quantity: lot.toString()});
                      }} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Select Account</label>
                    <select required className="input-premium font-semibold" value={logFormData.account_id} onChange={e => setLogFormData({...logFormData, account_id: e.target.value})}>
                      <option value="" disabled>Select Margin Account</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Trade Type</label>
                    <div className="flex bg-[#191919] p-1 rounded-xl border border-white/10 gap-1">
                      <button type="button" onClick={() => setLogFormData({...logFormData, trade_type: "BUY"})} className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${logFormData.trade_type === "BUY" ? "bg-[#387ED1] text-white shadow-[0_0_12px_rgba(56,126,209,0.4)]" : "text-gray-400 hover:text-white"}`}>Buy</button>
                      <button type="button" onClick={() => setLogFormData({...logFormData, trade_type: "SELL"})} className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${logFormData.trade_type === "SELL" ? "bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]" : "text-gray-400 hover:text-white"}`}>Sell</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Instrument Type</label>
                    <div className="flex bg-[#191919] p-1 rounded-xl border border-white/10 gap-1">
                      <button type="button" onClick={() => setLogFormData({...logFormData, instrument_type: "FUT"})} className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${logFormData.instrument_type === "FUT" ? "bg-sky-600 text-white shadow-md" : "text-gray-400 hover:text-white"}`}>FUT</button>
                      <button type="button" onClick={() => setLogFormData({...logFormData, instrument_type: "CE"})} className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${logFormData.instrument_type === "CE" ? "bg-emerald-600 text-white shadow-md" : "text-gray-400 hover:text-white"}`}>CE</button>
                      <button type="button" onClick={() => setLogFormData({...logFormData, instrument_type: "PE"})} className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${logFormData.instrument_type === "PE" ? "bg-rose-600 text-white shadow-md" : "text-gray-400 hover:text-white"}`}>PE</button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {logFormData.instrument_type !== "FUT" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Strike Price (₹)</label>
                      <input 
                        required 
                        type="number" 
                        step="any" 
                        className="input-premium font-mono font-bold" 
                        placeholder="e.g. 24500" 
                        value={logFormData.strike_price} 
                        onChange={e => setLogFormData({...logFormData, strike_price: e.target.value})} 
                        inputMode="decimal" 
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Expiry Date</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setLogFormData({...logFormData, expiry_date: getNextThursdayExpiry(0)})}
                          className="text-[0.625rem] bg-[#387ED1]/20 text-[#387ED1] hover:bg-[#387ED1] hover:text-white px-1.5 py-0.5 rounded font-bold transition-all"
                        >
                          This Wk
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogFormData({...logFormData, expiry_date: getNextThursdayExpiry(1)})}
                          className="text-[0.625rem] bg-white/10 text-gray-300 hover:bg-white/20 px-1.5 py-0.5 rounded font-bold transition-all"
                        >
                          Next Wk
                        </button>
                      </div>
                    </div>
                    <input 
                      type="date" 
                      required
                      className="input-premium font-bold" 
                      value={logFormData.expiry_date} 
                      onChange={e => setLogFormData({...logFormData, expiry_date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Quantity / Lots</label>
                      {(() => {
                        const lot = getFnoLotSize(logFormData.symbol);
                        const qtyNum = parseFloat(logFormData.quantity) || 0;
                        const lotCount = Math.round(qtyNum / lot);
                        return (
                          <span className="text-[0.6875rem] text-[#387ED1] font-bold">
                            {lotCount > 0 ? `${lotCount} Lot${lotCount > 1 ? 's' : ''}` : `Lot size: ${lot}`}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const lot = getFnoLotSize(logFormData.symbol);
                          const current = parseFloat(logFormData.quantity) || lot;
                          const nextVal = Math.max(lot, current - lot);
                          setLogFormData({...logFormData, quantity: nextVal.toString()});
                        }}
                        className="px-2.5 py-2 bg-[#202020] border border-white/10 rounded-lg text-xs font-black text-white hover:bg-white/10 active:scale-95 transition-all"
                        title="Decrease 1 Lot"
                      >
                        -1 Lot
                      </button>
                      <input 
                        required 
                        type="number" 
                        step="any" 
                        className="input-premium tabular-nums text-center font-bold" 
                        placeholder="e.g. 25" 
                        value={logFormData.quantity} 
                        onChange={e => setLogFormData({...logFormData, quantity: e.target.value})} 
                        inputMode="decimal" 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const lot = getFnoLotSize(logFormData.symbol);
                          const current = parseFloat(logFormData.quantity) || 0;
                          const nextVal = current + lot;
                          setLogFormData({...logFormData, quantity: nextVal.toString()});
                        }}
                        className="px-2.5 py-2 bg-[#202020] border border-white/10 rounded-lg text-xs font-black text-white hover:bg-white/10 active:scale-95 transition-all"
                        title="Increase 1 Lot"
                      >
                        +1 Lot
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Avg. Entry Price (₹)</label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="input-premium tabular-nums font-bold" 
                      placeholder="0.00"
                      value={logFormData.entry_price} 
                      onChange={e => setLogFormData({...logFormData, entry_price: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Trade Date</label>
                          <input 
                            required 
                            type="date" 
                            className="input-premium" 
                            value={logFormData.trade_date} 
                            onChange={e => setLogFormData({...logFormData, trade_date: e.target.value})} 
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Notes</label>
                          <input 
                            className="input-premium" 
                            placeholder="Optional strategy notes..." 
                            value={logFormData.notes} 
                            onChange={e => setLogFormData({...logFormData, notes: e.target.value})} 
                          />
                        </div>
                      </div>

                      {/* Zerodha Kite Derivatives Tax & Margin Breakdown Slip */}
                      {((parseFloat(logFormData.quantity) || 0) > 0) && (
                        <div className="bg-[#191919] border border-[#387ED1]/30 p-4 rounded-xl space-y-2.5 text-xs text-gray-300">
                          <div className="flex justify-between items-center border-b border-[#333] pb-2">
                            <span className="font-extrabold text-[#387ED1] uppercase tracking-wider text-[0.6875rem]">Zerodha Kite Derivatives Tax Slip</span>
                            <span className="text-[0.625rem] bg-[#387ED1]/20 text-[#387ED1] px-2 py-0.5 rounded font-black uppercase">
                              {logFormData.instrument_type === 'FUT' ? 'Futures' : 'Options'} ({logFormData.trade_type})
                            </span>
                          </div>

                          {(() => {
                            const q = parseFloat(logFormData.quantity) || 0;
                            const p = parseFloat(logFormData.entry_price) || 0;
                            const turnover = q * p;
                            const isBuy = logFormData.trade_type === "BUY";
                            const calc = logFormData.instrument_type === "FUT"
                              ? calculateFnoFuturesCharges(turnover, isBuy)
                              : calculateFnoOptionsCharges(turnover, isBuy);
                            const currentCharges = parseFloat(logFormData.charges) || 0;

                            return (
                              <>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-gray-400">Total Contract Value:</span>
                                  <span className="text-white font-bold">₹{turnover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="bg-[#252525] p-2.5 rounded-lg border border-[#333] space-y-1 text-[0.6875rem]">
                                  <div className="flex justify-between text-gray-300">
                                    <span>Brokerage:</span>
                                    <span className="font-mono text-white">₹{calc.brokerage.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-gray-400">
                                    <span>STT ({logFormData.instrument_type === 'FUT' ? '0.0125%' : '0.0625%'}):</span>
                                    <span className="font-mono text-white">₹{calc.stt.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-gray-400">
                                    <span>NSE Txn Fee ({logFormData.instrument_type === 'FUT' ? '0.00173%' : '0.0355%'}):</span>
                                    <span className="font-mono text-white">₹{calc.transactionFee.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-gray-400">
                                    <span>GST (18%):</span>
                                    <span className="font-mono text-white">₹{calc.gst.toFixed(2)}</span>
                                  </div>
                                </div>

                                {/* Prominent Auto-Calculated Total Charges Display & Edit Row */}
                                <div className="flex justify-between items-center bg-[#202020] px-3.5 py-2.5 rounded-xl border border-[#387ED1]/30">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-200 font-extrabold text-[0.6875rem] uppercase tracking-wider">Total Charges:</span>
                                    {!isCustomCharges ? (
                                      <span className="text-[0.5625rem] bg-[#387ED1]/20 text-[#387ED1] border border-[#387ED1]/30 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                                        Auto-Calculated
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsCustomCharges(false);
                                          setLogFormData(prev => ({ ...prev, charges: calc.totalCharges.toString() }));
                                        }}
                                        className="text-[0.625rem] text-[#387ED1] hover:underline font-bold"
                                      >
                                        (Reset)
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-mono font-extrabold text-sm">
                                      ₹{isCustomCharges ? (parseFloat(logFormData.charges) || 0).toFixed(2) : calc.totalCharges.toFixed(2)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!isCustomCharges) {
                                          setIsCustomCharges(true);
                                          setLogFormData({ ...logFormData, charges: calc.totalCharges.toString() });
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
                                      value={logFormData.charges}
                                      onChange={(e) => {
                                        setIsCustomCharges(true);
                                        setLogFormData({ ...logFormData, charges: e.target.value });
                                      }}
                                      className="w-28 bg-[#202020] border border-[#387ED1] rounded px-2.5 py-1 text-xs text-white font-mono font-bold outline-none text-right"
                                      placeholder="0.00"
                                    />
                                  </div>
                                )}

                                <div className="flex justify-between items-center pt-2 border-t border-[#333] font-black text-xs">
                                  <span className="text-white">Estimated Required Margin / Net:</span>
                                  <span className={isBuy ? 'text-[#FF5722]' : 'text-[#41B883]'}>
                                    ₹{(isBuy ? turnover + currentCharges : turnover - currentCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                <div className="pt-4 mt-6">
                  <button type="submit" disabled={submitting} className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg ${logFormData.trade_type === 'SELL' ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30' : 'bg-[#387ED1] hover:bg-[#2b6bba] text-white shadow-[#387ED1]/30'}`}>
                    {submitting ? "Processing..." : logFormData.trade_type === 'BUY' ? "Place Buy Order" : "Place Sell Order"}
                  </button>
                </div>
              </div>
            </form>
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
                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded font-black tracking-widest">{selectedTrade.instrument_type}</span>
              </div>
            </div>

            <div className="p-5 space-y-5 bg-[#151515]">
              <div className="bg-[#202020] p-4 rounded border border-white/5">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Entry details</p>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-300 font-bold">{selectedTrade.quantity} Lot / Qty</span>
                  <span className="text-white font-bold">@ ₹{formatMoney(Number(selectedTrade.entry_price))}</span>
                </div>
              </div>

              <form onSubmit={handleCloseSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Exit Price</label>
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
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Exit Date</label>
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
