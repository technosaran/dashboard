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
    <div className="flex w-full bg-[#0B0E11] min-h-screen text-[#EAECSF] relative font-sans">
      {/* Background Ambient Binance Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-[#F0B90B]/5 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 -left-32 w-[550px] h-[550px] bg-[#0ECB81]/5 rounded-full blur-[160px]" />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        
        {/* Binance Pro Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-[#2B313A] bg-[#181A20] gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            {/* Binance Brand Icon */}
            <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center text-[#F0B90B] shadow-[0_0_15px_rgba(240,185,11,0.2)]">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 0l-4.5 4.5 4.5 4.5 4.5-4.5L12 0zm-7.5 7.5L0 12l4.5 4.5 4.5-4.5L4.5 7.5zm15 0l-4.5 4.5 4.5 4.5 4.5-4.5-4.5-4.5zM12 15l-4.5 4.5L12 24l4.5-4.5L12 15zm0-4.5L9.75 8.25 12 6l2.25 2.25L12 10.5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-wider uppercase">Binance Spot Portfolio</h1>
                <span className="text-[0.5625rem] bg-[#F0B90B]/20 text-[#F0B90B] border border-[#F0B90B]/30 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">PRO</span>
              </div>
              <p className="text-[0.6875rem] text-[#848E9C] font-semibold flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse" />
                Binance Live Data Feed • USDT Base Pair
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex gap-1 rounded-xl bg-[#0B0E11] border border-[#2B313A] p-1 shadow-inner">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-[#F0B90B] text-black shadow-[0_0_12px_rgba(240,185,11,0.4)]"
                    : "text-[#848E9C] hover:text-white hover:bg-white/5"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("holdings")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "holdings"
                    ? "bg-[#F0B90B] text-black shadow-[0_0_12px_rgba(240,185,11,0.4)]"
                    : "text-[#848E9C] hover:text-white hover:bg-white/5"
                }`}
              >
                Holdings ({activeHoldings.length})
              </button>
              <button
                onClick={() => setActiveTab("transactions")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "transactions"
                    ? "bg-[#F0B90B] text-black shadow-[0_0_12px_rgba(240,185,11,0.4)]"
                    : "text-[#848E9C] hover:text-white hover:bg-white/5"
                }`}
              >
                Order History
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshPrices}
                disabled={isRefreshing || activeHoldings.length === 0}
                className="bg-[#2B313A]/50 hover:bg-[#2B313A] border border-[#2B313A] text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isRefreshing ? (
                  <svg className="w-3.5 h-3.5 animate-spin text-[#F0B90B]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-[#F0B90B]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                )}
                Sync Prices
              </button>
              <button
                onClick={openNewModal}
                className="bg-[#F0B90B] hover:bg-[#fcd535] text-black font-extrabold px-4 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(240,185,11,0.25)] cursor-pointer"
              >
                + New Trade
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard View */}
        <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === "dashboard" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mt-2">
              
              {/* Left: Allocation Donut */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center bg-[#181A20] p-8 border border-[#2B313A] rounded-2xl relative shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#F0B90B] via-[#0ECB81] to-[#F6465D]" />
                <h3 className="text-xs font-bold text-[#848E9C] uppercase tracking-widest mb-6 absolute top-6 left-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#F0B90B]" />
                  Binance Asset Allocation
                </h3>
                {mounted && pieChartData.length > 0 ? (
                  <div className="w-[300px] h-[300px] relative mt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={85} outerRadius={115} paddingAngle={3} dataKey="value" stroke="none">
                          {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "#181A20", border: "1px solid #2B313A", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.8)" }}
                          itemStyle={{ color: "#F0B90B", fontSize: "12px", fontWeight: "bold" }}
                          formatter={(value) => [`${formatMoney(Number(value))}`, "USDT Value"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[#848E9C] text-xs uppercase tracking-widest font-black">Total Valuation</span>
                      <span className="text-white text-3xl font-extrabold tracking-tight mt-1">
                        {formatMoney(stats.totalCurrent)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-[280px] flex flex-col items-center justify-center text-[#848E9C] text-xs font-medium gap-3">
                    <span>No crypto holdings in Binance portfolio.</span>
                    <button
                      onClick={openNewModal}
                      className="bg-[#F0B90B] text-black font-extrabold px-4 py-2 rounded-lg text-xs uppercase tracking-wider hover:bg-[#fcd535] transition-all shadow-[0_0_15px_rgba(240,185,11,0.3)] cursor-pointer"
                    >
                      + Execute First Spot Trade
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Binance Spot Stats Cards */}
              <div className="flex flex-col gap-4">
                <div className="bg-[#181A20] border border-[#2B313A] rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#F0B90B]/5 rounded-bl-full pointer-events-none" />
                  <span className="text-[0.6875rem] font-bold text-[#848E9C] uppercase tracking-widest">Total Spot Balance (USDT)</span>
                  <div className="mt-2">
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">{formatMoney(stats.totalCurrent)}</h2>
                    <span className="text-xs text-[#0ECB81] font-bold mt-1 block">≈ 1.00000000 USDT Base</span>
                  </div>
                </div>

                <div className="bg-[#181A20] border border-[#2B313A] rounded-2xl p-6 flex flex-col justify-between shadow-xl">
                  <span className="text-[0.6875rem] font-bold text-[#848E9C] uppercase tracking-widest">Total Cost Basis</span>
                  <div className="mt-2">
                    <h2 className="text-2xl font-bold text-[#EAECSF]">{formatMoney(stats.totalInvested)}</h2>
                    <span className="text-xs text-[#848E9C]">Historical Purchase Capital</span>
                  </div>
                </div>

                <div className="bg-[#181A20] border border-[#2B313A] rounded-2xl p-6 flex flex-col justify-between shadow-xl">
                  <span className="text-[0.6875rem] font-bold text-[#848E9C] uppercase tracking-widest">Total P&L (Unrealized)</span>
                  <div className="mt-2">
                    <h2 className={`text-2xl font-extrabold ${stats.totalPnL >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                      {stats.totalPnL >= 0 ? "+" : ""}{formatMoney(stats.totalPnL)} ({stats.totalPnLPercent.toFixed(2)}%)
                    </h2>
                    <span className="text-xs text-[#848E9C]">All-Time Net Return</span>
                  </div>
                </div>

                <div className="bg-[#181A20] border border-[#2B313A] rounded-2xl p-6 flex flex-col justify-between shadow-xl">
                  <span className="text-[0.6875rem] font-bold text-[#848E9C] uppercase tracking-widest">24h Price Change</span>
                  <div className="mt-2">
                    <h2 className={`text-2xl font-extrabold ${stats.dayPnL >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                      {stats.dayPnL >= 0 ? "+" : ""}{formatMoney(stats.dayPnL)} ({stats.dayPnLPercent.toFixed(2)}%)
                    </h2>
                    <span className="text-xs text-[#848E9C]">24 Hours Spot Market Fluctuation</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Holdings View - Binance Spot Pairs */}
          {activeTab === "holdings" && (
            <div className="bg-[#181A20] border border-[#2B313A] rounded-2xl overflow-hidden shadow-2xl mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#2B313A] bg-[#0B0E11] text-[0.6875rem] uppercase font-extrabold text-[#848E9C] tracking-wider">
                      <th className="px-6 py-4">Spot Pair</th>
                      <th className="px-6 py-4 text-right">Holding Qty</th>
                      <th className="px-6 py-4 text-right">Avg Entry Price</th>
                      <th className="px-6 py-4 text-right">Binance LTP</th>
                      <th className="px-6 py-4 text-right">Total Value (USDT)</th>
                      <th className="px-6 py-4 text-right">Unrealized P&L</th>
                      <th className="px-6 py-4 text-center">Trade Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B313A]/50">
                    {activeHoldings.map((h) => {
                      const costBasis = Number(h.quantity) * Number(h.buy_price);
                      const currentVal = Number(h.quantity) * Number(h.current_price);
                      const pnl = currentVal - costBasis;
                      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                      
                      const ltp = Number(h.current_price);
                      const prevClose = Number(h.previous_close || ltp);
                      const isLtpUp = ltp >= prevClose;

                      return (
                        <tr key={h.id} className="hover:bg-[#2B313A]/30 transition-colors text-xs text-white">
                          <td className="px-6 py-4 font-bold">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded font-black tracking-wider uppercase text-xs">
                                {h.symbol}/USDT
                              </span>
                              <span className="text-[#848E9C] text-xs font-medium">{h.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-white">{h.quantity}</td>
                          <td className="px-6 py-4 text-right font-mono text-[#848E9C]">{formatMoney(Number(h.buy_price))}</td>
                          <td className={`px-6 py-4 text-right font-mono font-bold ${isLtpUp ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                            {formatMoney(ltp)}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-extrabold text-white">{formatMoney(currentVal)}</td>
                          <td className={`px-6 py-4 text-right font-mono font-black ${pnl >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                            {pnl >= 0 ? "+" : ""}{formatMoney(pnl)} ({pnlPercent.toFixed(2)}%)
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(h)}
                                className="text-xs bg-[#2B313A] hover:bg-[#363D47] text-white px-2.5 py-1 rounded-md transition-colors font-bold uppercase cursor-pointer"
                              >
                                Modify
                              </button>
                              <button
                                onClick={() => handleDelete(h.id)}
                                className="text-xs bg-[#F6465D]/10 text-[#F6465D] hover:bg-[#F6465D] hover:text-white px-2.5 py-1 rounded-md transition-colors font-bold uppercase cursor-pointer"
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
                        <td colSpan={7} className="text-center py-12 text-[#848E9C] text-xs font-semibold">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <span>No active spot holdings found. Execute a trade to get started!</span>
                            <button
                              onClick={openNewModal}
                              className="bg-[#F0B90B] text-black font-extrabold px-4 py-2 rounded-lg text-xs uppercase tracking-wider hover:bg-[#fcd535] transition-all shadow-[0_0_15px_rgba(240,185,11,0.3)] cursor-pointer"
                            >
                              + Place Spot Order
                            </button>
                          </div>
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
            <div className="bg-[#181A20] border border-[#2B313A] rounded-2xl overflow-hidden shadow-2xl mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#2B313A] bg-[#0B0E11] text-[0.6875rem] uppercase font-extrabold text-[#848E9C] tracking-wider">
                      <th className="px-6 py-4">Spot Pair</th>
                      <th className="px-6 py-4">Execution Date</th>
                      <th className="px-6 py-4 text-right">Executed Quantity</th>
                      <th className="px-6 py-4 text-right">Executed Price (USDT)</th>
                      <th className="px-6 py-4 text-right">Gross Turn</th>
                      <th className="px-6 py-4 text-center">Order Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B313A]/50">
                    {cryptoHoldings.map((h) => {
                      const gross = Number(h.quantity) * Number(h.buy_price);
                      return (
                        <tr key={h.id} className="hover:bg-[#2B313A]/30 transition-colors text-xs text-white">
                          <td className="px-6 py-4 font-bold">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 rounded font-black tracking-wider uppercase text-xs">
                                {h.symbol}/USDT
                              </span>
                              <span className="text-[#848E9C] text-xs font-medium">{h.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#848E9C]">
                            {h.bought_at ? new Date(h.bought_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : "-"}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold">{h.quantity}</td>
                          <td className="px-6 py-4 text-right font-mono text-[#848E9C]">{formatMoney(Number(h.buy_price))}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-white">{formatMoney(gross)}</td>
                          <td className="px-6 py-4 text-center text-[#848E9C] italic max-w-[200px] truncate" title={h.notes || ""}>
                            {h.notes || "-"}
                          </td>
                        </tr>
                      );
                    })}
                    {cryptoHoldings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-[#848E9C] text-xs font-semibold">
                          No order execution history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Binance Order Ticket Drawer */}
        {showModal && (
          <Drawer
            isOpen={showModal}
            onClose={() => { setShowModal(false); setEditingId(null); }}
            title={editingId ? `Binance Spot Order - Edit ${formData.symbol}/USDT` : "Binance Spot Order Ticket"}
          >
            <div className="p-0 -mx-6 -mt-6">
              {/* Binance Trade Header */}
              <div className={`p-4 rounded-t flex items-center justify-between ${
                formData.trade_type === "buy" ? "bg-[#0ECB81]" : "bg-[#F6465D]"
              } text-black font-extrabold`}>
                <div>
                  <span className="text-base font-black uppercase tracking-wider">{editingId ? "Modify" : formData.trade_type === "buy" ? "Buy Spot" : "Sell Spot"} {formData.symbol || "Crypto"}</span>
                  <span className="ml-2 text-xs bg-black/20 text-white px-1.5 py-0.5 rounded font-black tracking-widest">USDT PAIR</span>
                </div>
                <div className="text-right text-white">
                  <span className="text-[0.65rem] text-white/70 uppercase font-black block">Binance LTP</span>
                  <span className="text-sm font-black">${parseFloat(formData.current_price || "0").toFixed(2)}</span>
                </div>
              </div>

              <div className="p-5 space-y-5 bg-[#181A20] text-white">
                
                {/* Search Crypto / Popular Coins / Manual Entry */}
                {!formData.symbol ? (
                  <div className="space-y-3 relative">
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-bold text-[#848E9C] uppercase tracking-wide">Search Binance Coin / Ticker</label>
                      <div className="relative">
                        <input 
                          autoFocus
                          className="w-full bg-[#0B0E11] border border-[#2B313A] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#F0B90B] placeholder-[#848E9C]" 
                          placeholder="Search e.g. Bitcoin, BTC, Ethereum..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                        />
                        {isSearching && (
                          <div className="absolute right-3 top-2.5">
                            <svg className="w-3.5 h-3.5 animate-spin text-[#F0B90B]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                          </div>
                        )}
                      </div>

                      {showSearchDropdown && searchResults.length > 0 && (
                        <div className="absolute z-[120] left-0 right-0 top-[100%] mt-1 bg-[#181A20] border border-[#2B313A] rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                          {searchResults.map((res, i) => (
                            <div 
                              key={i} 
                              className="px-3 py-2 hover:bg-[#2B313A] cursor-pointer transition-colors border-b border-[#2B313A]/50 last:border-0 flex items-center justify-between"
                              onClick={async () => {
                                setFormData({...formData, symbol: res.symbol, name: res.name});
                                setSearchQuery("");
                                setShowSearchDropdown(false);
                                await handleFetchSinglePrice(res.symbol);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {res.thumb && <img src={res.thumb} alt={res.symbol} className="w-6 h-6 rounded-full" />}
                                <div>
                                  <div className="text-xs font-bold text-[#F0B90B]">{res.symbol}/USDT</div>
                                  <div className="text-xs text-[#848E9C] truncate max-w-[220px]">{res.name}</div>
                                </div>
                              </div>
                              <span className="text-[0.5625rem] bg-[#F0B90B]/20 text-[#F0B90B] px-1.5 py-0.5 rounded font-extrabold uppercase">Select</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Popular Coin Quick Select Chips */}
                    <div className="space-y-1.5">
                      <label className="text-[0.65rem] font-bold text-[#848E9C] uppercase tracking-wider">Binance Top Spot Markets</label>
                      <div className="flex flex-wrap gap-1.5">
                        {POPULAR_COINS.map(coin => (
                          <button
                            key={coin.symbol}
                            type="button"
                            onClick={() => handleCoinChipClick(coin)}
                            className="text-xs bg-[#0B0E11] hover:bg-[#F0B90B]/20 border border-[#2B313A] hover:border-[#F0B90B]/50 text-white hover:text-[#F0B90B] px-2.5 py-1 rounded-lg transition-all font-semibold cursor-pointer"
                          >
                            {coin.symbol}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual Token / Custom Coin Input */}
                    <div className="pt-2 border-t border-[#2B313A]">
                      <details className="group" open={Boolean(formData.symbol)}>
                        <summary className="text-xs text-[#848E9C] hover:text-[#F0B90B] cursor-pointer font-bold select-none">
                          Or enter custom crypto token details →
                        </summary>
                        <div className="mt-2 space-y-3 p-3 bg-[#0B0E11] border border-[#2B313A] rounded-xl">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[0.65rem] font-bold text-[#848E9C] uppercase">Ticker Symbol *</label>
                              <input
                                type="text"
                                className="w-full bg-[#181A20] border border-[#2B313A] rounded px-2.5 py-1.5 text-xs text-white outline-none uppercase focus:border-[#F0B90B]"
                                placeholder="e.g. SOL"
                                value={formData.symbol}
                                onChange={e => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                              />
                            </div>
                            <div>
                              <label className="text-[0.65rem] font-bold text-[#848E9C] uppercase">Coin Name *</label>
                              <input
                                type="text"
                                className="w-full bg-[#181A20] border border-[#2B313A] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#F0B90B]"
                                placeholder="e.g. Solana"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                ) : (
                  /* Selected Crypto Card */
                  <div className="bg-[#0B0E11] border border-[#2B313A] p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-[#F0B90B]/10 rounded-xl border border-[#F0B90B]/20">💎</span>
                      <div>
                        <p className="text-xs font-black text-[#F0B90B]">{formData.symbol}/USDT</p>
                        <p className="text-xs text-[#848E9C] font-medium">{formData.name}</p>
                      </div>
                    </div>
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, symbol: "", name: "" }));
                        }}
                        className="text-xs bg-[#F6465D]/10 text-[#F6465D] hover:bg-[#F6465D] hover:text-white px-2 py-1 rounded transition-all font-bold cursor-pointer"
                      >
                        Change Market
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
                      <label className="text-xs font-bold text-[#848E9C] uppercase tracking-wide">Order Quantity</label>
                      <input
                        required
                        type="number"
                        step="any"
                        className="w-full bg-[#0B0E11] border border-[#2B313A] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#F0B90B]"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                        inputMode="decimal"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#848E9C] uppercase tracking-wide">Buy Price (USDT)</label>
                      <input
                        required
                        type="number"
                        step="any"
                        className="w-full bg-[#0B0E11] border border-[#2B313A] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#F0B90B]"
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
                        className="flex-1 bg-[#0ECB81] hover:bg-[#0bb774] text-black font-extrabold py-2.5 rounded-lg text-xs transition-colors uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                      >
                        BUY SPOT ({formData.symbol || "COIN"})
                      </button>
                      <button
                        type="submit"
                        onClick={() => setFormData({ ...formData, trade_type: "sell" })}
                        disabled={submitting}
                        className="flex-1 bg-[#F6465D] hover:bg-[#e03a50] text-white font-extrabold py-2.5 rounded-lg text-xs transition-colors uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                      >
                        SELL SPOT ({formData.symbol || "COIN"})
                      </button>
                    </div>
                  )}

                  {editingId && (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-[#F0B90B] hover:bg-[#fcd535] text-black font-extrabold py-2.5 rounded-lg text-xs transition-all uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                    >
                      Update Binance Spot Holding
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
