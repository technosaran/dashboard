"use client";

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { differenceInDays, parseISO, format } from "date-fns";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { createGoal, updateGoalAmount, deleteGoal, updateGoal } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { getColorByLabel } from "@/lib/chart-colours";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

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
  
  const [activeView, setActiveView] = useState<"overview" | "trackers">("overview");

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
        setFormData(prev => ({ ...prev, account_id: defaultAccExists ? defaultAccId : "" }));
      }, 0);
    }
  }, [accounts, formData.account_id, profile]);

  const stats = useMemo(() => {
    const activeGoals = goals.filter(g => Number(g.current_amount) < Number(g.target_amount));
    const totalTarget = activeGoals.reduce((s, g) => s + Number(g.target_amount), 0);
    const totalCurrent = activeGoals.reduce((s, g) => s + Number(g.current_amount), 0);
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    
    let closestDeadline: Date | null = null;
    let closestDays = Infinity;
    
    activeGoals.forEach(g => {
      if (g.deadline) {
        const d = parseISO(g.deadline);
        const days = differenceInDays(d, new Date());
        if (days >= 0 && days < closestDays) {
          closestDays = days;
          closestDeadline = d;
        }
      }
    });

    return { totalTarget, totalCurrent, overallProgress, activeCount: activeGoals.length, closestDays, closestDeadline };
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
    await withLock(async () => {
      const res = await updateGoalAmount(selectedGoalId, parseFloat(contributeAmount), selectedAccountId);
      if (!res?.error) {
        toast.success("Capital injected into savings goal");
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
        toast.success("Milestone deleted from registry");
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
          <h1 className="text-4xl font-black tracking-tight text-white">Financial Milestones</h1>
          <p className="text-xs text-[--text-muted] font-bold uppercase tracking-[0.3em] mt-2">Target & Progression Tracking</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Add New Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-indigo-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <span className="text-3xl">🎯</span>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">No Active Goals</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Establish financial milestones to track your progress towards major purchases or savings targets.</p>
          <div className="mt-8 flex justify-center">
             <button onClick={() => setShowAddModal(true)} className="btn-primary">Create Your First Goal</button>
          </div>
        </div>
      ) : (
      <>
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Target</p>
            <p className="text-2xl md:text-3xl font-black text-white">₹{stats.totalTarget.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Active Capital Goal</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Capital Secured</p>
            <p className="text-2xl md:text-3xl font-black text-[--accent-primary-light]">₹{stats.totalCurrent.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Saved</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Overall Progress</p>
            <p className="text-2xl md:text-3xl font-black text-success">{stats.overallProgress.toFixed(1)}%</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Completion Rate</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Active Trackers</p>
            <p className="text-2xl md:text-3xl font-black text-white">{stats.activeCount}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Open Milestones</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Nearest Deadline</p>
            <p className={`text-2xl md:text-3xl font-black ${stats.closestDays <= 30 ? 'text-warning' : 'text-emerald-400'}`}>
              {stats.closestDays === Infinity ? 'None' : `${stats.closestDays}d`}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">
              {stats.closestDeadline ? format(stats.closestDeadline, "MMM d, yyyy") : "No Deadlines"}
            </p>
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
            onClick={() => setActiveView("trackers")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeView === "trackers"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Goal Trackers
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">
              {goals.length}
            </span>
          </button>
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
                        <Bar dataKey="Saved" stackId="a" fill="var(--accent-primary)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Remaining" stackId="a" fill="rgba(255,255,255,0.1)" radius={[0, 4, 4, 0]} />
                      </BarChart>
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
        <Drawer isOpen={showContributeModal} onClose={() => setShowContributeModal(false)} title="Add to Goal">
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
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} (₹{Number(a.balance).toLocaleString()})</option>
                ))}
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
        }} title={editingGoalId ? "Edit Goal" : "Create New Goal"}>
        <div className="p-2 max-w-md mx-auto w-full">
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
            <div className="grid grid-cols-2 gap-4">
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
                  <option key={c.label} value={c.label}>{c.icon} {c.label}</option>
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
                  <option value="" disabled>Select an account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (₹{Number(a.balance).toLocaleString()})</option>
                  ))}
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
        <Drawer isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Goal?">
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
