"use client";

import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { addLiability, updateLiability, deleteLiability } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { format, parseISO } from "date-fns";

const CATEGORIES = [
  { label: "Personal Loan", icon: "👤" },
  { label: "Home Loan", icon: "🏠" },
  { label: "Credit Card", icon: "💳" },
  { label: "EMI", icon: "📅" },
  { label: "Vehicle Loan", icon: "🚗" },
  { label: "Business Loan", icon: "🏢" },
  { label: "Others", icon: "📄" },
];

export default function LiabilitiesClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { liabilities }, isValidating } = useFinanceData(initialData);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category: "Personal Loan",
    total_amount: "",
    remaining_amount: "",
    interest_rate: "",
    monthly_payment: "",
    due_date: "",
    notes: "",
  });

  const stats = useMemo(() => {
    const totalDebt = liabilities.reduce((s, l) => s + Number(l.remaining_amount), 0);
    const monthlyEMI = liabilities.reduce((s, l) => s + Number(l.monthly_payment || 0), 0);
    const highestInterest = Math.max(...liabilities.map(l => Number(l.interest_rate || 0)), 0);
    return { totalDebt, monthlyEMI, highestInterest };
  }, [liabilities]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...formData,
      total_amount: parseFloat(formData.total_amount),
      remaining_amount: parseFloat(formData.remaining_amount),
      interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
      monthly_payment: formData.monthly_payment ? parseFloat(formData.monthly_payment) : undefined,
      due_date: formData.due_date || undefined,
    };

    const res = editingId 
      ? await updateLiability(editingId, payload)
      : await addLiability(payload);

    if (!res.error) {
      toast.success(editingId ? "Liability updated" : "Liability added");
      setShowAddModal(false);
      setEditingId(null);
      setFormData({ name: "", category: "Personal Loan", total_amount: "", remaining_amount: "", interest_rate: "", monthly_payment: "", due_date: "", notes: "" });
    } else toast.error(res.error);
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Liabilities & Debt</h1>
          <p className="text-xs text-[--text-muted] font-bold uppercase tracking-[0.3em] mt-2">Debt Management Terminal</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary !h-11 shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.4)]">Record Liability</button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Debt", value: stats.totalDebt, sub: "Outstanding Balance", color: "text-[--danger]", icon: "📉" },
          { label: "Monthly Outflow", value: stats.monthlyEMI, sub: "Total EMIs", color: "text-[--warning]", icon: "💸" },
          { label: "Peak Interest", value: stats.highestInterest, sub: "Highest APR %", color: "text-white", icon: "🔥", isPercent: true },
        ].map((s, i) => (
          <div key={i} className="glass-card-static p-6 border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-4xl opacity-[0.03] group-hover:opacity-[0.07] transition-opacity rotate-12">{s.icon}</div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">{s.label}</p>
            <p className={`text-2xl font-black tabular-nums ${s.color}`}>
              {s.isPercent ? `${s.value}%` : `₹${s.value.toLocaleString()}`}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Liabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {liabilities.map((l) => {
          const category = CATEGORIES.find(c => c.label === l.category) || CATEGORIES[6];
          const progress = (Number(l.total_amount) - Number(l.remaining_amount)) / Number(l.total_amount) * 100;
          
          return (
            <div key={l.id} className="glass-card flex flex-col min-h-[280px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1 group border-white/5">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[--danger] via-[--warning] to-[--danger]" />
              
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                 <button onClick={() => {
                   setEditingId(l.id);
                   setFormData({
                     name: l.name,
                     category: l.category,
                     total_amount: l.total_amount.toString(),
                     remaining_amount: l.remaining_amount.toString(),
                     interest_rate: (l.interest_rate || "").toString(),
                     monthly_payment: (l.monthly_payment || "").toString(),
                     due_date: l.due_date || "",
                     notes: l.notes || "",
                   });
                   setShowAddModal(true);
                 }} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-[--text-muted] flex items-center justify-center hover:bg-white/10 hover:text-white transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                 </button>
                 <button onClick={() => { if(confirm("Delete this liability?")) deleteLiability(l.id); }} className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
              </div>

              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[--danger]/10 flex items-center justify-center text-xl shadow-inner border border-white/5">
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white group-hover:text-[--danger-light] transition-colors">{l.name}</h3>
                    <p className="text-[10px] font-bold text-[--text-muted] uppercase tracking-[0.2em] mt-0.5">{l.category}</p>
                  </div>
                </div>
                {l.interest_rate && (
                  <span className="text-[10px] font-black px-3 py-1 bg-white/5 text-white rounded-full uppercase tracking-widest border border-white/10">
                    {l.interest_rate}%
                  </span>
                )}
              </div>

              <div className="mt-auto space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Repayment Progress</span>
                    <span className="text-[10px] font-black text-white tabular-nums">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[--danger] to-[--warning] transition-all duration-1000" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-[8px] font-black text-[--text-muted] uppercase tracking-widest mb-1">Remaining</p>
                    <p className="text-[13px] font-black text-white tabular-nums">₹{l.remaining_amount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-right">
                    <p className="text-[8px] font-black text-[--text-muted] uppercase tracking-widest mb-1">Monthly EMI</p>
                    <p className="text-[13px] font-black text-[--warning] tabular-nums">₹{(l.monthly_payment || 0).toLocaleString()}</p>
                  </div>
                </div>
                
                {l.due_date && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <div className="status-dot scale-75 bg-[--warning]" />
                    <span className="text-[9px] font-bold text-[--text-muted] uppercase tracking-widest">Next Due: {format(parseISO(l.due_date), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/90 backdrop-blur-xl animate-fade-in shadow-2xl">
          <div className="glass-card-static w-full max-w-2xl p-6 md:p-10 border-[--danger]/20 shadow-[0_0_100px_rgba(239,68,68,0.1)] max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-black">{editingId ? "Update Liability" : "Record Liability"}</h2>
              <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className="text-[--text-muted] hover:text-white transition-colors"><svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Liability Name</label>
                  <input required className="input-premium" placeholder="e.g. HDFC Home Loan" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Category</label>
                  <select className="input-premium" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Total Principal (₹)</label>
                  <input required type="number" className="input-premium" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Remaining Balance (₹)</label>
                  <input required type="number" className="input-premium" value={formData.remaining_amount} onChange={e => setFormData({...formData, remaining_amount: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Interest Rate (%)</label>
                  <input type="number" step="0.01" className="input-premium" value={formData.interest_rate} onChange={e => setFormData({...formData, interest_rate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Monthly EMI (₹)</label>
                  <input type="number" className="input-premium" value={formData.monthly_payment} onChange={e => setFormData({...formData, monthly_payment: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Next Due Date</label>
                  <input type="date" className="input-premium" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Notes / Account Number</label>
                  <textarea className="input-premium min-h-[100px] py-4" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full shadow-xl shadow-[--danger]/20 !bg-[--danger] hover:!bg-rose-600 mt-4">
                {submitting ? "Processing..." : editingId ? "Update Record" : "Establish Liability"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
