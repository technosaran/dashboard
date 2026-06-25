"use client";

import { useState, useMemo, useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { addLiability, updateLiability, deleteLiability } from "./actions";
import { revertLedgerLog } from "../alternative-assets/actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, parseISO } from "date-fns";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

import LiabilitiesDataTable from "./components/LiabilitiesDataTable";

const CATEGORIES = [
  { label: "Personal Loan", icon: "👤" },
  { label: "Home Loan", icon: "🏠" },
  { label: "Credit Card", icon: "💳" },
  { label: "EMI", icon: "📅" },
  { label: "Vehicle Loan", icon: "🚗" },
  { label: "Business Loan", icon: "🏢" },
  { label: "Others", icon: "📄" },
];

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

export default function LiabilitiesClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { liabilities, ledgerLogs, accounts }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "records">("overview");

  const mounted = useHasMounted();

  const [formData, setFormData] = useState({
    name: "",
    category: "Personal Loan",
    total_amount: "",
    remaining_amount: "",
    interest_rate: "",
    monthly_payment: "",
    due_date: "",
    notes: "",
    account_id: "",
  });

  const stats = useMemo(() => {
    const totalDebt = liabilities.reduce((s, l) => s + Number(l.remaining_amount), 0);
    const totalPrincipal = liabilities.reduce((s, l) => s + Number(l.total_amount), 0);
    const monthlyEMI = liabilities.reduce((s, l) => s + Number(l.monthly_payment || 0), 0);
    const highestInterest = liabilities.reduce((max, l) => Math.max(max, Number(l.interest_rate || 0)), 0);
    const totalPaid = totalPrincipal - totalDebt;
    const payoffPct = totalPrincipal > 0 ? (totalPaid / totalPrincipal) * 100 : 0;
    
    return { totalDebt, monthlyEMI, highestInterest, totalPrincipal, totalPaid, payoffPct };
  }, [liabilities]);

  const pieChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    liabilities.forEach(l => {
      const cat = l.category || "Others";
      catMap[cat] = (catMap[cat] || 0) + Number(l.remaining_amount);
    });
    return Object.entries(catMap).map(([name, value]) => ({
      name,
      value,
      fill: getColorByLabel(name)
    })).sort((a, b) => b.value - a.value);
  }, [liabilities]);

  const barChartData = useMemo(() => {
    return liabilities.map(l => {
      const remaining = Number(l.remaining_amount);
      const paid = Math.max(0, Number(l.total_amount) - remaining);
      return {
        name: l.name.substring(0, 10) + (l.name.length > 10 ? "..." : ""),
        Paid: paid,
        Remaining: remaining,
        Total: Number(l.total_amount)
      };
    }).sort((a, b) => b.Remaining - a.Remaining).slice(0, 10);
  }, [liabilities]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const { account_id, ...libData } = formData;
      const payload = {
        ...libData,
        total_amount: parseFloat(formData.total_amount),
        remaining_amount: parseFloat(formData.remaining_amount),
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
        monthly_payment: formData.monthly_payment ? parseFloat(formData.monthly_payment) : undefined,
        due_date: formData.due_date || undefined,
      };

      const res = editingId 
        ? await updateLiability(editingId, payload)
        : await addLiability({ ...payload, account_id });

      if (!res.error) {
        toast.success(editingId ? "Liability updated" : "Liability recorded");
        setShowAddModal(false);
        setEditingId(null);
        setFormData({ name: "", category: "Personal Loan", total_amount: "", remaining_amount: "", interest_rate: "", monthly_payment: "", due_date: "", notes: "", account_id: "" });
        mutate();
      } else toast.error(res.error);
    });
  }

  async function handleDeleteLiability(id: string) {
    if (!confirm("Permanently purge this debt record?")) return;
    await withLock(async () => {
      const res = await deleteLiability(id);
      if (!res.error) {
        toast.success("Liability deleted successfully");
        mutate();
      } else {
        toast.error(res.error);
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
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Loans & Debts</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Liability Management Terminal</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} disabled={submitting} className="btn-primary !h-11 px-6 !bg-rose-500 hover:!bg-rose-600 shadow-[0_0_30px_rgba(244,63,94,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Record Liability
        </button>
      </div>

      {liabilities.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/15 to-orange-500/15 border border-rose-500/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)] animate-pulse">
              <span className="text-3xl">📉</span>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">No Active Liabilities</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Track loans, EMIs, credit cards, and other debt obligations. Monitor repayment progress and stay on top of your financial commitments.</p>
          <div className="mt-8 flex justify-center">
             <button onClick={() => setShowAddModal(true)} className="btn-primary !bg-rose-500 hover:!bg-rose-600">Record First Liability</button>
          </div>
        </div>
      ) : (
      <>
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Exposure</p>
            <p className="text-2xl md:text-3xl font-black text-rose-500">₹{stats.totalDebt.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Outstanding Principal</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Monthly Commitment</p>
            <p className="text-2xl md:text-3xl font-black text-orange-400">₹{stats.monthlyEMI.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Combined EMIs</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Weighted Interest</p>
            <p className="text-2xl md:text-3xl font-black text-white">{stats.highestInterest.toFixed(1)}%</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Max APR %</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Paid</p>
            <p className="text-2xl md:text-3xl font-black text-white">₹{stats.totalPaid.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Cleared Debt</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-rose-500/10 to-transparent">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Payoff Est</p>
            <p className={`text-2xl md:text-3xl font-black text-white`}>
              {stats.payoffPct.toFixed(1)}%
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Global Progress</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveView("overview")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${
              activeView === "overview"
                ? "border-rose-500 text-rose-500"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView("records")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeView === "records"
                ? "border-rose-500 text-rose-500"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Debt Records
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">
              {liabilities.length}
            </span>
          </button>
        </div>

        {/* View Content */}
        {activeView === "overview" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Paydown Bar Chart */}
              <div className="glass-card-static p-6 lg:col-span-2 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Debt vs Paid (Top 10)</h3>
                    <p className="text-2xl font-black mt-2 text-white">Paydown Analysis</p>
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
                        <Bar dataKey="Paid" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Remaining" stackId="a" fill="#F43F5E" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Allocation Pie Chart */}
              <div className="glass-card-static p-6 flex flex-col items-center justify-center relative min-h-[400px]">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Debt Exposure</h3>
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
                          formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Debt"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                       <span className="text-3xl mb-2">📊</span>
                       <span className="text-xs uppercase tracking-widest font-black">No Category Data</span>
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
            <LiabilitiesDataTable 
              liabilities={liabilities} 
              onEdit={(l) => {
                setEditingId(l.id);
                setFormData({
                  name: l.name,
                  category: l.category || "Personal Loan",
                  total_amount: l.total_amount.toString(),
                  remaining_amount: l.remaining_amount.toString(),
                  interest_rate: (l.interest_rate || "").toString(),
                  monthly_payment: (l.monthly_payment || "").toString(),
                  due_date: l.due_date || "",
                  notes: l.notes || "", 
                  account_id: "",
                });
                setShowAddModal(true);
              }} 
              onDelete={handleDeleteLiability} 
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
          title={editingId ? "Update Liability" : "Record Liability"}
        >
          <form onSubmit={handleSubmit} className="space-y-6 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Liability Name</label>
                <input required className="input-premium" placeholder="e.g. HDFC Home Loan" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoComplete="new-password" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Category</label>
                <select aria-label="Select liability category" id="liability-category" name="category" className="input-premium" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Total Principal (₹)</label>
                <input required type="number" className="input-premium tabular-nums" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Remaining Balance (₹)</label>
                <input required type="number" className="input-premium tabular-nums" value={formData.remaining_amount} onChange={e => setFormData({...formData, remaining_amount: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Interest Rate (%)</label>
                <input type="number" step="0.01" className="input-premium tabular-nums" value={formData.interest_rate} onChange={e => setFormData({...formData, interest_rate: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Monthly EMI (₹)</label>
                <input type="number" className="input-premium tabular-nums" value={formData.monthly_payment} onChange={e => setFormData({...formData, monthly_payment: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Next Due Date</label>
                <input type="date" className="input-premium" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} autoComplete="new-password" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Destination Account (Optional)</label>
                <select aria-label="Select account" id="liability-account" name="account_id" className="input-premium" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                  <option value="">No Transaction</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Notes / Account Number</label>
              <textarea className="input-premium min-h-[100px] py-4 resize-none" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} autoComplete="new-password" />
            </div>

            <div className="pt-4 mt-8">
              <button type="submit" disabled={submitting} className="btn-primary w-full h-12 shadow-xl shadow-[--danger]/20 !bg-danger hover:!bg-rose-600 text-[11px] font-black uppercase tracking-widest">
                {submitting ? "Processing..." : (editingId ? "Update Record" : "Register Liability")}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
