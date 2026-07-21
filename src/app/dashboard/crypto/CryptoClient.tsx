"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import { getColorByLabel } from "@/lib/chart-colours";
import {
  createCryptoHolding,
  updateCryptoHolding,
  deleteCryptoHolding,
  fetchBinancePrice,
  refreshAllCryptoPrices,
  searchCrypto
} from "./actions";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

type CryptoAsset = {
  id: string;
  name: string;
  symbol: string | null;
  quantity: number;
  buy_price: number;
  current_price: number;
  currency: string;
  notes: string | null;
  bought_at: string | null;
  day_change?: number;
  day_change_percent?: number;
  previous_close?: number;
};

// Autocomplete list of popular coins with default names
const POPULAR_COINS = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "BNB", name: "Binance Coin" },
  { symbol: "XRP", name: "Ripple" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "SUI", name: "Sui" },
  { symbol: "PEPE", name: "Pepe" },
];

export default function CryptoClient() {
  const { data: { investments, accounts }, mutate } = useFinanceData();
  const [submitting, withLock] = useSubmitLock();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeTab, setActiveTab] = useState<"dashboard" | "holdings" | "transactions">("dashboard");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingSingle, setIsFetchingSingle] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchCrypto(searchQuery);
      setSearchResults(res);
      setShowSearchDropdown(true);
      setIsSearching(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    quantity: "",
    buy_price: "",
    current_price: "",
    notes: "",
    bought_at: new Date().toISOString().split("T")[0],
    deduct_from_account: "",
    trade_type: "buy" as "buy" | "sell"
  });

  const [charges, setCharges] = useState("0");

  // Filter holdings of type crypto
  const cryptoHoldings = useMemo(() => {
    return (investments || []).filter(i => i.type === "crypto") as unknown as CryptoAsset[];
  }, [investments]);

  // Active holdings (qty > 0)
  const activeHoldings = useMemo(() =>
    cryptoHoldings.filter(c => Number(c.quantity) > 0),
    [cryptoHoldings]
  );

  // Set default account when modal opens
  useEffect(() => {
    if (accounts.length > 0 && showModal && !formData.deduct_from_account) {
      const usdAcc = accounts.find(a => a.currency === "USD");
      setFormData(prev => ({
        ...prev,
        deduct_from_account: usdAcc ? usdAcc.id : accounts[0].id
      }));
    }
  }, [accounts, showModal, formData.deduct_from_account]);

  // Auto refresh live prices on mount if holdings exist
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (activeHoldings.length > 0 && !refreshedRef.current) {
      refreshedRef.current = true;
      const today = new Date().toISOString().split("T")[0];
      if (localStorage.getItem("last_crypto_refresh") !== today) {
        localStorage.setItem("last_crypto_refresh", today);
        handleRefreshPrices();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHoldings.length]);

  // ─── Real-Time Batch Refresh ───────────────────────────────────────────────
  const handleRefreshPrices = async () => {
    setIsRefreshing(true);
    try {
      const res = await refreshAllCryptoPrices();
      if (res.error) {
        toast.error(res.error);
      } else if (res.updated > 0) {
        toast.success(`Refreshed prices for ${res.updated} crypto holdings!`);
        mutate();
      } else {
        toast.success("Prices are up to date.");
      }
    } catch {
      toast.error("Failed to refresh prices.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─── Auto-Fetch Single LTP on Coin Selection/Entry ────────────────────────
  const handleFetchSinglePrice = async (sym: string) => {
    if (!sym) return;
    setIsFetchingSingle(true);
    try {
      const res = await fetchBinancePrice(sym);
      if (res.price !== undefined) {
        setFormData(prev => ({
          ...prev,
          buy_price: prev.buy_price || res.price!.toString(),
          current_price: res.price!.toString()
        }));
        toast.success(`Fetched live price for ${sym.toUpperCase()}: $${res.price}`);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to fetch live price.");
    } finally {
      setIsFetchingSingle(false);
    }
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const openNewModal = () => {
    setEditingId(null);
    setSearchQuery("");
    setFormData({
      name: "",
      symbol: "",
      quantity: "",
      buy_price: "",
      current_price: "",
      notes: "",
      bought_at: new Date().toISOString().split("T")[0],
      deduct_from_account: "",
      trade_type: "buy"
    });
    setCharges("0");
    setShowModal(true);
  };

  const handleCoinChipClick = async (coin: { symbol: string; name: string }) => {
    setFormData(prev => ({
      ...prev,
      symbol: coin.symbol,
      name: coin.name
    }));
    await handleFetchSinglePrice(coin.symbol);
  };

  const handleEdit = (holding: CryptoAsset) => {
    setEditingId(holding.id);
    setSearchQuery("");
    setFormData({
      name: holding.name || "",
      symbol: holding.symbol || "",
      quantity: holding.quantity.toString(),
      buy_price: holding.buy_price.toString(),
      current_price: holding.current_price.toString(),
      notes: holding.notes || "",
      bought_at: holding.bought_at || new Date().toISOString().split("T")[0],
      deduct_from_account: "",
      trade_type: "buy"
    });
    setCharges("0");
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this crypto holding?")) return;
    await withLock(async () => {
      const res = await deleteCryptoHolding(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Holding deleted");
        mutate();
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(formData.quantity);
    const buyPrice = parseFloat(formData.buy_price);
    const currPrice = parseFloat(formData.current_price);
    const fees = parseFloat(charges) || 0;

    if (isNaN(qty) || qty <= 0) return toast.error("Enter a valid quantity");
    if (isNaN(buyPrice) || buyPrice <= 0) return toast.error("Enter a valid buy price");
    if (isNaN(currPrice) || currPrice <= 0) return toast.error("Enter a valid current price");

    await withLock(async () => {
      if (editingId) {
        const res = await updateCryptoHolding(editingId, {
          name: formData.name || formData.symbol,
          symbol: formData.symbol,
          quantity: qty,
          buy_price: buyPrice,
          current_price: currPrice,
          notes: formData.notes,
          bought_at: formData.bought_at
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Holding updated successfully");
          setShowModal(false);
          setEditingId(null);
          mutate();
        }
      } else {
        if (!formData.deduct_from_account) {
          toast.error("Please select a channeling account");
          return;
        }
        const res = await createCryptoHolding({
          name: formData.name || formData.symbol,
          symbol: formData.symbol,
          quantity: qty,
          buy_price: buyPrice,
          current_price: currPrice,
          notes: formData.notes,
          bought_at: formData.bought_at,
          deduct_account_id: formData.deduct_from_account,
          trade_type: formData.trade_type,
          charges: fees
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(formData.trade_type === "buy" ? "Crypto purchased!" : "Crypto sold!");
          setShowModal(false);
          mutate();
        }
      }
    });
  };

  // ─── Stats & Allocation Calculations ───────────────────────────────────────
  const stats = useMemo(() => {
    const totalInvested = activeHoldings.reduce((s, i) => s + (Number(i.quantity) * Number(i.buy_price)), 0);
    const totalCurrent = activeHoldings.reduce((s, i) => s + (Number(i.quantity) * Number(i.current_price)), 0);
    const unrealizedPnL = totalCurrent - totalInvested;
    const totalRealizedPnL = cryptoHoldings.reduce((s, i) => s + Number((i as any).realized_pnl || 0), 0);
    const totalPnL = unrealizedPnL + totalRealizedPnL;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    const dayPnL = activeHoldings.reduce((s, i) => {
      const prevClose = Number(i.previous_close || i.current_price || 0);
      const dayChange = Number(i.current_price || 0) - prevClose;
      return s + (dayChange * Number(i.quantity || 0));
    }, 0);
    const prevDayValue = totalCurrent - dayPnL;
    const dayPnLPercent = prevDayValue > 0 ? (dayPnL / prevDayValue) * 100 : 0;

    return { totalInvested, totalCurrent, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent };
  }, [activeHoldings, cryptoHoldings]);

  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {};
    activeHoldings.forEach(c => {
      const sym = (c.symbol || c.name || "Unknown").toUpperCase();
      map[sym] = (map[sym] || 0) + (Number(c.quantity) * Number(c.current_price));
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      fill: getColorByLabel(name)
    })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [activeHoldings]);

  const formatMoney = (val: number) => {
    return "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex w-full bg-[var(--bg-base)] min-h-screen">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[var(--bg-card)]">
          <div className="flex items-center gap-6">
            <div className="flex gap-1.5 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === "dashboard"
                    ? "bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary)/0.35]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("holdings")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === "holdings"
                    ? "bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary)/0.35]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Holdings ({activeHoldings.length})
              </button>
              <button
                onClick={() => setActiveTab("transactions")}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                  activeTab === "transactions"
                    ? "bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-primary)/0.35]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Transactions
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshPrices}
              disabled={isRefreshing || activeHoldings.length === 0}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-50 flex items-center gap-2"
            >
              {isRefreshing ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
              Refresh Prices
            </button>
            <button
              onClick={openNewModal}
              className="bg-[var(--accent-primary)] hover:brightness-90 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md shadow-[var(--accent-primary)]/10"
            >
              Add Trade
            </button>
          </div>
        </div>

        {/* Dashboard View */}
        <div className="p-6 max-w-6xl w-full mx-auto space-y-6">
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mt-4">
              
              {/* Left: Allocation Donut */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center bg-[var(--bg-card)] p-8 border border-white/5 rounded-2xl relative">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 absolute top-6 left-6">Asset Allocation</h3>
                {mounted && pieChartData.length > 0 ? (
                  <div className="w-[300px] h-[300px] relative mt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={85} outerRadius={115} paddingAngle={2} dataKey="value" stroke="none">
                          {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-primary)", borderRadius: "12px" }}
                          itemStyle={{ color: "#fff", fontSize: "11px" }}
                          formatter={(value) => [`${formatMoney(Number(value))}`, "Value"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">Total Portfolio</span>
                      <span className="text-white text-3xl font-extrabold mt-1">
                        {formatMoney(stats.totalCurrent)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-500 text-xs font-medium">
                    No holdings to show.
                  </div>
                )}
              </div>

              {/* Right: Quick stats */}
              <div className="flex flex-col gap-4">
                <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Value</span>
                  <div>
                    <h2 className="text-3xl font-extrabold text-white mt-1">{formatMoney(stats.totalCurrent)}</h2>
                    <span className="text-xs text-gray-400">Current Market Valuation (USD)</span>
                  </div>
                </div>

                <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Invested Value</span>
                  <div>
                    <h2 className="text-2xl font-black text-gray-300 mt-1">{formatMoney(stats.totalInvested)}</h2>
                    <span className="text-xs text-gray-400">Total Purchase Cost Basis</span>
                  </div>
                </div>

                <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Unrealized P&L</span>
                  <div>
                    <h2 className={`text-2xl font-black mt-1 ${stats.totalPnL >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {stats.totalPnL >= 0 ? "+" : ""}{formatMoney(stats.totalPnL)} ({stats.totalPnLPercent.toFixed(2)}%)
                    </h2>
                    <span className="text-xs text-gray-400">All-Time Net Returns</span>
                  </div>
                </div>

                <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">24h Day Change</span>
                  <div>
                    <h2 className={`text-2xl font-black mt-1 ${stats.dayPnL >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {stats.dayPnL >= 0 ? "+" : ""}{formatMoney(stats.dayPnL)} ({stats.dayPnLPercent.toFixed(2)}%)
                    </h2>
                    <span className="text-xs text-gray-400">{"Today's Valuation Shift"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Holdings View */}
          {activeTab === "holdings" && (
            <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase font-bold text-gray-400 tracking-wider">
                      <th className="px-6 py-4">Asset</th>
                      <th className="px-6 py-4 text-right">Qty</th>
                      <th className="px-6 py-4 text-right">Avg Cost</th>
                      <th className="px-6 py-4 text-right">LTP (Live Price)</th>
                      <th className="px-6 py-4 text-right">Current Value</th>
                      <th className="px-6 py-4 text-right">Total P&L</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {activeHoldings.map((h) => {
                      const costBasis = Number(h.quantity) * Number(h.buy_price);
                      const currentVal = Number(h.quantity) * Number(h.current_price);
                      const pnl = currentVal - costBasis;
                      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                      
                      const ltp = Number(h.current_price);
                      const prevClose = Number(h.previous_close || ltp);
                      const isLtpUp = ltp >= prevClose;

                      return (
                        <tr key={h.id} className="hover:bg-white/[0.01] transition-colors text-xs text-white">
                          <td className="px-6 py-4 font-bold">
                            <div className="flex items-center gap-2">
                              <span className="p-1 bg-white/5 rounded border border-white/10 uppercase">{h.symbol}</span>
                              <span className="text-gray-400 text-xs">{h.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">{h.quantity}</td>
                          <td className="px-6 py-4 text-right text-gray-400">{formatMoney(Number(h.buy_price))}</td>
                          <td className={`px-6 py-4 text-right font-semibold ${isLtpUp ? "text-emerald-400" : "text-rose-400"}`}>
                            {formatMoney(ltp)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold">{formatMoney(currentVal)}</td>
                          <td className={`px-6 py-4 text-right font-extrabold ${pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {pnl >= 0 ? "+" : ""}{formatMoney(pnl)} ({pnlPercent.toFixed(2)}%)
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(h)}
                                className="text-xs bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white px-2.5 py-1 rounded transition-colors font-bold uppercase"
                              >
                                Modify
                              </button>
                              <button
                                onClick={() => handleDelete(h.id)}
                                className="text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-2.5 py-1 rounded transition-colors font-bold uppercase"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {activeHoldings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-500 text-xs font-semibold">
                          No crypto holdings found. Add a trade to get started!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions View */}
          {activeTab === "transactions" && (
            <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase font-bold text-gray-400 tracking-wider">
                      <th className="px-6 py-4">Asset</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Quantity</th>
                      <th className="px-6 py-4 text-right">Executed Price</th>
                      <th className="px-6 py-4 text-right">Gross Turn</th>
                      <th className="px-6 py-4 text-center">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {cryptoHoldings.map((h) => {
                      const gross = Number(h.quantity) * Number(h.buy_price);
                      return (
                        <tr key={h.id} className="hover:bg-white/[0.01] transition-colors text-xs text-white">
                          <td className="px-6 py-4 font-bold">
                            <div className="flex items-center gap-2">
                              <span className="p-1 bg-white/5 rounded border border-white/10 uppercase">{h.symbol}</span>
                              <span className="text-gray-400 text-xs">{h.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            {h.bought_at ? new Date(h.bought_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : "-"}
                          </td>
                          <td className="px-6 py-4 text-right font-medium">{h.quantity}</td>
                          <td className="px-6 py-4 text-right text-gray-400">{formatMoney(Number(h.buy_price))}</td>
                          <td className="px-6 py-4 text-right font-semibold">{formatMoney(gross)}</td>
                          <td className="px-6 py-4 text-center text-gray-500 italic max-w-[200px] truncate" title={h.notes || ""}>
                            {h.notes || "-"}
                          </td>
                        </tr>
                      );
                    })}
                    {cryptoHoldings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500 text-xs font-semibold">
                          No transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Order Ticket Drawer */}
        {showModal && (
          <Drawer
            isOpen={showModal}
            onClose={() => { setShowModal(false); setEditingId(null); }}
            title={editingId ? `Edit ${formData.symbol}` : "Order Ticket"}
          >
            <div className="p-0 -mx-6 -mt-6">
              <div className={`p-4 rounded-t flex items-center justify-between ${
                formData.trade_type === "buy" ? "bg-emerald-600" : "bg-rose-600"
              } text-white`}>
                <div>
                  <span className="text-base font-bold uppercase tracking-wider">{editingId ? "Modify" : formData.trade_type === "buy" ? "Buy" : "Sell"} {formData.symbol || "Asset"}</span>
                  <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded font-black tracking-widest">USDT</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-white/70">LTP</span>
                  <span className="ml-1 text-sm font-bold">${parseFloat(formData.current_price || "0").toFixed(2)}</span>
                </div>
              </div>

              <div className="p-5 space-y-5 bg-[var(--bg-card)]">
                
                {/* Search Crypto (if adding new from scratch) */}
                {!formData.symbol ? (
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Search Coin</label>
                    <div className="relative">
                      <input 
                        autoFocus
                        className="w-full bg-[#202020] border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-[#2185d0] placeholder-gray-500" 
                        placeholder="Search e.g. Bitcoin, BTC, Ethereum..."
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
                            onClick={async () => {
                              setFormData({...formData, symbol: res.symbol, name: res.name});
                              setSearchQuery("");
                              setShowSearchDropdown(false);
                              await handleFetchSinglePrice(res.symbol);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              {res.thumb && <img src={res.thumb} alt={res.symbol} className="w-6 h-6 rounded-full" />}
                              <div>
                                <div className="text-xs font-bold text-white">{res.symbol}</div>
                                <div className="text-xs text-gray-400 truncate max-w-[220px]">{res.name}</div>
                              </div>
                            </div>
                            <span className="text-[0.5625rem] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-semibold">Select</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected Crypto Card */
                  <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-white/[0.02] rounded-xl border border-white/5">💎</span>
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
                        Change Coin
                      </button>
                    )}
                  </div>
                )}

                {/* Form fields */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Hidden fields for auto-fetched data */}
                  <input type="hidden" value={formData.current_price} />
                  <input type="hidden" value={formData.symbol} />
                  <input type="hidden" value={formData.name} />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Quantity</label>
                      <input
                        required
                        type="number"
                        step="any"
                        className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                        inputMode="decimal"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Buy Price</label>
                      <input
                        required
                        type="number"
                        step="any"
                        className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]"
                        value={formData.buy_price}
                        onChange={e => setFormData({ ...formData, buy_price: e.target.value })}
                        inputMode="decimal"
                      />
                    </div>
                  </div>

                  {/* Action buttons switcher */}
                  {!editingId && (
                    <div className="flex gap-3 pt-3">
                      <button
                        type="submit"
                        onClick={() => setFormData({ ...formData, trade_type: "buy" })}
                        disabled={submitting}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs transition-colors uppercase tracking-wider disabled:opacity-50"
                      >
                        BUY
                      </button>
                      <button
                        type="submit"
                        onClick={() => setFormData({ ...formData, trade_type: "sell" })}
                        disabled={submitting}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded text-xs transition-colors uppercase tracking-wider disabled:opacity-50"
                      >
                        SELL
                      </button>
                    </div>
                  )}

                  {editingId && (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-[var(--accent-primary)] hover:brightness-95 text-white font-bold py-2.5 rounded text-xs transition-all uppercase tracking-wider disabled:opacity-50"
                    >
                      Update Holding
                    </button>
                  )}
                </form>
              </div>
            </div>
          </Drawer>
        )}
      </div>
    </div>
  );
}
