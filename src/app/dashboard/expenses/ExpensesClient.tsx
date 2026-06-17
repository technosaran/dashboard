"use client";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { addExpense, deleteExpense } from "./actions";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, parseISO, subMonths } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useMediaQuery } from "@/hooks/use-media-query";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

import dynamic from "next/dynamic";

const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { CHART_SERIES_COLOURS, getCategoryColour } from "@/lib/chart-colours";
import { exportToCSV } from "@/lib/export-csv";

const CATEGORIES = [
  { label: "Rent", icon: "🏠", color: getCategoryColour("Rent") },
  { label: "Food", icon: "🍔", color: getCategoryColour("Food & Dining") },
  { label: "Travel", icon: "✈️", color: getCategoryColour("Travel") },
  { label: "Investment", icon: "📈", color: getCategoryColour("Investment") },
  { label: "Transport", icon: "🚌", color: getCategoryColour("Transportation") },
  { label: "Utilities", icon: "⚡", color: getCategoryColour("Utilities") },
  { label: "Entertainment", icon: "🎬", color: getCategoryColour("Entertainment") },
  { label: "Shopping", icon: "🛍️", color: getCategoryColour("Shopping") },
  { label: "Subscription", icon: "💳", color: getCategoryColour("Subscription") },
  { label: "Others", icon: "📦", color: getCategoryColour("Others") },
];

