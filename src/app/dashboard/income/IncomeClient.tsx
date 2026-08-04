"use client";

import { useMemo, useState, useEffect, memo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { addIncome, deleteIncome, updateIncome } from "./actions";
import { format, parseISO, subMonths } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/empty-state";

import { getBankLogoSources } from "@/lib/banks";
import { getCompanyLogoSources } from "@/lib/companies";
import { CustomChartTooltip } from "@/components/ui/chart-tooltip";

import { CHART_COLOURS } from "@/lib/chart-colours";
function getColorByLabel(label: string | null | undefined) {
  if (!label) return CHART_COLOURS[0];
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return CHART_COLOURS[hash % CHART_COLOURS.length];
}

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "@/components/ui/recharts";


function getBrandMonogram(name: string): string {
  const cleaned = name
    .replace(/^(dividend|salary|interest|bonus|freelance|payout|credit|payment|refund|from|to|transfer):\s*/i, "")
    .replace(/\b(ltd|limited|corp|corporation|inc|incorporated|serv|services|lt|co)\b/gi, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[—–\-]\s*₹.*$/i, "")
    .trim();
  
  if (cleaned.length === 0) return "IN";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

const MONOGRAM_GRADIENTS = [
  "from-blue-500 via-indigo-600 to-purple-600",
  "from-emerald-500 via-teal-600 to-cyan-600",
  "from-orange-500 via-red-500 to-pink-600",
  "from-violet-500 via-purple-600 to-fuchsia-600",
  "from-cyan-500 via-blue-600 to-indigo-600",
  "from-rose-500 via-pink-500 to-fuchsia-600",
];

function getGradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return MONOGRAM_GRADIENTS[Math.abs(hash) % MONOGRAM_GRADIENTS.length];
}

const CompanyLogo = memo(({ name, fallbackText = "I", className = "w-10 h-10" }: { name?: string; fallbackText?: string; className?: string }) => {
  const cleanName = useMemo(() => {
    if (!name) return "";
    return name.replace(/^\[(gemini ai|telegram|ai|bot)\]\s*/i, "").trim();
  }, [name]);

  const sources = useMemo(() => {
    if (!cleanName) return [];
    const companySources = getCompanyLogoSources(cleanName);
    if (companySources.length > 0) return companySources;

    const bankSources = getBankLogoSources(cleanName);
    if (bankSources.length > 0) return bankSources;

    return [];
  }, [cleanName]);

  const [srcIndex, setSrcIndex] = useState(0);

  const [prevName, setPrevName] = useState(cleanName);
  if (prevName !== cleanName) {
    setPrevName(cleanName);
    setSrcIndex(0);
  }

  const initials = getBrandMonogram(cleanName || fallbackText);
  const gradient = getGradientForName(cleanName || "");

  if (!sources.length || srcIndex >= sources.length) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-xs tracking-wider shadow-md shrink-0 select-none p-1 text-center truncate`}>
        {initials}
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center justify-center shrink-0 rounded-2xl bg-white p-0.5 shadow-md border border-white/30 overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={sources[srcIndex]}
        src={sources[srcIndex]}
        alt={cleanName || "Company"}
        className="w-full h-full object-contain rounded-xl scale-110"
        loading="eager"
        onError={() => setSrcIndex((prev) => prev + 1)}
      />
    </div>
  );
});
CompanyLogo.displayName = "CompanyLogo";

const AccountBankLogo = memo(({ bankName, accountName, className = "w-10 h-10" }: { bankName?: string | null; accountName?: string; className?: string }) => {
  const sources = useMemo(() => {
    const q = (bankName || accountName || "").trim().toLowerCase();
    const cash = q.includes("cash");
    const direct = q.includes("direct") || q.includes("ledger");
    if (cash || direct) return [];
    return getBankLogoSources(bankName || accountName || "");
  }, [bankName, accountName]);

  const [srcIndex, setSrcIndex] = useState(0);

  const [prevKey, setPrevKey] = useState(`${bankName}-${accountName}`);
  if (prevKey !== `${bankName}-${accountName}`) {
    setPrevKey(`${bankName}-${accountName}`);
    setSrcIndex(0);
  }

  const query = (bankName || accountName || "").trim().toLowerCase();
  const isCash = query.includes("cash");
  const isDirect = query.includes("direct") || query.includes("ledger");

  if (isCash) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-700 border border-amber-400/30 flex items-center justify-center text-white text-xs shadow-md shrink-0 select-none`}>
        💵
      </div>
    );
  }

  if (isDirect) {
    return (
      <div className={`${className} rounded-2xl bg-slate-800 border border-white/20 flex items-center justify-center text-sky-400 font-black text-xs shrink-0 select-none`}>
        D
      </div>
    );
  }

  if (!sources || sources.length === 0 || srcIndex >= sources.length) {
    const initials = (accountName || bankName || "B").charAt(0).toUpperCase();
    const gradient = getGradientForName(accountName || bankName || "");
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br ${gradient} border border-white/20 flex items-center justify-center text-white font-black text-xs shrink-0 select-none`}>
        {initials}
      </div>
    );
  }

  const currentSrc = sources[srcIndex];

  return (
    <div className={`${className} flex items-center justify-center shrink-0 rounded-2xl bg-white p-0.5 shadow-md border border-white/30 overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={bankName || accountName || "Bank"}
        className="w-full h-full object-contain scale-110"
        loading="eager"
        decoding="async"
        onError={() => setSrcIndex(prev => prev + 1)}
      />
    </div>
  );
});
AccountBankLogo.displayName = "AccountBankLogo";

