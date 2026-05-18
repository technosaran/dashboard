"use client";

import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { addLiability, updateLiability, deleteLiability } from "./actions";
import { revertLedgerLog } from "../alternative-assets/actions";
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
  const { data: { liabilities, ledgerLogs, accounts } } = useFinanceData(initialData);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"loans" | "history">("loans");

  const liabilityLogs = useMemo(() => {
    return ledgerLogs
      .filter(log => log.details?.toLowerCase().includes("liability") || log.details?.toLowerCase().includes("loan") || log.details?.toLowerCase().includes("debt"))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [ledgerLogs]);

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
    const monthlyEMI = liabilities.reduce((s, l) => s + Number(l.monthly_payment || 0), 0);
    const highestInterest = liabilities.reduce((max, l) => Math.max(max, Number(l.interest_rate || 0)), 0);
    return { totalDebt, monthlyEMI, highestInterest };
  }, [liabilities]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
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
    } else toast.error(res.error);
    setSubmitting(false);
  }

  async function handleRevert(logId: string) {
    if (!confirm("Revert this action? This will undo the ledger entry and any associated balance changes.")) return;
    setSubmitting(true);
    // Note: revertLedgerLog is imported from alternative-assets/actions.ts or a shared location
    const res = await revertLedgerLog(logId);
    if (!res.error) {
      toast.success("Action reverted successfully");
    } else {
      toast.error(res.error);
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Loans & Debts</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Liability Management Terminal</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button 
              disabled={submitting}
              onClick={() => setActiveTab("loans")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "loans" ? "bg-rose-500 text-white shadow-lg" : "text-[--text-muted] hover:text-white"}`}
            >
              Active Loans
            </button>
            <button 
              disabled={submitting}
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "history" ? "bg-rose-500 text-white shadow-lg" : "text-[--text-muted] hover:text-white"}`}
            >
              History
            </button>
          </div>
          <button onClick={() => setShowAddModal(true)} disabled={submitting} className="btn-primary !h-12 !px-8 !bg-rose-500 hover:!bg-rose-600 shadow-[0_0_30px_rgba(244,63,94,0.3)] !rounded-2xl text-[11px] font-black tracking-widest uppercase">{submitting ? "Working..." : "Record Liability"}</button>
        </div>
      </div>

      {activeTab === "loans" ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Total Exposure", value: stats.totalDebt, sub: "Outstanding Principal", color: "text-rose-500", icon: "📉" },
              { label: "Monthly Commitment", value: stats.monthlyEMI, sub: "Combined EMIs", color: "text-orange-400", icon: "💸" },
              { label: "Weighted Interest", value: stats.highestInterest, sub: "Max APR %", color: "text-white", icon: "🔥", isPercent: true },
            ].map((s, i) => (
              <div key={i} className="glass-card-static p-8 border-white/5 hover:border-white/10 transition-all group relative overflow-hidden rounded-[32px]">
                <div className="absolute -right-6 -top-6 text-6xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12 grayscale">{s.icon}</div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-4 opacity-60">{s.label}</p>
                <p className={`text-3xl font-black tabular-nums ${s.color} tracking-tight`}>
                  {s.isPercent ? `${s.value.toFixed(2)}%` : `₹${s.value.toLocaleString()}`}
                </p>
                <div className="flex items-center gap-2 mt-3">
                   <div className="w-1 h-1 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                   <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest opacity-40">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Liabilities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {liabilities.map((l) => {
              const category = CATEGORIES.find(c => c.label === l.category) || CATEGORIES[6];
              const progress = (Number(l.total_amount) - Number(l.remaining_amount)) / Number(l.total_amount) * 100;
              
              return (
                <div key={l.id} className="glass-card-static flex flex-col min-h-[340px] p-8 relative overflow-hidden transition-all hover:scale-[1.02] group border-white/5 bg-gradient-to-br from-rose-500/[0.02] to-transparent rounded-[40px]">
                  <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-rose-500 via-orange-500 to-rose-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-10">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-2xl shadow-2xl group-hover:scale-110 transition-transform">
                        {category.icon}
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-black text-white group-hover:text-rose-400 transition-colors leading-tight">{l.name}</h3>
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">{l.category}</span>
                           {l.interest_rate && (
                            <span className="text-[9px] font-black text-white uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                              {l.interest_rate}% APR
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
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
                           notes: l.notes || "", account_id: "",
                         });
                         setShowAddModal(true);
                       }} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                       </button>
                    </div>
                  </div>

                  <div className="space-y-8 mt-auto">
                    <div className="space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em] opacity-50">Repayment Progress</span>
                        <span className="text-[10px] font-black text-white tabular-nums">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-1000 relative" style={{ width: `${Math.min(progress, 100)}%` }}>
                           <div className="absolute inset-0 bg-[length:20px_20px] bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] animate-[shimmer_2s_linear_infinite]" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
                        <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest mb-1 opacity-50">Outstanding</p>
                        <p className="text-[15px] font-black text-white tabular-nums">₹{l.remaining_amount.toLocaleString()}</p>
                      </div>
                      <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 text-right backdrop-blur-md">
                        <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest mb-1 opacity-50">Monthly EMI</p>
                        <p className="text-[15px] font-black text-orange-400 tabular-nums">₹{(l.monthly_payment || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                       {l.due_date ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                          <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-widest opacity-60">Due: {format(parseISO(l.due_date), "MMM d, yyyy")}</span>
                        </div>
                      ) : <div />}
                      <button onClick={() => { if(confirm("Permanently purge this debt record?")) deleteLiability(l.id); }} className="text-rose-500 hover:text-rose-400 transition-colors">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="glass-card-static rounded-[40px] overflow-hidden border-white/5">
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Repayment History</h3>
            <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-widest">{liabilityLogs.length} Records Found</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[9px] text-[--text-muted] uppercase font-black tracking-widest bg-white/[0.01]">
                  <th className="py-4 px-8">Timestamp</th>
                  <th className="py-4 px-8">Action</th>
                  <th className="py-4 px-8">Details</th>
                  <th className="py-4 px-8 text-right">Balance Change</th>
                  <th className="py-4 px-8 text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {liabilityLogs.map((log) => {
                  const isOut = log.action_type === "CREATE" || log.action_type === "ADJUST_UP";
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-5 px-8">
                        <p className="text-[11px] font-bold text-white/80">{log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "N/A"}</p>
                        <p className="text-[9px] font-bold text-[--text-muted] mt-0.5">{log.created_at ? format(new Date(log.created_at), "HH:mm:ss") : ""}</p>
                      </td>
                      <td className="py-5 px-8">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                          log.action_type === "CREATE" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          log.action_type === "DELETE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        }`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="py-5 px-8">
                        <p className="text-[12px] font-bold text-white group-hover:text-rose-400 transition-colors">{log.details}</p>
                      </td>
                      <td className="py-5 px-8 text-right tabular-nums">
                        <p className={`text-[12px] font-black ${isOut ? "text-rose-400" : "text-emerald-400"}`}>
                          {log.amount ? `${isOut ? "+" : "-"}₹${log.amount.toLocaleString()}` : "—"}
                        </p>
                      </td>
                      <td className="py-5 px-8 text-right">
                         <button 
                           onClick={() => handleRevert(log.id)}
                           disabled={submitting}
                           className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all bg-rose-500/5 px-3 py-1 rounded-lg border border-rose-500/10"
                         >
                           Revert
                         </button>
                      </td>
                    </tr>
                  );
                })}
                {liabilityLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-[11px] font-bold text-[--text-muted] uppercase tracking-[0.3em]">No historical records detected</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/90 backdrop-blur-xl animate-fade-in shadow-2xl">
          <div className="glass-card-static w-full max-w-2xl p-6 md:p-10 border-rose-500/20 shadow-[0_0_100px_rgba(244,63,94,0.1)] max-h-[95vh] overflow-y-auto">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Destination Account (Optional)</label>
                  <select className="input-premium" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                    <option value="">No Transaction</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Notes / Account Number</label>
                  <textarea className="input-premium min-h-[100px] py-4" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full shadow-xl shadow-[--danger]/20 !bg-danger hover:!bg-rose-600 mt-4">
                {submitting ? "Processing..." : editingId ? "Update Record" : "Establish Liability"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
