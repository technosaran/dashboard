"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { createBond, updateBond } from "./actions";
import { revertLedgerLog } from "../alternative-assets/actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, differenceInDays, parseISO } from "date-fns";
import { Drawer } from "@/components/ui/drawer";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

const formatNum = (num: number | string) => {
  return Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};


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

export default function BondsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { accounts, bonds: bondsData, bondTransactions, ledgerLogs, profile }, isValidating, mutate } = useFinanceData(initialData);
  const bonds = useMemo(() => (bondsData || []).filter(b => b.status === 'Active') as Bond[], [bondsData]);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"holdings" | "history">("holdings");
  const [submitting, withLock] = useSubmitLock();

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
    accrued_interest: "0",
    total_interest_earned: "0",
    current_value: ""
  });

  // Initialize default account when accounts/profile loads or modal is opened
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
    const avgYTM = bonds.length > 0 
      ? bonds.reduce((s, b) => s + Number(b.ytm || 0), 0) / bonds.length 
      : 0;
    
    return { totalInvested, currentValue, totalInterest, accruedInterest, totalPnL, avgYTM };
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
      interest_frequency: bond.interest_frequency,
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
      if (editingId) {
        const quantity = parseInt(formData.quantity) || 1;
        const purchasePrice = parseFloat(formData.purchase_price) || 0;
        const currentPrice = parseFloat(formData.current_price) || 0;
        const faceValue = parseFloat(formData.face_value) || 0;
        const totalInvested = purchasePrice * quantity;
        const currentValue = parseFloat(formData.current_value) || (currentPrice * quantity);

        const result = await updateBond(editingId, {
          bond_name: formData.bond_name,
          isin: formData.isin,
          issuer: formData.issuer,
          bond_type: formData.bond_type as "Government" | "Corporate" | "Tax-Free" | "Infrastructure" | "PSU",
          face_value: faceValue,
          quantity: quantity,
          purchase_price: purchasePrice,
          current_price: currentPrice,
          coupon_rate: parseFloat(formData.coupon_rate) || 0,
          ytm: formData.ytm ? parseFloat(formData.ytm) : undefined,
          purchase_date: formData.purchase_date,
          maturity_date: formData.maturity_date,
          next_interest_date: formData.next_interest_date || undefined,
          interest_frequency: formData.interest_frequency as "Monthly" | "Quarterly" | "Semi-Annual" | "Annual",
          credit_rating: formData.credit_rating,
          platform: formData.platform,
          notes: formData.notes,
          accrued_interest: parseFloat(formData.accrued_interest) || 0,
          total_interest_earned: parseFloat(formData.total_interest_earned) || 0,
          current_value: currentValue,
          total_invested: totalInvested
        });
          if (!result?.error) {
            toast.success("Bond holding details updated");
            setShowAddModal(false);
            setEditingId(null);
            setFormData({
              bond_name: "", isin: "", issuer: "", bond_type: "Government",
              face_value: "1000", quantity: "1", purchase_price: "", current_price: "",
              coupon_rate: "", ytm: "", purchase_date: new Date().toISOString().split("T")[0],
              maturity_date: "", next_interest_date: "", interest_frequency: "Semi-Annual",
              credit_rating: "", platform: "Wint", demat_account: "", account_id: "", notes: "",
              accrued_interest: "0", total_interest_earned: "0", current_value: ""
            });
            mutate();
          } else {
          toast.error(result.error);
        }
        return;
      }

      // Client-side validation to prevent NaN/empty values reaching the RPC
      const purchasePrice = parseFloat(formData.purchase_price);
      const couponRate = parseFloat(formData.coupon_rate);
      const faceValue = parseFloat(formData.face_value);
      const quantity = parseInt(formData.quantity);

      if (!formData.bond_name.trim() || !formData.isin.trim() || !formData.issuer.trim()) {
        toast.error("Bond name, ISIN, and issuer are required");
        return;
      }
      if (isNaN(purchasePrice) || purchasePrice <= 0) {
        toast.error("Please enter a valid purchase price");
        return;
      }
      if (isNaN(couponRate) || couponRate < 0) {
        toast.error("Please enter a valid coupon rate");
        return;
      }
      if (!formData.maturity_date) {
        toast.error("Maturity date is required");
        return;
      }

      const result = await createBond({
        ...formData,
        face_value: faceValue || 1000,
        quantity: quantity || 1,
        purchase_price: purchasePrice,
        current_price: parseFloat(formData.current_price) || purchasePrice,
        coupon_rate: couponRate,
        ytm: formData.ytm ? parseFloat(formData.ytm) : undefined,
        bond_type: formData.bond_type as "Government" | "Corporate" | "Tax-Free" | "Infrastructure" | "PSU",
        interest_frequency: formData.interest_frequency as "Monthly" | "Quarterly" | "Semi-Annual" | "Annual",
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
          accrued_interest: "0", total_interest_earned: "0", current_value: ""
        });
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleRevert(logId: string | null) {
    if (!logId) return toast.error("No ledger log found for this transaction");
    if (!confirm("Revert this transaction? This will undo the bond transaction and reverse any account transactions.")) return;
    const res = await revertLedgerLog(logId);
    if (!res.error) {
      toast.success("Transaction reverted");
      mutate();
    } else toast.error(res.error);
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

  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[--text-primary]">Fixed Income Securities</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Bonds Portfolio Management</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary !h-11 px-6 text-xs font-bold uppercase tracking-wider">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Add Bond
        </button>
      </div>

      {/* Summary Cards */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-5 gap-4 px-4">
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Invested Capital</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">+₹{stats.totalInvested.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Market Valuation</span>
          <span className="text-xl md:text-2xl font-black tabular-nums text-success">+₹{stats.currentValue.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Total P&L</span>
          <div className="flex flex-col">
            <span className={`text-xl md:text-2xl font-black tabular-nums ${stats.totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
              {stats.totalPnL >= 0 ? '+' : '-'}₹{Math.abs(stats.totalPnL).toLocaleString()}
            </span>
            <span className={`text-[10px] font-black ${stats.totalPnL >= 0 ? 'text-success' : 'text-danger'} opacity-60`}>
              ({stats.totalPnL >= 0 ? '+' : ''}{stats.totalInvested > 0 ? ((stats.totalPnL / stats.totalInvested) * 100).toFixed(2) : '0.00'}%)
            </span>
          </div>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Interest Earned</span>
          <span className="text-xl md:text-2xl font-black tabular-nums text-success">₹{stats.totalInterest.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Avg. YTM</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">{stats.avgYTM.toFixed(2)}%</span>
        </div>
      </div>

      {/* Tabs & Sync */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-8">
          <button type="button"
            onClick={() => setActiveTab("holdings")}
            className={`text-xs font-black uppercase tracking-widest pb-3 px-1 transition-all ${activeTab === "holdings" ? "text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]" : "text-[--text-muted] hover:text-[--text-primary]"}`}
          >
            Holdings ({bonds.length})
          </button>
          <button type="button"
            onClick={() => setActiveTab("history")}
            className={`text-xs font-black uppercase tracking-widest pb-3 px-1 transition-all ${activeTab === "history" ? "text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]" : "text-[--text-muted] hover:text-[--text-primary]"}`}
          >
            Transactions
          </button>
        </div>
      </div>

      {/* Holdings View */}
      {activeTab === "holdings" && (
        <div className="mx-4">
          {bonds.length === 0 ? (
            <EmptyState
              title="No Bonds in Portfolio"
              description="Start building your fixed income portfolio with government and corporate bonds"
              icon="📜"
              glowColor="indigo"
              action={
                <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary shadow-2xl shadow-[--accent-primary]/20">Add Your First Bond</button>
              }
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block glass-card-static table-responsive-wrapper">
                <table className="w-full text-left border-collapse min-w-[900px]">
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
                    {bonds.map((bond) => {
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
                            <span className="text-[14px] font-black text-success tabular-nums">{Number(bond.coupon_rate).toFixed(2)}%</span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <span className="text-[13px] font-bold text-[--text-primary] tabular-nums">{bond.ytm ? Number(bond.ytm).toFixed(2) : "—"}%</span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <span className="text-[13px] font-medium text-[--text-secondary] tabular-nums">₹{Number(bond.total_invested).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <span className="text-[14px] font-bold text-[--text-primary] tabular-nums">+₹{Number(bond.current_value).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`text-[14px] font-black tabular-nums ${pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                                {pnl >= 0 ? '+' : '-'}₹{Math.abs(pnl).toLocaleString()}
                              </span>
                              <span className={`text-[10px] font-bold tabular-nums opacity-60 ${pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                                {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-[--text-primary]">{format(parseISO(bond.maturity_date), "MMM d, yyyy")}</span>
                                <span className={`text-[10px] font-bold ${daysToMaturity < 90 ? 'text-warning' : 'text-[--text-muted]'}`}>
                                  {daysToMaturity} days
                                </span>
                              </div>
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); startEdit(bond); }}
                                className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white text-[9px] font-black uppercase rounded transition-all ml-4 opacity-0 group-hover:opacity-100"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {bonds.map((bond) => {
                  const daysToMaturity = differenceInDays(parseISO(bond.maturity_date), new Date());
                  const pnl = Number(bond.current_value) - Number(bond.total_invested);
                  const pnlPercent = (pnl / Number(bond.total_invested)) * 100;
                  const isProfit = pnl >= 0;
                  const bondTypeColor = getBondTypeColor(bond.bond_type);
                  const ratingColor = getRatingColor(bond.credit_rating);

                  return (
                    <div key={bond.id} className="glass-card-static p-5 active:bg-white/[0.04] transition-all relative overflow-hidden">
                      <div className="flex justify-between items-start gap-2 mb-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white leading-tight">{bond.bond_name}</span>
                          <span className="text-[10px] text-[--text-muted] font-medium mt-1">{bond.issuer}</span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
                            <span className="text-[8px] text-[--text-muted] font-bold tracking-tight">ISIN: {bond.isin}</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className={`text-[15px] font-black ${isProfit ? 'text-success' : 'text-danger'}`}>
                            {isProfit ? '+' : ''}₹{formatNum(pnl)}
                          </span>
                          <span className={`text-[10px] font-bold opacity-60 ${isProfit ? 'text-success' : 'text-danger'}`}>
                            {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 border-t border-white/5 pt-3 mb-4 text-[12px] overflow-hidden">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Quantity</p>
                          <p className="font-bold text-white">{bond.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Coupon Rate</p>
                          <p className="font-black text-success text-[13px]">{Number(bond.coupon_rate).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">YTM</p>
                          <p className="font-bold text-white">{bond.ytm ? `${Number(bond.ytm).toFixed(2)}%` : '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Current Value</p>
                          <p className="font-bold text-[--accent-primary-light]">₹{Number(bond.current_value).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Invested Capital</p>
                          <p className="font-medium text-[--text-secondary]">₹{Number(bond.total_invested).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Maturity</p>
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-white text-[11px]">{format(parseISO(bond.maturity_date), "MMM d, yyyy")}</span>
                            <span className={`text-[9px] font-bold ${daysToMaturity < 90 ? 'text-warning' : 'text-[--text-muted]'}`}>
                              ({daysToMaturity} days)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button type="button" 
                          onClick={() => startEdit(bond)} 
                          className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Edit Holding Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Transactions History View */}
      {activeTab === "history" && (
        <div className="mx-4">
          {(bondTransactions || []).length === 0 ? (
            <EmptyState
              title="No Transactions Yet"
              description="Bond transactions will appear here after your first purchase or interest payment."
              icon="📜"
              glowColor="indigo"
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block glass-card-static table-responsive-wrapper">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Date</th>
                      <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Type</th>
                      <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">Quantity</th>
                      <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">Price</th>
                      <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em] text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {(bondTransactions || []).map((txn) => {
                      const typeColors: Record<string, string> = {
                        BUY: 'text-[--accent-primary]',
                        SELL: 'text-danger',
                        INTEREST: 'text-success',
                        MATURITY: 'text-warning',
                      };
                      return (
                        <tr key={txn.id} className="hover:bg-white/[0.015] transition-colors group">
                          <td className="px-6 py-4 text-[13px] font-medium text-[--text-primary]">
                            {txn.transaction_date ? format(parseISO(txn.transaction_date), "MMM d, yyyy") : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 ${typeColors[txn.transaction_type] || 'text-[--text-muted]'}`}>
                              {txn.transaction_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-[13px] font-bold text-[--text-primary] tabular-nums">
                            {txn.quantity || "—"}
                          </td>
                          <td className="px-6 py-4 text-right text-[13px] font-medium text-[--text-secondary] tabular-nums">
                            {txn.price_per_bond ? `₹${Number(txn.price_per_bond).toLocaleString()}` : "—"}
                          </td>
                          <td className="px-6 py-4 text-right text-[14px] font-black text-[--text-primary] tabular-nums flex items-center justify-end gap-4">
                            <span>₹{Number(txn.amount).toLocaleString()}</span>
                            {(() => {
                              const matchingLog = ledgerLogs?.find(log => 
                                log.source_type === 'bond' && 
                                log.source_id === txn.bond_id && 
                                Number(log.amount) === Number(txn.amount)
                              );
                              return matchingLog ? (
                                <button type="button" 
                                  onClick={() => handleRevert(matchingLog.id)}
                                  disabled={submitting}
                                  className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10"
                                >
                                  Revert
                                </button>
                              ) : null;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-4">
                {(bondTransactions || []).map((txn) => {
                  const typeColors: Record<string, string> = {
                    BUY: 'text-[--accent-primary]',
                    SELL: 'text-danger',
                    INTEREST: 'text-success',
                    MATURITY: 'text-warning',
                  };
                  return (
                    <div key={txn.id} className="glass-card-static p-4 border-white/5">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-bold text-[--text-muted]">
                          {txn.transaction_date ? format(parseISO(txn.transaction_date), "MMM d, yyyy") : "—"}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 ${typeColors[txn.transaction_type] || 'text-[--text-muted]'}`}>
                          {txn.transaction_type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-[12px] border-t border-white/5 pt-3 mb-3">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-[--text-muted]">Quantity</p>
                          <p className="font-bold text-white">{txn.quantity || "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] uppercase tracking-wider text-[--text-muted]">Price</p>
                          <p className="font-bold text-white">{txn.price_per_bond ? `₹${Number(txn.price_per_bond).toLocaleString()}` : "—"}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#666]">Total Amount</span>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm text-white">
                            ₹{Number(txn.amount).toLocaleString()}
                          </span>
                          {(() => {
                            const matchingLog = ledgerLogs?.find(log => 
                              log.source_type === 'bond' && 
                              log.source_id === txn.bond_id && 
                              Number(log.amount) === Number(txn.amount)
                            );
                            return matchingLog ? (
                              <button type="button" 
                                onClick={() => handleRevert(matchingLog.id)}
                                disabled={submitting}
                                className="text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10"
                              >
                                Revert
                              </button>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? 'Edit Bond Holding' : 'Add Bond Investment'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Bond Name</label>
                <input required className="input-premium" value={formData.bond_name} onChange={e => setFormData({...formData, bond_name: e.target.value})} placeholder="e.g., 7.18% Govt of India 2033" autoComplete="new-password" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">ISIN</label>
                <input required className="input-premium" value={formData.isin} onChange={e => setFormData({...formData, isin: e.target.value})} placeholder="INE123A01012" autoComplete="new-password" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Issuer</label>
                <input required className="input-premium" value={formData.issuer} onChange={e => setFormData({...formData, issuer: e.target.value})} placeholder="Government of India" autoComplete="new-password" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Bond Type</label>
                <select aria-label="Select bond type" id="bond-type" name="bond_type" className="input-premium" value={formData.bond_type} onChange={e => setFormData({...formData, bond_type: e.target.value})}>
                  {BOND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Credit Rating</label>
                <input className="input-premium" value={formData.credit_rating} onChange={e => setFormData({...formData, credit_rating: e.target.value})} placeholder="e.g. CRISIL AAA" autoComplete="new-password" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Face Value</label>
                <input required type="number" className="input-premium tabular-nums" value={formData.face_value} onChange={e => setFormData({...formData, face_value: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Quantity</label>
                <input required type="number" className="input-premium tabular-nums" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Purchase Price</label>
                <input required type="number" step="0.01" className="input-premium tabular-nums" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Current Price (Market LTP)</label>
                <input required type="number" step="0.01" className="input-premium tabular-nums" value={formData.current_price} onChange={e => setFormData({...formData, current_price: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Current Total Value</label>
                <input required type="number" step="0.01" className="input-premium tabular-nums" value={formData.current_value} onChange={e => setFormData({...formData, current_value: e.target.value})} placeholder="Leave blank to auto-calculate" autoComplete="new-password" inputMode="decimal" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Coupon Rate (%)</label>
                <input required type="number" step="0.01" className="input-premium tabular-nums" value={formData.coupon_rate} onChange={e => setFormData({...formData, coupon_rate: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Yield to Maturity (YTM %)</label>
                <input type="number" step="0.01" className="input-premium tabular-nums" value={formData.ytm} onChange={e => setFormData({...formData, ytm: e.target.value})} placeholder="7.25" autoComplete="new-password" inputMode="decimal" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Interest Frequency</label>
                <select aria-label="Select interest frequency" id="bond-interest-freq" name="interest_frequency" className="input-premium" value={formData.interest_frequency} onChange={e => setFormData({...formData, interest_frequency: e.target.value})}>
                  {INTEREST_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Purchase Date</label>
                <input required type="date" className="input-premium" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} autoComplete="new-password" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Maturity Date</label>
                <input required type="date" className="input-premium" value={formData.maturity_date} onChange={e => setFormData({...formData, maturity_date: e.target.value})} autoComplete="new-password" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Next Interest Payment Date</label>
                <input type="date" className="input-premium" value={formData.next_interest_date} onChange={e => setFormData({...formData, next_interest_date: e.target.value})} autoComplete="new-password" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Platform</label>
                <input className="input-premium" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} placeholder="Wint" autoComplete="new-password" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Accrued Interest</label>
                <input required type="number" step="0.01" className="input-premium tabular-nums" value={formData.accrued_interest} onChange={e => setFormData({...formData, accrued_interest: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Total Interest Earned</label>
                <input required type="number" step="0.01" className="input-premium tabular-nums" value={formData.total_interest_earned} onChange={e => setFormData({...formData, total_interest_earned: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            {!editingId ? (
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Deduct from Account</label>
                <select aria-label="Select account" id="bond-account" name="account_id" className="input-premium" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                  <option value="">No Deduction</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
                {formData.account_id && (() => {
                  const selectedAcc = accounts.find(a => a.id === formData.account_id);
                  return selectedAcc ? (
                    <div className="mt-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
                      <span className="font-medium">Selected Balance</span>
                      <span className="font-bold text-white tabular-nums">
                        {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            ) : null}

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Notes</label>
              <textarea className="input-premium min-h-[80px] resize-none" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Optional notes" />
            </div>

            <div className="pt-4 mt-8">
              <button type="submit" disabled={submitting} className="btn-primary w-full h-12 text-[11px] font-black uppercase tracking-widest shadow-xl shadow-[--accent-primary]/20">
                {editingId ? "Update Bond Details" : submitting ? "Adding..." : "Add Bond"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
