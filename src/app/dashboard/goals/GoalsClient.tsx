"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { differenceInDays, parseISO, format } from "date-fns";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { createGoal, updateGoalAmount, deleteGoal, updateGoal } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { CHART_COLOURS } from "@/lib/chart-colours";

type Goal = Tables<"goals">;

const GOAL_CATEGORIES = [
  { label: "Home", icon: "🏠" },
  { label: "Travel", icon: "✈️" },
  { label: "Emergency", icon: "🛡️" },
  { label: "Tech", icon: "💻" },
  { label: "Vehicle", icon: "🚗" },
  { label: "Investment", icon: "📈" },
  { label: "Education", icon: "🎓" },
  { label: "Others", icon: "🎯" },
];

const CARD_COLORS = [
  { gradient: "linear-gradient(135deg, #6c5ce7, #a29bfe)", color: "#a29bfe" },
  { gradient: "linear-gradient(135deg, #ff6b6b, #ff8787)", color: "#ff8787" },
  { gradient: "linear-gradient(135deg, #4ecdc4, #81ecec)", color: "#81ecec" },
  { gradient: "linear-gradient(135deg, #45b7d1, #74b9ff)", color: "#74b9ff" },
  { gradient: "linear-gradient(135deg, #ffa07a, #fab1a0)", color: "#fab1a0" },
  { gradient: "linear-gradient(135deg, #fdcb6e, #ffeaa7)", color: "#ffeaa7" },
  { gradient: "linear-gradient(135deg, #00b894, #55efc4)", color: "#55efc4" },
  { gradient: "linear-gradient(135deg, #ff7675, #fd79a8)", color: "#fd79a8" },
  { gradient: "linear-gradient(135deg, #a29bfe, #dfe6e9)", color: "#dfe6e9" },
  { gradient: "linear-gradient(135deg, #00cec9, #81ecec)", color: "#81ecec" },
];

