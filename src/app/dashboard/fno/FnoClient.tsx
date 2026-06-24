"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { logFnoTrade, closeFnoTrade, deleteFnoTrade } from "./actions";
import { useFinanceData, type FinanceData, type FnoTrade } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";

import FNODataTable from "./components/FNODataTable";
import PnLValue from "@/components/pnl-value";

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

export default function FnoClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { fnoTrades, accounts, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showLogForm, setShowLogForm] = useState(searchParams?.get("action") === "new");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<FnoTrade | null>(null);
  const [submitting, withLock] = useSubmitLock();
  const [activeTab, setActiveTab] = useState<"overview" | "positions" | "history">("overview");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const activePositions = useMemo(() => fnoTrades.filter(t => t.status === "OPEN"), [fnoTrades]);
  const closedHistory = useMemo(() => fnoTrades.filter(t => t.status === "CLOSED"), [fnoTrades]);

  const stats = useMemo(() => {
    const totalRealizedPnL = closedHistory.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
    const activeCost = activePositions.reduce((acc, t) => acc + (Number(t.quantity) * Number(t.entry_price)), 0);
    const wins = closedHistory.filter(t => Number(t.pnl || 0) > 0).length;
    const losses = closedHistory.filter(t => Number(t.pnl || 0) <= 0).length;
    const winRate = closedHistory.length > 0 ? (wins / closedHistory.length) * 100 : 0;

    let bestTrade = null;
    let bestPnL = -Infinity;
    closedHistory.forEach(t => {
      if (Number(t.pnl) > bestPnL) {
        bestPnL = Number(t.pnl);
        bestTrade = t.symbol;
      }
    });

    return { totalRealizedPnL, activeCost, winRate, wins, losses, bestTrade, bestPnL };
  }, [activePositions, closedHistory]);

  const pnlChartData = useMemo(() => {
    const sorted = [...closedHistory].sort((a, b) => new Date(a.close_date || a.trade_date).getTime() - new Date(b.close_date || b.trade_date).getTime());
    let cumPnL = 0;
    return sorted.map(t => {
      cumPnL += Number(t.pnl);
      return {
        name: t.close_date ? new Date(t.close_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
        PnL: cumPnL
      };
    });
  }, [closedHistory]);

  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fnoTrades.forEach(t => {
      map[t.instrument_type] = (map[t.instrument_type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      fill: name === "FUT" ? "#06B6D4" : name === "CE" ? "#22C55E" : "#F43F5E"
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

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">F&O</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Derivatives Trading</p>
        </div>
        <button type="button" onClick={() => setShowLogForm(true)} disabled={submitting} className="btn-primary !h-11 px-6 shadow-[0_0_30px_rgba(14,165,233,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Log Trade
        </button>
      </div>

      {fnoTrades.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-emerald-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <span className="text-3xl">⚡</span>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">F&O Terminal</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Track futures and options trades, log daily P&L, and monitor your derivatives portfolio.</p>
          <div className="mt-8 flex justify-center">
             <button onClick={() => setShowLogForm(true)} className="btn-primary">Log First Trade</button>
          </div>
        </div>
      ) : (
      <>
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Active Capital</p>
            <p className="text-2xl md:text-3xl font-black text-white">₹{stats.activeCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Currently Deployed</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Net Realized P&L</p>
            <PnLValue amount={stats.totalRealizedPnL} size="lg" showIcon />
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Closed Positions</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Win Rate</p>
            <p className="text-2xl md:text-3xl font-black text-[--accent-primary-light]">{stats.winRate.toFixed(1)}%</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Historical Accuracy</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Win/Loss Ratio</p>
            <p className="text-2xl md:text-3xl font-black text-white">{stats.wins} <span className="text-slate-500 font-bold">/</span> {stats.losses}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Closed Trades</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Best Trade</p>
            <p className="text-xl md:text-2xl font-black text-emerald-400 truncate" title={stats.bestTrade || ""}>
              {stats.bestPnL > -Infinity ? `₹${stats.bestPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "N/A"}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60 truncate" title={stats.bestTrade || ""}>
              {stats.bestTrade ? stats.bestTrade : "No Data"}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${
              activeTab === "overview"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("positions")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "positions"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Active Positions
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">
              {activePositions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "history"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Closed History
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">
              {closedHistory.length}
            </span>
          </button>
        </div>

        {/* View Content */}
        {activeTab === "overview" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* PnL Area Chart */}
              <div className="glass-card-static p-6 lg:col-span-2 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Realized P&L Growth</h3>
                    <p className="text-2xl font-black mt-2 text-white">Cumulative Performance</p>
                  </div>
                </div>
                <div className="flex-1 min-h-[250px] w-full mt-4 -ml-4">
                  {mounted && pnlChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={pnlChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} tickFormatter={(val: any) => `₹${Number(val).toLocaleString()}`} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                          formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, "P&L"]}
                        />
                        <Area type="monotone" dataKey="PnL" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorPnL)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[--text-muted] text-sm italic">Not enough closed trades</div>
                  )}
                </div>
              </div>

              {/* Allocation Pie Chart */}
              <div className="glass-card-static p-6 flex flex-col items-center justify-center relative min-h-[400px]">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Instrument Allocation</h3>
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
                          formatter={(value: any) => [value, "Trades"]}
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
                    {pieChartData.map((entry, index) => (
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
        ) : activeTab === "positions" ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <FNODataTable 
              trades={activePositions}
              onCloseTrade={(trade) => { setSelectedTrade(trade); setShowCloseForm(true); }}
              onDeleteTrade={handleDeleteTrade}
              onAdd={() => setShowLogForm(true)}
              showActions={true}
            />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <FNODataTable 
              trades={closedHistory}
              onDeleteTrade={handleDeleteTrade}
              showActions={true}
            />
          </div>
        )}
      </>
      )}

      {/* Log Trade Modal */}
      {showLogForm && (
        <Drawer
          isOpen={showLogForm}
          onClose={() => setShowLogForm(false)}
          title="Log F&O Trade"
        >
          <div className="p-2 max-w-2xl mx-auto w-full">
            <form onSubmit={handleLogSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Underlying Symbol</label>
                  <input required className="input-premium uppercase" placeholder="e.g. NIFTY" value={logFormData.symbol} onChange={e => setLogFormData({...logFormData, symbol: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Instrument Type</label>
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
                    {(["FUT", "CE", "PE"] as const).map(type => (
                      <button key={type} type="button" onClick={() => setLogFormData({...logFormData, instrument_type: type})} className={`flex-1 h-10 text-[10px] font-black rounded-lg transition-all ${logFormData.instrument_type === type ? "bg-[--accent-primary] text-white shadow-md" : "text-[--text-muted]"}`}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Strike Price</label>
                  <input type="number" step="any" disabled={logFormData.instrument_type === "FUT"} className="input-premium disabled:opacity-40" placeholder="e.g. 18500" value={logFormData.strike_price} onChange={e => setLogFormData({...logFormData, strike_price: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Contract Expiry</label>
                  <input required type="date" className="input-premium" value={logFormData.expiry_date} onChange={e => setLogFormData({...logFormData, expiry_date: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Order Action</label>
                  <select className="input-premium" value={logFormData.trade_type} onChange={e => setLogFormData({...logFormData, trade_type: e.target.value as any})}>
                    <option value="BUY">BUY (Long / Pay Premium)</option>
                    <option value="SELL">SELL (Short / Collect Premium)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Trade Date</label>
                  <input required type="date" className="input-premium" value={logFormData.trade_date} onChange={e => setLogFormData({...logFormData, trade_date: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Lot Quantity</label>
                  <input required type="number" className="input-premium" placeholder="e.g. 50" value={logFormData.quantity} onChange={e => setLogFormData({...logFormData, quantity: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Avg Entry Premium (₹)</label>
                  <input required type="number" step="any" className="input-premium" placeholder="e.g. 124.50" value={logFormData.entry_price} onChange={e => setLogFormData({...logFormData, entry_price: e.target.value})} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Linked Account (Premium Flow)</label>
                <select className="input-premium" value={logFormData.account_id} onChange={e => setLogFormData({...logFormData, account_id: e.target.value})}>
                  <option value="">N/A (Track Only)</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 mt-8">
                <button type="submit" disabled={submitting} className={`btn-primary w-full h-12 shadow-xl text-[11px] font-black uppercase tracking-widest shadow-[--accent-primary]/20`}>
                  {submitting ? "Processing..." : "Log Trade"}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}

      {/* Close Trade Modal */}
      {showCloseForm && selectedTrade && (
        <Drawer isOpen={showCloseForm} onClose={() => { setShowCloseForm(false); setSelectedTrade(null); }} title="Close Position">
          <div className="p-2 max-w-lg mx-auto w-full">
            <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-[10px] text-[--text-muted] font-black uppercase tracking-widest">Instrument</span>
                <span className="text-xs font-bold text-white">{selectedTrade.symbol} {selectedTrade.instrument_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-[--text-muted] font-black uppercase tracking-widest">Entry Price</span>
                <span className="text-xs font-bold text-white">₹{selectedTrade.entry_price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-[--text-muted] font-black uppercase tracking-widest">Quantity</span>
                <span className="text-xs font-bold text-white">{selectedTrade.quantity}</span>
              </div>
            </div>
            <form onSubmit={handleCloseSubmit} className="space-y-5">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Exit Premium (₹)</label>
                <input required type="number" step="any" className="input-premium" placeholder="e.g. 150.25" value={closeFormData.exit_price} onChange={e => setCloseFormData({...closeFormData, exit_price: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Settlement Date</label>
                <input required type="date" className="input-premium" value={closeFormData.close_date} onChange={e => setCloseFormData({...closeFormData, close_date: e.target.value})} />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full h-12 shadow-md mt-4">
                {submitting ? "Settling..." : "Close Position"}
              </button>
            </form>
          </div>
        </Drawer>
      )}

    </div>
  );
}
