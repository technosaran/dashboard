"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { recordMFInvestment, updateMFHolding } from "./actions";
import { revertLedgerLog } from "../alternative-assets/actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, parseISO } from "date-fns";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

import MutualFundsDataTable from "./components/MutualFundsDataTable";
import PnLValue from "@/components/pnl-value";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number; day_change?: number; day_change_percent?: number };

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

export default function MutualFundsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { mutualFunds: rawMfs, accounts, mutualFundTrades: trades, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "holdings">("overview");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [charges, setCharges] = useState("0");

  const [formData, setFormData] = useState({
    fund_name: "",
    scheme_code: "",
    units: "",
    nav: "",
    current_nav: "",
    investment_type: "SIP",
    category: "Equity",
    amc_name: "HDFC",
    date: new Date().toISOString().split("T")[0],
    account_id: "",
    trade_type: "buy" as "buy" | "sell"
  });

  useEffect(() => {
    if (accounts.length > 0 && showAddModal && !formData.account_id) {
      const defaultAccId = profile?.default_accounts?.mutual_funds;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      if (defaultAccExists) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, account_id: defaultAccId }));
        }, 0);
      }
    }
  }, [accounts, profile, showAddModal, formData.account_id]);

  const finalStampDuty = parseFloat(charges) || 0;

  const mutualFunds = useMemo(() => {
    return rawMfs.filter(mf => Number(mf.units) > 0).map(mf => {
      const currentNav = Number(mf.current_nav || 0);
      const prevNav = Number(mf.previous_nav || 0);
      
      let day_change = Number(mf.day_change || 0);
      let day_change_percent = Number(mf.day_change_percent || 0);

      if (prevNav > 0) {
        day_change = currentNav - prevNav;
        day_change_percent = (day_change / prevNav) * 100;
      }
      return { ...mf, day_change, day_change_percent } as MF;
    });
  }, [rawMfs]);

  const stats = useMemo(() => {
    const totalInvested = mutualFunds.reduce((s, g) => s + (Number(g.units) * Number(g.avg_nav)), 0);
    const totalCurrentValue = mutualFunds.reduce((s, g) => s + (Number(g.units) * Number(g.current_nav)), 0);
    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    const dayPnL = mutualFunds.reduce((s, g) => s + (Number(g.day_change || 0) * Number(g.units || 0)), 0);
    const prevDayValue = totalCurrentValue - dayPnL;
    const dayPnLPercent = prevDayValue > 0 ? (dayPnL / prevDayValue) * 100 : 0;

    let bestFund: string | null = null;
    let bestPnL = -Infinity;
    mutualFunds.forEach(mf => {
      const inv = Number(mf.units) * Number(mf.avg_nav);
      const cur = Number(mf.units) * Number(mf.current_nav);
      const p = inv > 0 ? ((cur - inv) / inv) * 100 : 0;
      if (p > bestPnL) {
        bestPnL = p;
        bestFund = mf.fund_name;
      }
    });

    return { totalInvested, totalCurrentValue, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent, bestFund, bestPnL };
  }, [mutualFunds]);

  const pieChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    mutualFunds.forEach(mf => {
      const cat = mf.amc_name || "Others";
      catMap[cat] = (catMap[cat] || 0) + (Number(mf.units) * Number(mf.current_nav));
    });
    return Object.entries(catMap).map(([name, value]) => ({
      name,
      value,
      fill: getColorByLabel(name)
    })).sort((a, b) => b.value - a.value);
  }, [mutualFunds]);

  const barChartData = useMemo(() => {
    return mutualFunds.map(mf => {
      const invested = Number(mf.units) * Number(mf.avg_nav);
      const current = Number(mf.units) * Number(mf.current_nav);
      return {
        name: mf.fund_name.substring(0, 15) + (mf.fund_name.length > 15 ? "..." : ""),
        Invested: invested,
        Current: current,
        PnL: current - invested
      };
    }).sort((a, b) => b.Current - a.Current).slice(0, 10);
  }, [mutualFunds]);

  const startSell = (mf: MF) => {
    setFormData({
        fund_name: mf.fund_name,
        scheme_code: mf.fund_symbol || mf.scheme_code || "",
        units: mf.units.toString(),
        nav: mf.current_nav.toString(),
        current_nav: mf.current_nav.toString(),
        investment_type: mf.investment_type || "LUMPSUM",
        category: mf.category || "Equity",
        amc_name: mf.amc_name || "",
        date: new Date().toISOString().split("T")[0],
        account_id: "",
        trade_type: "sell"
    });
    setCharges("0");
    setShowAddModal(true);
  };

  const startEdit = (mf: MF) => {
    setEditingId(mf.id);
    setFormData({
      fund_name: mf.fund_name,
      scheme_code: mf.fund_symbol || mf.scheme_code || "",
      units: mf.units.toString(),
      nav: mf.avg_nav.toString(),
      current_nav: mf.current_nav.toString(),
      investment_type: mf.investment_type || "SIP",
      category: mf.category || "Equity",
      amc_name: mf.amc_name || "",
      date: new Date().toISOString().split("T")[0],
      account_id: "",
      trade_type: "buy"
    });
    setCharges("0");
    setShowAddModal(true);
  };

  async function handleAddMF(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      try {
        if (editingId) {
          const res = await updateMFHolding(editingId, {
            fund_name: formData.fund_name,
            amc_name: formData.amc_name,
            scheme_code: formData.scheme_code,
            fund_symbol: formData.scheme_code,
            units: parseFloat(formData.units),
            avg_nav: parseFloat(formData.nav),
            current_nav: parseFloat(formData.current_nav || formData.nav),
            category: formData.category,
            investment_type: formData.investment_type
          });
          if (!res?.error) {
            toast.success("Mutual fund holding updated successfully");
            setShowAddModal(false);
            setEditingId(null);
            setFormData({ 
              fund_name: "", scheme_code: "", units: "", nav: "", current_nav: "",
              investment_type: "SIP", category: "Equity", amc_name: "HDFC",
              date: new Date().toISOString().split("T")[0], account_id: "",
              trade_type: "buy"
            });
            setCharges("0");
            mutate();
          } else {
            toast.error(res.error);
          }
        } else {
          if (!formData.account_id) {
              toast.error("Please select a channeling account");
              return;
          }
          const res = await recordMFInvestment({
            ...formData,
            units: parseFloat(formData.units),
            nav: parseFloat(formData.nav),
            stamp_duty: finalStampDuty,
            trade_type: formData.trade_type
          });
          if (!res?.error) {
            toast.success(formData.trade_type === 'buy' ? "Wealth deployed into mutual fund" : "Mutual fund units liquidated successfully");
            setShowAddModal(false);
            setFormData({ 
              fund_name: "", scheme_code: "", units: "", nav: "", current_nav: "",
              investment_type: "SIP", category: "Equity", amc_name: "HDFC",
              date: new Date().toISOString().split("T")[0], account_id: "",
              trade_type: "buy"
            });
            setCharges("0");
            mutate();
          } else {
            toast.error(res.error);
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to process mutual fund investment.");
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
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Mutual Funds</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Asset Management Terminal</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} disabled={submitting} className="btn-primary !h-11 px-6 shadow-[0_0_30px_rgba(14,165,233,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Record Investment
        </button>
      </div>

      {mutualFunds.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-emerald-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <span className="text-3xl">📈</span>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">No Mutual Funds</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Diversify your portfolio with Mutual Funds. Track SIPs and Lumpsum investments easily.</p>
          <div className="mt-8 flex justify-center">
             <button onClick={() => setShowAddModal(true)} className="btn-primary">Record First Investment</button>
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
            <p className="text-2xl md:text-3xl font-black text-[--accent-primary-light]">₹{stats.totalCurrentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
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
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Best Performing</p>
            <p className="text-xl md:text-2xl font-black text-emerald-400 truncate" title={stats.bestFund || ""}>
              {stats.bestPnL > -Infinity ? `${stats.bestPnL.toFixed(1)}%` : "N/A"}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60 truncate" title={stats.bestFund || ""}>
              {stats.bestFund ? String(stats.bestFund).substring(0, 15) : "No Data"}
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
            Fund Holdings
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">
              {mutualFunds.length}
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
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Invested vs Market Value (Top 10)</h3>
                    <p className="text-2xl font-black mt-2 text-white">Performance Analysis</p>
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
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">AMC Allocation</h3>
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
            <MutualFundsDataTable 
              funds={mutualFunds} 
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
          title={editingId ? "Update Fund Holding" : "Record Mutual Fund Transaction"}
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
                  Buy / SIP
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, trade_type: "sell" })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    formData.trade_type === "sell" ? "bg-rose-500 text-white shadow-md" : "text-[--text-muted]"
                  }`}
                >
                  Sell / Redeem
                </button>
              </div>
            )}

            <form onSubmit={handleAddMF} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Fund Name</label>
                  <input required className="input-premium" placeholder="e.g. Parag Parikh Flexi Cap" value={formData.fund_name} onChange={e => setFormData({...formData, fund_name: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">AMC Name</label>
                  <input required className="input-premium" placeholder="e.g. PPFAS" value={formData.amc_name} onChange={e => setFormData({...formData, amc_name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Units</label>
                  <input required type="number" step="any" className="input-premium tabular-nums" value={formData.units} onChange={e => setFormData({...formData, units: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">NAV (Price)</label>
                  <input required type="number" step="any" className="input-premium tabular-nums" value={formData.nav} onChange={e => setFormData({...formData, nav: e.target.value})} inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Category</label>
                  <select className="input-premium" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="Equity">Equity</option>
                    <option value="Debt">Debt</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Liquid">Liquid</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Investment Type</label>
                  <select className="input-premium" value={formData.investment_type} onChange={e => setFormData({...formData, investment_type: e.target.value})}>
                    <option value="SIP">SIP</option>
                    <option value="Lumpsum">Lumpsum</option>
                  </select>
                </div>
              </div>

              {!editingId && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transaction Date</label>
                    <input type="date" className="input-premium" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                      {formData.trade_type === 'buy' ? 'Deduct From Account' : 'Deposit To Account'}
                    </label>
                    <select className="input-premium" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                      <option value="">No Transaction (Track Only)</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Stamp Duty / Charges (₹)</label>
                  <input type="number" step="any" className="input-premium tabular-nums" value={charges} onChange={e => setCharges(e.target.value)} />
                </div>
                </>
              )}

              <div className="pt-4 mt-8">
                <button type="submit" disabled={submitting} className={`btn-primary w-full h-12 shadow-xl text-[11px] font-black uppercase tracking-widest ${!editingId && formData.trade_type === 'sell' ? '!bg-rose-500 hover:!bg-rose-600 shadow-[--danger]/20' : 'shadow-[--accent-primary]/20'}`}>
                  {submitting ? "Processing..." : (editingId ? "Update Fund" : formData.trade_type === 'buy' ? "Invest Funds" : "Redeem Funds")}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
}