export default function GoalsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { goals, accounts }, isValidating } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || "");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [submitting, withLock] = useSubmitLock();
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  
  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    deadline: "",
    category: "Others",
    account_id: "",
  });

  const [contributeAmount, setContributeAmount] = useState("");
  if (!selectedAccountId && accounts.length > 0) {
    setSelectedAccountId(accounts[0].id);
  }



  const stats = useMemo(() => {
    const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
    const totalCurrent = goals.reduce((s, g) => s + Number(g.current_amount), 0);
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    return { totalTarget, totalCurrent, overallProgress };
  }, [goals]);

  function startEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      deadline: goal.deadline || "",
      category: goal.category || "Others",
      account_id: "",
    });
    setShowAddModal(true);
  }

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      let res;
      if (editingGoalId) {
        res = await updateGoal(editingGoalId, {
          name: formData.name,
          target_amount: parseFloat(formData.target_amount),
          deadline: formData.deadline || undefined,
          category: formData.category
        });
      } else {
        res = await createGoal({
          ...formData,
          target_amount: parseFloat(formData.target_amount),
          current_amount: parseFloat(formData.current_amount),
          deadline: formData.deadline || undefined,
        });
      }
      if (!res?.error) {
        toast.success(editingGoalId ? "Target parameters updated successfully" : "New financial milestone established successfully");
        setShowAddModal(false);
        setFormData({ name: "", target_amount: "", current_amount: "0", deadline: "", category: "Others", account_id: "" });
        setEditingGoalId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleContribute(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoalId || !selectedAccountId) {
      toast.error("Please select an account.");
      return;
    }
    await withLock(async () => {
      const res = await updateGoalAmount(selectedGoalId, parseFloat(contributeAmount), selectedAccountId);
      if (!res?.error) {
        toast.success("Capital injected into savings goal");
        setShowContributeModal(false);
        setContributeAmount("");
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleDeleteGoal(id: string) {
    if (!confirm("Are you sure?")) return;
    const res = await deleteGoal(id);
    if (!res?.error) toast.success("Milestone deleted from registry");
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="md:hidden w-full p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center mt-4">
             <h2 className="text-xl font-black text-white">Goals & Savings</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <div className="grid grid-cols-2 gap-3 mt-4">
               <button onClick={() => setShowAddModal(true)} className="btn-primary shadow-xl shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600">Add Goal</button>
             </div>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[--text-primary]">Financial Milestones</h1>
              <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
            </div>
            <p className="text-[--text-secondary] text-sm mt-1">Track and manage your long-term savings goals.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="hidden md:flex btn-primary gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Add New Goal
          </button>
        </div>

      </div>

      <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="flex justify-start">
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('active')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-[--accent-primary] text-white shadow-lg shadow-[--accent-primary]/20' : 'text-[--text-muted] hover:text-[--text-primary]'}`}
          >
            Active
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'completed' ? 'bg-success text-white shadow-lg shadow-[--success]/20' : 'text-[--text-muted] hover:text-[--text-primary]'}`}
          >
            Completed
          </button>
        </div>
      </div>

      {activeTab === 'active' ? (
        <div className="space-y-6">
          {goals.filter(g => Number(g.current_amount) < Number(g.target_amount)).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2">
            {goals.filter(g => Number(g.current_amount) < Number(g.target_amount)).map((goal, index) => {
              const category = GOAL_CATEGORIES.find(c => c.label === goal.category) || GOAL_CATEGORIES[7];
              const cardColor = CARD_COLORS[index % CARD_COLORS.length];
              const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
              const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
              const monthsLeft = daysLeft ? Math.ceil(daysLeft / 30.41) : null;
              const monthlyRequired = (monthsLeft && monthsLeft > 0) ? Math.ceil((Number(goal.target_amount) - Number(goal.current_amount)) / monthsLeft) : null;

              return (
                <div key={goal.id} className="glass-card flex flex-col min-h-[280px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1 group" style={{ background: `linear-gradient(180deg, ${cardColor.color}05 0%, rgba(255,255,255,0.02) 100%)`, borderColor: `${cardColor.color}20` }}>
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: cardColor.gradient }} />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-4">
                       <span className="w-fit px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: `${cardColor.color}20`, color: cardColor.color, border: `1px solid ${cardColor.color}30` }}>
                         {goal.category}
                       </span>
                       <div className="flex items-center gap-3">
                         <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg" style={{ background: cardColor.gradient, boxShadow: `0 8px 16px ${cardColor.color}33` }}>
                           {category.icon}
                         </div>
                         <div className="flex flex-col">
                           <span className="text-base font-bold text-[--text-secondary]">{goal.name}</span>
                           <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">{progress.toFixed(0)}% Complete {progress >= 50 ? '🚀' : '✨'}</span>
                         </div>
                       </div>
                    </div>
                    <button onClick={() => startEdit(goal)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-3 flex-1 mb-6">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(progress, 100)}%`, background: cardColor.gradient }} />
                    </div>
                    <div className="flex justify-between items-baseline">
                       <p className="text-2xl font-black tabular-nums" style={{ color: cardColor.color }}>₹{Number(goal.current_amount).toLocaleString()}</p>
                       <p className="text-[10px] font-bold text-[--text-muted]">of ₹{Number(goal.target_amount).toLocaleString()}</p>
                    </div>
                    
                    {/* Monthly Requirement Display */}
                    {goal.deadline && (
                      <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
                        {monthsLeft && monthsLeft > 0 ? (
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Monthly Requirement</p>
                              <p className="text-[13px] font-black mt-1" style={{ color: cardColor.color }}>
                                ₹{monthlyRequired?.toLocaleString()}/month
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest">To Reach By</p>
                              <p className="text-[11px] font-bold text-white mt-1">{format(parseISO(goal.deadline), 'MMM d, yyyy')}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-[11px] font-black text-danger">⚠️ Deadline Passed</p>
                            <p className="text-[9px] text-[--text-muted] mt-1">Goal deadline was {format(parseISO(goal.deadline), 'MMM d, yyyy')}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                       <div>
                         <p className="text-[8px] font-black text-[--text-muted] uppercase tracking-widest">Time Left</p>
                         <p className="text-[11px] font-bold text-white">{daysLeft !== null ? (daysLeft > 0 ? `${daysLeft}d` : 'Due') : '—'}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-[8px] font-black text-[--text-muted] uppercase tracking-widest">Months Remaining</p>
                         <p className="text-[11px] font-bold text-[--accent-primary-light]">{monthsLeft && monthsLeft > 0 ? `${monthsLeft}mo` : '—'}</p>
                       </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedGoalId(goal.id); setShowContributeModal(true); }}
                      className="flex-1 h-12 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                      style={{ background: `${cardColor.color}15`, color: cardColor.color, border: `1px solid ${cardColor.color}30` }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                      Add Capital
                    </button>
                    <button onClick={() => handleDeleteGoal(goal.id)} className="w-12 h-12 rounded-xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}

            </div>
          ) : (
            <div className="py-24 text-center">

              <h3 className="text-2xl font-black text-white">No Active Objectives</h3>
              <p className="text-sm text-[--text-muted] mt-2 max-w-xs mx-auto">Initialize a new financial milestone to begin tracking your progress.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-2">
              {goals.filter(g => Number(g.current_amount) >= Number(g.target_amount)).map((goal, index) => {
                const cardColor = CARD_COLORS[(index + 3) % CARD_COLORS.length]; // Offset so they look different from active
                return (
                  <div key={goal.id} className="glass-card p-6 flex flex-col group relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${cardColor.color}05 0%, rgba(255,255,255,0.02) 100%)`, borderColor: `${cardColor.color}20` }}>
                    <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: cardColor.gradient }} />
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex flex-col">
                        <h3 className="font-bold text-[15px]">{goal.name}</h3>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: cardColor.color }}>Achieved</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(goal)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[--text-muted] hover:text-blue-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100" title="Edit Goal"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                        <button onClick={() => handleDeleteGoal(goal.id)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[--text-muted] hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mb-1">Final Amount</span>
                          <span className="text-xl font-bold tabular-nums" style={{ color: cardColor.color }}>₹{Number(goal.current_amount).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-24 text-center">

              <h3 className="text-2xl font-black text-white">Registry Empty</h3>
              <p className="text-sm text-[--text-muted] mt-2 max-w-xs mx-auto">No archived breakthroughs detected. Your achievements will manifest here.</p>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card-static w-full max-w-xl p-8 md:p-12">
             <div className="flex justify-between items-center mb-10">
               <h2 className="text-3xl font-black tracking-tight">{editingGoalId ? "Update Milestone" : "Set Milestone"}</h2>
               <button onClick={() => { setShowAddModal(false); setEditingGoalId(null); setFormData({ name: "", target_amount: "", current_amount: "0", deadline: "", category: "Others", account_id: "" }); }} className="text-[--text-muted] hover:text-[--text-primary] transition-colors p-2">
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
               
               {!editingGoalId && Number(formData.current_amount) > 0 && (
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
                 {submitting ? (editingGoalId ? "Updating..." : "Establishing...") : (editingGoalId ? "Update Goal" : "Commit Goal")}
               </button>
             </form>
          </div>
        </div>
      )}

      {showContributeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card-static w-full max-sm p-8 animate-scale-in text-center border-white/10 shadow-2xl">
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
