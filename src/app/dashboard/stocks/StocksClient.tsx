"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import type { Tables } from "@/lib/database.types";
import { toast } from "react-hot-toast";

import { 
  createInvestment, 
  updateInvestment, 
  deleteInvestment, 
  getStockDetails, 
  refreshAllPrices,
  searchStocks,
  revertLedgerLog
} from "./actions";
import { calculateZerodhaCharges } from "@/lib/investment-utils";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import PnLValue from "@/components/pnl-value";

type Stock = Tables<"investments"> & { total_charges?: number; pnlPercent?: number };

interface Suggestion {
  symbol: string;
  fullSymbol: string;
  name?: string;
  exchange: string;
}


type SortKey = "name" | "pnl" | "pnlPercent" | "current_value" | "quantity";
type SortDir = "asc" | "desc";

function formatNum(val: number, decimals = 2): string {
  return val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function StocksClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { investments, accounts, stockTrades: trades }, isValidating } = useFinanceData(initialData);
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
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams?.get("action") === "new");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, withLock] = useSubmitLock();

  const [showChargesInForm, setShowChargesInForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");


  const [formData, setFormData] = useState({
    name: "", symbol: "", quantity: "", buy_price: "", current_price: "",
    currency: "INR", notes: "", bought_at: new Date().toISOString().split("T")[0],
    exchange: "NSE" as "NSE" | "BSE",
    deduct_from_account: "",
    trade_type: "buy" as "buy" | "sell"
  });

  const [activeTab, setActiveTab] = useState<"holdings" | "history">("holdings");
  const refreshAllRef = useRef<(() => Promise<void>) | null>(null);
  const fetchPriceRef = useRef<((symbol: string) => Promise<void>) | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced search for suggestions
  useEffect(() => {
    if (editingId) return;
    const timer = setTimeout(async () => {
      if (formData.symbol.length >= 2) {
        const results = await searchStocks(formData.symbol, formData.exchange);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        
        // If there's an exact match in suggestions, we can preemptively fetch price
        const exactMatch = results.find(r => r.symbol === formData.symbol.toUpperCase());
        if (exactMatch) {
            void fetchPriceRef.current?.(exactMatch.symbol);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.symbol, formData.exchange, editingId]);

  const zerodhaCharges = useMemo(() => {
    const qty = parseFloat(formData.quantity) || 0;
    const price = parseFloat(formData.buy_price) || 0;
    return calculateZerodhaCharges(qty, price, formData.exchange, formData.trade_type === "buy");
  }, [formData.quantity, formData.buy_price, formData.exchange, formData.trade_type]);



  async function handleFetchPrice(symbol: string) {
    if (symbol.length < 2 || editingId) return;
    setFetchingPrice(true);
    setFetchError(null);
    try {
      const res = await getStockDetails(symbol, formData.exchange);
      if ("error" in res) {
        setFetchError(res.error || "Stock not found");
      } else {
        setFormData(prev => ({
          ...prev,
          name: res.name || prev.name,
          current_price: res.price?.toString() || prev.current_price,
          currency: res.currency || prev.currency
        }));
      }
    } catch {
      setFetchError("Fetch failed");
    }
    setFetchingPrice(false);
  }

  fetchPriceRef.current = handleFetchPrice;

  async function handleRevert(logId: string | null) {
    if (!logId) return toast.error("No ledger log found for this trade");
    if (!confirm("Revert this trade? This will undo the portfolio change and reverse any account transactions.")) return;
    const res = await revertLedgerLog(logId);
    if (!res.error) toast.success("Trade reverted");
    else toast.error(res.error);
  }

  // Removed redundant auto-fetch useEffect to prevent "asking two times" feel

  async function handleRefreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    const toastId = toast.loading("Refreshing market prices...");
    try {
      const res = await refreshAllPrices();
      if (res.success) {
        toast.success("All prices updated", { id: toastId });
      } else {
        toast.error(res.error || "Failed to refresh prices", { id: toastId });
      }
    } catch {
      toast.error("Network error during refresh", { id: toastId });
    } finally {
      setRefreshing(false);
    }
  }

  refreshAllRef.current = handleRefreshAll;

  useEffect(() => {
    // Initial fetch
    void handleRefreshAll();
    // Auto-refresh interval (every 60 seconds)
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void handleRefreshAll();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, []); // Empty dependency array is fine since handleRefreshAll doesn't have reactive dependencies that require re-binding

  // --- Computed ---
  const { totalInvested, totalCurrent, totalPnL, totalPnLPercent, totalDayPnL, totalDayPnLPercent } = useMemo(() => {
    const invested = stocks.reduce((s, i) => s + Number(i.buy_price || 0) * Number(i.quantity || 0), 0);
    const current = stocks.reduce((s, i) => s + Number(i.current_price || 0) * Number(i.quantity || 0), 0);
    const pnl = current - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    const dayPnL = stocks.reduce((s, i) => s + Number(i.day_change || 0) * Number(i.quantity || 0), 0);
    const prevDay = current - dayPnL;
    const dayPnLPercent = prevDay > 0 ? (dayPnL / prevDay) * 100 : 0;
    return { totalInvested: invested, totalCurrent: current, totalPnL: pnl, totalPnLPercent: pnlPercent, totalDayPnL: dayPnL, totalDayPnLPercent: dayPnLPercent };
  }, [stocks]);

  const filtered = useMemo(() => {
    const list = stocks.filter(i => Number(i.quantity) > 0);
    return [...list].sort((a, b) => {
      let cmp = 0;
      const aq = Number(a.quantity);
      const bq = Number(b.quantity);
      const abp = Number(a.buy_price);
      const bbp = Number(b.buy_price);
      const acp = Number(a.current_price);
      const bcp = Number(b.current_price);

      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "pnl") cmp = ((acp - abp) * aq) - ((bcp - bbp) * bq);
      else if (sortKey === "pnlPercent") {
        const pa = abp > 0 ? ((acp - abp) / abp) * 100 : 0;
        const pb = bbp > 0 ? ((bcp - bbp) / bbp) * 100 : 0;
        cmp = pa - pb;
      } else if (sortKey === "current_value") cmp = (acp * aq) - (bcp * bq);
      else if (sortKey === "quantity") cmp = aq - bq;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [stocks, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function resetForm() {
    setFormData({
      name: "", symbol: "", quantity: "", buy_price: "", current_price: "",
      currency: "INR", notes: "", bought_at: new Date().toISOString().split("T")[0],
      exchange: "NSE",
      deduct_from_account: "",
      trade_type: "buy"
    });
    setShowForm(false);
    setEditingId(null);
    setFetchError(null);
  }

  function startEdit(inv: Stock) {
    const isBSE = inv.symbol?.endsWith(".BO");
    setFormData({
      name: inv.name, 
      symbol: (inv.symbol || "").split(".")[0],
      quantity: inv.quantity.toString(), 
      buy_price: inv.buy_price.toString(),
      current_price: inv.current_price.toString(), 
      currency: inv.currency,
      notes: inv.notes || "", 
      bought_at: inv.bought_at || new Date().toISOString().split("T")[0],
      exchange: isBSE ? "BSE" : "NSE",
      deduct_from_account: "", 
      trade_type: "buy"
    });
    setEditingId(inv.id);
    setShowForm(true);
  }

  function startSell(inv: Stock) {
    const isBSE = inv.symbol?.endsWith(".BO");
    setFormData({
      name: inv.name, 
      symbol: (inv.symbol || "").split(".")[0],
      quantity: inv.quantity.toString(), 
      buy_price: inv.current_price.toString(), // Default to LTP for sell
      current_price: inv.current_price.toString(), 
      currency: inv.currency,
      notes: "", 
      bought_at: new Date().toISOString().split("T")[0],
      exchange: isBSE ? "BSE" : "NSE",
      deduct_from_account: "", 
      trade_type: "sell"
    });
    setEditingId(null); // Selling is a new "transaction" record usually, or we could handle it as a specific sell logic
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const suffix = formData.exchange === "BSE" ? ".BO" : ".NS";
      const fullSymbol = formData.symbol ? `${formData.symbol.trim().toUpperCase().split(".")[0]}${suffix}` : undefined;

      const payload = {
        name: formData.name, 
        symbol: fullSymbol,
        quantity: parseFloat(formData.quantity),
        buy_price: parseFloat(formData.buy_price),
        current_price: parseFloat(formData.current_price),
        currency: formData.currency,
        notes: formData.notes || undefined,
        bought_at: formData.bought_at,
        deduct_account_id: formData.deduct_from_account || undefined,
        total_cost_with_charges: !editingId ? zerodhaCharges.netAmount : undefined,
        trade_type: formData.trade_type
      };
      const result = editingId
        ? await updateInvestment(editingId, payload)
        : await createInvestment(payload);
      if (!result?.error) {
        toast.success(editingId ? "Equity position updated successfully" : "New equity position registered in portfolio");
        resetForm();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function confirmDelete() {
    if (!deletingId) return;
    const res = await deleteInvestment(deletingId);
    if (!res?.error) { toast.success("Investment record purged from architecture"); } else toast.error(res.error);
    setShowDeleteConfirm(false);
    setDeletingId(null);
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="inline-flex ml-1 opacity-40 text-[9px] group-hover:opacity-100 transition-opacity">
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  // Export holdings to CSV
  function exportHoldings() {
    const csvData = filtered.map(inv => {
      const invested = inv.buy_price * inv.quantity;
      const currentVal = inv.current_price * inv.quantity;
      const pnl = currentVal - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      return {
        Symbol: inv.symbol?.split('.')[0] || '',
        Name: inv.name,
        Quantity: inv.quantity,
        'Avg Cost': inv.buy_price.toFixed(2),
        LTP: inv.current_price.toFixed(2),
        'Current Value': currentVal.toFixed(2),
        'P&L': pnl.toFixed(2),
        'P&L %': pnlPct.toFixed(2),
        'Day Change': inv.day_change || 0,
        'Day Change %': inv.day_change_percent || 0
      };
    });
    
    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holdings_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Holdings exported successfully');
  }



  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      
      {/* ── Portfolio Overview Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 mb-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[--text-primary]">Stocks Portfolio</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Live Asset Tracking</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
            {/* Auto refresh enabled */}
            <button 
              onClick={handleRefreshAll} 
              disabled={refreshing}
              className="btn-secondary !h-11 !px-6 flex items-center justify-center gap-2 flex-1 md:flex-none"
              title="Refresh Market Prices"
            >
              <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden md:inline">Sync Portfolio</span>
            </button>
            <button 
              onClick={exportHoldings} 
              className="btn-secondary !h-11 !px-6 flex items-center justify-center gap-2 hidden md:flex"
              title="Export Holdings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <button 
              onClick={() => setShowForm(true)} 
              className="btn-primary !h-12 md:!h-11 !px-8 w-full md:w-auto text-[13px] md:text-[11px] font-black uppercase tracking-widest shadow-[0_4px_20px_rgba(var(--accent-primary-rgb),0.3)] order-first md:order-last"
            >
                Add Stock
            </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4 px-4 mb-4">
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Total Invested</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">+₹{totalInvested.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Current Value</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">+₹{totalCurrent.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Unrealized P&L</span>
          <PnLValue value={totalPnL} percentage={totalPnLPercent} size="lg" className="items-start" />
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">{"Day's P&L"}</span>
          <PnLValue value={totalDayPnL} percentage={totalDayPnLPercent} size="lg" className="items-start" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-white/5 gap-4 px-4">
        <div className="flex items-center gap-8">
           <button 
             onClick={() => setActiveTab("holdings")}
             className={`text-xs font-black uppercase tracking-widest pb-3 px-1 transition-all ${activeTab === 'holdings' ? 'text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]' : 'text-[--text-muted] hover:text-[--text-primary]'}`}
           >
             Holdings ({stocks.filter(s => Number(s.quantity) > 0).length})
           </button>
           <button 
             onClick={() => setActiveTab("history")}
             className={`text-xs font-black uppercase tracking-widest pb-3 px-1 transition-all ${activeTab === 'history' ? 'text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]' : 'text-[--text-muted] hover:text-[--text-primary]'}`}
           >
             History
           </button>
        </div>
      </div>

      {/* ── Content View ── */}
      {activeTab === "holdings" ? (
        filtered.length > 0 ? (
          <div className="w-full mt-4 overflow-x-auto custom-scrollbar">
            {/* Desktop Table */}
            <table className="hidden md:table w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01] text-[9px] text-[--text-muted] uppercase font-black tracking-widest">
                  <th className="py-4 px-6 font-black transition-colors cursor-pointer hover:text-[--text-primary] group" onClick={() => handleSort("name")}>
                    Instrument <SortIcon col="name" />
                  </th>
                  <th className="py-4 px-4 font-black text-right cursor-pointer hover:text-[--text-primary] group" onClick={() => handleSort("quantity")}>
                    Qty. <SortIcon col="quantity" />
                  </th>
                  <th className="py-4 px-4 font-black text-right">Avg. cost</th>
                  <th className="py-4 px-4 font-black text-right">LTP</th>
                  <th className="py-4 px-4 font-black text-right cursor-pointer hover:text-[--text-primary] group" onClick={() => handleSort("current_value")}>
                    Cur. val <SortIcon col="current_value" />
                  </th>
                  <th className="py-4 px-4 font-black text-right cursor-pointer hover:text-[--text-primary] group" onClick={() => handleSort("pnl")}>
                    P&L <SortIcon col="pnl" />
                  </th>
                  <th className="py-4 px-4 font-black text-right">
                    Day Chg.
                  </th>
                  <th className="py-4 px-4 font-black text-right cursor-pointer hover:text-[--text-primary] group" onClick={() => handleSort("pnlPercent")}>
                    Net chg. <SortIcon col="pnlPercent" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((inv) => {
                  const invested = inv.buy_price * inv.quantity;
                  const currentVal = inv.current_price * inv.quantity;
                  const pnl = currentVal - invested;
                  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

                  return (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-white/[0.015] transition-all group relative cursor-default"
                    >
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <span className="text-[13px] font-medium text-[--text-primary]">{inv.symbol?.split('.')[0] || inv.name}</span>
                          </div>
                          <span className="text-[10px] text-[--text-muted] font-normal">{inv.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-secondary]">{inv.quantity}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-secondary]">{formatNum(inv.buy_price)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-primary] font-normal">{formatNum(inv.current_price)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-primary]">{formatNum(currentVal)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] font-medium">
                        <PnLValue value={pnl} showSign={true} prefix="₹" size="sm" />
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums">
                        <PnLValue value={(inv.day_change || 0) * inv.quantity} percentage={inv.day_change_percent || 0} size="sm" />
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] font-medium relative">
                        <PnLValue value={pnlPct} showSign={true} prefix="" suffix="%" size="sm" />
                        <div className="absolute inset-0 flex items-center justify-end pr-4 gap-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto bg-[--bg-base] backdrop-blur-md">
                          <button onClick={(e) => { e.stopPropagation(); startSell(inv); }} className="h-7 px-4 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-black rounded shadow-[0_4px_10px_rgba(244,63,94,0.2)] transition-colors uppercase tracking-tight">SELL</button>
                          <button onClick={(e) => { e.stopPropagation(); startEdit(inv); }} className="h-7 px-4 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-black rounded shadow-[0_4px_10px_rgba(14,165,233,0.2)] transition-colors uppercase tracking-tight">EDIT</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4 px-1">
               {filtered.map((inv) => {
                  const invested = inv.buy_price * inv.quantity;
                  const currentVal = inv.current_price * inv.quantity;
                  const pnl = currentVal - invested;
                  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                  const isProfit = pnl >= 0;
                  return (
                    <div key={inv.id} className="glass-card-static p-4 active:bg-white/[0.04] transition-all">
                       <div className="flex justify-between items-start mb-3">
                          <div onClick={() => startEdit(inv)} className="flex flex-col">
                             <span className="text-sm font-black text-white">{inv.symbol?.split('.')[0]}</span>
                             <span className="text-[10px] text-[--text-muted] uppercase font-bold">{inv.name}</span>
                          </div>
                          <div className="text-right">
                             <div className={`text-[15px] font-black ${isProfit ? "text-success" : "text-danger"}`}>
                                {isProfit ? "+" : ""}₹{formatNum(pnl)}
                             </div>
                             <div className={`text-[10px] font-bold opacity-60 ${isProfit ? "text-success" : "text-danger"}`}>
                                {isProfit ? "+" : ""}{pnlPct.toFixed(2)}%
                             </div>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-y-4 border-t border-white/5 pt-4 mb-4 overflow-hidden">
                          <div className="overflow-hidden"><p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Holding</p><p className="text-[13px] font-black truncate">{inv.quantity} <span className="opacity-40 font-bold ml-1">@ ₹{formatNum(inv.buy_price)}</span></p></div>
                          <div className="text-right overflow-hidden"><p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Current Value</p><p className="text-[13px] font-black truncate">₹{formatNum(currentVal)}</p></div>
                          <div className="overflow-hidden"><p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-1">LTP</p><p className="text-[13px] font-black truncate">₹{formatNum(inv.current_price)}</p></div>
                          <div className="text-right overflow-hidden">
                             <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Day Return</p>
                             <div className="flex flex-col items-end">
                                <p className={`text-[13px] font-black ${inv.day_change !== null && inv.day_change >= 0 ? "text-success" : "text-danger"}`}>
                                   {inv.day_change !== null && inv.day_change > 0 ? "+" : ""}{inv.day_change !== null ? formatNum(inv.day_change * inv.quantity) : "—"}
                                </p>
                                <p className={`text-[9px] font-bold opacity-60 ${inv.day_change !== null && inv.day_change >= 0 ? "text-success" : "text-danger"}`}>
                                   ({inv.day_change !== null && inv.day_change > 0 ? "+" : ""}{inv.day_change_percent?.toFixed(2)}%)
                                </p>
                             </div>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => { setEditingId(null); setFormData({ symbol: inv.symbol || "", name: inv.name, quantity: "", buy_price: inv.current_price.toString(), current_price: inv.current_price.toString(), exchange: inv.symbol?.endsWith(".BO") ? "BSE" : "NSE", trade_type: "buy", deduct_from_account: "", currency: "INR", notes: "", bought_at: new Date().toISOString().split("T")[0] }); setShowForm(true); }} className="flex-1 py-3 bg-success/20 hover:bg-success/30 text-success border border-success/30 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-success/5">Buy</button>
                          <button onClick={() => startSell(inv)} className="flex-1 py-3 bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-danger/5">Sell</button>
                          <button onClick={() => startEdit(inv)} className="w-12 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center transition-all shadow-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                       </div>
                    </div>
                  );
               })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-[--border-default] rounded-sm bg-[--bg-surface]/50">
            <p className="text-[--text-muted] text-sm mb-4">You don&apos;t have any holdings yet.</p>
            <button onClick={() => setShowForm(true)} className="text-[--accent-primary-light] text-xs font-medium hover:underline">Add your first stock</button>
          </div>
        )
      ) : activeTab === "history" ? (
        /* ── History Table ── */
        trades.length > 0 ? (
          <div className="w-full mt-4 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[--border-default] text-[11px] text-[--text-secondary] uppercase font-medium">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-4 text-right">Qty.</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right">Charges</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-4 text-[11px] text-[--text-muted]">{trade.trade_date ? format(new Date(trade.trade_date), "MMM d, yyyy") : "N/A"}</td>
                    <td className="py-4 px-4">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${trade.trade_type === 'buy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        {trade.trade_type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[13px] font-bold text-white group-hover:text-[--accent-primary-light] transition-colors">{trade.symbol.split('.')[0]}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] text-white/80">{trade.quantity}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] text-white/80">₹{formatNum(trade.price)}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[11px] text-rose-500/80">₹{formatNum(trade.charges ?? 0)}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] font-black flex items-center justify-end gap-4">
                       <span className={trade.trade_type === 'buy' ? 'text-rose-400' : 'text-emerald-400'}>
                         {trade.trade_type === 'buy' ? '-' : '+'}₹{formatNum(trade.total_amount)}
                       </span>
                       <button 
                         onClick={() => handleRevert(trade.ledger_log_id)}
                         disabled={submitting}
                         className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10"
                       >
                         Revert
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-[--border-default] rounded-sm bg-[--bg-surface]/50">
            <p className="text-[--text-muted] text-sm">No transaction history found.</p>
          </div>
        )
      ) : null}

      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in shadow-2xl">
          <div className="glass-card-static w-full max-w-xl p-6 md:p-10 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-10 pb-2">
              <h2 className="text-2xl font-black">
                {editingId ? "Modify Portfolio" : (formData.trade_type === 'buy' ? 'Asset Acquisition' : 'Asset Disposal')}
              </h2>
              <button onClick={resetForm} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <svg className="w-8 h-8 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative z-50">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[10px] text-[--text-muted] uppercase tracking-widest font-bold z-10">Symbol</label>
                  <input
                    required value={formData.symbol}
                    onChange={e => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    className="w-full h-12 px-4 bg-transparent border border-[--border-default] rounded-md text-[13px] text-[--text-primary] focus:border-[--accent-primary] outline-none font-bold uppercase placeholder:text-[--text-disabled]"
                    placeholder="SBIN"
                    autoComplete="off"
                  />
                  
                  {/* Suggestions Dropdown */}
                  {showSuggestions && (
                    <div className="absolute z-[400] top-full left-0 right-0 mt-1 bg-[--bg-elevated] border border-[--border-default] rounded-md shadow-2xl max-h-48 overflow-y-auto overflow-x-hidden animate-fade-in-up">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, symbol: s.symbol, name: s.name || "" });
                            setShowSuggestions(false);
                            handleFetchPrice(s.symbol);
                          }}
                          className="w-full px-4 py-3 flex flex-col items-start border-b border-[--border-default] last:border-0 hover:bg-[--accent-primary]/10 transition-colors text-left"
                        >
                          <div className="flex justify-between w-full">
                            <span className="text-[13px] font-bold text-[--text-primary]">{s.symbol}</span>
                            <span className="text-[10px] text-[--accent-primary-light] font-bold">{s.exchange}</span>
                          </div>
                          <span className="text-[11px] text-[--text-muted] truncate w-full">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-1 p-1 bg-[--bg-base] rounded-md border border-[--border-default]">
                   <button
                     type="button"
                     onClick={() => setFormData({ ...formData, exchange: "NSE" })}
                     className={`flex-1 h-10 text-[10px] font-bold rounded-md transition-all ${formData.exchange === "NSE" ? "bg-[--accent-primary] text-white shadow-lg" : "text-[--text-muted] hover:text-[--text-primary]"}`}
                   >
                     NSE
                   </button>
                   <button
                     type="button"
                     onClick={() => setFormData({ ...formData, exchange: "BSE" })}
                     className={`flex-1 h-10 text-[10px] font-bold rounded-md transition-all ${formData.exchange === "BSE" ? "bg-[--accent-primary] text-white shadow-lg" : "text-[--text-muted] hover:text-[--text-primary]"}`}
                   >
                     BSE
                   </button>
                </div>
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[10px] text-[--text-muted] uppercase tracking-widest font-bold z-10">Company Name</label>
                <input
                  required value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 px-4 bg-transparent border border-[--border-default] rounded-md text-[13px] text-[--text-primary] focus:border-[--accent-primary] outline-none font-medium placeholder:text-[--text-disabled]"
                  placeholder="State Bank of India"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[10px] text-[--text-muted] uppercase tracking-widest font-bold z-10">Qty.</label>
                  <input
                    required type="number" step="any"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-[--border-default] rounded-md text-[13px] text-[--text-primary] tabular-nums outline-none focus:border-[--accent-primary] font-bold"
                    placeholder="0"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[10px] text-[--text-muted] uppercase tracking-widest font-bold z-10">Avg. Price</label>
                  <input
                    required type="number" step="0.01"
                    value={formData.buy_price}
                    onChange={e => setFormData({ ...formData, buy_price: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-[--border-default] rounded-md text-[13px] text-[--text-primary] tabular-nums outline-none focus:border-[--accent-primary] font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[10px] text-[--text-muted] uppercase tracking-widest font-bold z-10">Market LTP</label>
                  <div className="relative">
                    <input
                      required type="number" step="0.01"
                      value={formData.current_price}
                      onChange={e => setFormData({ ...formData, current_price: e.target.value })}
                      className={`w-full h-12 px-4 bg-transparent border border-[--border-default] rounded-md text-[13px] text-[--text-primary] tabular-nums outline-none focus:border-[--accent-primary] font-bold transition-all ${fetchingPrice ? "opacity-50" : ""}`}
                      placeholder="0.00"
                    />
                    {fetchingPrice && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-[--accent-primary] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {fetchError && (
                    <p className="mt-2 text-[11px] font-medium text-rose-400">
                      {fetchError}
                    </p>
                  )}
                </div>

                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[10px] text-[--text-muted] uppercase tracking-widest font-bold z-10">
                    {formData.trade_type === 'buy' ? 'Deduct From' : 'Deposit To'}
                  </label>
                  <select
                    value={formData.deduct_from_account || ""}
                    onChange={e => setFormData({ ...formData, deduct_from_account: e.target.value })}
                    className="w-full h-12 px-4 pr-10 bg-transparent border border-[--border-default] rounded-md text-[12px] text-[--text-primary] outline-none focus:border-[--accent-primary] appearance-none font-bold"
                    disabled={!!editingId}
                  >
                    <option value="" className="bg-[--bg-surface]">N/A (Historical)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id} className="bg-[--bg-surface]">
                        {acc.name} (₹{formatNum(acc.balance)})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[--text-muted]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Zerodha Charges Breakdown (Condensed with Toggle) */}
              {parseFloat(formData.quantity) > 0 && parseFloat(formData.buy_price) > 0 && (
                <div className="bg-[--bg-base] rounded-xl p-4 border border-[--border-default] animate-fade-in">
                   <div className="flex justify-between items-center mb-0">
                     <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Levies & Taxes</span>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[13px] font-black text-[--text-primary]">₹{formatNum(zerodhaCharges.totalCharges)}</span>
                           <button 
                             type="button"
                             onClick={() => setShowChargesInForm(!showChargesInForm)}
                             className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                             title={showChargesInForm ? "Hide charges breakdown" : "Show charges breakdown"}
                           >
                             <svg className="w-4 h-4 text-[--accent-primary-light]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                               {showChargesInForm ? (
                                 <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                               ) : (
                                 <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                               )}
                             </svg>
                           </button>
                        </div>
                     </div>
                     <span className="text-[9px] text-[--accent-primary-light] border border-[--accent-primary]/20 px-2 py-0.5 rounded font-black uppercase">Zerodha Delivery</span>
                   </div>
                   
                   {showChargesInForm && (
                     <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 pt-4 border-t border-white/5 animate-fade-in">
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[--text-muted]">STT (0.1%)</span>
                         <span className="text-[--text-primary]">₹{formatNum(zerodhaCharges.stt)}</span>
                       </div>
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[--text-muted]">Txn Fee</span>
                         <span className="text-[--text-primary]">₹{formatNum(zerodhaCharges.txnCharge)}</span>
                       </div>
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[--text-muted]">GST (18%)</span>
                         <span className="text-[--text-primary]">₹{formatNum(zerodhaCharges.gst)}</span>
                       </div>
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[--text-muted]">Stamp Duty</span>
                         <span className="text-[--text-primary]">₹{formatNum(zerodhaCharges.stampDuty)}</span>
                       </div>
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[--text-muted]">SEBI Fee</span>
                         <span className="text-[--text-primary]">₹{formatNum(zerodhaCharges.sebiCharge)}</span>
                       </div>
                       {zerodhaCharges.dpCharges > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[--text-muted]">DP Charges</span>
                          <span className="text-[--text-primary]">₹{formatNum(zerodhaCharges.dpCharges)}</span>
                        </div>
                       )}
                     </div>
                   )}
                   
                   <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                      <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-widest">Net Outflow</span>
                      <span className={`text-[15px] font-black tabular-nums ${formData.trade_type === 'buy' ? 'text-danger' : 'text-success'}`}>
                        ₹{formatNum(zerodhaCharges.netAmount)}
                      </span>
                   </div>
                </div>
              )}

              <button
                type="submit" disabled={submitting}
                className="btn-primary w-full shadow-2xl mt-4"
              >
                {submitting ? "Processing Transaction..." : (editingId ? "Finalize Updates" : (formData.trade_type === 'buy' ? "Authorize Buy Order" : "Authorize Sell Order"))}
              </button>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="w-full max-w-xs bg-[--bg-surface] border border-[--border-default] rounded-sm p-6 text-center shadow-2xl">
              <h3 className="text-base font-medium text-[--text-primary] mb-2">Delete holding?</h3>
              <p className="text-[12px] text-[--text-muted] mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowDeleteConfirm(false); setDeletingId(null); }}
                  className="flex-1 h-10 border border-[--border-default] text-[--text-primary] text-xs font-medium rounded-sm hover:bg-[--bg-elevated] transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 h-10 bg-danger text-white text-xs font-medium rounded-sm hover:opacity-90 transition-colors"
                >
                  DELETE
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
