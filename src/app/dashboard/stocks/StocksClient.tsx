"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { createInvestment, updateInvestment } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

import StocksDataTable from "./components/StocksDataTable";
import PnLValue from "@/components/pnl-value";

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
  const { data: { investments, accounts, stockTrades: trades, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "holdings">("overview");

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

    let bestStock = null;
    let bestPnL = -Infinity;
    activeStocks.forEach(s => {
      const inv = Number(s.quantity) * Number(s.buy_price);
      const cur = Number(s.quantity) * Number(s.current_price);
      const p = inv > 0 ? ((cur - inv) / inv) * 100 : 0;
      if (p > bestPnL) {
        bestPnL = p;
        bestStock = s.symbol || s.name;
      }
    });

    return { totalInvested, totalCurrent, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent, bestStock, bestPnL };
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
    })).sort((a, b) => b.value - a.value).slice(0, 10); // Top 10 for pie
  }, [activeStocks]);

  const barChartData = useMemo(() => {
    return activeStocks.map(s => {
      const invested = Number(s.quantity) * Number(s.buy_price);
      const current = Number(s.quantity) * Number(s.current_price);
      return {
        name: s.symbol || s.name.substring(0, 10),
        Invested: invested,
        Current: current,
        PnL: current - invested
      };
    }).sort((a, b) => b.Current - a.Current).slice(0, 10);
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

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
    return `₹${value.toLocaleString()}`;
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Stocks</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Equity Portfolio</p>
        </div>
        <button type="button" onClick={() => { 
          setFormData({
            name: "", symbol: "", quantity: "", buy_price: "", current_price: "",
            currency: "INR", notes: "", bought_at: new Date().toISOString().split("T")[0],
            deduct_from_account: "", trade_type: "buy"
          });
          setEditingId(null);
          setShowAddModal(true); 
        }} disabled={submitting} className="btn-primary !h-11 px-6 shadow-[0_0_30px_rgba(14,165,233,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Record Trade
        </button>
      </div>

      {activeStocks.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-emerald-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <span className="text-3xl">🏢</span>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">No Stocks</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">You haven't invested in any stocks yet. Add your holdings to track performance.</p>
          <div className="mt-8 flex justify-center">
             <button onClick={() => setShowAddModal(true)} className="btn-primary">Record First Trade</button>
          </div>
        </div>
      ) : (
      <>
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Invested</p>
            <p className="text-2xl md:text-3xl font-black text-white">₹{stats.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Capital Deployed</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Current Value</p>
            <p className="text-2xl md:text-3xl font-black text-[--accent-primary-light]">₹{stats.totalCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Market Value</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Returns</p>
            <PnLValue amount={stats.totalPnL} percentage={stats.totalPnLPercent} size="lg" showIcon />
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Unrealized P&L</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">1D Returns</p>
            <PnLValue amount={stats.dayPnL} percentage={stats.dayPnLPercent} size="lg" showIcon />
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Daily Change</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Top Gainer</p>
            <p className="text-xl md:text-2xl font-black text-emerald-400 truncate" title={stats.bestStock || ""}>
              {stats.bestPnL > -Infinity ? `${stats.bestPnL.toFixed(1)}%` : "N/A"}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60 truncate" title={stats.bestStock || ""}>
              {stats.bestStock ? stats.bestStock : "No Data"}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveView("overview")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${
              activeView === "overview"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView("holdings")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeView === "holdings"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Portfolio
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">
              {activeStocks.length}
            </span>
          </button>
        </div>

        {/* View Content */}
        {activeView === "overview" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Invested vs Current Bar Chart */}
              <div className="glass-card-static p-6 lg:col-span-2 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Stock Performance (Top 10)</h3>
                    <p className="text-2xl font-black mt-2 text-white">Invested vs Current</p>
                  </div>
                </div>
                <div className="flex-1 min-h-[250px] w-full mt-4 -ml-4">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} width={100} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontWeight: "bold" }}
                          formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, ""]}
                        />
                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                        <Bar dataKey="Invested" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Current" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Allocation Pie Chart */}
              <div className="glass-card-static p-6 flex flex-col items-center justify-center relative min-h-[400px]">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Top Holdings Allocation</h3>
                <div className="w-full h-[250px] mt-8">
                  {mounted && pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                          {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />)}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                          itemStyle={{ color: "#fff", fontWeight: "bold" }}
                          formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Value"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                       <span className="text-3xl mb-2">📊</span>
                       <span className="text-xs uppercase tracking-widest font-black">No Data</span>
                    </div>
                  )}
                </div>
                {pieChartData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
                    {pieChartData.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                        <span className="text-[--text-secondary] font-medium">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <StocksDataTable 
              stocks={activeStocks} 
              onEdit={startEdit} 
              onSell={startSell}
              onAdd={() => setShowAddModal(true)} 
            />
          </div>
        )}
      </>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? "Update Stock Holding" : "Record Stock Trade"}
        >
          <div className="p-2 max-w-lg mx-auto w-full">
            {!editingId && (
              <div className="flex bg-white/5 rounded-xl p-1 border border-white/5 mb-6">
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, trade_type: "buy" })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    formData.trade_type === "buy" ? "bg-[--accent-primary] text-white shadow-md" : "text-[--text-muted]"
                  }`}
                >
                  Buy Stock
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, trade_type: "sell" })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    formData.trade_type === "sell" ? "bg-rose-500 text-white shadow-md" : "text-[--text-muted]"
                  }`}
                >
                  Sell Stock
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Stock Name</label>
                  <input required className="input-premium" placeholder="e.g. Apple Inc" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Symbol / Ticker</label>
                  <input className="input-premium uppercase" placeholder="e.g. AAPL" value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Quantity</label>
                  <input required type="number" step="any" className="input-premium tabular-nums" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">{formData.trade_type === 'buy' ? 'Buy Price' : 'Sell Price'}</label>
                  <input required type="number" step="any" className="input-premium tabular-nums" value={formData.buy_price} onChange={e => setFormData({...formData, buy_price: e.target.value})} inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Current Market Price (LTP)</label>
                  <input required type="number" step="any" className="input-premium tabular-nums" value={formData.current_price} onChange={e => setFormData({...formData, current_price: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Currency</label>
                  <select className="input-premium" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              {!editingId && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transaction Date</label>
                    <input type="date" className="input-premium" value={formData.bought_at} onChange={e => setFormData({...formData, bought_at: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                      {formData.trade_type === 'buy' ? 'Deduct From Account' : 'Deposit To Account'}
                    </label>
                    <select className="input-premium" value={formData.deduct_from_account} onChange={e => setFormData({...formData, deduct_from_account: e.target.value})}>
                      <option value="">No Transaction (Track Only)</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Brokerage / STT / Charges (₹)</label>
                  <input type="number" step="any" className="input-premium tabular-nums" value={charges} onChange={e => setCharges(e.target.value)} />
                </div>
                </>
              )}

              <div className="pt-4 mt-8">
                <button type="submit" disabled={submitting} className={`btn-primary w-full h-12 shadow-xl text-[11px] font-black uppercase tracking-widest ${!editingId && formData.trade_type === 'sell' ? '!bg-rose-500 hover:!bg-rose-600 shadow-[--danger]/20' : 'shadow-[--accent-primary]/20'}`}>
                  {submitting ? "Processing..." : (editingId ? "Update Stock" : formData.trade_type === 'buy' ? "Purchase Stock" : "Sell Stock")}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
}
