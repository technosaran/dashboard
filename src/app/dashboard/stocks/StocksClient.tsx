"use client";

import { useCallback, useEffect, useState, startTransition, useMemo } from "react";
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
import { getAccounts } from "../accounts/actions";

type Stock = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  symbol: string | null;
  quantity: number;
  buy_price: number;
  current_price: number;
  currency: string;
  notes: string | null;
  bought_at: string | null;
  realized_pnl: number;
  created_at: string;
  updated_at: string;
};

type Account = {
  id: string;
  name: string;
  balance: number;
  currency: string;
};

const supabase = createClient();

const KITE_COLORS = {
  green: "#4caf50",
  red: "#df514c",
  blue: "#387ed1",
  bg: "#1a1a1a",
  bgSecondary: "#1f1f1f",
  border: "#252525",
  textMuted: "#9b9b9b",
  textPrimary: "#eeeeee",
  rowHover: "#252525"
};

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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showActionsId, setShowActionsId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "", symbol: "", quantity: "", buy_price: "", current_price: "",
    currency: "INR", notes: "", bought_at: new Date().toISOString().split("T")[0],
    exchange: "NSE" as "NSE" | "BSE",
    deduct_from_account: "",
    trade_type: "buy" as "buy" | "sell"
  });

  const [activeTab, setActiveTab] = useState<"holdings" | "history">("holdings");
  const [trades, setTrades] = useState<any[]>([]);

  const loadTrades = useCallback(async () => {
    const res = await getStockTrades();
    if (res.data) setTrades(res.data);
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
    if (data) setStocks(data);
  }, []);

  useEffect(() => {
    if (activeTab === "history") loadTrades();
  }, [activeTab, loadTrades]);

  const loadAccounts = useCallback(async () => {
    const res = await getAccounts();
    if (res.data) setAccounts(res.data as Account[]);
  }, []);

  useEffect(() => {
    if (showForm) loadAccounts();
  }, [showForm, loadAccounts]);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced search for suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.symbol.length >= 2 && !editingId) {
        const results = await searchStocks(formData.symbol, formData.exchange);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
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

  async function handleFetchPrice(symbol: string) {
    if (symbol.length < 2 || editingId) return;
    setFetchingPrice(true);
    setFetchError(null);
    try {
      const res = await getStockDetails(symbol, formData.exchange);
      if ("error" in res) {
        setFetchError(res.error);
      } else {
        setFormData(prev => ({
          ...prev,
          name: res.name || prev.name,
          current_price: res.price?.toString() || prev.current_price,
          currency: res.currency || prev.currency
        }));
      }
    } catch (e) {
      setFetchError("Fetch failed");
    }
    setFetchingPrice(false);
  }

  // Auto-fetch stock details when symbol or exchange changes
  useEffect(() => {
    if (editingId) return;
    const symbol = formData.symbol.trim();
    if (symbol.length < 2) {
      setFetchError(null);
      return;
    }
    const timeout = setTimeout(() => handleFetchPrice(symbol), 1000);
    return () => clearTimeout(timeout);
  }, [formData.symbol, formData.exchange, editingId]);

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
    } catch (e) {
      toast.error("Network error during refresh", { id: toastId });
    } finally {
      setRefreshing(false);
    }
  }

  // --- Computed ---
  const totalInvested = stocks.reduce((s, i) => s + i.buy_price * i.quantity, 0);
  const totalCurrent = stocks.reduce((s, i) => s + i.current_price * i.quantity, 0);
  const totalRealizedPnL = stocks.reduce((s, i) => s + (i.realized_pnl || 0), 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const filtered = useMemo(() => {
    let list = stocks;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.symbol && i.symbol.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "pnl") cmp = ((a.current_price - a.buy_price) * a.quantity) - ((b.current_price - b.buy_price) * b.quantity);
      else if (sortKey === "pnlPercent") {
        const pa = a.buy_price > 0 ? ((a.current_price - a.buy_price) / a.buy_price) * 100 : 0;
        const pb = b.buy_price > 0 ? ((b.current_price - b.buy_price) / b.buy_price) * 100 : 0;
        cmp = pa - pb;
      } else if (sortKey === "current_value") cmp = (a.current_price * a.quantity) - (b.current_price * b.quantity);
      else if (sortKey === "quantity") cmp = a.quantity - b.quantity;
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
    setShowActionsId(null);
  }

  function startSell(inv: Stock) {
    const isBSE = inv.symbol?.endsWith(".BO");
    setFormData({
      name: inv.name, 
      symbol: (inv.symbol || "").split(".")[0],
      quantity: inv.quantity.toString(), 
      buy_price: inv.buy_price.toString(), // For record keeping
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
    setShowActionsId(null);
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
      toast.success(editingId ? "Stock updated" : "Stock added");
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
    if (!res?.error) { toast.success("Stock deleted"); loadStocks(); } else toast.error(res.error);
    setShowDeleteConfirm(false);
    setDeletingId(null);
    setShowActionsId(null);
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="inline-flex ml-1 opacity-40 text-[9px] group-hover:opacity-100 transition-opacity">
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  return (
    <div className="flex flex-col gap-0 animate-fade-in font-sans text-[#eee]" style={{ maxWidth: "1250px", margin: "0 auto", width: "100%", paddingBottom: "100px" }}>
      
      {/* ── Kite Summary Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#252525] pb-8 mb-6 gap-6">
        <div className="flex items-center gap-10">
          <div className="flex flex-col">
            <h1 className="text-xl font-medium text-[#eee]">Equity Portfolio ({stocks.length})</h1>
          </div>
          <div className="h-10 w-[1px] bg-[#252525] hidden sm:block" />
          <div className="flex gap-12">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#9b9b9b] uppercase tracking-wider mb-1">Total investment</span>
              <span className="text-xl font-normal tabular-nums">{formatNum(totalInvested)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#9b9b9b] uppercase tracking-wider mb-1">Current value</span>
              <span className="text-xl font-normal tabular-nums">{formatNum(totalCurrent)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-10">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#9b9b9b] uppercase tracking-wider mb-1">Realized P&L</span>
            <span className={`text-xl font-medium tabular-nums ${totalRealizedPnL >= 0 ? "text-[#4caf50]" : "text-[#df514c]"}`}>
              {totalRealizedPnL >= 0 ? "+" : ""}{formatNum(totalRealizedPnL)}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#9b9b9b] uppercase tracking-wider mb-1">Unrealized P&L</span>
            <div className="flex items-center gap-2">
               <span className={`text-xl font-medium tabular-nums ${totalPnL >= 0 ? "text-[#4caf50]" : "text-[#df514c]"}`}>
                {totalPnL >= 0 ? "+" : ""}{formatNum(totalPnL)}
              </span>
              <span className={`text-[11px] font-medium ${totalPnL >= 0 ? "text-[#4caf50]" : "text-[#df514c]"}`}>
                ({totalPnL >= 0 ? "+" : ""}{totalPnLPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="h-9 px-4 bg-[#252525] hover:bg-[#333] text-[#eee] text-sm font-medium rounded transition-colors flex items-center justify-center disabled:opacity-50"
              title="Refresh LTP for all stocks"
            >
              <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="h-9 px-6 bg-[#387ed1] hover:bg-[#2c69b1] text-white text-sm font-medium rounded transition-colors"
            >
              Add Stock
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs & Search ── */}
      <div className="flex items-center justify-between mb-4 border-b border-[#252525]">
        <div className="flex items-center gap-8">
           <button 
             onClick={() => setActiveTab("holdings")}
             className={`text-sm font-medium pb-3 px-1 transition-all ${activeTab === 'holdings' ? 'text-[#387ed1] border-b-2 border-[#387ed1]' : 'text-[#666] hover:text-[#999]'}`}
           >
             Holdings ({stocks.length})
           </button>
           <button 
             onClick={() => setActiveTab("history")}
             className={`text-sm font-medium pb-3 px-1 transition-all ${activeTab === 'history' ? 'text-[#387ed1] border-b-2 border-[#387ed1]' : 'text-[#666] hover:text-[#999]'}`}
           >
             History
           </button>
        </div>

        <div className="relative w-80 group pb-3">
           <svg className="absolute left-0 top-[40%] -translate-y-1/2 w-4 h-4 text-[#666] group-focus-within:text-[#387ed1] transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full h-8 pl-7 pr-3 bg-transparent text-sm text-[#eee] placeholder:text-[#555] outline-none transition-colors border-none"
          />
        </div>
      </div>

      {/* ── Content View ── */}
      {activeTab === "holdings" ? (
        filtered.length > 0 ? (
          <div className="w-full mt-4 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#252525] text-[11px] text-[#9b9b9b] uppercase font-medium">
                  <th className="py-3 px-4 font-medium transition-colors cursor-pointer hover:text-[#eee] group" onClick={() => handleSort("name")}>
                    Instrument <SortIcon col="name" />
                  </th>
                  <th className="py-3 px-4 font-medium text-right cursor-pointer hover:text-[#eee] group" onClick={() => handleSort("quantity")}>
                    Qty. <SortIcon col="quantity" />
                  </th>
                  <th className="py-3 px-4 font-medium text-right">Avg. cost</th>
                  <th className="py-3 px-4 font-medium text-right">LTP</th>
                  <th className="py-3 px-4 font-medium text-right cursor-pointer hover:text-[#eee] group" onClick={() => handleSort("current_value")}>
                    Cur. val <SortIcon col="current_value" />
                  </th>
                  <th className="py-3 px-4 font-medium text-right cursor-pointer hover:text-[#eee] group" onClick={() => handleSort("pnl")}>
                    P&L <SortIcon col="pnl" />
                  </th>
                  <th className="py-3 px-4 font-medium text-right cursor-pointer hover:text-[#eee] group" onClick={() => handleSort("pnlPercent")}>
                    Net chg. <SortIcon col="pnlPercent" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const invested = inv.buy_price * inv.quantity;
                  const currentVal = inv.current_price * inv.quantity;
                  const pnl = currentVal - invested;
                  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                  const isProfit = pnl >= 0;

                  return (
                    <tr 
                      key={inv.id} 
                      className="border-b border-[#252525] hover:bg-[#1f1f1f] transition-all group relative cursor-default"
                    >
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-[#eee]">{inv.symbol?.split('.')[0] || inv.name}</span>
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

      {/* ── Add/Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#1a1a1a] border border-[#252525] shadow-2xl rounded-sm p-8 animate-scale-in">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-lg font-medium text-[#eee]">
                {editingId ? "Edit holding" : "Add holding"}
              </h2>
              <button onClick={resetForm} className="text-[#666] hover:text-[#eee] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-wide">Stock Symbol</label>
                <input
                  required value={formData.symbol}
                  onChange={e => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-sm text-[13px] text-[#eee] focus:border-[#387ed1] outline-none font-medium uppercase placeholder:text-[#333]"
                  placeholder="e.g. SBIN, RELIANCE, TCS"
                  autoComplete="off"
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && (
                  <div className="absolute z-[400] top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#252525] rounded-sm shadow-2xl max-h-48 overflow-y-auto overflow-x-hidden animate-fade-in-up">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, symbol: s.symbol, name: s.name });
                          setShowSuggestions(false);
                          // Auto-fetch price for selected
                          handleFetchPrice(s.symbol);
                        }}
                        className="w-full px-4 py-3 flex flex-col items-start border-b border-[#252525] last:border-0 hover:bg-[#252525] transition-colors text-left"
                      >
                        <div className="flex justify-between w-full">
                          <span className="text-[13px] font-bold text-[#eee]">{s.symbol}</span>
                          <span className="text-[10px] text-[#666] uppercase">{s.exchange}</span>
                        </div>
                        <span className="text-[11px] text-[#9b9b9b] truncate w-full">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {fetchError && (
                  <p className="absolute -bottom-5 left-0 text-[10px] text-[#df514c] animate-fade-in">{fetchError}</p>
                )}
              </div>

              <div className="flex gap-2 p-1 bg-[#252525] rounded-sm">
                 <button
                   type="button"
                   onClick={() => setFormData({ ...formData, exchange: "NSE" })}
                   className={`flex-1 h-8 text-[11px] font-medium rounded-sm transition-all ${formData.exchange === "NSE" ? "bg-[#387ed1] text-white" : "text-[#666] hover:text-[#999]"}`}
                 >
                   NSE
                 </button>
                 <button
                   type="button"
                   onClick={() => setFormData({ ...formData, exchange: "BSE" })}
                   className={`flex-1 h-8 text-[11px] font-medium rounded-sm transition-all ${formData.exchange === "BSE" ? "bg-[#387ed1] text-white" : "text-[#666] hover:text-[#999]"}`}
                 >
                   BSE
                 </button>
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-wide">Company Name</label>
                <input
                  required value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-sm text-[13px] text-[#eee] focus:border-[#387ed1] outline-none placeholder:text-[#333]"
                  placeholder="e.g. State Bank of India"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-wide">Quantity</label>
                  <input
                    required type="number" step="any"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-sm text-[13px] text-[#eee] tabular-nums outline-none focus:border-[#387ed1]"
                    placeholder="0"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-wide">Avg. Price</label>
                  <input
                    required type="number" step="0.01"
                    value={formData.buy_price}
                    onChange={e => setFormData({ ...formData, buy_price: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-sm text-[13px] text-[#eee] tabular-nums outline-none focus:border-[#387ed1]"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-wide">Current LTP</label>
                <div className="relative">
                  <input
                    required type="number" step="0.01"
                    value={formData.current_price}
                    onChange={e => setFormData({ ...formData, current_price: e.target.value })}
                    className={`w-full h-12 px-4 bg-transparent border border-[#252525] rounded-sm text-[13px] text-[#eee] tabular-nums outline-none focus:border-[#387ed1] transition-all ${fetchingPrice ? "opacity-50" : ""}`}
                    placeholder="0.00"
                  />
                  {fetchingPrice && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-[#387ed1] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[#1a1a1a] text-[10px] text-[#666] uppercase tracking-wide">Deduct from Account (Optional)</label>
                <select
                  value={formData.deduct_from_account || ""}
                  onChange={e => setFormData({ ...formData, deduct_from_account: e.target.value })}
                  className="w-full h-12 px-4 bg-transparent border border-[#252525] rounded-sm text-[13px] text-[#eee] outline-none focus:border-[#387ed1] appearance-none"
                  disabled={!!editingId} // Disable deduction when editing
                >
                  <option value="" className="bg-[#1a1a1a]">Do not deduct funds</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} className="bg-[#1a1a1a]">
                      {acc.name} (Balance: {formatNum(acc.balance)})
                    </option>
                  ))}
                </select>
                {/* Custom arrow for select */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#666]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Mode Header (Fixed) */}
              <div className={`p-2 rounded-sm text-center text-[11px] font-bold tracking-widest uppercase mb-4 shadow-sm border ${
                formData.trade_type === 'buy' 
                ? "bg-[#4caf501a] text-[#4caf50] border-[#4caf5033]" 
                : "bg-[#df514c1a] text-[#df514c] border-[#df514c33]"
              }`}>
                {formData.trade_type === 'buy' ? 'Buy Equity' : 'Sell Equity'}
              </div>

              {/* ── Zerodha Charges Breakdown ── */}
              {parseFloat(formData.quantity) > 0 && parseFloat(formData.buy_price) > 0 && (
                <div className="bg-[#1f1f1f] rounded-sm p-4 space-y-3 border border-[#252525] animate-fade-in shadow-xl">
                   <div className="flex justify-between items-center text-[10px] text-[#666] uppercase tracking-wide border-b border-[#252525] pb-2 mb-2">
                     <span>Zerodha Charges Breakdown</span>
                     <span className="text-[#387ed1] lowercase">Equity Delivery</span>
                   </div>
                   
                   <div className="space-y-2">
                     <div className="flex justify-between text-[11px]">
                       <span className="text-[#9b9b9b]">Equity Turnover</span>
                       <span className="text-[#eee]">₹{formatNum(zerodhaCharges.turnover)}</span>
                     </div>
                     <div className="flex justify-between text-[11px]">
                       <span className="text-[#9b9b9b]">Brokerage</span>
                       <span className="text-[#4caf50]">₹0.00</span>
                     </div>
                     <div className="flex justify-between text-[11px]">
                       <span className="text-[#9b9b9b]">STT/CTT (0.1%)</span>
                       <span className="text-[#eee]">₹{formatNum(zerodhaCharges.stt)}</span>
                     </div>
                     <div className="flex justify-between text-[11px]">
                       <span className="text-[#9b9b9b]">Exchange Txn Charges</span>
                       <span className="text-[#eee]">₹{formatNum(zerodhaCharges.txnCharge)}</span>
                     </div>
                     {formData.trade_type === "buy" && (
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[#9b9b9b]">Stamp Duty (0.015%)</span>
                         <span className="text-[#eee]">₹{formatNum(zerodhaCharges.stampDuty)}</span>
                       </div>
                     )}
                     {formData.trade_type === "sell" && (
                       <div className="flex justify-between text-[11px]">
                         <span className="text-[#9b9b9b]">DP Charges (incl. GST)</span>
                         <span className="text-[#eee]">₹{formatNum(zerodhaCharges.dpCharges)}</span>
                       </div>
                     )}
                     <div className="flex justify-between text-[11px]">
                       <span className="text-[#9b9b9b]">GST (18%)</span>
                       <span className="text-[#eee]">₹{formatNum(zerodhaCharges.gst)}</span>
                     </div>
                     <div className="flex justify-between text-[12px] pt-3 border-t border-[#333] font-bold">
                       <span className="text-[#eee]">{formData.trade_type === 'buy' ? 'TOTAL PAYABLE' : 'NET RECEIVABLE'}</span>
                       <span className={formData.trade_type === 'buy' ? 'text-[#df514c]' : 'text-[#4caf50]'}>₹{formatNum(zerodhaCharges.netAmount)}</span>
                     </div>
                   </div>
                   
                   <p className="text-[10px] text-[#666] italic text-center pt-1">
                     *Calculated based on Zerodha standard rates for {formData.exchange}
                   </p>
                </div>
              )}

              <button
                type="submit" disabled={submitting}
                className={`w-full h-12 text-white text-[13px] font-bold rounded-sm transition-all mt-2 uppercase tracking-widest shadow-lg ${
                  formData.trade_type === 'buy'
                  ? "bg-[#4caf50] hover:bg-[#43a047] shadow-[#4caf501a]"
                  : "bg-[#df514c] hover:bg-[#c64541] shadow-[#df514c1a]"
                }`}
              >
                {submitting ? "Processing..." : editingId ? "Update Record" : formData.trade_type}
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
