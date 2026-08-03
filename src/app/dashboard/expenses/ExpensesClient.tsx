"use client";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { addExpense, deleteExpense, updateExpense } from "./actions";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, parseISO, subMonths } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { Drawer } from "@/components/ui/drawer";

import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "@/components/ui/recharts";
import { CHART_SERIES_COLOURS, getCategoryColour } from "@/lib/chart-colours";
import ExpenseDataTable from "./components/ExpenseDataTable";
import ExpenseForm from "./components/ExpenseForm";
import { CustomChartTooltip } from "@/components/ui/chart-tooltip";

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
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [editingExpense, setEditingExpense] = useState<{ id: string; description: string; amount: string | number; category: string; date: string | null; account_id: string | null } | null>(null);
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

  function handleEditExpense(expense: { id: string; description: string; amount: string | number; category: string; date: string | null; account_id: string | null }) {
    setEditingExpense(expense);
    setShowAddModal(true);
  }

  async function confirmDeleteExpense() {
    if (!deletingExpenseId) return;
    await withLock(async () => {
      const res = await deleteExpense(deletingExpenseId);
      if (!res?.error) {
        toast.success(res.message || "Expense entry reverted successfully");
        mutate();
      } else {
        toast.error(res.error);
      }
      setShowDeleteConfirm(false);
      setDeletingExpenseId(null);
    });
  }

  async function handleSubmitForm(data: any) {
    await withLock(async () => {
      const isEdit = Boolean(editingExpense || data.id);
      const res = isEdit
        ? await updateExpense({
            id: editingExpense?.id || data.id,
            description: data.description,
            amount: typeof data.amount === "number" ? data.amount : parseFloat(data.amount),
            category: data.category,
            date: data.date,
            account_id: data.account_id || undefined,
          })
        : await addExpense(data);

      if (!res?.error) {
        toast.success(isEdit ? "Expense entry updated" : "Expense recorded successfully");
        setShowAddModal(false);
        setEditingExpense(null);
        mutate();
      } else {
        toast.error(res.error);
      }
    });
  }

  const getColorByLabel = (label: string | null | undefined) => {
    if (!label) return "#06B6D4";
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

  const currentMonthExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (!e.date) return false;
      const d = parseISO(e.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [expenses, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const targetDate = new Date(selectedYear, selectedMonth - 1, 1);
    const currentMonth = currentMonthExpenses;
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

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal tracking-tight text-white">Expenses</h1>
            <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-amber-400' : 'bg-emerald-400 opacity-50'}`} />
          </div>
          <p className="text-slate-400 text-sm mt-1 font-sans">Monitor your daily spend and monthly category breakdowns.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="hidden md:flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl">
            <button
              type="button"
              onClick={() => {
                if (selectedMonth === 1) {
                  setSelectedMonth(12);
                  setSelectedYear(prev => prev - 1);
                } else {
                  setSelectedMonth(prev => prev - 1);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              ◀
            </button>
            <div className="px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-amber-300 select-none">
              {format(new Date(selectedYear, selectedMonth - 1, 1), "MMM yyyy")}
            </div>
            <button
              type="button"
              onClick={() => {
                if (selectedMonth === 12) {
                  setSelectedMonth(1);
                  setSelectedYear(prev => prev + 1);
                } else {
                  setSelectedMonth(prev => prev + 1);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Next month"
            >
              ▶
            </button>
          </div>

          <button 
            type="button" 
            onClick={() => setShowAddModal(true)} 
            className="h-10 px-5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all flex items-center justify-center gap-2 border border-amber-400/30 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Log Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Expenses</p>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-mono font-bold text-rose-400 tabular-nums">
              -₹{stats.totalSpent.toLocaleString()}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">All Time</span>
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">This Month</p>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-mono font-bold text-amber-300 tabular-nums">
              -₹{stats.monthlyTotal.toLocaleString()}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">{format(new Date(selectedYear, selectedMonth - 1, 1), "MMM")}</span>
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Average Expense</p>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-mono font-bold text-slate-200 tabular-nums">
              -₹{(expenses.length ? stats.totalSpent / expenses.length : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
            </h3>
            <span className="text-[10px] font-mono text-slate-500">{expenses.length} entries</span>
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Top Category</p>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <h3 className="text-lg md:text-xl font-bold truncate text-slate-100">{stats.pieData[0]?.name || "None"}</h3>
            <span className="text-[10px] font-mono text-slate-500">Highest</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly Spending Trend</h3>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /><span className="text-xs text-slate-400">Outflow</span></div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
                <YAxis hide />
                <Tooltip content={<CustomChartTooltip currency="₹" />} />
                <Area type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">Expense Categories</h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={6} dataKey="value">
                  {stats.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomChartTooltip currency="₹" />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {stats.pieData.slice(0, 4).map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{background: item.color}} />
                <span className="text-xs font-medium text-slate-300 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ExpenseDataTable
        expenses={currentMonthExpenses as any[]}
        accounts={accounts}
        onDelete={handleDeleteExpense}
        onEdit={handleEditExpense}
        onAdd={() => setShowAddModal(true)}
        categories={CATEGORIES}
      />

      {showDeleteConfirm && (
        <div role="dialog" aria-modal="true" className="mobile-dialog-shell fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md md:max-w-lg p-6 md:p-8 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl">
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
        <Drawer isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingExpense(null); }} title={editingExpense ? "Edit Expense" : "Record Transaction"}>
          <ExpenseForm
            key={`drawer-${editingExpense?.id ?? 'new'}-${defaultDate}-${defaultAccountId}-${showAddModal}`}
            isOpen={showAddModal}
            onClose={() => { setShowAddModal(false); setEditingExpense(null); }}
            onSubmit={handleSubmitForm}
            submitting={submitting}
            accounts={accounts}
            categories={CATEGORIES}
            defaultDate={editingExpense?.date ?? defaultDate}
            defaultAccountId={editingExpense?.account_id ?? defaultAccountId}
            editingExpense={editingExpense ?? undefined}
          />
        </Drawer>
      )}
    </div>
  );
}
