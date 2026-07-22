"use client";

import { useState, useMemo, useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { createBond, updateBond } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import { getColorByLabel } from "@/lib/chart-colours";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

import BondsDataTable from "./components/BondsDataTable";

import type { Tables } from "@/lib/database.types";
type Bond = Tables<"bonds">;

const MOCK_BOND_DB: Record<string, {
  bond_name: string;
  issuer: string;
  bond_type: "Government" | "Corporate" | "Tax-Free" | "Infrastructure" | "PSU";
  face_value: number;
  coupon_rate: number;
  ytm: number;
  interest_frequency: "Monthly" | "Quarterly" | "Semi-Annual" | "Annual";
  credit_rating: string;
  current_price: number;
  maturity_date: string;
}> = {
  "IN0020230085": {
    bond_name: "7.18% GS 2033",
    issuer: "Government of India",
    bond_type: "Government",
    face_value: 1000,
    coupon_rate: 7.18,
    ytm: 7.18,
    interest_frequency: "Semi-Annual",
    credit_rating: "Sovereign",
    current_price: 1005.50,
    maturity_date: "2033-08-14"
  },
  "IN0020210244": {
    bond_name: "6.10% GS 2031",
    issuer: "Government of India",
    bond_type: "Government",
    face_value: 1000,
    coupon_rate: 6.10,
    ytm: 6.85,
    interest_frequency: "Semi-Annual",
    credit_rating: "Sovereign",
    current_price: 955.20,
    maturity_date: "2031-07-12"
  },
  "INE901L07347": {
    bond_name: "8.30% NHAI Tax Free 2034",
    issuer: "National Highways Authority of India",
    bond_type: "Tax-Free",
    face_value: 1000,
    coupon_rate: 8.30,
    ytm: 5.60,
    interest_frequency: "Annual",
    credit_rating: "AAA",
    current_price: 1250.00,
    maturity_date: "2034-01-25"
  },
  "INE020B07355": {
    bond_name: "8.71% REC Tax Free 2029",
    issuer: "REC Limited",
    bond_type: "Tax-Free",
    face_value: 1000,
    coupon_rate: 8.71,
    ytm: 5.45,
    interest_frequency: "Annual",
    credit_rating: "AAA",
    current_price: 1195.00,
    maturity_date: "2029-09-24"
  },
  "INE134E07567": {
    bond_name: "8.20% PFC Tax Free 2030",
    issuer: "Power Finance Corporation",
    bond_type: "Tax-Free",
    face_value: 1000,
    coupon_rate: 8.20,
    ytm: 5.50,
    interest_frequency: "Annual",
    credit_rating: "AAA",
    current_price: 1160.00,
    maturity_date: "2030-11-16"
  },
  "INE516F07409": {
    bond_name: "9.25% Piramal NCD 2027",
    issuer: "Piramal Enterprises Limited",
    bond_type: "Corporate",
    face_value: 1000,
    coupon_rate: 9.25,
    ytm: 9.50,
    interest_frequency: "Monthly",
    credit_rating: "AA",
    current_price: 990.00,
    maturity_date: "2027-06-18"
  },
  "INE895D07849": {
    bond_name: "8.75% Muthoot Finance NCD 2028",
    issuer: "Muthoot Finance Limited",
    bond_type: "Corporate",
    face_value: 1000,
    coupon_rate: 8.75,
    ytm: 8.90,
    interest_frequency: "Annual",
    credit_rating: "AA+",
    current_price: 1002.00,
    maturity_date: "2028-12-15"
  },
  "INE121A07QD6": {
    bond_name: "9.05% Shriram Finance NCD 2027",
    issuer: "Shriram Finance Limited",
    bond_type: "Corporate",
    face_value: 1000,
    coupon_rate: 9.05,
    ytm: 9.20,
    interest_frequency: "Monthly",
    credit_rating: "AA+",
    current_price: 1010.00,
    maturity_date: "2027-04-20"
  }
};

export default function BondsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { bonds: bondsData, accounts, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "holdings" | "history">("dashboard");

  const mounted = useHasMounted();

  const bonds = useMemo(() => (bondsData || []).filter(b => b.status === 'Active') as Bond[], [bondsData]);
  const historyBonds = useMemo(() => (bondsData || []).filter(b => b.status !== 'Active') as Bond[], [bondsData]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{isin: string, data: any}[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      const timer = setTimeout(() => {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    const q = searchQuery.toLowerCase();
    const results = Object.entries(MOCK_BOND_DB).filter(([isin, data]) => 
      isin.toLowerCase().includes(q) || data.bond_name.toLowerCase().includes(q) || data.issuer.toLowerCase().includes(q)
    ).map(([isin, data]) => ({ isin, data }));
    const timer = setTimeout(() => {
      setSearchResults(results);
      setShowSearchDropdown(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      const chosenAccount = defaultAccExists ? defaultAccId : accounts[0].id;
      setTimeout(() => {
        setFormData(prev => ({ ...prev, account_id: chosenAccount }));
      }, 0);
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
    <div className="flex flex-col gap-8 animate-in fade-in duration-700 bg-[#0A0F1D] min-h-screen text-[#EAECSF] p-2 sm:p-4 rounded-3xl relative">
      {/* Background Ambient Wint Wealth Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-[#00D09C]/5 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 -left-32 w-[550px] h-[550px] bg-sky-500/5 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 flex flex-col gap-8">
        
        {/* Wint Wealth Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[#111827] p-6 rounded-2xl border border-[#1F293D] shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#00D09C]/10 border border-[#00D09C]/30 flex items-center justify-center text-[#00D09C] shadow-[0_0_20px_rgba(0,208,156,0.2)]">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight uppercase">Wint Wealth Bonds</h1>
                <span className="text-[0.625rem] bg-[#00D09C]/20 text-[#00D09C] border border-[#00D09C]/30 px-2 py-0.5 rounded font-black tracking-widest uppercase">FIXED INCOME</span>
              </div>
              <p className="text-xs text-[#848E9C] font-semibold mt-1">High Yield Fixed Income • Senior Secured Corporate NCDs & Sovereign Bonds</p>
            </div>
          </div>

          <button type="button" onClick={() => { 
            setFormData({
              bond_name: "", isin: "", issuer: "", bond_type: "Corporate",
              face_value: "1000", quantity: "1", purchase_price: "1000", current_price: "1000",
              coupon_rate: "10.5", ytm: "10.5", purchase_date: new Date().toISOString().split("T")[0],
              maturity_date: "", next_interest_date: "", interest_frequency: "Monthly",
              credit_rating: "AAA", platform: "Wint Wealth", demat_account: "", account_id: "", notes: "",
              accrued_interest: "0", total_interest_earned: "0", current_value: ""
            });
            setEditingId(null);
            setShowAddModal(true); 
          }} disabled={submitting} className="bg-[#00D09C] hover:bg-[#00b386] text-black font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,208,156,0.3)] flex items-center gap-2 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            + Invest in Bond
          </button>
        </div>

        {bonds.length === 0 ? (
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px] shadow-2xl relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#00D09C]/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="relative mb-6 p-6 rounded-3xl bg-[#0A0F1D] border border-[#1F293D] shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-[#00D09C]/15 border border-[#00D09C]/30 flex items-center justify-center shadow-[0_0_30px_rgba(0,208,156,0.2)] animate-pulse">
                <span className="text-3xl">🏛️</span>
              </div>
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">No Active Bond Holdings</h3>
            <p className="text-sm text-[#848E9C] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Lock in predictable fixed interest returns up to 11.5% p.a. with senior-secured corporate bonds and sovereign gold bonds.</p>
            <div className="mt-8 flex justify-center">
               <button onClick={() => setShowAddModal(true)} className="bg-[#00D09C] text-black font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider hover:bg-[#00b386] transition-all shadow-[0_0_20px_rgba(0,208,156,0.3)] cursor-pointer">+ Add Bond Investment</button>
            </div>
          </div>
        ) : (
        <>
          {/* Top Wint Stats Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#848E9C] mb-2">Total Bond Capital</p>
              <p className="text-2xl font-black text-white">₹{stats.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-[0.5625rem] font-bold text-[#848E9C] mt-2 uppercase tracking-widest">Deployed Capital</p>
            </div>
            <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#848E9C] mb-2">Current Valuation</p>
              <p className="text-2xl font-black text-[#00D09C]">₹{stats.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-[0.5625rem] font-bold text-[#848E9C] mt-2 uppercase tracking-widest">Market Value</p>
            </div>
            <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#848E9C] mb-2">Interest Payouts</p>
              <p className="text-2xl font-black text-[#00D09C]">₹{stats.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-[0.5625rem] font-bold text-[#848E9C] mt-2 uppercase tracking-widest">Received Payouts</p>
            </div>
            <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#848E9C] mb-2">Accrued Coupon</p>
              <p className="text-2xl font-black text-amber-400">₹{stats.accruedInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-[0.5625rem] font-bold text-[#848E9C] mt-2 uppercase tracking-widest">Next Payout Cycle</p>
            </div>
            <div className="bg-[#111827] border border-[#00D09C]/30 rounded-2xl p-5 shadow-xl relative overflow-hidden bg-gradient-to-br from-[#00D09C]/10 to-transparent">
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#00D09C] mb-2">Weighted YTM</p>
              <p className="text-2xl font-black text-white truncate">
                {stats.avgYTM > 0 ? `${stats.avgYTM.toFixed(2)}% p.a.` : "N/A"}
              </p>
              <p className="text-[0.5625rem] font-bold text-[#848E9C] mt-2 uppercase tracking-widest">Annual Yield</p>
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex p-1 bg-[#111827] border border-[#1F293D] rounded-2xl max-w-fit shadow-inner">
            {[
              { key: "dashboard", label: "Overview" },
              { key: "holdings", label: "Bond Portfolio", badge: bonds.length },
              { key: "history", label: "Matured Bonds", badge: historyBonds.length }
            ].map((tab) => {
              const isActive = activeView === tab.key;
              
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveView(tab.key as any)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer ${
                    isActive
                      ? "bg-[#00D09C] text-black shadow-[0_0_15px_rgba(0,208,156,0.3)] font-extrabold"
                      : "text-[#848E9C] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                  {tab.badge !== undefined && (
                    <span className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1.5 text-[0.5rem] font-black ${
                      isActive ? "bg-black/20 text-black" : "bg-white/10 text-white"
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* View Content */}
          {activeView === "dashboard" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Invested vs Current Bar Chart */}
                <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-6 lg:col-span-2 min-h-[400px] flex flex-col shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#848E9C]">Wint Wealth Bond Yield Analysis</h3>
                      <p className="text-2xl font-black mt-1 text-white">Invested Capital vs Market Value</p>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[250px] w-full mt-4 -ml-4">
                    {mounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fill: "#848E9C", fontSize: 12 }} />
                          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#848E9C", fontSize: 12 }} width={100} />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: "#111827", border: "1px solid #1F293D", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.8)" }}
                            itemStyle={{ color: "#00D09C", fontWeight: "bold" }}
                            formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, ""]}
                          />
                          <Legend wrapperStyle={{ paddingTop: "20px" }} />
                          <Bar dataKey="Invested" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="Current" fill="#00D09C" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Allocation Pie Chart */}
                <div className="bg-[#111827] border border-[#1F293D] rounded-2xl p-6 flex flex-col items-center justify-center relative min-h-[400px] shadow-2xl">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#848E9C] absolute top-6 left-6">Credit Breakdown</h3>
                  <div className="w-full h-[250px] mt-8">
                    {mounted && pieChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value">
                            {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="#111827" strokeWidth={2} />)}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: "#111827", border: "1px solid #1F293D", borderRadius: "12px" }}
                            itemStyle={{ color: "#fff", fontWeight: "bold" }}
                            formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Valuation"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#848E9C]">
                         <span className="text-3xl mb-2">📊</span>
                         <span className="text-xs uppercase tracking-widest font-bold">No Allocation Data</span>
                      </div>
                    )}
                  </div>
                  {pieChartData.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
                      {pieChartData.slice(0, 5).map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5 text-xs bg-[#0A0F1D] px-2.5 py-1 rounded-lg border border-[#1F293D]">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                          <span className="text-[#848E9C] font-semibold">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {activeView === "holdings" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <BondsDataTable 
                bonds={bonds} 
                onEdit={startEdit} 
                onAdd={() => setShowAddModal(true)} 
              />
            </div>
          )}

          {activeView === "history" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <BondsDataTable 
                bonds={historyBonds} 
                onEdit={startEdit} 
                onAdd={() => setShowAddModal(true)} 
              />
            </div>
          )}
        </>
        )}

        {/* Wint Wealth Add / Edit Bond Drawer */}
        {showAddModal && (
          <Drawer
            isOpen={showAddModal}
            onClose={() => { setShowAddModal(false); setEditingId(null); }}
            title={editingId ? "Modify Bond Investment" : "Wint Wealth - Record Bond"}
          >
            <div className="p-1 max-w-2xl mx-auto w-full text-white">
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Wint Wealth Search & Quick Suggestions */}
                {!formData.bond_name ? (
                  <div className="space-y-3 relative">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#848E9C]">Search Bond Issue / ISIN</label>
                    <div className="relative">
                      <input 
                        autoFocus
                        className="w-full bg-[#0A0F1D] border border-[#1F293D] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00D09C] placeholder-[#848E9C]" 
                        placeholder="Search e.g. InCred, Navi, SGB, Piramal..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                    {showSearchDropdown && searchResults.length > 0 && (
                      <div className="absolute z-[120] left-0 right-0 top-[100%] mt-1 bg-[#111827] border border-[#1F293D] rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                        {searchResults.map((res, i) => (
                          <div 
                            key={i} 
                            className="px-4 py-3 hover:bg-[#1F293D] cursor-pointer transition-colors border-b border-[#1F293D]/50 last:border-0 flex items-center justify-between"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                isin: res.isin,
                                bond_name: res.data.bond_name,
                                issuer: res.data.issuer,
                                bond_type: res.data.bond_type,
                                face_value: res.data.face_value.toString(),
                                coupon_rate: res.data.coupon_rate.toString(),
                                ytm: res.data.ytm.toString(),
                                interest_frequency: res.data.interest_frequency,
                                credit_rating: res.data.credit_rating,
                                current_price: res.data.current_price.toString(),
                                purchase_price: res.data.current_price.toString(),
                                maturity_date: res.data.maturity_date,
                              }));
                              setSearchQuery("");
                              setShowSearchDropdown(false);
                            }}
                          >
                            <div>
                              <div className="text-xs font-bold text-[#00D09C]">{res.data.bond_name}</div>
                              <div className="text-[0.6875rem] text-[#848E9C]">{res.isin} • {res.data.issuer} • {res.data.credit_rating}</div>
                            </div>
                            <span className="text-[0.5625rem] bg-[#00D09C]/20 text-[#00D09C] px-2 py-0.5 rounded font-black uppercase tracking-wider">Select</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2">
                      <button 
                        type="button" 
                        className="text-xs text-[#00D09C] hover:underline font-bold cursor-pointer"
                        onClick={() => setFormData(prev => ({...prev, bond_name: "Custom Corporate Bond", isin: "INE000000000", credit_rating: "AA"}))}
                      >
                        + Enter custom bond details manually
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Selected Bond Card */
                  <div className="bg-[#0A0F1D] border border-[#00D09C]/30 p-4 rounded-xl flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-[#00D09C]/10 rounded-xl border border-[#00D09C]/20 text-[#00D09C]">📜</span>
                      <div>
                        <p className="text-xs font-extrabold text-[#00D09C]">{formData.bond_name}</p>
                        <p className="text-[0.6875rem] text-[#848E9C] font-semibold uppercase mt-0.5">{formData.isin} • {formData.issuer} • <span className="text-[#00D09C]">{formData.credit_rating || "AAA"} Rated</span></p>
                      </div>
                    </div>
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, bond_name: "", isin: "" }))}
                        className="text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-2.5 py-1 rounded transition-all font-bold cursor-pointer"
                      >
                        Change
                      </button>
                    )}
                  </div>
                )}

                {/* Main Inputs */}
                {formData.bond_name && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#848E9C] uppercase tracking-wide">Units / Quantity</label>
                        <input required type="number" className="w-full bg-[#0A0F1D] border border-[#1F293D] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#848E9C] uppercase tracking-wide">Purchase Price / Unit (₹)</label>
                        <input required type="number" step="any" className="w-full bg-[#0A0F1D] border border-[#1F293D] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} />
                      </div>
                    </div>

                    {/* Wint Wealth Live Interest Payout Calculator Preview Box */}
                    {Boolean(formData.quantity) && Boolean(formData.purchase_price) && (
                      <div className="bg-[#0A0F1D] border border-[#00D09C]/40 p-3.5 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs border-b border-[#1F293D] pb-2">
                          <span className="text-[#848E9C] font-semibold">Total Capital Investment</span>
                          <span className="font-extrabold text-white">₹{(Number(formData.quantity) * Number(formData.purchase_price)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#848E9C] font-semibold">Expected Annual Interest ({formData.coupon_rate || "10.5"}%)</span>
                          <span className="font-extrabold text-[#00D09C]">₹{((Number(formData.quantity) * Number(formData.purchase_price) * (Number(formData.coupon_rate || 10.5) / 100))).toLocaleString("en-IN", { maximumFractionDigits: 0 })} / year</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#848E9C] font-semibold">Monthly Interest Payout</span>
                          <span className="font-extrabold text-[#00D09C]">₹{(((Number(formData.quantity) * Number(formData.purchase_price) * (Number(formData.coupon_rate || 10.5) / 100))) / 12).toLocaleString("en-IN", { maximumFractionDigits: 0 })} / month</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#848E9C] uppercase tracking-wide">Purchase Date</label>
                        <input type="date" required className="w-full bg-[#0A0F1D] border border-[#1F293D] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} />
                      </div>
                      {!editingId && (
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-[#848E9C] uppercase tracking-wide">Channeling Account</label>
                          <select className="w-full bg-[#0A0F1D] border border-[#1F293D] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                            <option value="" disabled>Select Account</option>
                            {accounts.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <details className="group bg-[#0A0F1D] border border-[#1F293D] rounded-xl overflow-hidden mt-3">
                      <summary className="text-xs font-bold uppercase tracking-wider text-[#848E9C] p-3 cursor-pointer select-none hover:text-[#00D09C] transition-colors">
                        Additional Bond Terms & Credit Ratings →
                      </summary>
                      <div className="p-4 space-y-4 pt-2">
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[0.6875rem] font-bold text-[#848E9C] uppercase">Issuer Name</label>
                            <input required className="w-full bg-[#111827] border border-[#1F293D] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[#00D09C]" placeholder="e.g. InCred Financial" value={formData.issuer} onChange={e => setFormData({...formData, issuer: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[0.6875rem] font-bold text-[#848E9C] uppercase">Credit Rating</label>
                            <select className="w-full bg-[#111827] border border-[#1F293D] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.credit_rating} onChange={e => setFormData({...formData, credit_rating: e.target.value})}>
                              <option value="AAA">AAA (Highest Safety)</option>
                              <option value="AA+">AA+ (High Safety)</option>
                              <option value="AA">AA (Strong Safety)</option>
                              <option value="A+">A+ (Adequate Safety)</option>
                              <option value="Sovereign">Sovereign (Govt Backed)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[0.6875rem] font-bold text-[#848E9C] uppercase">Coupon (%)</label>
                            <input required type="number" step="any" className="w-full bg-[#111827] border border-[#1F293D] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.coupon_rate} onChange={e => setFormData({...formData, coupon_rate: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[0.6875rem] font-bold text-[#848E9C] uppercase">YTM (%)</label>
                            <input type="number" step="any" className="w-full bg-[#111827] border border-[#1F293D] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[#00D09C]" placeholder="Optional" value={formData.ytm} onChange={e => setFormData({...formData, ytm: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[0.6875rem] font-bold text-[#848E9C] uppercase">Payout Frequency</label>
                            <select className="w-full bg-[#111827] border border-[#1F293D] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.interest_frequency} onChange={e => setFormData({...formData, interest_frequency: e.target.value})}>
                              <option value="Monthly">Monthly Payout</option>
                              <option value="Quarterly">Quarterly Payout</option>
                              <option value="Semi-Annual">Semi-Annual Payout</option>
                              <option value="Annual">Annual Payout</option>
                              <option value="Cumulative">Cumulative (At Maturity)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[0.6875rem] font-bold text-[#848E9C] uppercase">Maturity Date</label>
                            <input type="date" required className="w-full bg-[#111827] border border-[#1F293D] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.maturity_date} onChange={e => setFormData({...formData, maturity_date: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[0.6875rem] font-bold text-[#848E9C] uppercase">Platform</label>
                            <input className="w-full bg-[#111827] border border-[#1F293D] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-[#00D09C]" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} />
                          </div>
                        </div>
                      </div>
                    </details>

                    <div className="pt-2">
                      <button type="submit" disabled={submitting} className="w-full bg-[#00D09C] hover:bg-[#00b386] text-black font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,208,156,0.3)] disabled:opacity-50 cursor-pointer">
                        {submitting ? "Processing..." : (editingId ? "Update Bond Investment" : "Confirm Bond Investment")}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </Drawer>
        )}
      </div>
    </div>
  );
}