export default function ExpensesClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { expenses, accounts, profile }, isValidating, mutate } = useFinanceData(initialData);
  const isMobile = useMediaQuery('(max-width: 767.98px)');
  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Food",
    date: "",
    account_id: "",
  });

  // Set today's date on client mount to prevent SSR/hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        date: new Date().toISOString().split("T")[0]
      }));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Initialize default account when accounts/profile loads or modal is opened
  useEffect(() => {
    if (accounts.length > 0 && showAddModal && !formData.account_id) {
      const defaultAccId = profile?.settings?.default_accounts?.expenses;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      if (defaultAccExists) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, account_id: defaultAccId }));
        }, 0);
      }
    }
  }, [accounts, profile, showAddModal, formData.account_id]);

  // Align form default date with the selected month and year
  useEffect(() => {
    if (showAddModal) {
      const t = setTimeout(() => {
        setFormData(prev => {
          if (!prev.date) return prev;
          const today = new Date();
          const [currYear, currMonth] = prev.date.split("-").map(Number);
          
          if (currMonth === selectedMonth && currYear === selectedYear) {
            return prev;
          }
          
          const yyyy = selectedYear;
          const mm = String(selectedMonth).padStart(2, '0');
          
          if (today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear) {
            const dd = String(today.getDate()).padStart(2, '0');
            return { ...prev, date: `${yyyy}-${mm}-${dd}` };
          } else {
            return { ...prev, date: `${yyyy}-${mm}-01` };
          }
        });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [selectedMonth, selectedYear, showAddModal]);

  // Handle escape key closure for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDeleteConfirm(false);
        setDeletingExpenseId(null);
        setShowAddModal(false);
      }
    };
    if (showDeleteConfirm || showAddModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteConfirm, showAddModal]);

  async function handleDeleteExpense(id: string) {
    setDeletingExpenseId(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteExpense() {
    if (!deletingExpenseId) return;
    await withLock(async () => {
      const res = await deleteExpense(deletingExpenseId);
      if (!res?.error) {
        toast.success("Expense entry reverted successfully");
        mutate();
      } else {
        toast.error(res.error);
      }
      setShowDeleteConfirm(false);
      setDeletingExpenseId(null);
    });
  }

  const stats = useMemo(() => {
    const targetDate = new Date(selectedYear, selectedMonth - 1, 1);
    const currentMonth = expenses.filter(e => {
      if (!e.date) return false;
      const d = parseISO(e.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const monthlyTotal = currentMonth.reduce((s, e) => s + Number(e.amount), 0);
    
    const catMap: Record<string, number> = {};
    currentMonth.forEach(e => {
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
      const d = subMonths(targetDate, i);
      trendMap[format(d, "MMM yy")] = 0;
    }
    expenses.forEach(e => {
      if (!e.date) return;
      const m = format(parseISO(e.date), "MMM yy");
      if (trendMap[m] !== undefined) {
        trendMap[m] += Number(e.amount);
      }
    });
    const trendData = Object.entries(trendMap).map(([name, value]) => ({ name, value }));

    return { totalSpent, monthlyTotal, pieData, trendData };
  }, [expenses, selectedMonth, selectedYear, accounts]);

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter(e => {
      const matchCat = categoryFilter === "All" || e.category === categoryFilter;
      if (!matchCat) return false;
      if (!e.date) return false;
      const d = parseISO(e.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
    
    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [expenses, categoryFilter, currentPage, selectedMonth, selectedYear]);

  const totalFilteredCount = useMemo(() => {
    return expenses.filter(e => {
      const matchCat = categoryFilter === "All" || e.category === categoryFilter;
      if (!matchCat) return false;
      if (!e.date) return false;
      const d = parseISO(e.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    }).length;
  }, [expenses, categoryFilter, selectedMonth, selectedYear]);

  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const result = await addExpense({ ...formData, amount: parseFloat(formData.amount), account_id: formData.account_id || undefined });
      if (!result?.error) {
        toast.success("Daily expenditure recorded: Ledger updated");
        const today = new Date();
        const yyyy = selectedYear;
        const mm = String(selectedMonth).padStart(2, '0');
        const defaultDate = (today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear)
          ? `${yyyy}-${mm}-${String(today.getDate()).padStart(2, '0')}`
          : `${yyyy}-${mm}-01`;

        setFormData({ 
          description: "", 
          amount: "", 
          category: "Food", 
          date: defaultDate, 
          account_id: "",
        });
        setShowAddModal(false);
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-[calc(var(--mobile-bottom-nav-height)+2rem)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[--text-primary]">Record Expense</h1>
            <div className={`status-dot scale-70 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'}`} />
          </div>
          <Link href="/dashboard" className="text-[10px] font-black uppercase text-[--text-muted] no-underline bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
            Back
          </Link>
        </div>
        
        <div className="glass-card-static p-5 border border-white/5 bg-white/[0.01]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                {["Food", "Shopping", "Entertainment"].includes(formData.category) ? "Merchant / Store" : "Description / Purpose"}
              </label>
              <input type="text" required className="input-premium" placeholder="e.g. Starbucks" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} autoComplete="off" id="expense-description" name="description" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Debit Amount</label>
              <input type="number" required className="input-premium" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} autoComplete="off" inputMode="decimal" id="expense-amount" name="amount" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Expenditure Sector</label>
              <select className="input-premium" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} aria-label="Select expenditure category" id="expense-category" name="category">
                {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transaction Date</label>
              <input type="date" required className="input-premium" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} autoComplete="off" id="expense-date" name="date" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Deduct from Account</label>
              <select className="input-premium" value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })} aria-label="Select debit account" id="expense-account" name="account_id">
                <option value="">No Deduction (Track only)</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
              {formData.account_id && (() => {
                const selectedAcc = accounts.find(a => a.id === formData.account_id);
                return selectedAcc ? (
                  <div className="mt-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] text-[--text-secondary]">
                    <span>Selected Balance</span>
                    <span className="font-bold text-white">
                      {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                    </span>
                  </div>
                ) : null;
              })()}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full h-12 shadow-md mt-6">
              {submitting ? "Processing..." : "Confirm Record"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Expense Tracking</h1>
            <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
          </div>
          <p className="text-[--text-secondary] text-[13px] md:text-sm mt-1">Monitor your spending and analyze your monthly expenditure.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select 
            className="btn-secondary !h-11 px-4 text-xs font-bold" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            aria-label="Select month"
            id="expenses-month-select"
            name="month"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1} className="bg-[--bg-surface]">
                {format(new Date(2020, i, 1), "MMMM")}
              </option>
            ))}
          </select>
          <select 
            className="btn-secondary !h-11 px-4 text-xs font-bold" 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            aria-label="Select year"
            id="expenses-year-select"
            name="year"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y} className="bg-[--bg-surface]">{y}</option>
            ))}
          </select>
          <button type="button" 
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
            className="btn-secondary flex-1 md:flex-none gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary flex-1 md:flex-none gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Net Consumption</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate text-danger">
              -₹{stats.totalSpent.toLocaleString()}
            </h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-bold">All Time</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Monthly Flow</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate text-danger">
              -₹{stats.monthlyTotal.toLocaleString()}
            </h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-[--accent-primary]/10 text-[--accent-primary] border border-[--accent-primary]/20 font-bold">{format(new Date(), "MMM")}</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Average</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate text-danger">
              -₹{(expenses.length ? stats.totalSpent / expenses.length : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
            </h3>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card-static p-5 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Expenditure Velocity</h3>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_SERIES_COLOURS.expense }} /><span className="text-[10px] font-bold text-[--text-muted]">Monthly Trend</span></div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_SERIES_COLOURS.expense} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_SERIES_COLOURS.expense} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} dy={10} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="value" stroke={CHART_SERIES_COLOURS.expense} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-8">Asset Allocation</h3>
          <div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">{stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">{stats.pieData.slice(0, 4).map((item) => (<div key={item.name} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background: item.color}} /><span className="text-[10px] font-bold text-[--text-secondary] truncate">{item.name}</span></div>))}</div>
        </div>
      </div>

      <div className="glass-card-static overflow-hidden border-white/5">
        <div className="p-5 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto"><select className="input-premium py-2 text-sm w-32 md:w-40" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category" id="expenses-category-filter" name="categoryFilter"><option value="All">All Categories</option>{CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}</select></div>
          <div className="text-[10px] font-bold text-[--text-muted]">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalFilteredCount)} of {totalFilteredCount} results
          </div>
        </div>

        <div className="hidden overflow-x-auto w-full custom-scrollbar md:block">
          {expenses.length === 0 ? (
            <EmptyState
              title="Initialize Your Financial Ledger"
              description="Start by adding your first expense. Track every rupee to gain total control over your capital outflow."
              icon={
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
              }
              glowColor="rose"
              action={
                <button type="button" onClick={() => setShowAddModal(true)} className="btn-primary shadow-xl shadow-[--accent-primary]/20 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                  Add Your First Expense
                </button>
              }
            />
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Ref / Description</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Segment</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] hidden sm:table-cell">Channel</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Amount</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-[--text-muted] text-sm italic">No transactions found matching your criteria.</td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => {
                    const theme = CATEGORIES.find(c => c.label === exp.category) || CATEGORIES[7];
                    const account = accounts.find(a => a.id === exp.account_id);
                    return (
                      <tr key={exp.id} className="hover:bg-white/[0.015] transition-colors group">
                        <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                          <p className="text-[13px] font-bold text-[--text-primary]">{exp.date ? format(parseISO(exp.date), "MMM d, yy") : "—"}</p>
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">{theme.icon}</div>
                            <p className="text-[13px] font-medium text-[--text-primary] group-hover:text-[--accent-primary] transition-colors truncate max-w-[120px] md:max-w-none">{exp.description}</p>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10" style={{color: theme.color}}>{exp.category}</span>
                        </td>
                        <td className="px-4 md:px-6 py-5 whitespace-nowrap hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[11px] font-medium text-[--text-secondary]">{account?.name || "Cash"}</span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                          <p className="text-[15px] md:text-base font-black text-danger">-{getAccountCurrency(exp.account_id) === 'USD' ? '$' : '₹'}{Number(exp.amount).toLocaleString()}</p>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                          <button type="button" 
                            onClick={() => handleDeleteExpense(exp.id)} 
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-rose-400 hover:bg-rose-500/10 transition-all ml-auto flex items-center justify-center"
                            title="Delete Transaction"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile card list feed for expenses */}
        <div className="divide-y divide-white/10 md:hidden">
          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-[--text-muted] text-xs italic">
              No transactions found matching your criteria.
            </div>
          ) : (
            filteredExpenses.map((exp) => {
              const theme = CATEGORIES.find(c => c.label === exp.category) || CATEGORIES[7];
              const account = accounts.find(a => a.id === exp.account_id);
              return (
                <div key={exp.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                        {theme.icon}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-bold text-[--text-primary] truncate">{exp.description}</span>
                        <span className="text-[9px] text-[--text-muted] uppercase font-bold">{exp.date ? format(parseISO(exp.date), "MMM d, yyyy") : "—"}</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[15px] font-black text-danger">-{getAccountCurrency(exp.account_id) === 'USD' ? '$' : '₹'}{Number(exp.amount).toLocaleString()}</span>
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.1em] bg-white/5 border border-white/10" style={{color: theme.color}}>{exp.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.03] pt-2 mt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-medium text-[--text-secondary]">{account?.name || "Cash"}</span>
                    </div>
                    <button type="button" 
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold text-[--text-secondary] active:bg-danger/10 active:text-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between">
            <button type="button"
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
                  <button type="button"
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
            <button type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div role="dialog" aria-modal="true" className="mobile-dialog-shell fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-sm p-8 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-[--text-primary]">Revert Transaction</h3>
                <p className="text-sm text-[--text-secondary] mt-2">Are you sure you want to revert this expense? Your account balance will be refunded.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletingExpenseId(null); }} className="btn-secondary flex-1 h-11 font-bold rounded-xl">Cancel</button>
                <button type="button" onClick={confirmDeleteExpense} className="btn-danger flex-1 h-11 font-bold rounded-xl" disabled={submitting}>Revert</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div role="dialog" aria-modal="true" className="mobile-dialog-shell fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in shadow-2xl">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-2xl p-6 md:p-10 border-[--accent-primary]/20 shadow-[0_0_100px_rgba(108,92,231,0.15)] max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8 md:mb-10"><div className="flex items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[--accent-primary]/20 flex items-center justify-center"><svg className="w-5 h-5 md:w-6 md:h-6 text-[--accent-primary]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div><h2 className="text-xl md:text-3xl font-black">Record Transaction</h2></div><button type="button" onClick={() => setShowAddModal(false)} className="text-[--text-muted] hover:text-[--text-primary] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"><svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleSubmit} className="space-y-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">{["Food", "Shopping", "Entertainment"].includes(formData.category) ? "Merchant / Store" : "Description / Purpose"}</label><input autoFocus type="text" required className="input-premium" placeholder="e.g. Starbucks" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} autoComplete="new-password" id="expense-description" name="description" /></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Debit Amount</label><input type="number" required className="input-premium" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} autoComplete="new-password" inputMode="decimal" id="expense-amount" name="amount" /></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Expenditure Sector</label><select className="input-premium" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} aria-label="Select expenditure category" id="expense-category" name="category">{CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}</select></div><div className="space-y-3"><label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transaction Date</label><input type="date" required className="input-premium" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} autoComplete="new-password" id="expense-date" name="date" /></div><div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Deduct from Account</label>
                      <select className="input-premium" value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })} aria-label="Select debit account" id="expense-account" name="account_id">
                        <option value="">No Deduction (Track only)</option>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                      </select>
                      {formData.account_id && (() => {
                        const selectedAcc = accounts.find(a => a.id === formData.account_id);
                        return selectedAcc ? (
                          <div className="mt-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
                            <span className="font-medium">Selected Balance</span>
                            <span className="font-bold text-white">
                              {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div></div><button type="submit" disabled={submitting} className="btn-primary w-full shadow-xl shadow-[--accent-primary]/20 mt-4">{submitting ? "Processing..." : "Confirm Record"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
