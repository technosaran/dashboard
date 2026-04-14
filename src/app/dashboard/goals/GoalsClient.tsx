
"use client";

import { useState, useMemo, useCallback, useEffect, startTransition } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { toast } from "react-hot-toast";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { createGoal, updateGoalAmount, deleteGoal } from "./actions";
import { useRealTimeSync } from "@/hooks/use-realtime-sync";

type Goal = Tables<"goals">;
type Account = Tables<"accounts">;

const GOAL_CATEGORIES = [
  { label: "Home", icon: "🏠", color: "#6366f1" },
  { label: "Travel", icon: "✈️", color: "#06b6d4" },
  { label: "Emergency", icon: "🛡️", color: "#10b981" },
  { label: "Tech", icon: "💻", color: "#f59e0b" },
  { label: "Vehicle", icon: "🚗", color: "#f43f5e" },
  { label: "Investment", icon: "📈", color: "#8b5cf6" },
  { label: "Education", icon: "🎓", color: "#ec4899" },
  { label: "Others", icon: "🎯", color: "#64748b" },
];

export default function GoalsClient({ initialGoals, initialAccounts }: { initialGoals: Goal[], initialAccounts: Account[] }) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccounts[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    deadline: "",
    category: "Others",
    account_id: "",
  });

  const [contributeAmount, setContributeAmount] = useState("");
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const [goalData, accData] = await Promise.all([
      supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").eq("user_id", user.id).order("name")
    ]);

    if (goalData.data) setGoals(goalData.data);
    if (accData.data) setAccounts(accData.data);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase.channel("goals-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => startTransition(fetchData))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, supabase]);

  useRealTimeSync(fetchData);

  const stats = useMemo(() => {
    const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
    const totalCurrent = goals.reduce((s, g) => s + Number(g.current_amount), 0);
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    return { totalTarget, totalCurrent, overallProgress };
  }, [goals]);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await createGoal({
      ...formData,
      target_amount: parseFloat(formData.target_amount),
      current_amount: parseFloat(formData.current_amount),
      deadline: formData.deadline || undefined,
    });
    if (!res?.error) {
      toast.success("Goal established.");
      setShowAddModal(false);
      setFormData({ name: "", target_amount: "", current_amount: "0", deadline: "", category: "Others", account_id: "" });
    } else {
      toast.error(res.error);
    }
    setSubmitting(false);
  }

  async function handleContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoalId || !selectedAccountId) {
      toast.error("Please select an account.");
      return;
    }
    setSubmitting(true);
    const res = await updateGoalAmount(selectedGoalId, parseFloat(contributeAmount), selectedAccountId);
    if (!res?.error) {
      toast.success("Capital injected.");
      setShowContributeModal(false);
      setContributeAmount("");
    } else {
      toast.error(res.error);
    }
    setSubmitting(false);
  }

  async function handleDeleteGoal(id: string) {
    if (!confirm("Are you sure?")) return;
    const res = await deleteGoal(id);
    if (!res?.error) toast.success("Goal deleted.");
  }

  return (
    <div className="flex flex-col gap-10 animate-fade-in py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[--text-primary]">Financial Milestones</h1>
          <p className="text-[--text-secondary] text-sm mt-1">Track and manage your long-term savings goals.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="h-11 px-6 bg-[--accent-primary] hover:bg-[--accent-primary-light] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[--accent-primary]/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Add New Goal
        </button>
      </div>

      {/* Clean Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card-static p-6 flex flex-col gap-1">
          <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Total Target</p>
          <p className="text-2xl font-black">₹{stats.totalTarget.toLocaleString()}</p>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-1">
          <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Saved Amount</p>
          <p className="text-2xl font-black text-[--accent-primary-light]">₹{stats.totalCurrent.toLocaleString()}</p>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Overall Progress</p>
            <p className="text-sm font-black text-[--accent-primary-light]">{stats.overallProgress.toFixed(1)}%</p>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[--accent-primary] transition-all duration-1000"
              style={{ width: `${Math.min(stats.overallProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const category = GOAL_CATEGORIES.find(c => c.label === goal.category) || GOAL_CATEGORIES[7];
          const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
          const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;

          return (
            <div key={goal.id} className="glass-card p-6 flex flex-col border-white/5 hover:border-[--accent-primary]/30 group">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px]">{goal.name}</h3>
                    <p className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wide">{goal.category}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => { setSelectedGoalId(goal.id); setShowContributeModal(true); }} 
                    className="p-2 text-[--text-muted] hover:text-[--accent-primary-light] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                  </button>
                  <button 
                    onClick={() => handleDeleteGoal(goal.id)} 
                    className="p-2 text-[--text-muted] hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Saved</span>
                    <span className="text-xl font-bold">₹{Number(goal.current_amount).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Target</span>
                    <span className="text-sm font-semibold opacity-60">₹{Number(goal.target_amount).toLocaleString()}</span>
                  </div>
                </div>

                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-1000"
                    style={{ 
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: category.color,
                      boxShadow: `0 0 4px ${category.color}40`
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                   <span className="text-[10px] font-bold" style={{ color: category.color }}>{progress.toFixed(0)}% Achieved</span>
                   {daysLeft !== null && (
                     <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wide">
                       {daysLeft > 0 ? `${daysLeft}d left` : 'Due'}
                     </span>
                   )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Standardized Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card-static w-full max-w-xl p-8 md:p-12 animate-scale-in">
             <div className="flex justify-between items-center mb-10">
               <h2 className="text-3xl font-black tracking-tight">Set Milestone</h2>
               <button onClick={() => setShowAddModal(false)} className="text-[--text-muted] hover:text-[--text-primary] transition-colors p-2">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             </div>
             <form onSubmit={handleAddGoal} className="space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-wider text-[--text-muted] ml-1">Goal Name</label>
                 <input required className="input-premium h-12 text-sm" placeholder="e.g. Europe Trip" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-wider text-[--text-muted] ml-1">Target (₹)</label>
                   <input required type="number" className="input-premium h-12 text-sm" placeholder="0" value={formData.target_amount} onChange={e => setFormData({...formData, target_amount: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-wider text-[--text-muted] ml-1">Initial (₹)</label>
                   <input type="number" className="input-premium h-12 text-sm" value={formData.current_amount} onChange={e => setFormData({...formData, current_amount: e.target.value})} />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-wider text-[--text-muted] ml-1">Category</label>
                   <select className="input-premium h-12 text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                     {GOAL_CATEGORIES.map(c => <option key={c.label} value={c.label} style={{background: '#0c1021'}}>{c.label}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-wider text-[--text-muted] ml-1">Target Date</label>
                   <input type="date" className="input-premium h-12 text-sm" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
                 </div>
               </div>
               
               {Number(formData.current_amount) > 0 && (
                 <div className="space-y-2 animate-fade-in">
                   <label className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary-light] ml-1">Deduct Initial From</label>
                   <select 
                     required
                     className="input-premium h-12 text-sm border-[--accent-primary]/30" 
                     value={formData.account_id} 
                     onChange={e => setFormData({...formData, account_id: e.target.value})}
                   >
                     <option value="" style={{background: '#0c1021'}}>Select Account...</option>
                     {accounts.map(acc => (
                       <option key={acc.id} value={acc.id} style={{background: '#0c1021'}}>
                         {acc.name} (₹{Number(acc.balance).toLocaleString()})
                       </option>
                     ))}
                   </select>
                 </div>
               )}

               <button type="submit" disabled={submitting} className="btn-primary w-full shadow-2xl mt-4">
                 {submitting ? "Establishing..." : "Commit Goal"}
               </button>
             </form>
          </div>
        </div>
      )}

      {/* Focus Contribution Modal */}
      {showContributeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card-static w-full max-w-sm p-8 animate-scale-in text-center border-white/10 shadow-2xl">
             <div className="w-14 h-14 rounded-2xl bg-[--accent-primary]/10 flex items-center justify-center text-2xl mx-auto mb-4">💰</div>
             <h3 className="text-xl font-black mb-1">Inject Savings</h3>
             <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mb-6">Asset Allocation</p>
             <form onSubmit={handleContribute} className="space-y-6">
               <div className="space-y-4">
                 <div className="space-y-1 text-left">
                   <label className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest ml-1">Debit From</label>
                   <select 
                    required
                    className="input-premium !h-11 text-xs" 
                    value={selectedAccountId} 
                    onChange={e => setSelectedAccountId(e.target.value)}
                   >
                     {accounts.map(acc => (
                       <option key={acc.id} value={acc.id} style={{background: '#0c1021'}}>
                         {acc.name} (₹{Number(acc.balance).toLocaleString()})
                       </option>
                     ))}
                   </select>
                 </div>
                 <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest ml-1">Amount (₹)</label>
                    <input required autoFocus type="number" step="0.01" className="bg-transparent border-b-2 border-white/10 w-full text-3xl font-black text-center py-2 outline-none focus:border-[--accent-primary] transition-colors tabular-nums" placeholder="0.00" value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} />
                 </div>
               </div>
               <div className="flex gap-3 pt-2">
                 <button type="button" onClick={() => setShowContributeModal(false)} className="btn-secondary h-11 text-[10px]">Cancel</button>
                 <button type="submit" disabled={submitting} className="btn-primary flex-[1.5] h-11 text-[10px] shadow-xl shadow-[--accent-primary]/20">Confirm</button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
