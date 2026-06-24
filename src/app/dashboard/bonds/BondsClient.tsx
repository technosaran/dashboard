"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { createBond, updateBond } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

import BondsDataTable from "./components/BondsDataTable";
import PnLValue from "@/components/pnl-value";

import type { Tables } from "@/lib/database.types";
type Bond = Tables<"bonds">;

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

export default function BondsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { bonds: bondsData, accounts, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBond, setSelectedBond] = useState<any | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "holdings">("overview");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bonds = useMemo(() => (bondsData || []).filter(b => b.status === 'Active') as Bond[], [bondsData]);

  const [formData, setFormData] = useState({
    bond_name: "", isin: "", issuer: "", bond_type: "Government",
    face_value: "1000", quantity: "1", purchase_price: "", current_price: "",
    coupon_rate: "", ytm: "", purchase_date: "",
    maturity_date: "", next_interest_date: "", interest_frequency: "Semi-Annual",
    credit_rating: "", platform: "Wint", demat_account: "", account_id: "", notes: "",
    accrued_interest: "0", total_interest_earned: "0", current_value: ""
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFormData(prev => ({ ...prev, purchase_date: new Date().toISOString().split("T")[0] }));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && showAddModal && !formData.account_id) {
      const defaultAccId = profile?.default_accounts?.bonds;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      if (defaultAccExists) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, account_id: defaultAccId }));
        }, 0);
      }
    }
  }, [accounts, profile, showAddModal, formData.account_id]);

  const stats = useMemo(() => {
    const totalInvested = bonds.reduce((s, b) => s + Number(b.total_invested), 0);
    const currentValue = bonds.reduce((s, b) => s + Number(b.current_value), 0);
    const totalInterest = bonds.reduce((s, b) => s + Number(b.total_interest_earned || 0), 0);
    const accruedInterest = bonds.reduce((s, b) => s + Number(b.accrued_interest || 0), 0);
    const totalPnL = currentValue - totalInvested;
    const avgYTM = bonds.length > 0 ? bonds.reduce((s, b) => s + Number(b.ytm || 0), 0) / bonds.length : 0;
    
    return { totalInvested, currentValue, totalInterest, accruedInterest, totalPnL, avgYTM };
  }, [bonds]);

  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {};
    bonds.forEach(b => {
      const type = b.bond_type || "Others";
      map[type] = (map[type] || 0) + Number(b.current_value);
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      fill: getColorByLabel(name)
    })).sort((a, b) => b.value - a.value);
  }, [bonds]);

  const barChartData = useMemo(() => {
    return bonds.map(b => {
      return {
        name: b.bond_name.substring(0, 15) + (b.bond_name.length > 15 ? "..." : ""),
        Invested: Number(b.total_invested),
        Current: Number(b.current_value)
      };
    }).sort((a, b) => b.Current - a.Current).slice(0, 10);
  }, [bonds]);

  const startEdit = (bond: Bond) => {
    setEditingId(bond.id);
    setFormData({
      bond_name: bond.bond_name,
      isin: bond.isin,
      issuer: bond.issuer,
      bond_type: bond.bond_type,
      face_value: bond.face_value.toString(),
      quantity: bond.quantity.toString(),
      purchase_price: bond.purchase_price.toString(),
      current_price: bond.current_price.toString(),
      coupon_rate: bond.coupon_rate.toString(),
      ytm: bond.ytm ? bond.ytm.toString() : "",
      purchase_date: bond.purchase_date,
      maturity_date: bond.maturity_date,
      next_interest_date: bond.next_interest_date || "",
      interest_frequency: bond.interest_frequency || "Annual",
      credit_rating: bond.credit_rating || "",
      platform: bond.platform || "Wint",
      demat_account: "",
      account_id: "",
      notes: "",
      accrued_interest: bond.accrued_interest ? bond.accrued_interest.toString() : "0",
      total_interest_earned: bond.total_interest_earned ? bond.total_interest_earned.toString() : "0",
      current_value: bond.current_value ? bond.current_value.toString() : ""
    });
    setShowAddModal(true);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      try {
        const quantity = parseInt(formData.quantity) || 1;
        const purchasePrice = parseFloat(formData.purchase_price) || 0;
        const currentPrice = parseFloat(formData.current_price) || 0;
        const faceValue = parseFloat(formData.face_value) || 0;
        const totalInvested = purchasePrice * quantity;
        const currentValue = parseFloat(formData.current_value) || (currentPrice * quantity);

        if (editingId) {
          const res = await updateBond(editingId, {
            bond_name: formData.bond_name,
            isin: formData.isin,
            issuer: formData.issuer,
            bond_type: formData.bond_type as any,
            face_value: faceValue,
            quantity: quantity,
            purchase_price: purchasePrice,
            current_price: currentPrice,
            coupon_rate: parseFloat(formData.coupon_rate) || 0,
            ytm: formData.ytm ? parseFloat(formData.ytm) : undefined,
            purchase_date: formData.purchase_date,
            maturity_date: formData.maturity_date,
            next_interest_date: formData.next_interest_date || undefined,
            interest_frequency: formData.interest_frequency as any,
            credit_rating: formData.credit_rating || undefined,
            platform: formData.platform,
            notes: formData.notes,
            accrued_interest: parseFloat(formData.accrued_interest) || 0,
            total_interest_earned: parseFloat(formData.total_interest_earned) || 0,
            current_value: currentValue,
            total_invested: totalInvested
          });
          if (!res?.error) {
            toast.success("Bond holding updated successfully");
            setShowAddModal(false);
            setEditingId(null);
            mutate();
          } else {
            toast.error(res.error);
          }
        } else {
          if (!formData.account_id) {
            toast.error("Please select a channeling account");
            return;
          }
          const res = await createBond({
            ...formData,
            face_value: faceValue || 1000,
            quantity: quantity || 1,
            purchase_price: purchasePrice,
            current_price: currentPrice || purchasePrice,
            coupon_rate: parseFloat(formData.coupon_rate),
            ytm: formData.ytm ? parseFloat(formData.ytm) : undefined,
            bond_type: formData.bond_type as any,
            interest_frequency: formData.interest_frequency as any,
          });
          if (!res?.error) {
            toast.success("Bond investment recorded");
            setShowAddModal(false);
            mutate();
          } else {
            toast.error(res.error);
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to process bond investment.");
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
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Fixed Income</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Bonds & Debentures</p>
        </div>
        <button type="button" onClick={() => { 
          setFormData({
            bond_name: "", isin: "", issuer: "", bond_type: "Government",
            face_value: "1000", quantity: "1", purchase_price: "", current_price: "",
            coupon_rate: "", ytm: "", purchase_date: new Date().toISOString().split("T")[0],
            maturity_date: "", next_interest_date: "", interest_frequency: "Semi-Annual",
            credit_rating: "", platform: "Wint", demat_account: "", account_id: "", notes: "",
            accrued_interest: "0", total_interest_earned: "0", current_value: ""
          });
          setEditingId(null);
          setShowAddModal(true); 
        }} disabled={submitting} className="btn-primary !h-11 px-6 shadow-[0_0_30px_rgba(14,165,233,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Record Bond
        </button>
      </div>

      {bonds.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-emerald-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <span className="text-3xl">📜</span>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">No Bonds</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Diversify with fixed-income instruments. Track your corporate and government bonds.</p>
          <div className="mt-8 flex justify-center">
             <button onClick={() => setShowAddModal(true)} className="btn-primary">Record First Bond</button>
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
            <p className="text-2xl md:text-3xl font-black text-[--accent-primary-light]">₹{stats.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Market Value</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Interest</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-400">₹{stats.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Earned So Far</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Accrued Interest</p>
            <p className="text-2xl md:text-3xl font-black text-amber-400">₹{stats.accruedInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Yet to be paid</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Average YTM</p>
            <p className="text-xl md:text-2xl font-black text-[--accent-primary] truncate">
              {stats.avgYTM > 0 ? `${stats.avgYTM.toFixed(2)}%` : "N/A"}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Yield To Maturity</p>
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
            Bond Holdings
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">
              {bonds.length}
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
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Bond Performance</h3>
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
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Bond Type Allocation</h3>
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
            <BondsDataTable 
              bonds={bonds} 
              onEdit={startEdit} 
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
          title={editingId ? "Update Bond" : "Record Bond Investment"}
        >
          <div className="p-2 max-w-2xl mx-auto w-full">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Bond Name</label>
                  <input required className="input-premium" placeholder="e.g. 7.18% GS 2033" value={formData.bond_name} onChange={e => setFormData({...formData, bond_name: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Issuer</label>
                  <input required className="input-premium" placeholder="e.g. RBI" value={formData.issuer} onChange={e => setFormData({...formData, issuer: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">ISIN</label>
                  <input required className="input-premium" placeholder="IN0000..." value={formData.isin} onChange={e => setFormData({...formData, isin: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Bond Type</label>
                  <select className="input-premium" value={formData.bond_type} onChange={e => setFormData({...formData, bond_type: e.target.value})}>
                    <option value="Government">Government</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Tax-Free">Tax-Free</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="PSU">PSU</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Platform</label>
                  <input className="input-premium" placeholder="e.g. Wint Wealth" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Quantity</label>
                  <input required type="number" className="input-premium tabular-nums" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Face Value (₹)</label>
                  <input required type="number" step="any" className="input-premium tabular-nums" value={formData.face_value} onChange={e => setFormData({...formData, face_value: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Purchase Price (₹)</label>
                  <input required type="number" step="any" className="input-premium tabular-nums" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Coupon Rate (%)</label>
                  <input required type="number" step="any" className="input-premium tabular-nums" value={formData.coupon_rate} onChange={e => setFormData({...formData, coupon_rate: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">YTM (%)</label>
                  <input type="number" step="any" className="input-premium tabular-nums" placeholder="Optional" value={formData.ytm} onChange={e => setFormData({...formData, ytm: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Interest Frequency</label>
                  <select className="input-premium" value={formData.interest_frequency} onChange={e => setFormData({...formData, interest_frequency: e.target.value})}>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annual">Semi-Annual</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Purchase Date</label>
                  <input type="date" required className="input-premium" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Maturity Date</label>
                  <input type="date" required className="input-premium" value={formData.maturity_date} onChange={e => setFormData({...formData, maturity_date: e.target.value})} />
                </div>
              </div>

              {!editingId && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Deduct From Account</label>
                  <select className="input-premium" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                    <option value="">No Transaction (Track Only)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 mt-8">
                <button type="submit" disabled={submitting} className={`btn-primary w-full h-12 shadow-xl text-[11px] font-black uppercase tracking-widest shadow-[--accent-primary]/20`}>
                  {submitting ? "Processing..." : (editingId ? "Update Bond" : "Invest in Bond")}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
}