const INCOME_CATEGORIES = [
  { label: "Salary", icon: "🏢", color: CHART_COLOURS[0] },
  { label: "Dividend", icon: "💎", color: "#10b981" },
  { label: "Work", icon: "💻", color: CHART_COLOURS[1] },
  { label: "Freelance", icon: "🚀", color: CHART_COLOURS[2] },
  { label: "Gift", icon: "💝", color: CHART_COLOURS[3] },
  { label: "Bonus", icon: "✨", color: CHART_COLOURS[4] },
  { label: "Refund", icon: "↩️", color: CHART_COLOURS[5] },
  { label: "Others", icon: "📦", color: CHART_COLOURS[6] },
];

export default function IncomeClient({ initialData }: { initialData?: FinanceData }) {

  const { data: { incomes, accounts, profile }, isValidating, mutate } = useFinanceData(initialData);
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
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);
  const [editingIncome, setEditingIncome] = useState<any | null>(null);

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

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Salary",
    date: "",
    account_id: "",
    is_recurring: false,
    recurrence_frequency: "monthly",
    recurrence_day: 1,
    recurrence_end_date: "",
  });

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    const isNew = searchParams.get("action") === "new";
    if (isNew && !initialized && accounts.length > 0 && defaultDate) {
      const defaultAccId = profile?.default_accounts?.income;
      const account_id = (defaultAccId && accounts.some(a => a.id === defaultAccId)) ? defaultAccId : "";
      setTimeout(() => {
        setInitialized(true);
        setFormData({
          description: "",
          amount: "",
          category: "Salary",
          date: defaultDate,
          account_id,
          is_recurring: false,
          recurrence_frequency: "monthly",
          recurrence_day: 1,
          recurrence_end_date: "",
        });
      }, 0);
    } else if (!initialized && defaultDate) {
      setTimeout(() => {
        setInitialized(true);
        setFormData(prev => ({ ...prev, date: defaultDate }));
      }, 0);
    }
  }, [accounts, profile, defaultDate, initialized, searchParams]);

  const [prevCategoryFilter, setPrevCategoryFilter] = useState(categoryFilter);
  const [prevSelectedMonth, setPrevSelectedMonth] = useState(selectedMonth);
  const [prevSelectedYear, setPrevSelectedYear] = useState(selectedYear);

  if (categoryFilter !== prevCategoryFilter || selectedMonth !== prevSelectedMonth || selectedYear !== prevSelectedYear) {
    setPrevCategoryFilter(categoryFilter);
    setPrevSelectedMonth(selectedMonth);
    setPrevSelectedYear(selectedYear);
    setCurrentPage(1);
  }

  const handleOpenAddModal = () => {
    setEditingIncome(null);
    const defaultAccId = profile?.default_accounts?.income;
    const account_id = (defaultAccId && accounts.some(a => a.id === defaultAccId)) ? defaultAccId : "";
    setFormData({
      description: "",
      amount: "",
      category: "Salary",
      date: defaultDate,
      account_id,
      is_recurring: false,
      recurrence_frequency: "monthly",
      recurrence_day: 1,
      recurrence_end_date: "",
    });
    setShowAddModal(true);
  };

  const handleEditIncome = (inc: any) => {
    setEditingIncome(inc);
    setFormData({
      description: inc.description.replace(/^\[(gemini ai|telegram|ai|bot)\]\s*/i, "").trim(),
      amount: String(inc.amount),
      category: inc.category || "Salary",
      date: inc.date ? inc.date.split("T")[0] : defaultDate,
      account_id: inc.account_id || "",
      is_recurring: Boolean(inc.is_recurring),
      recurrence_frequency: inc.recurrence_frequency || "monthly",
      recurrence_day: inc.recurrence_day || 1,
      recurrence_end_date: inc.recurrence_end_date ? inc.recurrence_end_date.split("T")[0] : "",
    });
    setShowAddModal(true);
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDeleteConfirm(false);
        setDeletingIncomeId(null);
        setShowAddModal(false);
      }
    };
    if (showDeleteConfirm || showAddModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteConfirm, showAddModal]);

  async function handleDeleteIncome(id: string) {
    setDeletingIncomeId(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteIncome() {
    if (!deletingIncomeId) return;
    await withLock(async () => {
      const res = await deleteIncome(deletingIncomeId);
      if (!res?.error) {
        toast.success(res.message || "Income entry reverted successfully");
        mutate();
      } else {
        toast.error(res.error);
      }
      setShowDeleteConfirm(false);
      setDeletingIncomeId(null);
    });
  }

  const stats = useMemo(() => {
    const targetDate = new Date(selectedYear, selectedMonth - 1, 1);
    const currentMonth = incomes.filter(i => {
      if (!i.date) return false;
      const d = parseISO(i.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);
    const monthlyTotal = currentMonth.reduce((s, i) => s + Number(i.amount), 0);

    // Calculate unique active months with logged income
    const uniqueMonths = new Set(
      incomes
        .filter((i): i is typeof i & { date: string } => Boolean(i.date))
        .map((i) => {
          const d = parseISO(i.date);
          return `${d.getFullYear()}-${d.getMonth() + 1}`;
        })
    );
    const activeMonthsCount = Math.max(1, uniqueMonths.size);
    const monthlyAverage = totalIncome / activeMonthsCount;
    const perEntryAverage = incomes.length ? totalIncome / incomes.length : 0;
    
    // YoY comparison - same month last year
    const lastYearSameMonth = new Date(selectedYear - 1, selectedMonth - 1, 1);
    const lastYearIncomes = incomes.filter(i => {
      if (!i.date) return false;
      const d = parseISO(i.date);
      return d.getMonth() + 1 === lastYearSameMonth.getMonth() + 1 && d.getFullYear() === lastYearSameMonth.getFullYear();
    });
    const lastYearTotal = lastYearIncomes.reduce((s, i) => s + Number(i.amount), 0);
    const yoyChange = lastYearTotal > 0 ? ((monthlyTotal - lastYearTotal) / lastYearTotal) * 100 : 0;
    const yoyAbsolute = monthlyTotal - lastYearTotal;
    
    const catMap: Record<string, number> = {};
    currentMonth.forEach(i => {
      catMap[i.category] = (catMap[i.category] || 0) + Number(i.amount);
    });
    const pieData = Object.entries(catMap)
      .map(([name, value]) => {
        const categoryColor = INCOME_CATEGORIES.find((c) => c.label === name)?.color;
        const resolvedColor =
          categoryColor ||
          getColorByLabel(name);

        return {
          name,
          value,
          fill: resolvedColor,
          color: resolvedColor,
        };
      })
      .sort((a, b) => b.value - a.value);

    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(targetDate, i);
      trendMap[format(d, "MMM yy")] = 0;
    }
    incomes.forEach(i => {
      if (!i.date) return;
      const m = format(parseISO(i.date), "MMM yy");
      if (trendMap[m] !== undefined) {
        trendMap[m] += Number(i.amount);
      }
    });
    const trendData = Object.entries(trendMap).map(([name, value]) => ({ name, value }));

    const dividendIncomes = incomes.filter(i => 
      i.category?.toLowerCase() === "dividend" || 
      i.description?.toLowerCase().includes("dividend")
    );
    const totalDividends = dividendIncomes.reduce((s, i) => s + Number(i.amount), 0);

    return { totalIncome, monthlyTotal, pieData, trendData, yoyChange, yoyAbsolute, lastYearTotal, totalDividends, monthlyAverage, perEntryAverage, activeMonthsCount };
  }, [incomes, selectedMonth, selectedYear]);

  const filteredIncomes = useMemo(() => {
    const filtered = incomes.filter(i => {
      const matchCat = categoryFilter === "All" || i.category === categoryFilter;
      if (!matchCat) return false;
      if (!i.date) return false;
      const d = parseISO(i.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });
    
    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [incomes, categoryFilter, currentPage, selectedMonth, selectedYear]);

  const totalFilteredCount = useMemo(() => {
    return incomes.filter(i => {
      const matchCat = categoryFilter === "All" || i.category === categoryFilter;
      if (!matchCat) return false;
      if (!i.date) return false;
      const d = parseISO(i.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    }).length;
  }, [incomes, categoryFilter, selectedMonth, selectedYear]);

  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.account_id) {
      toast.error("Please select a deposit account");
      return;
    }
    await withLock(async () => {
      const result = editingIncome
        ? await updateIncome({
            id: editingIncome.id,
            description: formData.description,
            amount: parseFloat(formData.amount),
            category: formData.category,
            date: formData.date,
            account_id: formData.account_id || undefined,
          })
        : await addIncome({ 
            ...formData, 
            amount: parseFloat(formData.amount), 
            account_id: formData.account_id || undefined 
          });

      if (!result?.error) {
        toast.success(editingIncome ? "Income record updated successfully" : "Revenue inflow registered successfully");
        const today = new Date();
        const yyyy = selectedYear;
        const mm = String(selectedMonth).padStart(2, '0');
        const defaultDate = (today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear)
          ? `${yyyy}-${mm}-${String(today.getDate()).padStart(2, '0')}`
          : `${yyyy}-${mm}-01`;

        setFormData({
          description: "",
          amount: "",
          category: "Salary",
          date: defaultDate,
          account_id: "",
          is_recurring: false,
          recurrence_frequency: "monthly",
          recurrence_day: 1,
          recurrence_end_date: "",
        });
        setShowAddModal(false);
        setEditingIncome(null);
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal tracking-tight text-white">Income</h1>
            <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-amber-400' : 'bg-emerald-400 opacity-50'}`} />
          </div>
          <p className="text-slate-400 text-sm mt-1 font-sans">Track your salary, freelance earnings, and investment payouts.</p>
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
            <div className="px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400 select-none">
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
            onClick={handleOpenAddModal} 
            className="h-10 px-5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all flex items-center justify-center gap-2 border border-emerald-400/30 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Log Income
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Earned</p>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-mono font-bold text-emerald-400 tabular-nums">
              +₹{stats.totalIncome.toLocaleString()}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Lifetime</span>
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl flex flex-col justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">This Month</p>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-mono font-bold text-white tabular-nums">
              +₹{stats.monthlyTotal.toLocaleString()}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">{format(new Date(selectedYear, selectedMonth - 1, 1), "MMM")}</span>
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Monthly Average</p>
            <span className="text-[10px] font-mono text-slate-500">
              {stats.activeMonthsCount} mo avg
            </span>
          </div>
          <div className="mt-3 flex flex-col justify-between">
            <h3 className="text-xl md:text-2xl font-mono font-bold text-emerald-400 tabular-nums">
              +₹{Math.round(stats.monthlyAverage).toLocaleString()}
              <span className="text-xs text-slate-500 font-sans font-normal ml-1">/ mo</span>
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Income Growth</h3>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-slate-400">Inflow</span></div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
                <YAxis hide />
                <Tooltip content={<CustomChartTooltip currency="₹" />} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#incomeGradient)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="border border-slate-800 bg-slate-900/60 p-5 md:p-6 rounded-2xl">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">Source Distribution</h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={6} dataKey="value" isAnimationActive={false}>
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

      <div className="border border-slate-800 bg-slate-900/60 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-900 rounded-xl border border-slate-800">
            {["All", "Salary", "Freelance", "Dividend", "Bonus", "Others"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="text-xs font-mono text-slate-500">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalFilteredCount)} of {totalFilteredCount} results
          </div>
        </div>

        <div className="hidden table-responsive-wrapper md:block relative">
          {incomes.length === 0 ? (
            <EmptyState
              title="No income logged yet"
              description="Log your salary, freelance earnings, dividends, or interest to track your total income over time."
              icon={
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
              }
              glowColor="emerald"
              action={
                <button type="button" onClick={handleOpenAddModal} className="btn-primary">
                  Log First Income
                </button>
              }
            />
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-[#12151c] shadow-sm">
                <tr className="border-b border-white/5">
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Source</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Segment</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] hidden sm:table-cell">Destination</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Credit</th>
                  <th className="px-4 md:px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredIncomes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-[--text-muted] text-sm italic">No income transactions logged for this period.</td>
                  </tr>
                ) : (
                  filteredIncomes.map((inc) => {
                    const isAiLogged = /^\[(gemini ai|telegram|ai|bot)\]/i.test(inc.description);
                    const cleanDesc = inc.description.replace(/^\[(gemini ai|telegram|ai|bot)\]\s*/i, "").trim();
                    const isDividend = /dividend/i.test(inc.description);
                    const categoryLabel = isDividend ? "DIVIDEND" : inc.category;
                    const theme = INCOME_CATEGORIES.find(c => c.label === categoryLabel) || INCOME_CATEGORIES[6];
                    const account = accounts.find(a => a.id === inc.account_id);
                    return (
                      <tr key={inc.id} className="text-[--text-primary] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap">
                          <p className="text-xs font-bold">{inc.date ? format(parseISO(inc.date), "MMM d, yy") : "N/A"}</p>
                          <p className="text-[0.5625rem] text-success/60 font-bold uppercase">Credit</p>
                        </td>
                        <td className="px-4 md:px-6 py-3">
                          <div className="flex items-center gap-2.5">
                            <CompanyLogo name={inc.description} fallbackText="I" className="w-10 h-10" />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold group-hover:text-success transition-colors truncate max-w-[140px] md:max-w-none">{cleanDesc}</p>
                                {isAiLogged && (
                                  <span className="text-[8px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded shrink-0">
                                    AI Log
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[0.5625rem] font-black uppercase tracking-[0.1em] bg-success/5 border border-success/10 text-success" style={{color: theme.color}}>{categoryLabel}</span>
                        </td>
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap hidden sm:table-cell">
                          <div className="flex items-center gap-2.5">
                            <AccountBankLogo bankName={account?.bank_name} accountName={account?.name} className="w-10 h-10" />
                            <span className="text-xs font-semibold text-[--text-secondary]">{account?.name || "Direct Log"}</span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap text-right">
                          <p className="text-xs md:text-sm font-black text-success">+{getAccountCurrency(inc.account_id) === 'USD' ? '$' : '₹'}{Number(inc.amount).toLocaleString()}</p>
                        </td>
                        <td className="px-4 md:px-6 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditIncome(inc)}
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[--text-muted] hover:text-white hover:bg-white/10 transition-colors"
                              title="Edit income entry"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIncome(inc.id)}
                              className="p-1.5 rounded-lg bg-danger/10 border border-danger/20 text-rose-400 hover:bg-danger/20 transition-colors"
                              title="Delete income entry"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile card list feed for incomes */}
        <div className="divide-y divide-white/10 md:hidden">
          {filteredIncomes.length === 0 ? (
            <div className="p-8 text-center text-[--text-muted] text-xs italic">
              No transactions found matching your criteria.
            </div>
          ) : (
            filteredIncomes.map((inc) => {
              const isAiLogged = /^\[(gemini ai|telegram|ai|bot)\]/i.test(inc.description);
              const cleanDesc = inc.description.replace(/^\[(gemini ai|telegram|ai|bot)\]\s*/i, "").trim();
              const isDividend = /dividend/i.test(inc.description);
              const categoryLabel = isDividend ? "DIVIDEND" : inc.category;
              const theme = INCOME_CATEGORIES.find(c => c.label === categoryLabel) || INCOME_CATEGORIES[6];
              const account = accounts.find(a => a.id === inc.account_id);
              return (
                <div key={inc.id} className="p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CompanyLogo name={inc.description} fallbackText="I" className="w-10 h-10" />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-[--text-primary] truncate">{cleanDesc}</span>
                          {isAiLogged && (
                            <span className="text-[8px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1 py-0.5 rounded shrink-0">
                              AI
                            </span>
                          )}
                        </div>
                        <span className="text-[0.5625rem] text-[--text-muted] uppercase font-bold">{inc.date ? format(parseISO(inc.date), "MMM d, yyyy") : "—"}</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-[15px] font-black text-success">+{getAccountCurrency(inc.account_id) === 'USD' ? '$' : '₹'}{Number(inc.amount).toLocaleString()}</span>
                      <span className="px-2 py-0.5 rounded-full text-[0.5rem] font-black uppercase tracking-[0.1em] bg-success/5 border border-success/10 text-success" style={{color: theme.color}}>{categoryLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.03] pt-2 mt-1">
                    <div className="flex items-center gap-2">
                      <AccountBankLogo bankName={account?.bank_name} accountName={account?.name} className="w-10 h-10" />
                      <span className="text-xs font-medium text-[--text-secondary]">{account?.name || "Direct Log"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditIncome(inc)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-[--text-muted] hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteIncome(inc.id)}
                        className="px-2.5 py-1 rounded-lg bg-danger/10 border border-danger/20 text-[10px] font-bold text-rose-400"
                      >
                        Delete
                      </button>
                    </div>
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
                        ? 'bg-success text-white'
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
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md md:max-w-lg p-6 md:p-8 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-[--text-primary]">Delete Income</h3>
                <p className="text-sm text-[--text-secondary] mt-2">Are you sure you want to delete this income entry? Your account balance will be updated.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletingIncomeId(null); }} className="btn-secondary flex-1 h-11 font-bold rounded-xl">Cancel</button>
                <button type="button" onClick={confirmDeleteIncome} className="btn-danger flex-1 h-11 font-bold rounded-xl" disabled={submitting}>Revert</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingIncome(null); }}
          title={editingIncome ? "Edit Income Entry" : "Add Income"}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-[0.625rem] font-black uppercase tracking-wider text-[--text-muted]">
                  {formData.category === "Salary" ? "Company / Employer" : "Description / Source"}
                </label>
                <input autoFocus type="text" required className="input-premium !h-9 text-xs" placeholder={formData.category === "Salary" ? "e.g. Google" : "e.g. Freelance Web Design"} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} autoComplete="new-password" id="income-description" name="description" />
              </div>
              
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-[0.625rem] font-black uppercase tracking-wider text-[--text-muted]">Amount</label>
                <input type="number" required className="input-premium !h-9 text-xs" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} autoComplete="new-password" inputMode="decimal" id="income-amount" name="amount" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="income-category" className="text-[0.625rem] font-black uppercase tracking-wider text-[--text-muted]">Stream / Category</label>
              <select
                id="income-category"
                name="category"
                aria-label="Select Income Stream / Category"
                className="input-premium !h-9.5 text-xs font-semibold w-full cursor-pointer"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c.label} value={c.label} className="bg-[#151922] text-white py-1">
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</label>
                <input type="date" required className="input-premium py-2 text-xs" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} autoComplete="new-password" id="income-date" name="date" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Account</label>
                <select className="input-premium py-2 text-xs" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})} aria-label="Select deposit account" id="income-account" name="account_id">
                  <option value="" disabled className="bg-[--bg-surface]">Select Deposit Account</option>
                  {accounts.map(acc => {
                    const symbol = acc.currency === "USD" ? "$" : "₹";
                    const nameLabel = acc.bank_name && acc.bank_name.trim().toLowerCase() !== acc.name.trim().toLowerCase()
                      ? `${acc.bank_name} (${acc.name})`
                      : acc.name;
                    return (
                      <option key={acc.id} value={acc.id} className="bg-[--bg-surface]">
                        {nameLabel} — {symbol}{acc.balance.toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {formData.account_id && (() => {
              const selectedAcc = accounts.find(a => a.id === formData.account_id);
              return selectedAcc ? (
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
                  <span className="font-medium">Selected Balance</span>
                  <span className="font-bold text-white">
                    {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                  </span>
                </div>
              ) : null;
            })()}

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="inc-recurring">
                  Recurring Income
                </label>
                <input
                  type="checkbox"
                  id="inc-recurring"
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
                  checked={formData.is_recurring}
                  onChange={e => setFormData({ ...formData, is_recurring: e.target.checked })}
                />
              </div>

              {formData.is_recurring && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[0.5625rem] font-bold text-[--text-muted]" htmlFor="inc-frequency">
                      Frequency
                    </label>
                    <select
                      id="inc-frequency"
                      className="input-premium !h-9 text-xs text-white"
                      value={formData.recurrence_frequency}
                      onChange={e => setFormData({ ...formData, recurrence_frequency: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[0.5625rem] font-bold text-[--text-muted]" htmlFor="inc-rec-day">
                      Day Due
                    </label>
                    <input
                      type="number"
                      id="inc-rec-day"
                      min="1"
                      max="31"
                      className="input-premium !h-9 text-xs text-white"
                      value={formData.recurrence_day}
                      onChange={e => setFormData({ ...formData, recurrence_day: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[0.5625rem] font-bold text-[--text-muted]" htmlFor="inc-end-date">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="inc-end-date"
                      className="input-premium !h-9 text-xs text-white"
                      value={formData.recurrence_end_date}
                      onChange={e => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-2 mt-4">
              <button type="submit" disabled={submitting} className="btn-primary w-full h-10 shadow-xl shadow-[--accent-primary]/20 text-xs font-black uppercase tracking-widest cursor-pointer">
                {submitting ? "Processing..." : (editingIncome ? "Update Entry" : "Finalize Entry")}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
