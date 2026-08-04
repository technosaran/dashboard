"use client";

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { differenceInDays, parseISO, format, isValid } from "date-fns";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { createGoal, updateGoalAmount, deleteGoal, updateGoal } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { getColorByLabel } from "@/lib/chart-colours";

import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer } from "@/components/ui/recharts";

import { Drawer } from "@/components/ui/drawer";
import GoalsDataTable from "./components/GoalsDataTable";

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

export default function GoalsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { profile, goals, accounts }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [submitting, withLock] = useSubmitLock();
  
  const [activeView, setActiveView] = useState<"overview" | "trackers" | "completed" | "all">("overview");

  const mounted = useHasMounted();
  
  const [formData, setFormData] = useState({
    name: "",
    target_amount: "",
    current_amount: "0",
    deadline: "",
    category: "Others",
    account_id: "",
  });

  const [contributeAmount, setContributeAmount] = useState("");

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const defaultAccId = profile?.default_accounts?.goals;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      setTimeout(() => {
        setSelectedAccountId(defaultAccExists ? defaultAccId : accounts[0].id);
      }, 0);
    }
  }, [accounts, selectedAccountId, profile]);

  useEffect(() => {
    if (accounts.length > 0 && !formData.account_id) {
      const defaultAccId = profile?.default_accounts?.goals;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      setTimeout(() => {
        setFormData(prev => ({ ...prev, account_id: defaultAccExists ? defaultAccId : accounts[0].id }));
      }, 0);
    }
  }, [accounts, formData.account_id, profile]);

  const stats = useMemo(() => {
    const activeGoals = goals.filter(g => Number(g.current_amount) < Number(g.target_amount));
    const completedGoals = goals.filter(g => Number(g.current_amount) >= Number(g.target_amount));
    const totalTarget = activeGoals.reduce((s, g) => s + Number(g.target_amount), 0);
    const totalCurrent = activeGoals.reduce((s, g) => s + Number(g.current_amount), 0);
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    
    let closestDeadline: Date | null = null;
    let closestDays = Infinity;
    
    activeGoals.forEach(g => {
      if (g.deadline) {
        const d = parseISO(g.deadline);
        if (!isValid(d)) return;
        const days = differenceInDays(d, new Date());
        if (days >= 0 && days < closestDays) {
          closestDays = days;
          closestDeadline = d;
        }
      }
    });

    return { totalTarget, totalCurrent, overallProgress, activeCount: activeGoals.length, completedCount: completedGoals.length, closestDays, closestDeadline };
  }, [goals]);

  const barChartData = useMemo(() => {
    return goals
      .filter(g => Number(g.current_amount) < Number(g.target_amount))
      .map(g => ({
        name: g.name.substring(0, 10) + (g.name.length > 10 ? "..." : ""),
        Saved: Number(g.current_amount),
        Remaining: Math.max(0, Number(g.target_amount) - Number(g.current_amount)),
        Target: Number(g.target_amount)
      })).sort((a, b) => b.Target - a.Target).slice(0, 10);
  }, [goals]);

  const pieChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    goals.filter(g => Number(g.current_amount) < Number(g.target_amount)).forEach(g => {
      const cat = g.category || "Others";
      catMap[cat] = (catMap[cat] || 0) + Number(g.target_amount);
    });
    return Object.entries(catMap).map(([name, value]) => ({
      name,
      value,
      fill: getColorByLabel(name)
    })).sort((a, b) => b.value - a.value);
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
    const targetAmount = parseFloat(formData.target_amount);
    const currentAmount = parseFloat(formData.current_amount);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      toast.error("Target amount must be greater than zero.");
      return;
    }
    if (!editingGoalId && (!Number.isFinite(currentAmount) || currentAmount < 0)) {
      toast.error("Initial saved amount cannot be negative.");
      return;
    }

    await withLock(async () => {
      let res;
      if (editingGoalId) {
        res = await updateGoal(editingGoalId, {
          name: formData.name,
          target_amount: targetAmount,
          deadline: formData.deadline || undefined,
          category: formData.category
        });
      } else {
        res = await createGoal({
          ...formData,
          target_amount: targetAmount,
          current_amount: currentAmount,
          deadline: formData.deadline || undefined,
        });
      }
      if (!res?.error) {
        toast.success(editingGoalId ? "Financial goal updated successfully" : "New financial goal added successfully");
        setShowAddModal(false);
        setFormData({ name: "", target_amount: "", current_amount: "0", deadline: "", category: "Others", account_id: "" });
        setEditingGoalId(null);
        mutate();
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
    const amount = parseFloat(contributeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter a valid contribution amount.");
      return;
    }
    await withLock(async () => {
      const res = await updateGoalAmount(selectedGoalId, amount, selectedAccountId);
      if (!res?.error) {
        toast.success(res.message || "Contribution added to goal successfully");
        setShowContributeModal(false);
        setContributeAmount("");
        mutate();
      } else {
        toast.error(res.error);
      }
    });
  }

  function startDeleteGoal(id: string) {
    setDeletingGoalId(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteGoal() {
    if (!deletingGoalId) return;
    await withLock(async () => {
      const res = await deleteGoal(deletingGoalId);
      if (!res?.error) {
        toast.success(res.message || "Goal deleted successfully");
        setShowDeleteConfirm(false);
        setDeletingGoalId(null);
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
          <h1 className="text-3xl sm:text-4xl font-serif font-normal tracking-tight text-white">Savings & Financial Goals</h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">Set dedicated targets, track completion progress, and plan savings horizons.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="h-10 px-5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all flex items-center justify-center gap-2 border border-amber-400/30 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Add Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="border border-slate-800 bg-slate-900/60 p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[350px] rounded-3xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="text-xl md:text-2xl font-serif font-semibold text-white">No Active Goals</h3>
          <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto font-sans leading-relaxed">Set savings milestones for major purchases, emergency funds, or investment targets.</p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setShowAddModal(true)}
              className="h-10 px-5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all border border-amber-400/30 cursor-pointer"
            >
              Create First Goal
            </button>
          </div>
        </div>
      ) : (
      <>
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="border border-slate-800 bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Total Target</p>
            <p className="text-2xl font-mono font-bold text-white tabular-nums">₹{stats.totalTarget.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-sans">Target capital sum</p>
          </div>
          <div className="border border-slate-800 bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Total Saved</p>
            <p className="text-2xl font-mono font-bold text-white tabular-nums">₹{stats.totalCurrent.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-sans">Accumulated savings</p>
          </div>
          <div className="border border-slate-800 bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Overall Progress</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">{stats.overallProgress.toFixed(1)}%</p>
            <p className="text-[11px] text-slate-500 mt-1 font-sans">Completion rate</p>
          </div>
          <div className="border border-slate-800 bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Active Goals</p>
            <p className="text-2xl font-mono font-bold text-slate-200 tabular-nums">{stats.activeCount}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-sans">Milestones in progress</p>
          </div>
          <div className="border border-slate-800 bg-slate-900/60 p-5 rounded-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Next Horizon</p>
            <p className={`text-2xl font-mono font-bold tabular-nums ${stats.closestDays <= 30 ? 'text-white' : 'text-emerald-400'}`}>
              {stats.closestDays === Infinity ? 'None' : `${stats.closestDays}d`}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-sans">
              {stats.closestDeadline ? format(stats.closestDeadline, "MMM d, yyyy") : "No set deadline"}
            </p>
          </div>
        </div>

        {/* Premium Segmented Toggle Bar */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
          {[
            { key: "overview", label: "Overview" },
            { key: "trackers", label: "Goal Trackers" },
            { key: "completed", label: "Completed Goals" }
          ].map((tab) => {
            const isActive = activeView === tab.key;
            
            let activeStyles = "bg-[--accent-primary] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]";
            if (tab.key === "trackers") activeStyles = "bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]";
            if (tab.key === "completed") activeStyles = "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]";

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveView(tab.key as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer ${
                  isActive
                    ? `${activeStyles} border border-transparent`
                    : "text-[--text-muted] hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* View Content */}
        {activeView === "overview" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Progress Bar Chart */}
              <div className="glass-card-static p-6 lg:col-span-2 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Capital vs Target (Top 10)</h3>
                    <p className="text-2xl font-black mt-2 text-white">Progression Analysis</p>
                  </div>
                </div>
                <div className="flex-1 min-h-[250px] w-full mt-4 -ml-4">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <AreaChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="goalSavedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="goalTargetGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                        <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontWeight: "bold" }}
                          formatter={(value: any, name: any) => [`₹${Number(value).toLocaleString()}`, name]}
                        />
                        <Legend wrapperStyle={{ paddingTop: "15px" }} />
                        <Area type="monotone" dataKey="Saved" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#goalSavedGrad)" />
                        <Area type="monotone" dataKey="Target" stroke="#6366F1" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#goalTargetGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Allocation Pie Chart */}
              <div className="glass-card-static p-6 flex flex-col items-center justify-center relative min-h-[400px]">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Target Segmentation</h3>
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
                          formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Target"]}
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
            <GoalsDataTable 
              goals={goals} 
              initialFilter={activeView === "completed" ? "completed" : activeView === "trackers" ? "active" : "all"}
              onEdit={startEdit} 
              onDelete={startDeleteGoal} 
              onContribute={(g) => {
                setSelectedGoalId(g.id);
                setShowContributeModal(true);
              }}
              onAdd={() => setShowAddModal(true)} 
            />
          </div>
        )}
      </>
      )}

      {/* Contribute Modal */}
      {showContributeModal && (
        <Drawer isOpen={showContributeModal} onClose={() => setShowContributeModal(false)} title="Add to Goal" variant="center">
        <div className="p-2 max-w-sm mx-auto w-full">
          <form onSubmit={handleContribute} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-medium">₹</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  className="input-premium pl-8 w-full font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-2">From Account</label>
              <select
                required
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="input-premium w-full font-bold"
              >
                {accounts.map(a => {
                  const symbol = a.currency === "USD" ? "$" : "₹";
                  const nameLabel = a.bank_name && a.bank_name.trim().toLowerCase() !== a.name.trim().toLowerCase()
                    ? `${a.bank_name} (${a.name})`
                    : a.name;
                  return (
                    <option key={a.id} value={a.id} className="bg-[#181A20] text-white font-medium">
                      {nameLabel} — {symbol}{Number(a.balance).toLocaleString()}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowContributeModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1">Add Funds</button>
            </div>
          </form>
        </div>
      </Drawer>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <Drawer isOpen={showAddModal} onClose={() => {
          setShowAddModal(false);
          setEditingGoalId(null);
          setFormData({ name: "", target_amount: "", current_amount: "0", deadline: "", category: "Others", account_id: "" });
        }} title={editingGoalId ? "Edit Goal" : "Create New Goal"} variant="center" width="max-w-md md:max-w-lg">
        <div className="p-2 w-full">
          <form onSubmit={handleAddGoal} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-2">Goal Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input-premium w-full font-bold"
                placeholder="e.g. New Car"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-2">Target Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">₹</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={formData.target_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_amount: e.target.value }))}
                    className="input-premium pl-8 w-full font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>
              {!editingGoalId && (
                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-2">Initial Saved</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">₹</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.current_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, current_amount: e.target.value }))}
                      className="input-premium pl-8 w-full font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-2">Target Date (Optional)</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                className="input-premium w-full font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="input-premium w-full font-bold"
              >
                {GOAL_CATEGORIES.map(c => (
                  <option key={c.label} value={c.label} className="bg-[#181A20] text-white font-medium">{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            {!editingGoalId && Number(formData.current_amount) > 0 && (
              <div>
                <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-2">Source Account</label>
                <select
                  required
                  value={formData.account_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, account_id: e.target.value }))}
                  className="input-premium w-full font-bold"
                >
                  <option value="" disabled className="bg-[#181A20] text-white font-medium">Select an account</option>
                  {accounts.map(a => {
                    const symbol = a.currency === "USD" ? "$" : "₹";
                    const nameLabel = a.bank_name && a.bank_name.trim().toLowerCase() !== a.name.trim().toLowerCase()
                      ? `${a.bank_name} (${a.name})`
                      : a.name;
                    return (
                      <option key={a.id} value={a.id} className="bg-[#181A20] text-white font-medium">
                        {nameLabel} — {symbol}{Number(a.balance).toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1">{editingGoalId ? "Save Changes" : "Create Goal"}</button>
            </div>
          </form>
        </div>
      </Drawer>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Drawer isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Goal?" variant="center">
        <div className="p-2 max-w-sm mx-auto w-full text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <p className="text-sm text-[--text-secondary] mb-8">This will permanently remove this goal. The saved amount will NOT be returned to any account, it simply stops tracking.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDeleteGoal} disabled={submitting} className="bg-danger hover:bg-danger/80 text-white font-bold py-2.5 px-4 rounded-xl flex-1 transition-colors shadow-lg shadow-danger/20">Delete Goal</button>
          </div>
        </div>
      </Drawer>
      )}
    </div>
  );
}
