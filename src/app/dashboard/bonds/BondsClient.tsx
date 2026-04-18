"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "react-hot-toast";
import { createBond, deleteBond, recordInterestPayment } from "./actions";
import { useFinanceData } from "@/hooks/use-finance-data";
import { format, differenceInDays, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase-browser";

type Bond = {
  id: string;
  bond_name: string;
  isin: string;
  issuer: string;
  bond_type: string;
  face_value: number;
  quantity: number;
  purchase_price: number;
  current_price: number;
  total_invested: number;
  current_value: number;
  coupon_rate: number;
  ytm: number | null;
  accrued_interest: number;
  total_interest_earned: number;
  purchase_date: string;
  maturity_date: string;
  next_interest_date: string | null;
  interest_frequency: string;
  status: string;
  credit_rating: string | null;
  platform: string;
};

const BOND_TYPES = ["Government", "Corporate", "Tax-Free", "Infrastructure", "PSU"];
const INTEREST_FREQUENCIES = ["Monthly", "Quarterly", "Semi-Annual", "Annual"];

export default function BondsClient() {
  const supabase = createClient();
  const { data: { accounts }, isValidating } = useFinanceData();
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"holdings" | "history">("holdings");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  // Fetch bonds
  useEffect(() => {
    async function fetchBonds() {
      const { data } = await supabase
        .from("bonds")
        .select("*")
        .eq("status", "Active")
        .order("maturity_date", { ascending: true });
      
      if (data) setBonds(data as Bond[]);
    }
    fetchBonds();

    // Realtime subscription
    const channel = supabase
      .channel("bonds-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bonds" }, () => {
        fetchBonds();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [formData, setFormData] = useState({
    bond_name: "",
    isin: "",
    issuer: "",
    bond_type: "Government",
    face_value: "1000",
    quantity: "1",
    purchase_price: "",
    current_price: "",
    coupon_rate: "",
    ytm: "",
    purchase_date: new Date().toISOString().split("T")[0],
    maturity_date: "",
    next_interest_date: "",
    interest_frequency: "Semi-Annual",
    credit_rating: "",
    platform: "Wint",
    demat_account: "",
    account_id: "",
    notes: "",
  });

  const stats = useMemo(() => {
    const totalInvested = bonds.reduce((s, b) => s + Number(b.total_invested), 0);
    const currentValue = bonds.reduce((s, b) => s + Number(b.current_value), 0);
    const totalInterest = bonds.reduce((s, b) => s + Number(b.total_interest_earned || 0), 0);
    const accruedInterest = bonds.reduce((s, b) => s + Number(b.accrued_interest || 0), 0);
    const totalPnL = currentValue - totalInvested;
    const avgYTM = bonds.length > 0 
      ? bonds.reduce((s, b) => s + Number(b.ytm || 0), 0) / bonds.length 
      : 0;
    
    return { totalInvested, currentValue, totalInterest, accruedInterest, totalPnL, avgYTM };
  }, [bonds]);

  const filteredBonds = useMemo(() => {
    if (!search.trim()) return bonds;
    const q = search.toLowerCase();
    return bonds.filter(b => 
      b.bond_name.toLowerCase().includes(q) ||
      b.isin.toLowerCase().includes(q) ||
      b.issuer.toLowerCase().includes(q)
    );
  }, [bonds, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    
    const result = await createBond({
      ...formData,
      face_value: parseFloat(formData.face_value),
      quantity: parseInt(formData.quantity),
      purchase_price: parseFloat(formData.purchase_price),
      current_price: parseFloat(formData.current_price || formData.purchase_price),
      coupon_rate: parseFloat(formData.coupon_rate),
      ytm: formData.ytm ? parseFloat(formData.ytm) : undefined,
      bond_type: formData.bond_type as any,
      interest_frequency: formData.interest_frequency as any,
    });

    if (!result?.error) {
      toast.success("Bond investment recorded in portfolio");
      setShowAddModal(false);
      setFormData({
        bond_name: "", isin: "", issuer: "", bond_type: "Government",
        face_value: "1000", quantity: "1", purchase_price: "", current_price: "",
        coupon_rate: "", ytm: "", purchase_date: new Date().toISOString().split("T")[0],
        maturity_date: "", next_interest_date: "", interest_frequency: "Semi-Annual",
        credit_rating: "", platform: "Wint", demat_account: "", account_id: "", notes: "",
      });
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  }

  const getBondTypeColor = (type: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      Government: { bg: "rgba(16, 185, 129, 0.1)", text: "#10b981" },
      Corporate: { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" },
      "Tax-Free": { bg: "rgba(139, 92, 246, 0.1)", text: "#8b5cf6" },
      Infrastructure: { bg: "rgba(245, 158, 11, 0.1)", text: "#f59e0b" },
      PSU: { bg: "rgba(6, 182, 212, 0.1)", text: "#06b6d4" },
    };
    return colors[type] || { bg: "rgba(107, 114, 128, 0.1)", text: "#6b7280" };
  };

  const getRatingColor = (rating: string | null) => {
    if (!rating) return { bg: "rgba(107, 114, 128, 0.1)", text: "#6b7280" };
    if (rating.startsWith("AAA")) return { bg: "rgba(16, 185, 129, 0.1)", text: "#10b981" };
    if (rating.startsWith("AA")) return { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" };
    if (rating.startsWith("A")) return { bg: "rgba(245, 158, 11, 0.1)", text: "#f59e0b" };
    return { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444" };
  };

  return (
    <div className="flex flex-col gap-6 py-6" style={{ maxWidth: "1280px", margin: "0 auto", width: "100%", paddingBottom: "100px" }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[--text-primary]">Fixed Income Securities</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Bonds Portfolio Management</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary !h-11 !px-8">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Add Bond
        </button>
      </div>

      {/* Summary Cards */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-5 gap-4 px-4">
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Total Invested</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">₹{stats.totalInvested.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Current Value</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">₹{stats.currentValue.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Total P&L</span>
          <div className="flex flex-col">
            <span className={`text-xl md:text-2xl font-black tabular-nums ${stats.totalPnL >= 0 ? 'text-[--success]' : 'text-[--danger]'}`}>
              {stats.totalPnL >= 0 ? '+' : ''}₹{Math.abs(stats.totalPnL).toLocaleString()}
            </span>
            <span className={`text-[10px] font-black ${stats.totalPnL >= 0 ? 'text-[--success]' : 'text-[--danger]'} opacity-60`}>
              ({stats.totalPnL >= 0 ? '+' : ''}{((stats.totalPnL / stats.totalInvested) * 100).toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Interest Earned</span>
          <span className="text-xl md:text-2xl font-black tabular-nums text-[--success]">₹{stats.totalInterest.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Avg. YTM</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">{stats.avgYTM.toFixed(2)}%</span>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("holdings")}
            className={`text-xs font-black uppercase tracking-widest pb-3 px-1 transition-all ${activeTab === "holdings" ? "text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]" : "text-[--text-muted] hover:text-[--text-primary]"}`}
          >
            Holdings ({bonds.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`text-xs font-black uppercase tracking-widest pb-3 px-1 transition-all ${activeTab === "history" ? "text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]" : "text-[--text-muted] hover:text-[--text-primary]"}`}
          >
            Transactions
          </button>
        </div>
        
        <div className="relative w-full sm:w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search bonds..."
            className="input-premium pl-10 py-2 text-sm w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Holdings View */}
      {activeTab === "holdings" && (
        <div className="mx-4">
          {filteredBonds.length === 0 ? (
            <div className="glass-card-static p-24 text-center">
              <div className="text-6xl mb-4">📜</div>
              <h3 className="text-2xl font-black text-[--text-primary] mb-2">No Bonds in Portfolio</h3>
              <p className="text-sm text-[--text-muted] mb-8">Start building your fixed income portfolio with government and corporate bonds</p>
              <button onClick={() => setShowAddModal(true)} className="btn-primary shadow-2xl shadow-[--accent-primary]/20">Add Your First Bond</button>
            </div>
          ) : (
            <div className="glass-card-static overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Bond Details</th>
                    <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">Quantity</th>
                    <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">Coupon</th>
                    <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">YTM</th>
                    <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">Invested</th>
                    <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">Current Value</th>
                    <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">P&L</th>
                    <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Maturity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filteredBonds.map((bond) => {
                    const daysToMaturity = differenceInDays(parseISO(bond.maturity_date), new Date());
                    const pnl = Number(bond.current_value) - Number(bond.total_invested);
                    const pnlPercent = (pnl / Number(bond.total_invested)) * 100;
                    const bondTypeColor = getBondTypeColor(bond.bond_type);
                    const ratingColor = getRatingColor(bond.credit_rating);
                    
                    return (
                      <tr key={bond.id} className="hover:bg-white/[0.015] transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[13px] font-bold text-[--text-primary]">{bond.bond_name}</span>
                            </div>
                            <span className="text-[10px] text-[--text-muted] font-medium">{bond.issuer}</span>
                            <div className="flex items-center gap-2 mt-2">
                              <span 
                                className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider"
                                style={{ backgroundColor: bondTypeColor.bg, color: bondTypeColor.text }}
                              >
                                {bond.bond_type}
                              </span>
                              {bond.credit_rating && (
                                <span 
                                  className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase"
                                  style={{ backgroundColor: ratingColor.bg, color: ratingColor.text }}
                                >
                                  {bond.credit_rating}
                                </span>
                              )}
                              <span className="text-[9px] text-[--text-muted] font-medium">ISIN: {bond.isin}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-[13px] font-bold text-[--text-primary] tabular-nums">{bond.quantity}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-[14px] font-black text-[--success] tabular-nums">{Number(bond.coupon_rate).toFixed(2)}%</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-[13px] font-bold text-[--text-primary] tabular-nums">{bond.ytm ? Number(bond.ytm).toFixed(2) : "—"}%</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-[13px] font-medium text-[--text-secondary] tabular-nums">₹{Number(bond.total_invested).toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <span className="text-[14px] font-bold text-[--text-primary] tabular-nums">₹{Number(bond.current_value).toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <span className={`text-[14px] font-black tabular-nums ${pnl >= 0 ? 'text-[--success]' : 'text-[--danger]'}`}>
                              {pnl >= 0 ? '+' : ''}₹{Math.abs(pnl).toLocaleString()}
                            </span>
                            <span className={`text-[10px] font-bold tabular-nums opacity-60 ${pnl >= 0 ? 'text-[--success]' : 'text-[--danger]'}`}>
                              {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-[12px] font-bold text-[--text-primary]">{format(parseISO(bond.maturity_date), "MMM d, yyyy")}</span>
                            <span className={`text-[10px] font-bold ${daysToMaturity < 90 ? 'text-[--warning]' : 'text-[--text-muted]'}`}>
                              {daysToMaturity} days
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Bond Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl">
          <div className="glass-card-static w-full max-w-3xl p-8 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Add Bond Investment</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[--text-muted] hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Bond Name</label>
                  <input required className="input-premium" value={formData.bond_name} onChange={e => setFormData({...formData, bond_name: e.target.value})} placeholder="e.g., 7.18% Govt of India 2033" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">ISIN</label>
                  <input required className="input-premium" value={formData.isin} onChange={e => setFormData({...formData, isin: e.target.value})} placeholder="INE123A01012" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Issuer</label>
                  <input required className="input-premium" value={formData.issuer} onChange={e => setFormData({...formData, issuer: e.target.value})} placeholder="Government of India" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Bond Type</label>
                  <select className="input-premium" value={formData.bond_type} onChange={e => setFormData({...formData, bond_type: e.target.value})}>
                    {BOND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Face Value</label>
                  <input required type="number" className="input-premium" value={formData.face_value} onChange={e => setFormData({...formData, face_value: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Quantity</label>
                  <input required type="number" className="input-premium" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Purchase Price</label>
                  <input required type="number" step="0.01" className="input-premium" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Coupon Rate (%)</label>
                  <input required type="number" step="0.01" className="input-premium" value={formData.coupon_rate} onChange={e => setFormData({...formData, coupon_rate: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Interest Frequency</label>
                  <select className="input-premium" value={formData.interest_frequency} onChange={e => setFormData({...formData, interest_frequency: e.target.value})}>
                    {INTEREST_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Purchase Date</label>
                  <input required type="date" className="input-premium" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Maturity Date</label>
                  <input required type="date" className="input-premium" value={formData.maturity_date} onChange={e => setFormData({...formData, maturity_date: e.target.value})} />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Platform</label>
                  <input className="input-premium" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} placeholder="Wint" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 block">Deduct from Account</label>
                  <select className="input-premium" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                    <option value="">No Deduction</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "Adding..." : "Add Bond"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
