"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import type { Tables } from "@/lib/database.types";
import { toast } from "react-hot-toast";
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
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { getAccounts } from "../accounts/actions";
import { useSubmitLock } from "@/hooks/use-submit-lock";

type Stock = Tables<"investments"> & { total_charges?: number; pnlPercent?: number };

type Account = {
  id: string;
  name: string;
  balance: number;
  currency: string;
};

type SortKey = "name" | "pnl" | "pnlPercent" | "current_value" | "quantity";
type SortDir = "asc" | "desc";

function formatNum(val: number, decimals = 2): string {
  return val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function StocksClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { investments, accounts, stockTrades: trades }, isValidating, isLoading } = useFinanceData(initialData);
  const stocks = useMemo(() => investments.filter(i => i.type === "stock") as Stock[], [investments]);
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams?.get("action") === "new");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, withLock] = useSubmitLock();
  const [showAllCharges, setShowAllCharges] = useState(false);
  const [showChargesInForm, setShowChargesInForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [expandedHolding, setExpandedHolding] = useState<string | null>(null);

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

  // Calculate portfolio analytics
  const analytics = useMemo(() => {
    const sectorMap: Record<string, number> = {};
    const topGainers: Array<Stock & { pnlPct: number }> = [];
    const topLosers: Array<Stock & { pnlPct: number }> = [];
    
    filtered.forEach(inv => {
      const invested = inv.buy_price * inv.quantity;
      const currentVal = inv.current_price * inv.quantity;
      const pnl = currentVal - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      
      // Simple sector classification (you can enhance this)
      const sector = inv.name.includes('Bank') || inv.name.includes('Financial') ? 'Banking' :
                     inv.name.includes('IT') || inv.name.includes('Tech') ? 'Technology' :
                     inv.name.includes('Pharma') || inv.name.includes('Health') ? 'Healthcare' :
                     inv.name.includes('Auto') ? 'Automotive' : 'Others';
      
      sectorMap[sector] = (sectorMap[sector] || 0) + currentVal;
      
      if (pnlPct > 0) topGainers.push({ ...inv, pnlPct });
      else topLosers.push({ ...inv, pnlPct });
    });
    
    topGainers.sort((a, b) => (b.pnlPct || 0) - (a.pnlPct || 0));
    topLosers.sort((a, b) => (a.pnlPct || 0) - (b.pnlPct || 0));
    
    return {
      sectors: Object.entries(sectorMap).map(([name, value]) => ({ name, value })),
      topGainers: topGainers.slice(0, 5),
      topLosers: topLosers.slice(0, 5)
    };
  }, [filtered]);

  // If analytics is shown, render only analytics page
  if (showAnalytics) {
    return (
      <div className="fixed inset-0 z-[300] bg-[--bg-base] overflow-y-auto animate-fade-in">
        <div className="max-w-[1280px] mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[--text-primary]">Portfolio Analytics</h1>
              <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Insights & Performance</p>
            </div>
            <button 
              onClick={() => setShowAnalytics(false)} 
              className="btn-secondary !h-11 !px-6 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Holdings
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-card-static p-6">
              <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] mb-2">Total Holdings</p>
              <p className="text-2xl font-black">{filtered.length}</p>
            </div>
            <div className="glass-card-static p-6">
              <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] mb-2">Invested</p>
              <p className="text-2xl font-black">₹{totalInvested.toLocaleString()}</p>
            </div>
            <div className="glass-card-static p-6">
              <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] mb-2">Current Value</p>
              <p className="text-2xl font-black">₹{totalCurrent.toLocaleString()}</p>
            </div>
            <div className="glass-card-static p-6">
              <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] mb-2">Overall P&L</p>
              <div className="flex flex-col">
                <p className={`text-2xl font-black ${totalPnL >= 0 ? 'text-[--success]' : 'text-[--danger]'}`}>
                  {totalPnL >= 0 ? '+' : ''}₹{Math.abs(totalPnL).toLocaleString()}
                </p>
                <p className={`text-sm font-bold mt-1 ${totalPnL >= 0 ? 'text-[--success]' : 'text-[--danger]'} opacity-70`}>
                  {totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Sector Exposure */}
          {analytics.sectors.length > 0 && (
            <div className="glass-card-static p-8 mb-6">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] mb-6">Sector Exposure</h3>
              <div className="space-y-4">
                {analytics.sectors.map((sector, idx) => {
                  const percentage = (sector.value / totalCurrent) * 100;
                  return (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[13px] font-bold text-[--text-primary]">{sector.name}</span>
                        <span className="text-[12px] font-black text-[--text-muted]">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[--accent-primary] to-[--accent-primary-light] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Gainers & Losers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Top Gainers */}
            <div className="glass-card-static p-8">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--success] mb-6 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Top Gainers
              </h3>
              <div className="space-y-4">
                {analytics.topGainers.slice(0, 5).map((inv, idx) => {
                  const invested = inv.buy_price * inv.quantity;
                  const currentVal = inv.current_price * inv.quantity;
                  const pnl = currentVal - invested;
                  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                  return (
                    <div key={idx} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-[14px] font-bold text-[--text-primary]">{inv.symbol?.split('.')[0]}</p>
                        <p className="text-[11px] text-[--text-muted] mt-0.5">{inv.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-black text-[--success]">+{pnlPct.toFixed(2)}%</p>
                        <p className="text-[11px] text-[--success] mt-0.5">+₹{pnl.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Losers */}
            <div className="glass-card-static p-8">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--danger] mb-6 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                Top Losers
              </h3>
              <div className="space-y-4">
                {analytics.topLosers.slice(0, 5).map((inv, idx) => {
                  const invested = inv.buy_price * inv.quantity;
                  const currentVal = inv.current_price * inv.quantity;
                  const pnl = currentVal - invested;
                  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                  return (
                    <div key={idx} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-[14px] font-bold text-[--text-primary]">{inv.symbol?.split('.')[0]}</p>
                        <p className="text-[11px] text-[--text-muted] mt-0.5">{inv.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-black text-[--danger]">{pnlPct.toFixed(2)}%</p>
                        <p className="text-[11px] text-[--danger] mt-0.5">₹{pnl.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Portfolio Breakdown */}
          <div className="glass-card-static p-8">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] mb-6">Complete Portfolio Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stocks.filter(s => Number(s.quantity) > 0).map((stock) => {
                const invested = Number(stock.buy_price) * Number(stock.quantity);
                const current = Number(stock.current_price) * Number(stock.quantity);
                const pnl = current - invested;
                const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
                
                return (
                  <div key={stock.id} className="glass-card-static p-5 hover:bg-white/[0.02] transition-all border border-white/5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[14px] font-bold text-[--text-primary]">{stock.symbol?.split('.')[0]}</p>
                        <p className="text-[10px] text-[--text-muted] mt-1 line-clamp-1">{stock.name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[14px] font-black ${pnl >= 0 ? 'text-[--success]' : 'text-[--danger]'}`}>
                          {pnl >= 0 ? '+' : ''}₹{Math.abs(pnl).toLocaleString()}
                        </p>
                        <p className={`text-[10px] font-bold ${pnl >= 0 ? 'text-[--success]' : 'text-[--danger]'} opacity-70`}>
                          {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <p className="text-[--text-muted] mb-1">Invested</p>
                        <p className="font-bold text-[--accent-primary]">₹{invested.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[--text-muted] mb-1">Current</p>
                        <p className="font-bold text-[--success]">₹{current.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-[--text-muted]">
                      <span className="font-bold">{stock.quantity}</span> shares @ ₹{Number(stock.current_price).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 text-[--text-primary] py-6" style={{ maxWidth: "1250px", margin: "0 auto", width: "100%", paddingBottom: "100px" }}>
      
      {/* ── Portfolio Overview Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 mb-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[--text-primary]">Stocks Portfolio</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Live Asset Tracking</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Auto refresh enabled */}
            <button 
              onClick={() => setShowAnalytics(true)} 
              className="btn-secondary !h-11 !px-6 flex items-center gap-2"
              title="View Analytics"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </button>
            <button 
              onClick={exportHoldings} 
              className="btn-secondary !h-11 !px-6 flex items-center gap-2"
              title="Export Holdings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
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
            {/* Desktop Table */}
            <table className="hidden md:table w-full text-left border-collapse">
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
                             <span className="text-[13px] font-medium text-[--text-primary]">{inv.symbol?.split('.')[0] || inv.name}</span>
                          </div>
                          <span className="text-[10px] text-[--text-muted] font-normal">{inv.name}</span>
                        </div>
                        <div className="absolute left-0 top-0 bottom-0 flex items-center bg-[--bg-elevated] px-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto shadow-xl">
                          <button onClick={() => startSell(inv)} className="h-7 px-3 bg-[--danger]/10 hover:bg-[--danger] text-[--danger] hover:text-white text-[11px] font-bold rounded transition-colors mr-2 uppercase tracking-tight">SELL</button>
                          <button onClick={() => startEdit(inv)} className="h-7 px-3 bg-[--accent-primary]/10 hover:bg-[--accent-primary] text-[--accent-primary-light] hover:text-white text-[11px] font-medium rounded transition-colors">EDIT</button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-secondary]">{inv.quantity}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-secondary]">{formatNum(inv.buy_price)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-primary] font-normal">{formatNum(inv.current_price)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-primary]">{formatNum(currentVal)}</td>
                      <td className={`py-4 px-4 text-right tabular-nums text-[13px] font-medium ${isProfit ? "text-[--success]" : "text-[--danger]"}`}>{formatNum(pnl)}</td>
                      <td className="py-4 px-4 text-right tabular-nums">
                        <div className="flex flex-col items-end">
                           <span className={`text-[12px] font-medium ${inv.day_change !== null && inv.day_change >= 0 ? "text-[--success]" : "text-[--danger]"}`}>{inv.day_change !== null ? (inv.day_change > 0 ? "+" : "") + formatNum(inv.day_change) : "—"}</span>
                           <span className={`text-[10px] font-bold ${inv.day_change_percent !== null && inv.day_change_percent >= 0 ? "text-[--success]" : "text-[--danger]"}`}>{inv.day_change_percent !== null ? (inv.day_change_percent > 0 ? "+" : "") + Number(inv.day_change_percent).toFixed(2) + "%" : ""}</span>
                        </div>
                      </td>
                      <td className={`py-4 px-4 text-right tabular-nums text-[13px] font-medium ${isProfit ? "text-[--success]" : "text-[--danger]"}`}>{isProfit ? "+" : ""}{pnlPct.toFixed(2)}%</td>
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
                             <div className={`text-[15px] font-black ${isProfit ? "text-[--success]" : "text-[--danger]"}`}>
                                {isProfit ? "+" : ""}₹{formatNum(pnl)}
                             </div>
                             <div className={`text-[10px] font-bold opacity-60 ${isProfit ? "text-[--success]" : "text-[--danger]"}`}>
                                {isProfit ? "+" : ""}{pnlPct.toFixed(2)}%
                             </div>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-y-4 border-t border-white/5 pt-4 mb-4">
                          <div><p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Holding</p><p className="text-[13px] font-black">{inv.quantity} <span className="opacity-40 font-bold ml-1">@ ₹{formatNum(inv.buy_price)}</span></p></div>
                          <div className="text-right"><p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Current Value</p><p className="text-[13px] font-black">₹{formatNum(currentVal)}</p></div>
                          <div><p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-1">LTP</p><p className="text-[13px] font-black">₹{formatNum(inv.current_price)}</p></div>
                          <div className="text-right">
                             <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-1">Day Return</p>
                             <p className={`text-[13px] font-black ${inv.day_change && inv.day_change >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                                {inv.day_change ? (inv.day_change > 0 ? "+" : "") + formatNum(inv.day_change) : "—"}
                             </p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => startSell(inv)} className="flex-1 py-3 bg-[--danger]/10 text-[--danger] text-[10px] font-black uppercase tracking-widest rounded-xl active:bg-[--danger]/20">Exit Position</button>
                          <button onClick={() => startEdit(inv)} className="flex-1 py-3 bg-white/5 text-[--text-muted] text-[10px] font-black uppercase tracking-widest rounded-xl">View Details</button>
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
              <tbody>
                {trades.filter(t => 
                  t.symbol?.toLowerCase().includes(search.toLowerCase()) ||
                  t.trade_type?.toLowerCase().includes(search.toLowerCase())
                ).map((trade) => (
                  <tr key={trade.id} className="border-b border-[--border-default] hover:bg-[--bg-elevated] transition-all">
                    <td className="py-4 px-4 text-[12px] text-[--text-muted]">{trade.trade_date ? new Date(trade.trade_date).toLocaleDateString() : "N/A"}</td>
                    <td className="py-4 px-4">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-tighter ${trade.trade_type === 'buy' ? 'bg-[--success]/10 text-[--success]' : 'bg-[--danger]/10 text-[--danger]'}`}>
                        {trade.trade_type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[13px] font-medium text-[--text-primary]">{trade.symbol.split('.')[0]}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-secondary]">{trade.quantity}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-secondary]">{formatNum(trade.price)}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[11px] text-[--danger]">₹{formatNum(trade.charges ?? 0)}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-[13px] text-[--text-primary] font-medium">₹{formatNum(trade.total_amount)}</td>
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
                <div className="relative">
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
                  className="flex-1 h-10 bg-[--danger] text-white text-xs font-medium rounded-sm hover:bg-[--danger-light] transition-colors"
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
