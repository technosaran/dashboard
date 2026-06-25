"use client";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { addExpense, deleteExpense } from "./actions";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, parseISO, subMonths } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Drawer } from "@/components/ui/drawer";
import Link from "next/link";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { CHART_SERIES_COLOURS, getCategoryColour } from "@/lib/chart-colours";
import { exportToCSV } from "@/lib/export-csv";

import ExpenseDataTable from "./components/ExpenseDataTable";
import ExpenseForm from "./components/ExpenseForm";

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
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const defaultDate = useMemo(() => {
    const today = new Date();
    const yyyy = selectedYear;
    const mm = String(selectedMonth).padStart(2, '0');
    if (today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear) {
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } else {
      return `${yyyy}-${mm}-01`;
    }
  }, [selectedMonth, selectedYear]);

  const defaultAccountId = useMemo(() => {
    if (accounts.length > 0) {
      const defaultAccId = profile?.default_accounts?.expenses;
      if (defaultAccId && accounts.some(a => a.id === defaultAccId)) {
        return defaultAccId;
      }
    }
    return "";
  }, [accounts, profile]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDeleteConfirm(false);
        setDeletingExpenseId(null);
        setShowAddModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      const categoryColor = CATEGORIES.find(c => c.label === name)?.color;
      let resolvedColor = categoryColor || getCategoryColour(name);
      
      if (resolvedColor === getCategoryColour("Others") && name.toLowerCase() !== "others") {
        resolvedColor = getColorByLabel(name);
      }

      if (!resolvedColor || resolvedColor === "undefined") {
        resolvedColor = getColorByLabel(name);
      }

      return {
        name, 
        value,
        fill: resolvedColor,
        color: resolvedColor,
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
  }, [expenses, selectedMonth, selectedYear]);

  const currentMonthExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (!e.date) return false;
      const d = parseISO(e.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [expenses, selectedMonth, selectedYear]);

  async function handleSubmitForm(data: any) {
    await withLock(async () => {
      const result = await addExpense(data);
      if (!result?.error) {
        toast.success("Daily expenditure recorded: Ledger updated");
        setShowAddModal(false);
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
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
          <ExpenseForm
            key={`mobile-${defaultDate}-${defaultAccountId}`}
            isOpen={true}
            onClose={() => {}}
            onSubmit={handleSubmitForm}
            submitting={submitting}
            accounts={accounts}
            categories={CATEGORIES}
            defaultDate={defaultDate}
            defaultAccountId={defaultAccountId}
          />
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
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y} className="bg-[--bg-surface]">{y}</option>
            ))}
          </select>
          <button type="button" 
            onClick={() => {
              exportToCSV(
                currentMonthExpenses.map(e => ({
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
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-[--accent-primary]/10 text-[--accent-primary] border border-[--accent-primary]/20 font-bold">{format(new Date(selectedYear, selectedMonth - 1, 1), "MMM")}</span>
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
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
          <div className="h-[240px] w-full"><ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}><PieChart><Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">{stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }} /></PieChart></ResponsiveContainer></div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">{stats.pieData.slice(0, 4).map((item) => (<div key={item.name} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{background: item.color}} /><span className="text-[10px] font-bold text-[--text-secondary] truncate">{item.name}</span></div>))}</div>
        </div>
      </div>

      <ExpenseDataTable
        expenses={currentMonthExpenses as any[]}
        accounts={accounts}
        onDelete={handleDeleteExpense}
        onAdd={() => setShowAddModal(true)}
        categories={CATEGORIES}
      />

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
        <Drawer isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Record Transaction">
          <ExpenseForm
            key={`drawer-${defaultDate}-${defaultAccountId}-${showAddModal}`}
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSubmit={handleSubmitForm}
            submitting={submitting}
            accounts={accounts}
            categories={CATEGORIES}
            defaultDate={defaultDate}
            defaultAccountId={defaultAccountId}
          />
        </Drawer>
      )}
    </div>
  );
}
