"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { format, parseISO } from "date-fns";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import { Trash2, Plus } from "lucide-react";
import { addIncome, deleteIncome } from "@/app/dashboard/income/actions";
import { addExpense, deleteExpense } from "@/app/dashboard/expenses/actions";

const INCOME_CATEGORIES = [
  { label: "Salary", icon: "🏢" },
  { label: "Work", icon: "💻" },
  { label: "Freelance", icon: "🚀" },
  { label: "Gift", icon: "💝" },
  { label: "Bonus", icon: "✨" },
  { label: "Refund", icon: "↩️" },
  { label: "Others", icon: "📦" },
];

const EXPENSE_CATEGORIES = [
  { label: "Rent", icon: "🏠" },
  { label: "Food", icon: "🍔" },
  { label: "Travel", icon: "✈️" },
  { label: "Investment", icon: "📈" },
  { label: "Transport", icon: "🚌" },
  { label: "Utilities", icon: "⚡" },
  { label: "Entertainment", icon: "🎬" },
  { label: "Shopping", icon: "🛍️" },
  { label: "Subscription", icon: "💳" },
  { label: "Others", icon: "📦" },
];

export default function TransactionsClient() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "income" ? "income" : searchParams.get("tab") === "expenses" ? "expense" : "all";

  const { data: { transactions, accounts, profile }, mutate } = useFinanceData();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
  const [activeTab, setActiveTab] = useState<"all" | "income" | "expense">(initialTab as any);
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<"income" | "expense" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const [modalType, setModalType] = useState<"income" | "expense">("expense");
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Food",
    date: "",
    account_id: "",
    is_recurring: false,
    recurrence_frequency: "monthly",
    recurrence_day: 1,
    recurrence_end_date: "",
  });

  // Default date and account setup
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

  const initializedRef = useRef(false);

  useEffect(() => {
    const isNew = searchParams.get("action") === "new";
    if (isNew && !initializedRef.current && accounts.length > 0) {
      initializedRef.current = true;
      const category = "Food";
      const defaultAccId = profile?.default_accounts?.expenses;
      const account_id = (defaultAccId && accounts.some(a => a.id === defaultAccId)) ? defaultAccId : "";
      setTimeout(() => {
        setFormData({
          description: "",
          amount: "",
          category,
          date: defaultDate,
          account_id,
          is_recurring: false,
          recurrence_frequency: "monthly",
          recurrence_day: 1,
          recurrence_end_date: "",
        });
      }, 0);
    } else if (!initializedRef.current && defaultDate) {
      setTimeout(() => {
        setFormData(prev => ({ ...prev, date: defaultDate }));
      }, 0);
      if (defaultDate) {
        initializedRef.current = true;
      }
    }
  }, [accounts, profile, defaultDate, searchParams]);

  const handleOpenAddModal = (type: "income" | "expense") => {
    setModalType(type);
    const category = type === "income" ? "Salary" : "Food";
    const defaultAccId = type === "income" 
      ? profile?.default_accounts?.income 
      : profile?.default_accounts?.expenses;
    const account_id = (defaultAccId && accounts.some(a => a.id === defaultAccId)) ? defaultAccId : "";
    
    setFormData({
      description: "",
      amount: "",
      category,
      date: defaultDate,
      account_id,
      is_recurring: false,
      recurrence_frequency: "monthly",
      recurrence_day: 1,
      recurrence_end_date: ""
    });
    setShowAddModal(true);
  };

  const handleSwitchModalType = (type: "income" | "expense") => {
    setModalType(type);
    const category = type === "income" ? "Salary" : "Food";
    const defaultAccId = type === "income" 
      ? profile?.default_accounts?.income 
      : profile?.default_accounts?.expenses;
    const account_id = (defaultAccId && accounts.some(a => a.id === defaultAccId)) ? defaultAccId : "";
    
    setFormData(prev => ({
      ...prev,
      category,
      account_id
    }));
  };

  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };

  const getCategoryIcon = (category: string, type: string) => {
    const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return categories.find(c => c.label === category)?.icon || "📦";
  };

  // Filter transactions by selected month, year, type tab, global filter, and category
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.date) return false;
      const tDate = parseISO(t.date);
      const matchesPeriod = tDate.getMonth() + 1 === selectedMonth && tDate.getFullYear() === selectedYear;
      if (!matchesPeriod) return false;

      const matchesTab = activeTab === "all" || t.type === activeTab;
      if (!matchesTab) return false;

      const matchesCategory = categoryFilter === "All" || t.category === categoryFilter;
      if (!matchesCategory) return false;

      if (globalFilter) {
        const lower = globalFilter.toLowerCase();
        const account = accounts.find(a => a.id === t.account_id);
        const matchesSearch = 
          t.description.toLowerCase().includes(lower) ||
          (t.category && t.category.toLowerCase().includes(lower)) ||
          (account && account.name.toLowerCase().includes(lower));
        if (!matchesSearch) return false;
      }

      return true;
    }).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [transactions, selectedMonth, selectedYear, activeTab, categoryFilter, globalFilter, accounts]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [prevFilters, setPrevFilters] = useState({
    globalFilter,
    activeTab,
    selectedMonth,
    selectedYear,
    categoryFilter,
  });

  if (
    globalFilter !== prevFilters.globalFilter ||
    activeTab !== prevFilters.activeTab ||
    selectedMonth !== prevFilters.selectedMonth ||
    selectedYear !== prevFilters.selectedYear ||
    categoryFilter !== prevFilters.categoryFilter
  ) {
    setPrevFilters({
      globalFilter,
      activeTab,
      selectedMonth,
      selectedYear,
      categoryFilter,
    });
    setCurrentPage(1);
  }

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(startIndex, startIndex + pageSize);
  }, [filteredTransactions, currentPage]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      if (!t.date) return;
      const tDate = parseISO(t.date);
      if (tDate.getMonth() + 1 === selectedMonth && tDate.getFullYear() === selectedYear) {
        if (t.type === "income") {
          totalIncome += Number(t.amount);
        } else if (t.type === "expense") {
          totalExpense += Number(t.amount);
        }
      }
    });

    const netFlow = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netFlow / totalIncome) * 100 : 0;

    return { totalIncome, totalExpense, netFlow, savingsRate };
  }, [transactions, selectedMonth, selectedYear]);



  async function handleDelete(id: string, type: "income" | "expense") {
    setDeletingId(id);
    setDeletingType(type);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!deletingId || !deletingType) return;
    await withLock(async () => {
      const res = deletingType === "income" 
        ? await deleteIncome(deletingId)
        : await deleteExpense(deletingId);
      if (!res?.error) {
        toast.success("Transaction entry reverted successfully");
        mutate();
      } else {
        toast.error(res.error);
      }
      setShowDeleteConfirm(false);
      setDeletingId(null);
      setDeletingType(null);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const payload = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: formData.date,
        account_id: formData.account_id || undefined,
        is_recurring: formData.is_recurring,
        recurrence_frequency: formData.recurrence_frequency,
        recurrence_day: formData.recurrence_day,
        recurrence_end_date: formData.recurrence_end_date || undefined
      };

      const res = modalType === "income" 
        ? await addIncome(payload)
        : await addExpense(payload);

      if (!res?.error) {
        toast.success(modalType === "income" ? "Income logged successfully" : "Expense logged successfully");
        setFormData({ 
          description: "", 
          amount: "", 
          category: "Food", 
          date: defaultDate, 
          account_id: "",
          is_recurring: false,
          recurrence_frequency: "monthly",
          recurrence_day: 1,
          recurrence_end_date: ""
        });
        setShowAddModal(false);
        mutate();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">Income &amp; Expenses</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Cashflow &amp; Income/Expenses Log</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end w-full lg:w-auto">
          {/* Selectors Group */}
          <div className="flex items-center gap-2">
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
          </div>

          {/* Action Logs Group */}
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => handleOpenAddModal("income")}
              className="btn-primary !h-11 px-4 text-xs font-bold flex items-center gap-2 !bg-emerald-500 hover:!bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.2)] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Income</span>
            </button>
            <button 
              type="button" 
              onClick={() => handleOpenAddModal("expense")}
              className="btn-primary !h-11 px-4 text-xs font-bold flex items-center gap-2 !bg-rose-500 hover:!bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.2)] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card-static p-6 border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Inflow</p>
          <p className="text-2xl md:text-3xl font-black text-emerald-400">₹{stats.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Income</p>
        </div>
        <div className="glass-card-static p-6 border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Outflow</p>
          <p className="text-2xl md:text-3xl font-black text-rose-500">₹{stats.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Expenses</p>
        </div>
        <div className="glass-card-static p-6 border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Net Cashflow</p>
          <p className={`text-2xl md:text-3xl font-black ${stats.netFlow >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
            ₹{stats.netFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Margin</p>
        </div>
        <div className="glass-card-static p-6 border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Savings Rate</p>
          <p className={`text-2xl md:text-3xl font-black ${stats.savingsRate >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
            {stats.savingsRate.toFixed(1)}%
          </p>
          <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Efficiency</p>
        </div>
      </div>

      {/* Premium Segmented Toggle Bar */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
        {[
          { key: "all", label: "All Transactions" },
          { key: "income", label: "Income Only" },
          { key: "expense", label: "Expenses Only" }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          
          let activeStyles = "bg-[--accent-primary] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]";
          if (tab.key === "income") activeStyles = "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]";
          else if (tab.key === "expense") activeStyles = "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]";

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key as any); setCategoryFilter("All"); }}
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

      {/* Unified Table view */}
      <div className="glass-card-static rounded-2xl overflow-hidden flex flex-col border border-white/5">
        <div className="p-4 md:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search description, category..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="input-premium pl-9 py-2 text-sm w-full sm:w-64 !bg-black/20"
            />
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="transactions-category-filter" className="text-xs font-bold text-[--text-muted] uppercase">Category:</label>
            <select
              id="transactions-category-filter"
              className="btn-secondary !h-9 px-3 text-xs font-bold"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {activeTab !== "expense" && INCOME_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
              {activeTab !== "income" && EXPENSE_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-black/40 border-b border-white/5">
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Description</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Category</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Channel</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Value</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[--text-muted] text-sm italic">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((t) => {
                  const isIncome = t.type === "income";
                  const icon = getCategoryIcon(t.category || "Others", t.type);
                  const account = accounts.find(a => a.id === t.account_id);
                  const currency = getAccountCurrency(t.account_id);

                  return (
                    <tr key={t.id}>
                      <td className="px-5 py-3.5 align-middle">
                        <p className="text-[13px] font-bold text-white">
                          {t.date ? format(parseISO(t.date), "MMM d, yy") : "—"}
                        </p>
                        <p className={`text-[9px] font-bold uppercase ${isIncome ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                          {isIncome ? "Inflow" : "Outflow"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0">
                            {icon}
                          </div>
                          <p className="text-[13px] font-medium text-white truncate max-w-[200px]">
                            {t.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border ${
                          isIncome 
                            ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400" 
                            : "bg-rose-500/5 border-rose-500/10 text-rose-400"
                        }`}>
                          {t.category || "Others"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 align-middle">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${isIncome ? "bg-emerald-400" : "bg-rose-400"}`} />
                          <span className="text-[11px] font-medium text-[--text-secondary]">{account?.name || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle text-right">
                        <p className={`text-[15px] font-black ${isIncome ? "text-emerald-400" : "text-rose-500"}`}>
                          {isIncome ? "+" : "-"}{currency === "USD" ? "$" : "₹"}
                          {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-middle text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(t.source_id || t.id, t.type as any)}
                          className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-rose-400 hover:bg-rose-500/10 transition-all ml-auto flex items-center justify-center cursor-pointer opacity-80 group-hover:opacity-100"
                          title="Delete Transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredTransactions.length > pageSize && (
          <div className="flex items-center justify-between mt-4 px-5 py-3.5 border-t border-white/5">
            <p className="text-[11px] text-[--text-muted] font-bold uppercase tracking-wider">
              Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length} txns
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary !h-8 !px-3 !text-[10px] font-black uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTransactions.length / pageSize), p + 1))}
                disabled={currentPage === Math.ceil(filteredTransactions.length / pageSize)}
                className="btn-secondary !h-8 !px-3 !text-[10px] font-black uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="glass-card-static max-w-md w-full p-6 border border-white/10 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white">Revert Transaction?</h3>
            <p className="text-sm text-[--text-muted] leading-relaxed">
              This will permanently delete the transaction and revert any balance adjustments made to the associated account. This action is irreversible.
            </p>
            <div className="flex gap-3 justify-end mt-4">
              <button 
                type="button" 
                onClick={() => { setShowDeleteConfirm(false); setDeletingId(null); setDeletingType(null); }}
                className="btn-secondary !h-10 px-4 text-xs font-bold"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={confirmDelete}
                className="btn-primary !bg-rose-600 hover:!bg-rose-700 !h-10 px-5 text-xs font-bold text-white shadow-lg shadow-rose-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Transaction Logger Drawer */}
      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Record Transaction"
        >
          <div className="space-y-6">
            {/* Modal Type Selector */}
            <div className="flex rounded-xl bg-white/5 p-1 border border-white/5">
              <button
                type="button"
                onClick={() => handleSwitchModalType("expense")}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                  modalType === "expense" 
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/25" 
                    : "text-[--text-muted] hover:text-white"
                }`}
              >
                Expense / Outflow
              </button>
              <button
                type="button"
                onClick={() => handleSwitchModalType("income")}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                  modalType === "income" 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                    : "text-[--text-muted] hover:text-white"
                }`}
              >
                Income / Inflow
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="tx-description">
                  {modalType === "expense" ? "Merchant / Purpose" : "Source / Payor"}
                </label>
                <input 
                  type="text" 
                  required 
                  className="input-premium !h-10 text-xs" 
                  placeholder={modalType === "expense" ? "e.g. Starbucks" : "e.g. Monthly Salary"} 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  autoComplete="off" 
                  id="tx-description" 
                  name="description" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="tx-amount">
                    Amount (₹)
                  </label>
                  <input 
                    type="number" 
                    required 
                    className="input-premium !h-10 text-xs" 
                    placeholder="0.00" 
                    value={formData.amount} 
                    onChange={e => setFormData({ ...formData, amount: e.target.value })} 
                    autoComplete="off" 
                    inputMode="decimal" 
                    id="tx-amount" 
                    name="amount" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="tx-date">
                    Date
                  </label>
                  <input 
                    type="date" 
                    required 
                    className="input-premium !h-10 text-xs" 
                    value={formData.date} 
                    onChange={e => setFormData({ ...formData, date: e.target.value })} 
                    autoComplete="off" 
                    id="tx-date" 
                    name="date" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="tx-category">
                    Category
                  </label>
                  <select 
                    className="input-premium !h-10 text-xs text-white" 
                    value={formData.category} 
                    onChange={e => setFormData({ ...formData, category: e.target.value })} 
                    id="tx-category" 
                    name="category"
                    aria-label="Select transaction category"
                  >
                    {modalType === "income" 
                      ? INCOME_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)
                      : EXPENSE_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)
                    }
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="tx-account">
                    Account
                  </label>
                  <select 
                    className="input-premium !h-10 text-xs text-white" 
                    value={formData.account_id} 
                    onChange={e => setFormData({ ...formData, account_id: e.target.value })} 
                    id="tx-account" 
                    name="account_id"
                    aria-label="Select associated transaction account"
                  >
                    <option value="">No Account (Track only)</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
              </div>

              {formData.account_id && (() => {
                const selectedAcc = accounts.find(a => a.id === formData.account_id);
                return selectedAcc ? (
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] text-[--text-secondary]">
                    <span>Selected Balance</span>
                    <span className="font-bold text-white">
                      {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                    </span>
                  </div>
                ) : null;
              })()}

              {(modalType === "expense" || modalType === "income") && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="tx-recurring">
                      Recurring {modalType === "expense" ? "Expense" : "Income"}
                    </label>
                    <input
                      type="checkbox"
                      id="tx-recurring"
                      className={`w-4 h-4 rounded border-white/10 bg-white/5 ${modalType === 'income' ? 'text-emerald-500 focus:ring-emerald-500/20' : 'text-rose-500 focus:ring-rose-500/20'}`}
                      checked={formData.is_recurring}
                      onChange={e => setFormData({ ...formData, is_recurring: e.target.checked })}
                    />
                  </div>

                  {formData.is_recurring && (
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[--text-muted]" htmlFor="tx-frequency">
                          Frequency
                        </label>
                        <select
                          id="tx-frequency"
                          className="input-premium !h-9 text-[11px] text-white"
                          value={formData.recurrence_frequency}
                          onChange={e => setFormData({ ...formData, recurrence_frequency: e.target.value })}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[--text-muted]" htmlFor="tx-rec-day">
                          Day Due
                        </label>
                        <input
                          type="number"
                          id="tx-rec-day"
                          min="1"
                          max="31"
                          className="input-premium !h-9 text-[11px] text-white"
                          value={formData.recurrence_day}
                          onChange={e => setFormData({ ...formData, recurrence_day: parseInt(e.target.value) || 1 })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[--text-muted]" htmlFor="tx-end-date">
                          End Date
                        </label>
                        <input
                          type="date"
                          id="tx-end-date"
                          className="input-premium !h-9 text-[11px] text-white"
                          value={formData.recurrence_end_date}
                          onChange={e => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button 
                type="submit" 
                disabled={submitting} 
                className={`btn-primary w-full h-11 text-xs font-bold shadow-md mt-4 transition-all duration-200 cursor-pointer ${
                  modalType === "income" 
                    ? "!bg-emerald-500 hover:!bg-emerald-600 shadow-emerald-500/20" 
                    : "!bg-rose-500 hover:!bg-rose-600 shadow-rose-500/20"
                }`}
              >
                {submitting ? "Processing..." : "Confirm Record"}
              </button>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
}
