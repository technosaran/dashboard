"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import type { Tables } from "@/lib/database.types";
import { toast } from "react-hot-toast";
import { createClient } from "@/lib/supabase-browser";
import { 
  createInvestment, 
  updateInvestment, 
  deleteInvestment, 
  getStockDetails, 
  refreshAllPrices,
  searchStocks,
  getStockTrades
} from "./actions";
import { calculateZerodhaCharges } from "@/lib/investment-utils";
import { useRealTimeSync } from "@/hooks/use-realtime-sync";
import { getAccounts } from "../accounts/actions";

type Stock = Tables<"investments"> & { total_charges?: number };

type Account = {
  id: string;
  name: string;
  balance: number;
  currency: string;
};

const supabase = createClient();

type SortKey = "name" | "pnl" | "pnlPercent" | "current_value" | "quantity";
type SortDir = "asc" | "desc";

function formatNum(val: number, decimals = 2): string {
  return val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

interface StocksClientProps {
  initialStocks: Stock[];
}

export default function StocksClient({ initialStocks }: StocksClientProps) {
  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams?.get("action") === "new");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAllCharges, setShowAllCharges] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
  const [trades, setTrades] = useState<Tables<"stock_trades">[]>([]);
  const refreshAllRef = useRef<(() => Promise<void>) | null>(null);
  const fetchPriceRef = useRef<((symbol: string) => Promise<void>) | null>(null);

  const loadTrades = useCallback(async () => {
    const res = await getStockTrades();
    if (res.data) setTrades(res.data as Tables<"stock_trades">[]);
  }, []);

  const loadStocks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("investments")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", "stock")
      .order("created_at", { ascending: false });
    if (data) setStocks(data as Stock[]);
  }, []);

  useEffect(() => {
    if (activeTab === "history") loadTrades();
  }, [activeTab, loadTrades]);

  // Automated price refresh on mount (once every 15 mins max to be polite)
  useEffect(() => {
    refreshAllRef.current?.();
    const timer = setInterval(() => {
      refreshAllRef.current?.();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await getAccounts();
    if (res.data) setAccounts(res.data as Account[]);
  }, []);

  useEffect(() => {
    if (showForm) loadAccounts();
  }, [showForm, loadAccounts]);

  interface Suggestion {
    symbol: string;
    fullSymbol: string;
    name?: string;
    exchange: string;
  }

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

  useEffect(() => {
    const channel = supabase
      .channel("stocks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "investments" }, () =>
        startTransition(loadStocks)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadStocks]);

  useRealTimeSync(loadStocks);
  useRealTimeSync(loadTrades);

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

  // Removed redundant auto-fetch useEffect to prevent "asking two times" feel

  async function handleRefreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    const toastId = toast.loading("Refreshing market prices...");
    try {
      const res = await refreshAllPrices();
      if (res.success) {
        toast.success("All prices updated", { id: toastId });
        loadStocks();
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

  // --- Computed ---
  const totalInvested = stocks.reduce((s, i) => s + Number(i.buy_price || 0) * Number(i.quantity || 0), 0);
  const totalCurrent = stocks.reduce((s, i) => s + Number(i.current_price || 0) * Number(i.quantity || 0), 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const totalDayPnL = stocks.reduce((s, i) => s + Number(i.day_change || 0) * Number(i.quantity || 0), 0);
  const prevDayValue = totalCurrent - totalDayPnL;
  const totalDayPnLPercent = prevDayValue > 0 ? (totalDayPnL / prevDayValue) * 100 : 0;

  const filtered = useMemo(() => {
    let list = stocks.filter(i => Number(i.quantity) > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.symbol && i.symbol.toLowerCase().includes(q))
      );
    }
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
  }, [stocks, search, sortKey, sortDir]);

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
    if (submitting) return;
    e.preventDefault();
    setSubmitting(true);
    
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
      loadStocks();
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  }

  async function confirmDelete() {
    if (!deletingId) return;
    const res = await deleteInvestment(deletingId);
    if (!res?.error) { toast.success("Investment record purged from architecture"); loadStocks(); } else toast.error(res.error);
    setShowDeleteConfirm(false);
    setDeletingId(null);
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="inline-flex ml-1 opacity-40 text-[9px] group-hover:opacity-100 transition-opacity">
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  return (
    <div className="flex flex-col gap-0 animate-fade-in text-[--text-primary] py-6" style={{ maxWidth: "1250px", margin: "0 auto", width: "100%", paddingBottom: "100px" }}>
      
      {/* ── Portfolio Overview Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[--text-primary]">Stocks Portfolio</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Live Asset Tracking</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Auto refresh enabled */}
            <button onClick={() => setShowForm(true)} className="btn-primary !h-11 !px-8">
                Add Stock
            </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4 px-4 mb-4">
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Total Invested</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">₹{totalInvested.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Current Value</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">₹{totalCurrent.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Unrealized P&L</span>
          <div className="flex flex-col">
            <span className={`text-xl md:text-2xl font-black tabular-nums ${totalPnL >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
              {totalPnL >= 0 ? "+" : ""}{formatNum(totalPnL)}
            </span>
            <span className={`text-[10px] font-black ${totalPnL >= 0 ? "text-[--success]" : "text-[--danger]"} opacity-60`}>
              ({totalPnL >= 0 ? "+" : ""}{totalPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Day&apos;s P&amp;L</span>
          <div className="flex flex-col">
            <span className={`text-xl md:text-2xl font-black tabular-nums ${totalDayPnL >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
              {totalDayPnL >= 0 ? "+" : ""}{formatNum(totalDayPnL)}
            </span>
            <span className={`text-[10px] font-black ${totalDayPnL >= 0 ? "text-[--success]" : "text-[--danger]"} opacity-60`}>
              ({totalDayPnL >= 0 ? "+" : ""}{totalDayPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>


      {/* ── Tabs & Search ── */}
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

        <div className="relative w-full sm:w-64 md:w-80 group pb-3">
           <svg className="absolute left-0 top-[40%] -translate-y-1/2 w-4 h-4 text-[--text-muted] group-focus-within:text-[--accent-primary-light] transition-colors" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full h-8 pl-7 pr-3 bg-transparent text-[13px] text-[--text-primary] placeholder:text-white/10 outline-none transition-colors border-none font-medium"
          />
        </div>
      </div>

      {/* ── Content View ── */}
      {activeTab === "holdings" ? (
        filtered.length > 0 ? (
          <div className="w-full mt-4 overflow-hidden">
            <table className="w-full text-left border-collapse">
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
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.map((inv) => {
                  const invested = inv.buy_price * inv.quantity;
                  const currentVal = inv.current_price * inv.quantity;
                  const pnl = currentVal - invested;
                  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                  const isProfit = pnl >= 0;

                  return (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-white/[0.015] transition-all group relative cursor-default"
                    >
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <span className="text-[13px] font-medium text-[#eee]">{inv.symbol?.split('.')[0] || inv.name}</span>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 toast(`Charges Paid: ₹${formatNum(inv.total_charges || calculateZerodhaCharges(inv.quantity, inv.buy_price, inv.symbol?.endsWith('.BO') ? 'BSE' : 'NSE', true).totalCharges)}`, {
                                   icon: '👁️',
                                   style: { background: '#1a1a1a', color: '#eee', border: '1px solid #333', fontSize: '11px', fontWeight: 'bold' }
                                 });
                               }}
                               className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/5 rounded text-[10px]"
                               title="View Charges"
                             >
                               👁️
                             </button>
                          </div>
                          <span className="text-[10px] text-[#666] font-normal">{inv.name}</span>
                        </div>
                        
                        {/* Hover Actions */}
                        <div className="absolute left-0 top-0 bottom-0 flex items-center bg-[#1f1f1f] px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto shadow-xl">
                          <button 
                            onClick={() => startSell(inv)}
                            className="h-7 px-3 bg-[#df514c1a] hover:bg-[#df514c] text-[#df514c] hover:text-white text-[11px] font-bold rounded transition-colors mr-2 uppercase tracking-tight"
                          >
                            SELL
                          </button>
                          <button 
                            onClick={() => startEdit(inv)}
                            className="h-7 px-3 bg-[#387ed11a] hover:bg-[#387ed1] text-[#387ed1] hover:text-white text-[11px] font-medium rounded transition-colors"
                          >
                            EDIT
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[#9b9b9b]">{inv.quantity}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[#9b9b9b]">{formatNum(inv.buy_price)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[#eee] font-normal">{formatNum(inv.current_price)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[#eee]">{formatNum(currentVal)}</td>
                      <td className={`py-4 px-4 text-right tabular-nums text-[13px] font-medium ${isProfit ? "text-[#4caf50]" : "text-[#df514c]"}`}>
                        {formatNum(pnl)}
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums">
                        <div className="flex flex-col items-end">
                           <span className={`text-[12px] font-medium ${inv.day_change !== null && inv.day_change >= 0 ? "text-[#4caf50]" : "text-[#df514c]"}`}>
                             {inv.day_change !== null ? (inv.day_change > 0 ? "+" : "") + formatNum(inv.day_change) : "—"}
                           </span>
                           <span className={`text-[10px] font-bold ${inv.day_change_percent !== null && inv.day_change_percent >= 0 ? "text-[#4caf50]" : "text-[#df514c]"}`}>
                             {inv.day_change_percent !== null ? (inv.day_change_percent > 0 ? "+" : "") + Number(inv.day_change_percent).toFixed(2) + "%" : ""}
                           </span>
                        </div>
                      </td>
                      <td className={`py-4 px-4 text-right tabular-nums text-[13px] font-medium ${isProfit ? "text-[#4caf50]" : "text-[#df514c]"}`}>
                        {isProfit ? "+" : ""}{pnlPct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-[#252525] rounded-sm bg-[#1a1a1a]/50">
            <p className="text-[#666] text-sm mb-4">You don&apos;t have any holdings yet.</p>
            <button onClick={() => setShowForm(true)} className="text-[#387ed1] text-xs font-medium hover:underline">Add your first stock</button>
          </div>
        )
      ) : (
        /* ── History Table ── */
        trades.length > 0 ? (
          <div className="w-full mt-4 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#252525] text-[11px] text-[#9b9b9b] uppercase font-medium">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-4 text-right">Qty.</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right">Charges</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {trades.filter(t => 
                  t.symbol?.toLowerCase().includes(search.toLowerCase()) ||
                  t.symbol?.toLowerCase().includes(search.toLowerCase())
                ).map((trade) => (
                  <tr key={trade.id} className="border-b border-[#252525] hover:bg-[#1f1f1f] transition-all">
                    <td className="py-4 px-4 text-[12px] text-[#666]">{new Date(trade.trade_date).toLocaleDateString()}</td>
                    <td className="py-4 px-4">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-tighter ${trade.trade_type === 'buy' ? 'bg-[#4caf501a] text-[#4caf50]' : 'bg-[#df514c1a] text-[#df514c]'}`}>
                        {trade.trade_type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[13px] font-medium text-[#eee]">{trade.symbol.split('.')[0]}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[#9b9b9b]">{trade.quantity}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[#9b9b9b]">{formatNum(trade.price)}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[11px] text-[#df514c]">₹{formatNum(trade.charges)}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[#eee] font-medium">₹{formatNum(trade.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 border border-dashed border-[#252525] rounded-sm bg-[#1a1a1a]/50">
            <p className="text-[#666] text-sm">No transaction history found.</p>
          </div>
        )
      )}

      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in shadow-2xl">
          <div className="glass-card-static w-full max-w-xl p-6 md:p-10 animate-scale-in max-h-[95vh] overflow-y-auto">
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
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-widest font-bold z-10">Symbol</label>
                  <input
                    required value={formData.symbol}
                    onChange={e => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-md text-[13px] text-[#eee] focus:border-[#387ed1] outline-none font-bold uppercase placeholder:text-[#333]"
                    placeholder="SBIN"
                    autoComplete="off"
                  />
                  
                  {/* Suggestions Dropdown */}
                  {showSuggestions && (
                    <div className="absolute z-[400] top-full left-0 right-0 mt-1 bg-[#1f1f1f] border border-[#252525] rounded-md shadow-2xl max-h-48 overflow-y-auto overflow-x-hidden animate-fade-in-up">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, symbol: s.symbol, name: s.name || "" });
                            setShowSuggestions(false);
                            handleFetchPrice(s.symbol);
                          }}
                          className="w-full px-4 py-3 flex flex-col items-start border-b border-[#252525] last:border-0 hover:bg-[#387ed122] transition-colors text-left"
                        >
                          <div className="flex justify-between w-full">
                            <span className="text-[13px] font-bold text-[#eee]">{s.symbol}</span>
                            <span className="text-[10px] text-[#387ed1] font-bold">{s.exchange}</span>
                          </div>
                          <span className="text-[11px] text-[#666] truncate w-full">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-1 p-1 bg-[#151515] rounded-md border border-[#252525]">
                   <button
                     type="button"
                     onClick={() => setFormData({ ...formData, exchange: "NSE" })}
                     className={`flex-1 h-10 text-[10px] font-bold rounded-md transition-all ${formData.exchange === "NSE" ? "bg-[#387ed1] text-white shadow-lg" : "text-[#555] hover:text-[#eee]"}`}
                   >
                     NSE
                   </button>
                   <button
                     type="button"
                     onClick={() => setFormData({ ...formData, exchange: "BSE" })}
                     className={`flex-1 h-10 text-[10px] font-bold rounded-md transition-all ${formData.exchange === "BSE" ? "bg-[#387ed1] text-white shadow-lg" : "text-[#555] hover:text-[#eee]"}`}
                   >
                     BSE
                   </button>
                </div>
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-widest font-bold z-10">Company Name</label>
                <input
                  required value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-md text-[13px] text-[#eee] focus:border-[#387ed1] outline-none font-medium placeholder:text-[#333]"
                  placeholder="State Bank of India"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-widest font-bold z-10">Qty.</label>
                  <input
                    required type="number" step="any"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-md text-[13px] text-[#eee] tabular-nums outline-none focus:border-[#387ed1] font-bold"
                    placeholder="0"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-widest font-bold z-10">Avg. Price</label>
                  <input
                    required type="number" step="0.01"
                    value={formData.buy_price}
                    onChange={e => setFormData({ ...formData, buy_price: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-md text-[13px] text-[#eee] tabular-nums outline-none focus:border-[#387ed1] font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-widest font-bold z-10">Market LTP</label>
                  <div className="relative">
                    <input
                      required type="number" step="0.01"
                      value={formData.current_price}
                      onChange={e => setFormData({ ...formData, current_price: e.target.value })}
                      className={`w-full h-12 px-4 bg-transparent border border-[#252525] rounded-md text-[13px] text-[#eee] tabular-nums outline-none focus:border-[#387ed1] font-bold transition-all ${fetchingPrice ? "opacity-50" : ""}`}
                      placeholder="0.00"
                    />
                    {fetchingPrice && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-[#387ed1] border-t-transparent rounded-full animate-spin" />
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
                  <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-widest font-bold z-10">
                    {formData.trade_type === 'buy' ? 'Deduct From' : 'Deposit To'}
                  </label>
                  <select
                    value={formData.deduct_from_account || ""}
                    onChange={e => setFormData({ ...formData, deduct_from_account: e.target.value })}
                    className="w-full h-12 px-4 pr-10 bg-transparent border border-[#252525] rounded-md text-[12px] text-[#eee] outline-none focus:border-[#387ed1] appearance-none font-bold"
                    disabled={!!editingId}
                  >
                    <option value="" className="bg-[#1a1a1a]">N/A (Historical)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id} className="bg-[#1a1a1a]">
                        {acc.name} (₹{formatNum(acc.balance)})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#666]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Zerodha Charges Breakdown (Condensed with Toggle) */}
              {parseFloat(formData.quantity) > 0 && parseFloat(formData.buy_price) > 0 && (
                <div className="bg-[#151515] rounded-xl p-4 border border-[#252525] animate-fade-in">
                   <div className="flex justify-between items-center mb-0">
                     <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#555]">Levies & Taxes</span>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[13px] font-black text-[#eee]">₹{formatNum(zerodhaCharges.totalCharges)}</span>
                           <button 
                             type="button"
                             onClick={() => setShowAllCharges(!showAllCharges)}
                             className="text-[9px] font-black text-[--accent-primary-light] uppercase tracking-widest hover:underline"
                           >
                             {showAllCharges ? "Hide Details" : "See More"}
                           </button>
                        </div>
                     </div>
                     <span className="text-[9px] text-[#387ed1] border border-[#387ed1]/20 px-2 py-0.5 rounded font-black uppercase">Zerodha Delivery</span>
                   </div>
                   
                   {showAllCharges && (
                     <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 pt-4 border-t border-white/5 animate-fade-in">
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[#666]">STT (0.1%)</span>
                         <span className="text-[#eee]">₹{formatNum(zerodhaCharges.stt)}</span>
                       </div>
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[#666]">Txn Fee</span>
                         <span className="text-[#eee]">₹{formatNum(zerodhaCharges.txnCharge)}</span>
                       </div>
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[#666]">GST (18%)</span>
                         <span className="text-[#eee]">₹{formatNum(zerodhaCharges.gst)}</span>
                       </div>
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[#666]">Stamp Duty</span>
                         <span className="text-[#eee]">₹{formatNum(zerodhaCharges.stampDuty)}</span>
                       </div>
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[#666]">SEBI Fee</span>
                         <span className="text-[#eee]">₹{formatNum(zerodhaCharges.sebiCharge)}</span>
                       </div>
                       {zerodhaCharges.dpCharges > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#666]">DP Charges</span>
                          <span className="text-[#eee]">₹{formatNum(zerodhaCharges.dpCharges)}</span>
                        </div>
                       )}
                     </div>
                   )}
                   
                   <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                      <span className="text-[10px] font-black text-[#666] uppercase tracking-widest">Net Outflow</span>
                      <span className={`text-[15px] font-black tabular-nums ${formData.trade_type === 'buy' ? 'text-rose-400' : 'text-emerald-400'}`}>
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

      {/* ── Delete Confirm ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="w-full max-w-xs bg-[#1a1a1a] border border-[#252525] rounded-sm p-6 text-center shadow-2xl">
              <h3 className="text-base font-medium text-[#eee] mb-2">Delete holding?</h3>
              <p className="text-[12px] text-[#666] mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowDeleteConfirm(false); setDeletingId(null); }}
                  className="flex-1 h-10 border border-[#252525] text-[#eee] text-xs font-medium rounded-sm hover:bg-[#252525] transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 h-10 bg-[#df514c] text-white text-xs font-medium rounded-sm hover:bg-[#c0433f] transition-colors"
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
