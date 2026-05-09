"use client";

import Link from "next/link";
import { useMemo, useState, useDeferredValue, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { addExpense } from "./actions";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";

import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { CHART_COLOURS, getCategoryColour } from "@/lib/chart-colours";
import { exportToCSV } from "@/lib/export-csv";

const CATEGORIES = [
  { label: "Rent", icon: "🏠", color: getCategoryColour("Bills & Utilities") },
  { label: "Food", icon: "🍔", color: getCategoryColour("Food & Dining") },
  { label: "Travel", icon: "✈️", color: getCategoryColour("Travel") },
  { label: "Investment", icon: "📈", color: CHART_COLOURS[3] },
  { label: "Transport", icon: "🚌", color: getCategoryColour("Transportation") },
  { label: "Utilities", icon: "⚡", color: getCategoryColour("Bills & Utilities") },
  { label: "Entertainment", icon: "🎬", color: CHART_COLOURS[6] },
  { label: "Shopping", icon: "🛍️", color: CHART_COLOURS[0] },
  { label: "Subscription", icon: "💳", color: CHART_COLOURS[7] },
  { label: "Others", icon: "📦", color: getCategoryColour("Others") },
];



export default function ExpensesClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { expenses, accounts }, isValidating } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Food",
    date: new Date().toISOString().split("T")[0],
    account_id: "",
  });

  // Load budgets from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('expense_budgets');
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBudgets(JSON.parse(stored));
      } catch (e) {
        console.warn('Failed to parse budgets:', e);
      }
    }
  }, []);

  // Save budgets to localStorage
  const saveBudget = (category: string, limit: number) => {
    const newBudgets = { ...budgets, [category]: limit };
    setBudgets(newBudgets);
    localStorage.setItem('expense_budgets', JSON.stringify(newBudgets));
    toast.success(`Budget set for ${category}`);
  };

  // Calculate category spending for current month
  const categorySpending = useMemo(() => {
    const now = new Date();
    const currentMonth = expenses.filter(e => 
      e.date && isWithinInterval(parseISO(e.date), { start: startOfMonth(now), end: endOfMonth(now) })
    );
    
    const spending: Record<string, number> = {};
    currentMonth.forEach(e => {
      spending[e.category] = (spending[e.category] || 0) + Number(e.amount);
    });
    
    return spending;
  }, [expenses]);

  // Check if any category exceeds 80%
  const hasWarning = useMemo(() => {
    return Object.entries(budgets).some(([category, limit]) => {
      const spent = categorySpending[category] || 0;
      return (spent / limit) >= 0.8;
    });
  }, [budgets, categorySpending]);



  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = expenses.filter(e => e.date && isWithinInterval(parseISO(e.date), { start: startOfMonth(now), end: endOfMonth(now) }));
    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const monthlyTotal = currentMonth.reduce((s, e) => s + Number(e.amount), 0);
    
    const catMap: Record<string, number> = {};
    expenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
    });
    const pieData = Object.entries(catMap).map(([name, value]) => {
      const color = CATEGORIES.find(c => c.label === name)?.color || getCategoryColour("Others");
      return {
      name, 
      value,
      fill: color,
      color: color,
    };
    }).sort((a, b) => b.value - a.value);

    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      trendMap[format(d, "MMM")] = 0;
    }
    expenses.forEach(e => {
      if (!e.date) return;
      const m = format(parseISO(e.date), "MMM");
      if (trendMap[m] !== undefined) trendMap[m] += Number(e.amount);
    });
    const trendData = Object.entries(trendMap).map(([name, value]) => ({ name, value }));

    return { totalSpent, monthlyTotal, pieData, trendData };
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter(e => {
      const matchSearch = e.description.toLowerCase().includes(deferredSearch.toLowerCase());
      const matchCat = categoryFilter === "All" || e.category === categoryFilter;
      return matchSearch && matchCat;
    });
    
    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [expenses, deferredSearch, categoryFilter, currentPage]);

  const totalFilteredCount = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch = e.description.toLowerCase().includes(deferredSearch.toLowerCase());
      const matchCat = categoryFilter === "All" || e.category === categoryFilter;
      return matchSearch && matchCat;
    }).length;
  }, [expenses, deferredSearch, categoryFilter]);

  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addExpense({ ...formData, amount: parseFloat(formData.amount), account_id: formData.account_id || undefined });
    if (!result?.error) {
      toast.success("Daily expenditure recorded: Ledger updated");
      setFormData({ 
        description: "", 
        amount: "", 
        category: "Food", 
        date: new Date().toISOString().split("T")[0], 
        account_id: "",
      });
      setShowAddModal(false);
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="md:hidden p-4 rounded-xl border border-[--danger]/20 bg-[--danger]/5 text-center mt-4">
             <h2 className="text-xl font-black text-white">Record Expense</h2>
             <p className="text-[10px] text-[--text-muted] uppercase tracking-widest mt-1">Mobile Data Node</p>
             <button onClick={() => setShowAddModal(true)} className="btn-primary w-full mt-4 shadow-xl shadow-[--danger]/20 bg-[--danger] hover:bg-[--danger]">Log Now</button>
             <Link href="/dashboard" className="block text-center mt-4 text-[10px] text-white/50 uppercase font-black tracking-widest hover:text-white">← System Home</Link>
          </div>
        <div className="hidden md:block">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Expense Tracking</h1>
            <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
          </div>
          <p className="text-[--text-secondary] text-[13px] md:text-sm mt-1">Monitor your spending and analyze your monthly expenditure.</p>
        </div>
        <div className="hidden md:flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button onClick={() => setShowBudgetModal(true)} className="btn-secondary flex-1 md:flex-none gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            Budgets
          </button>
          <button 
            onClick={() => {
              try {
                exportToCSV(
                  expenses.map(e => ({
                    date: e.date ? format(parseISO(e.date), "yyyy-MM-dd") : "",
                    description: e.description,
                    category: e.category,
                    amount: Number(e.amount),
                    account: accounts.find(a => a.id === e.account_id)?.name || "Direct Log"
                  })),
                  "expenses_data",
                  [
                    { key: "date", label: "Date" },
                    { key: "description", label: "Description" },
                    { key: "category", label: "Category" },
                    { key: "amount", label: "Amount" },
                    { key: "account", label: "Account" }
                  ]
                );
                toast.success("Expense data exported successfully");
              } catch {
                toast.error("Failed to export data");
              }
            }}
            className="btn-secondary flex-1 md:flex-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex-1 md:flex-none gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Record
          </button>
        </div>
      </div>

      {/* Budget Warning Banner */}
      {hasWarning && (
        <div className="hidden md:block glass-card-static p-4 border-[--warning]/30 bg-[--warning]/10 animate-fade-in">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[--warning] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-bold text-[--warning]">Budget Alert</p>
              <p className="text-xs text-[--text-muted] mt-0.5">
                One or more categories have exceeded 80% of their budget limit. Review your spending.
              </p>
            </div>
            <button onClick={() => setShowBudgetModal(true)} className="btn-secondary !h-9 !px-4 text-xs">
              Manage Budgets
            </button>
          </div>
        </div>
      )}

      <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Net Consumption</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate">₹{stats.totalSpent.toLocaleString()}</h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-[--success]/10 text-[--success] border border-[--success]/20 font-bold">All Time</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Monthly Flow</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate">₹{stats.monthlyTotal.toLocaleString()}</h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-[--accent-primary]/10 text-[--accent-primary] border border-[--accent-primary]/20 font-bold">{format(new Date(), "MMM")}</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Average</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate">₹{(expenses.length ? stats.totalSpent / expenses.length : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted]">{expenses.length} txns</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between bg-gradient-to-br from-sky-500/10 to-transparent">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Top Sector</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate">{stats.pieData[0]?.name || "None"}</h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted]">Highest</span>
          </div>
        </div>
      </div>

      <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card-static p-5 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Expenditure Velocity</h3>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[--accent-primary]" /><span className="text-[10px] font-bold text-[--text-muted]">Monthly Trend</span></div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData}><defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} dy={10} /><YAxis hide /><Tooltip contentStyle={{background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px'}} cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}} /><Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" /></AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-8">Asset Allocation</h3>
          <div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">{stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">{stats.pieData.slice(0, 4).map((item) => (<div key={item.name} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background: item.color}} /><span className="text-[10px] font-bold text-[--text-secondary] truncate">{item.name}</span></div>))}</div>
        </div>
      </div>

      {/* Budget Progress by Category */}
      {Object.keys(budgets).length > 0 && (
        <div className="hidden md:block glass-card-static p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Budget Tracking (This Month)</h3>
            <button onClick={() => setShowBudgetModal(true)} className="text-[10px] font-black uppercase tracking-widest text-[--accent-primary] underline">
              Manage
            </button>
          </div>
          <div className="space-y-4">
            {Object.entries(budgets).map(([category, limit]) => {
              const spent = categorySpending[category] || 0;
              const percentage = (spent / limit) * 100;
              const color = percentage >= 80 ? 'text-[--danger]' : percentage >= 60 ? 'text-[--warning]' : 'text-[--success]';
              const bgColor = percentage >= 80 ? 'bg-[--danger]' : percentage >= 60 ? 'bg-[--warning]' : 'bg-[--success]';
              
              return (
                <div key={category}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[--text-primary]">{category}</span>
                      <span className={`text-[10px] font-black ${color}`}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[13px] font-black ${color}`}>
                        ₹{spent.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[--text-muted] ml-2">
                        / ₹{limit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${bgColor} transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="hidden md:block glass-card-static overflow-hidden border-white/5">
        <div className="p-5 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto"><div className="relative flex-1 md:w-64"><svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="Search transactions..." className="input-premium pl-10 py-2 text-sm w-full" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select className="input-premium py-2 text-sm w-32 md:w-40" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="All">All Categories</option>{CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}</select></div>
          <div className="text-[10px] font-bold text-[--text-muted]">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalFilteredCount)} of {totalFilteredCount} results
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          {expenses.length === 0 ? (
            <div className="py-24 flex flex-col items-center text-center">
               <h3 className="text-2xl font-black text-white mb-2">Initialize Your Financial Ledger</h3>
               <p className="text-sm text-[--text-muted] max-w-sm mb-8">Start by adding your first expense. Track every rupee to gain total control over your capital.</p>
               <button onClick={() => setShowAddModal(true)} className="btn-primary shadow-2xl shadow-[--accent-primary]/20 px-10">Add Your First Expense</button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[650px] md:min-w-0">
              <thead><tr className="bg-white/[0.02] border-b border-white/5"><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</th><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Ref / Description</th><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Segment</th><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] hidden sm:table-cell">Channel</th><th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredExpenses.length === 0 ? (<tr><td colSpan={5} className="px-6 py-20 text-center text-[--text-muted] text-sm italic">No transactions found matching your criteria.</td></tr>) : (filteredExpenses.map((exp) => { const theme = CATEGORIES.find(c => c.label === exp.category) || CATEGORIES[7]; const account = accounts.find(a => a.id === exp.account_id); return (<tr key={exp.id} className="hover:bg-white/[0.015] transition-colors group"><td className="px-4 md:px-6 py-5 whitespace-nowrap"><p className="text-[13px] font-bold text-[--text-primary]">{exp.date ? format(parseISO(exp.date), "MMM d, yy") : "—"}</p><p className="text-[9px] text-[--text-muted] uppercase font-bold">Verified</p></td><td className="px-4 md:px-6 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">{theme.icon}</div><p className="text-[13px] font-medium text-[--text-primary] group-hover:text-[--accent-primary] transition-colors truncate max-w-[120px] md:max-w-none">{exp.description}</p></div></td><td className="px-4 md:px-6 py-5 whitespace-nowrap"><span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10" style={{color: theme.color}}>{exp.category}</span></td><td className="px-4 md:px-6 py-5 whitespace-nowrap hidden sm:table-cell"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /><span className="text-[11px] font-medium text-[--text-secondary]">{account?.name || "Cash"}</span></div></td><td className="px-4 md:px-6 py-4 whitespace-nowrap text-right"><p className="text-[15px] md:text-base font-black text-[--text-primary]">₹{Number(exp.amount).toLocaleString()}</p></td></tr>) }))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                      currentPage === pageNum
                        ? 'bg-[--accent-primary] text-white'
                        : 'bg-white/5 hover:bg-white/10 text-[--text-muted]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in shadow-2xl">
          <div className="glass-card-static w-full max-w-2xl p-6 md:p-10 border-[--accent-primary]/20 shadow-[0_0_100px_rgba(108,92,231,0.15)] max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8 md:mb-10"><div className="flex items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[--accent-primary]/20 flex items-center justify-center"><svg className="w-5 h-5 md:w-6 md:h-6 text-[--accent-primary]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div><h2 className="text-xl md:text-3xl font-black">Record Transaction</h2></div><button onClick={() => setShowAddModal(false)} className="text-[--text-muted] hover:text-[--text-primary] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"><svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleSubmit} className="space-y-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">{["Food", "Shopping", "Entertainment"].includes(formData.category) ? "Merchant / Store" : "Description / Purpose"}</label><input type="text" required className="input-premium" placeholder="e.g. Starbucks" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Debit Amount</label><input type="number" required className="input-premium" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} /></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Expenditure Sector</label><select className="input-premium" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>{CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}</select></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transaction Date</label><input type="date" required className="input-premium" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Deduct from Account</label><select className="input-premium" value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })}><option value="">No Deduction (Track only)</option>{accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></div></div><button type="submit" disabled={submitting} className="btn-primary w-full shadow-xl shadow-[--accent-primary]/20 mt-4">{submitting ? "Processing..." : "Confirm Record"}</button>
</form>
          </div>
        </div>
      )}

      {/* Budget Management Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card-static w-full max-w-2xl p-6 md:p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black">Budget Management</h2>
                <p className="text-[11px] text-[--text-muted] mt-1">Set monthly spending limits for each category</p>
              </div>
              <button onClick={() => setShowBudgetModal(false)} className="text-[--text-muted] hover:text-[--text-primary] transition-colors p-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {CATEGORIES.map((cat) => {
                const currentBudget = budgets[cat.label] || 0;
                const spent = categorySpending[cat.label] || 0;
                const percentage = currentBudget > 0 ? (spent / currentBudget) * 100 : 0;

                return (
                  <div key={cat.label} className="glass-card-static p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cat.icon}</span>
                        <div>
                          <p className="text-[14px] font-bold text-[--text-primary]">{cat.label}</p>
                          {currentBudget > 0 && (
                            <p className="text-[10px] text-[--text-muted]">
                              Spent: ₹{spent.toLocaleString()} / ₹{currentBudget.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="0"
                          defaultValue={currentBudget || ''}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value);
                            if (value > 0) {
                              saveBudget(cat.label, value);
                            } else if (value === 0 || !e.target.value) {
                              const newBudgets = { ...budgets };
                              delete newBudgets[cat.label];
                              setBudgets(newBudgets);
                              localStorage.setItem('expense_budgets', JSON.stringify(newBudgets));
                            }
                          }}
                          className="input-premium w-32 h-10 text-sm text-right"
                        />
                      </div>
                    </div>
                    {currentBudget > 0 && (
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            percentage >= 80 ? 'bg-[--danger]' : percentage >= 60 ? 'bg-[--warning]' : 'bg-[--success]'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[11px] text-[--text-muted]">
                <strong>Tip:</strong> Set realistic monthly budgets for each category. You&apos;ll receive warnings when spending exceeds 80% of your limit.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
