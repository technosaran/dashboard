"use client";

import { useCallback, useEffect, useState, startTransition, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { addExpense, deleteExpense } from "./actions";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import type { Tables } from "@/lib/database.types";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";

const supabase = createClient();

const CATEGORIES = [
  { label: "Rent", icon: "🏠", color: "#6c5ce7" },
  { label: "Food", icon: "🍔", color: "#fab1a0" },
  { label: "Transport", icon: "🚌", color: "#00cec9" },
  { label: "Utilities", icon: "⚡", color: "#fdcb6e" },
  { label: "Entertainment", icon: "🎬", color: "#a29bfe" },
  { label: "Shopping", icon: "🛍️", color: "#ff7675" },
  { label: "Subscription", icon: "💳", color: "#55efc4" },
  { label: "Others", icon: "📦", color: "#b2bec3" },
];

type Expense = Tables<"expenses">;
type Account = Tables<"accounts">;

export default function ExpensesPage() {
  return (
    <Suspense fallback={
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-10 w-48 bg-white/5 rounded-xl" />
        <div className="grid grid-cols-4 gap-6"><div className="h-32 bg-white/5 rounded-2xl" /><div className="h-32 bg-white/5 rounded-2xl" /><div className="h-32 bg-white/5 rounded-2xl" /><div className="h-32 bg-white/5 rounded-2xl" /></div>
        <div className="h-96 bg-white/5 rounded-3xl" />
      </div>
    }>
      <ExpensesContent />
    </Suspense>
  );
}

function ExpensesContent() {
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Food",
    date: new Date().toISOString().split("T")[0],
    account_id: "",
  });

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [expRes, accRes] = await Promise.all([
      supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("accounts").select("*").eq("user_id", user.id).order("name")
    ]);

    if (expRes.data) setExpenses(expRes.data as Expense[]);
    if (accRes.data) setAccounts(accRes.data as Account[]);
    
    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(fetchData);
    const channel = supabase.channel("expenses-industry-v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => startTransition(fetchData))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Analytics Logic
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = expenses.filter(e => isWithinInterval(parseISO(e.date), { start: startOfMonth(now), end: endOfMonth(now) }));
    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const monthlyTotal = currentMonth.reduce((s, e) => s + Number(e.amount), 0);
    
    // Category Pie Data
    const catMap: Record<string, number> = {};
    expenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
    });
    const pieData = Object.entries(catMap).map(([name, value]) => ({ 
      name, 
      value,
      color: CATEGORIES.find(c => c.label === name)?.color || "#8884d8"
    })).sort((a, b) => b.value - a.value);

    // Trend Data (Last 6 months)
    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      trendMap[format(d, "MMM")] = 0;
    }
    expenses.forEach(e => {
      const m = format(parseISO(e.date), "MMM");
      if (trendMap[m] !== undefined) trendMap[m] += Number(e.amount);
    });
    const trendData = Object.entries(trendMap).map(([name, value]) => ({ name, value }));

    return { totalSpent, monthlyTotal, pieData, trendData };
  }, [expenses]);

  // Filtering Logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch = e.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "All" || e.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [expenses, search, categoryFilter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addExpense({ ...formData, amount: parseFloat(formData.amount), account_id: formData.account_id || undefined });
    if (!result?.error) {
      setFormData({ description: "", amount: "", category: "Food", date: new Date().toISOString().split("T")[0], account_id: "" });
      setShowAddModal(false);
    }
    setSubmitting(false);
  }

  if (loading) return <div className="p-8 space-y-8 animate-pulse">
    <div className="h-10 w-48 bg-white/5 rounded-xl" />
    <div className="grid grid-cols-4 gap-6"><div className="h-32 bg-white/5 rounded-2xl" /><div className="h-32 bg-white/5 rounded-2xl" /><div className="h-32 bg-white/5 rounded-2xl" /><div className="h-32 bg-white/5 rounded-2xl" /></div>
    <div className="h-96 bg-white/5 rounded-3xl" />
  </div>;

  return (
    <div className="max-w-full space-y-8 pb-32 animate-fade-in">
      {/* Industry Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[--text-primary]">Expense Operations</h1>
          <p className="text-[--text-secondary] text-sm mt-1">Industrial-grade expenditure management & real-time analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary px-5 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary px-6 py-2.5 flex items-center gap-2 shadow-xl shadow-[--accent-primary]/25"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Record Expense
          </button>
        </div>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card-static p-6 flex flex-col justify-between group">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Net Consumption</p>
          <div className="mt-3 flex items-end justify-between">
            <h3 className="text-2xl font-black">₹{stats.totalSpent.toLocaleString()}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">All Time</span>
          </div>
        </div>
        <div className="glass-card-static p-6 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Monthly Throughput</p>
          <div className="mt-3 flex items-end justify-between">
            <h3 className="text-2xl font-black">₹{stats.monthlyTotal.toLocaleString()}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[--accent-primary]/10 text-[--accent-primary] border border-[--accent-primary]/20">{format(new Date(), "MMMM")}</span>
          </div>
        </div>
        <div className="glass-card-static p-6 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Avg Transaction</p>
          <div className="mt-3 flex items-end justify-between">
            <h3 className="text-2xl font-black">₹{(expenses.length ? stats.totalSpent / expenses.length : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted]">{expenses.length} points</span>
          </div>
        </div>
        <div className="glass-card-static p-6 flex flex-col justify-between bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Top Sector</p>
          <div className="mt-3 flex items-end justify-between">
            <h3 className="text-2xl font-black">{stats.pieData[0]?.name || "None"}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted]">Highest Spend</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card-static p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[--text-muted]">Expenditure Velocity</h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[--accent-primary]" />
              <span className="text-[10px] font-bold text-[--text-muted]">Monthly Trend</span>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px'}}
                  cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card-static p-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[--text-muted] mb-8">Asset Allocation</h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {stats.pieData.slice(0, 4).map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{background: item.color}} />
                <span className="text-[10px] font-bold text-[--text-secondary] truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Professional Datatable */}
      <div className="glass-card-static overflow-hidden border-white/5">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder="Search transactions..." 
                className="input-premium pl-10 py-2 text-sm w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="input-premium py-2 text-sm w-32 md:w-40"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
            </select>
          </div>
          <div className="text-[10px] font-bold text-[--text-muted]">
            Showing {filteredExpenses.length} of {expenses.length} results
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Ref / Description</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Segment</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Channel</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[--text-muted] text-right">Debit Amount</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[--text-muted] text-center">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-[--text-muted] text-sm italic">
                    Infrastructure query returned no results.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const theme = CATEGORIES.find(c => c.label === exp.category) || CATEGORIES[7];
                  const account = accounts.find(a => a.id === exp.account_id);
                  return (
                    <tr key={exp.id} className="hover:bg-white/[0.015] transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-[--text-primary]">{format(parseISO(exp.date), "MMM d, yyyy")}</p>
                        <p className="text-[10px] text-[--text-muted] tracking-tighter uppercase font-mono">{exp.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                            {theme.icon}
                          </div>
                          <p className="text-sm font-medium text-[--text-primary] group-hover:text-[--accent-primary] transition-colors">
                            {exp.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-[--text-secondary]" style={{color: theme.color}}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-xs font-medium text-[--text-secondary]">{account?.name || "Direct Log"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <p className="text-lg font-black text-[--text-primary]">₹{Number(exp.amount).toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button 
                          onClick={() => deleteExpense(exp.id)}
                          className="p-2 rounded-lg bg-red-400/0 hover:bg-red-400/10 text-red-400/30 hover:text-red-400 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Entry Drawer / Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card-static w-full max-w-2xl p-10 animate-scale-in border-[--accent-primary]/20 shadow-[0_0_100px_rgba(108,92,231,0.15)]">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[--accent-primary]/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[--accent-primary]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h2 className="text-3xl font-black">Record Transaction</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-[--text-muted] hover:text-[--text-primary] transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Description</label>
                  <input type="text" required className="input-premium py-4" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Amount</label>
                  <input type="number" required className="input-premium py-4" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                </div>
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Category</label>
                  <select className="input-premium py-4" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Account Source</label>
                  <select className="input-premium py-4" value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })}>
                    <option value="">No Deduction</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-5 text-xl font-black">{submitting ? "Deploying..." : "Finalize Transaction"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
