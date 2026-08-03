"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { upsertBudget, deleteBudget, copyPreviousMonthBudgets, clearAllBudgets } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, parseISO, getDaysInMonth, isSameMonth, subMonths } from "date-fns";
import { getCategoryColour, getColorByLabel } from "@/lib/chart-colours";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "@/components/ui/recharts";

import { Drawer } from "@/components/ui/drawer";
import { Copy, Trash2, Edit2, Plus, Check } from "lucide-react";
import BudgetOverviewWidget from "@/components/dashboard/budget-overview-widget";

const BUDGET_CATEGORIES = [
  { label: "Rent", icon: "🏠" },
  { label: "Food", icon: "🍔" },
  { label: "Travel", icon: "✈️" },
  { label: "Investment", icon: "📈" },
  { label: "Transport", icon: "🚌" },
  { label: "Utilities", icon: "⚡" },
  { label: "Entertainment", icon: "🎬" },
  { label: "Shopping", icon: "🛍️" },
  { label: "Subscription", icon: "💳" },
  { label: "Others", icon: "📦" }
];

export default function BudgetClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { budgets, expenses, incomes }, mutate } = useFinanceData(initialData);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<"allocations" | "analytics" | "insights">("allocations");
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategory, setDrawerCategory] = useState<string>("");
  const [drawerIcon, setDrawerIcon] = useState<string>("📦");
  const [drawerAmount, setDrawerAmount] = useState<string>("");
  const [drawerSpent, setDrawerSpent] = useState<number>(0);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmStyle: "danger" | "primary";
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", confirmLabel: "Confirm", confirmStyle: "danger", onConfirm: () => {} });

  const [submitting, withLock] = useSubmitLock();
  const activeSubmissionsRef = useRef<Record<string, boolean>>({});

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

function normalizeCategory(cat: string): string {
  if (!cat) return "Others";
  const lower = cat.trim().toLowerCase();
  if (lower === "food & dining" || lower === "dining" || lower === "groceries") return "Food";
  if (lower === "housing") return "Rent";
  if (lower === "bills & utilities" || lower === "bills") return "Utilities";
  if (lower === "transportation") return "Transport";
  return cat;
}

  const formatCurrency = (val: number) => {
    if (val >= 100000) return `₹${(val / 1000).toFixed(0)}k`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  const actualSpending = useMemo(() => {
    const spending: Record<string, number> = {};
    expenses.forEach(e => {
      if (!e.date) return;
      const date = parseISO(e.date);
      if (date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear) {
        const amt = Number(e.amount);
        const norm = normalizeCategory(e.category);
        spending[norm] = (spending[norm] || 0) + amt;
      }
    });
    return spending;
  }, [expenses, selectedMonth, selectedYear]);

  const totalIncome = useMemo(() => {
    return incomes.reduce((sum, inc) => {
      if (!inc.date) return sum;
      const date = parseISO(inc.date);
      if (date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear) {
        return sum + Number(inc.amount);
      }
      return sum;
    }, 0);
  }, [incomes, selectedMonth, selectedYear]);

  const currentBudgets = useMemo(() => {
    return budgets
      .filter(b => b.period_month === selectedMonth && b.period_year === selectedYear)
      .map(b => ({ ...b, category: normalizeCategory(b.category) }));
  }, [budgets, selectedMonth, selectedYear]);

  const totalBudgeted = currentBudgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = Object.values(actualSpending).reduce((s, v) => s + v, 0);

  const { daysInMonth, daysPassed } = useMemo(() => {
    const date = new Date(selectedYear, selectedMonth - 1, 1);
    const total = getDaysInMonth(date);
    const now = new Date();
    let passed = total;
    if (isSameMonth(now, date)) {
      passed = now.getDate();
    } else if (now < date) {
      passed = 0;
    }
    return { daysInMonth: total, daysPassed: passed };
  }, [selectedMonth, selectedYear]);

  const monthProgressPercent = daysInMonth > 0 ? (daysPassed / daysInMonth) * 100 : 0;
  const budgetBurnRatePercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const isBurningFast = budgetBurnRatePercent > monthProgressPercent;

  const predictiveDeplInfo = useMemo(() => {
    if (totalSpent <= 0 || daysPassed <= 0 || totalBudgeted <= 0) return null;
    const avgDailySpent = totalSpent / daysPassed;
    if (avgDailySpent <= 0) return null;
    const daysToBurn = totalBudgeted / avgDailySpent;
    
    if (daysToBurn < daysPassed) {
      const dayNum = Math.max(1, Math.floor(daysToBurn));
      const date = new Date(selectedYear, selectedMonth - 1, dayNum);
      return {
        isExhausted: true,
        dateText: format(date, "MMM d, yyyy"),
        label: `Exhausted on ${format(date, "MMM d, yyyy")}`
      };
    }

    if (daysToBurn <= daysInMonth) {
      const dayNum = Math.min(daysInMonth, Math.floor(daysToBurn));
      const date = new Date(selectedYear, selectedMonth - 1, dayNum);
      return {
        isExhausted: false,
        dateText: format(date, "MMM d, yyyy"),
        label: `Projected run out on ${format(date, "MMM d, yyyy")}`
      };
    }

    return null;
  }, [totalSpent, daysPassed, totalBudgeted, daysInMonth, selectedMonth, selectedYear]);

  const dynamicCategories = useMemo(() => {
    const catsMap = new Map<string, string>();
    BUDGET_CATEGORIES.forEach(c => catsMap.set(c.label, c.icon));
    
    Object.keys(actualSpending).forEach(c => {
      const norm = normalizeCategory(c);
      if (!catsMap.has(norm)) catsMap.set(norm, "📦");
    });
    currentBudgets.forEach(b => {
      const norm = normalizeCategory(b.category);
      if (!catsMap.has(norm)) catsMap.set(norm, "📦");
    });
    
    return Array.from(catsMap.entries()).map(([label, icon]) => {
      let finalIcon = icon;
      const lower = label.toLowerCase();
      if (lower === "food & dining" || lower === "food") finalIcon = "🍔";
      else if (lower === "housing" || lower === "rent") finalIcon = "🏠";
      else if (lower === "bills & utilities" || lower === "utilities") finalIcon = "⚡";
      else if (lower === "transportation" || lower === "transport") finalIcon = "🚌";
      
      return { label, icon: finalIcon };
    }).sort((a, b) => {
      const aSpent = actualSpending[a.label] || 0;
      const bSpent = actualSpending[b.label] || 0;
      if (bSpent !== aSpent) return bSpent - aSpent;
      const aBudget = Number(currentBudgets.find(bg => bg.category === a.label)?.amount || 0);
      const bBudget = Number(currentBudgets.find(bg => bg.category === b.label)?.amount || 0);
      return bBudget - aBudget;
    });
  }, [actualSpending, currentBudgets]);

  const overviewItems = useMemo(() => {
    return dynamicCategories.map(cat => {
      const budget = currentBudgets.find(b => b.category === cat.label);
      const limit = Number(budget?.amount || 0);
      const spent = actualSpending[cat.label] || 0;
      return {
        name: cat.label,
        spent,
        limit,
        icon: cat.icon
      };
    }).filter(item => item.spent > 0 || item.limit > 0);
  }, [dynamicCategories, currentBudgets, actualSpending]);

  const overBudgetCategories = useMemo(() => {
    return dynamicCategories.filter(cat => {
      const budget = currentBudgets.find(b => b.category === cat.label);
      const limit = Number(budget?.amount || 0);
      const spent = actualSpending[cat.label] || 0;
      return limit > 0 && spent > limit;
    });
  }, [dynamicCategories, currentBudgets, actualSpending]);

  const trendData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(selectedYear, selectedMonth - 1, 1), 5 - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      
      const b = budgets.filter(bg => bg.period_month === m && bg.period_year === y).reduce((s, bg) => s + Number(bg.amount), 0);
      const s = expenses.filter(e => {
         if (!e.date) return false;
         const ed = parseISO(e.date);
         return ed.getMonth() + 1 === m && ed.getFullYear() === y;
      }).reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        name: format(d, "MMM yy"),
        Budget: b,
        Spent: s,
      };
    });
  }, [budgets, expenses, selectedMonth, selectedYear]);

  const velocityForecast = useMemo(() => {
    const today = new Date();
    const curMonth = today.getMonth() + 1;
    const curYear = today.getFullYear();
    const isCurrentMonth = selectedMonth === curMonth && selectedYear === curYear;

    const dayOfMonth = isCurrentMonth ? Math.max(1, today.getDate()) : 30;
    const totalDays = isCurrentMonth ? getDaysInMonth(today) : 30;

    return dynamicCategories.map((cat) => {
      const budget = currentBudgets.find((b) => b.category === cat.label);
      const limit = Number(budget?.amount || 0);
      const spent = actualSpending[cat.label] || 0;
      const dailyPace = spent / dayOfMonth;
      const projected = Math.round(dailyPace * totalDays);
      const willExceed = limit > 0 && projected > limit && spent <= limit;
      const exceedDay = willExceed && dailyPace > 0 ? Math.min(totalDays, Math.ceil(limit / dailyPace)) : null;

      return {
        category: cat.label,
        spent,
        limit,
        dailyPace,
        projected,
        willExceed,
        exceedDay,
        icon: cat.icon,
      };
    });
  }, [dynamicCategories, currentBudgets, actualSpending, selectedMonth, selectedYear]);

  const pieData = useMemo(() => {
    if (currentBudgets.length > 0) {
      return currentBudgets.map(b => {
        const color = getCategoryColour(b.category);
        return {
          name: b.category,
          value: Number(b.amount),
          fill: (color && color !== "undefined") ? color : getColorByLabel(b.category)
        };
      }).sort((a, b) => b.value - a.value);
    }

    return Object.entries(actualSpending).map(([cat, amt]) => {
      const color = getCategoryColour(cat);
      return {
        name: cat,
        value: amt,
        fill: (color && color !== "undefined") ? color : getColorByLabel(cat)
      };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [currentBudgets, actualSpending]);

  async function handleBudgetChange(category: string, amount: string) {
    if (activeSubmissionsRef.current[category]) return;

    const budget = currentBudgets.find(b => b.category === category);
    const limit = Number(budget?.amount || 0);
    const lastVal = limit ? limit.toString() : "";
    if (amount === lastVal) return;

    activeSubmissionsRef.current[category] = true;
    try {
      if (amount.trim() === "") {
        if (budget) {
          await withLock(async () => {
             const res = await deleteBudget(budget.id);
             if (!res.error) {
               toast.success(`${category} budget cleared successfully`);
               mutate();
             } else {
               toast.error(res.error);
             }
          });
        }
        return;
      }

      const val = parseFloat(amount);
      if (isNaN(val)) return;
      
      await withLock(async () => {
        const res = await upsertBudget({
          category,
          amount: val,
          period_month: selectedMonth,
          period_year: selectedYear
        });
        if (!res.error) {
          toast.success(`${category} budget updated successfully`);
          mutate();
        } else {
          toast.error(res.error);
        }
      });
    } finally {
      activeSubmissionsRef.current[category] = false;
    }
  }

  async function handleCarryOver() {
    let fromMonth = selectedMonth - 1;
    let fromYear = selectedYear;
    if (fromMonth === 0) {
      fromMonth = 12;
      fromYear = selectedYear - 1;
    }

    const spentCategoryLabels = Object.keys(actualSpending);
    const prevBudgets = budgets.filter(b => b.period_month === fromMonth && b.period_year === fromYear);
    const prevBudgetCategories = prevBudgets.map(b => b.category);
    const newCategories = spentCategoryLabels.filter(c => !prevBudgetCategories.includes(c));

    const fromLabel = format(new Date(fromYear, fromMonth - 1), "MMMM yyyy");

    setConfirmModal({
      open: true,
      title: "Carry over budget limits?",
      message: `This will copy all ${prevBudgets.length} budget limits from ${fromLabel} into this month.${newCategories.length > 0 ? ` It will also add blank limits for ${newCategories.length} new spending ${newCategories.length === 1 ? "category" : "categories"} (${newCategories.slice(0, 3).join(", ")}${newCategories.length > 3 ? "…" : ""}) from your current activity.` : ""} Existing limits for this month will be overwritten.`,
      confirmLabel: "Carry over",
      confirmStyle: "primary",
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        await withLock(async () => {
          const res = await copyPreviousMonthBudgets(fromMonth, fromYear, selectedMonth, selectedYear);
          if (!res.error) {
            toast.success(`Carried over ${res.count} budget limits from ${fromLabel}`);
            mutate();
          } else {
            toast.error(res.error);
          }
        });
      },
    });
  }

  async function handleClearAll() {
    setConfirmModal({
      open: true,
      title: "Clear all budget limits?",
      message: `This will permanently remove all ${currentBudgets.length} budget limits for ${format(new Date(selectedYear, selectedMonth - 1), "MMMM yyyy")}. Your expense records will not be affected.`,
      confirmLabel: "Clear all",
      confirmStyle: "danger",
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        await withLock(async () => {
          const res = await clearAllBudgets(selectedMonth, selectedYear);
          if (!res.error) {
            toast.success("All budget limits cleared for this month");
            mutate();
          } else {
            toast.error(res.error);
          }
        });
      },
    });
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[--text-primary]">Budget Planner</h1>
          <p className="text-sm md:text-sm mt-1 text-[--text-secondary]">Fiscal strategy, category limits, and monthly controls.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Desktop Month Switcher */}
          <div className="hidden md:flex items-center gap-1.5 bg-white/5 border border-white/10 p-1.5 rounded-xl">
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
              className="px-2.5 py-1.5 rounded-lg text-xs font-black text-[--text-muted] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              ◀
            </button>
            <div className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-400 select-none">
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
              className="px-2.5 py-1.5 rounded-lg text-xs font-black text-[--text-muted] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Next month"
            >
              ▶
            </button>
          </div>

          {/* Mobile Fallback selects */}
          <select 
            className="btn-secondary !h-11 px-4 text-xs font-bold md:hidden" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            aria-label="Select month"
            id="budget-month-select"
            name="month"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1} className="bg-[--bg-surface]">
                {format(new Date(2020, i, 1), "MMMM")}
              </option>
            ))}
          </select>
          <select 
            className="btn-secondary !h-11 px-4 text-xs font-bold md:hidden" 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            aria-label="Select year"
            id="budget-year-select"
            name="year"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y} className="bg-[--bg-surface]">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Key Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="glass-card-static p-5 border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400/80 mb-2">Planned spend</p>
          <p className="text-2xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">₹{totalBudgeted.toLocaleString()}</p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-80">Total monthly limit</p>
        </div>
        <div className="glass-card-static p-5 border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400/80 mb-2">Actual spend</p>
          <p className={`text-2xl font-black ${totalSpent > totalBudgeted && totalBudgeted > 0 ? "text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]" : "text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]"}`}>₹{totalSpent.toLocaleString()}</p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-80">Real-time outflow</p>
        </div>
        <div className="glass-card-static p-5 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400/80 mb-2">Margin</p>
          <p className={`text-2xl font-black ${totalBudgeted - totalSpent >= 0 ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]"}`}>
            ₹{(totalBudgeted - totalSpent).toLocaleString()}
          </p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-80">Remaining balance</p>
        </div>
        <div className="glass-card-static p-5 border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-400/80 mb-2">Daily allowance</p>
          <p className={`text-2xl font-black ${(daysInMonth - daysPassed) > 0 && (totalBudgeted - totalSpent) > 0 ? "text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]" : "text-slate-500"}`}>
            ₹{((daysInMonth - daysPassed) > 0 && (totalBudgeted - totalSpent) > 0 ? (totalBudgeted - totalSpent) / (daysInMonth - daysPassed) : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-80">Safe spend / day</p>
        </div>
        <div className="glass-card-static p-5 border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent col-span-2 md:col-span-1 shadow-lg">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-400/80 mb-2">Monthly income</p>
          <p className="text-2xl font-black text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">₹{totalIncome.toLocaleString()}</p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-80">Total revenue stream</p>
        </div>
      </div>

      {/* Predictive Velocity Pacing Alert Banner */}
      {velocityForecast.some((v) => v.willExceed) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">⚡</span>
            <div>
              <p className="font-black text-amber-400 uppercase tracking-wider text-[11px]">Predictive Velocity Alert</p>
              <p className="text-gray-300 font-medium">
                At your current spending pace,{" "}
                <strong className="text-amber-300">
                  {velocityForecast.filter((v) => v.willExceed).map((v) => v.category).join(", ")}
                </strong>{" "}
                will exceed set budget limits before month-end.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Segmented 3-Tab Switcher */}
      <div className="flex flex-wrap gap-2 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => setActiveTab("allocations")}
          className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer ${
            activeTab === "allocations"
              ? "bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              : "text-[--text-muted] hover:text-white hover:bg-white/5"
          }`}
        >
          <span>🎯 Category Allocations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer ${
            activeTab === "analytics"
              ? "bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              : "text-[--text-muted] hover:text-white hover:bg-white/5"
          }`}
        >
          <span>📊 Analytics & Pacing</span>
          {overBudgetCategories.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[0.625rem] font-bold">
              {overBudgetCategories.length} Over
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("insights")}
          className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer ${
            activeTab === "insights"
              ? "bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              : "text-[--text-muted] hover:text-white hover:bg-white/5"
          }`}
        >
          <span>💡 Insights & Comparison</span>
        </button>
      </div>

      {/* Tab 1: Category Allocations */}
      {activeTab === "allocations" && (
        <div className="space-y-6 animate-fade-in">
          {/* Section Header & Management Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/[0.01] p-4.5 rounded-2xl border border-white/5 gap-4">
            <div>
              <h3 className="text-sm font-bold text-[--text-primary]">Category Allocations</h3>
              <p className="text-xs text-[--text-muted] mt-0.5">Define and monitor maximum monthly spending limits per segment.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCarryOver}
                disabled={submitting}
                className="btn-secondary !h-9 px-3.5 text-xs font-black uppercase tracking-wider flex items-center gap-2 group transition-all duration-200 cursor-pointer"
                title="Carry over last month's budget limits"
              >
                <Copy className="w-3.5 h-3.5 text-[--text-secondary] group-hover:text-[--accent-primary-light] transition-colors" />
                <span>Carry Over</span>
              </button>

              {currentBudgets.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={submitting}
                  className="h-9 px-3.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all duration-200 group cursor-pointer"
                  title="Clear all budget limits for this month"
                >
                  <Trash2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* Over Budget Alerts Banner */}
          {overBudgetCategories.length > 0 && (
            <div className="glass-card-static p-4.5 border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-rose-400 mb-3.5 flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Over Budget Warnings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {overBudgetCategories.map(cat => {
                  const budget = currentBudgets.find(b => b.category === cat.label);
                  const limit = Number(budget?.amount || 0);
                  const spent = actualSpending[cat.label] || 0;
                  const overage = spent - limit;
                  return (
                    <div key={cat.label} className="flex justify-between items-center bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/10 text-xs">
                      <div className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span className="font-bold text-white">{cat.label}</span>
                      </div>
                      <span className="font-black text-rose-400">₹{overage.toLocaleString()} over</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Allocation Segment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dynamicCategories.map(cat => {
              const budget = currentBudgets.find(b => b.category === cat.label);
              const spent = actualSpending[cat.label] || 0;
              const limit = Number(budget?.amount || 0);
              const percent = limit > 0 ? (spent / limit) * 100 : 0;
              const remaining = limit - spent;

              return (
                <div key={cat.label} className="glass-card-static p-4.5 flex flex-col justify-between border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent hover:border-cyan-500/30 transition-all duration-300 min-h-[185px] shadow-lg">
                  <div>
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 flex-shrink-0 flex items-center justify-center">
                          {limit > 0 ? (
                            <>
                              <svg viewBox="0 0 44 44" className="w-full h-full absolute inset-0 -rotate-90 origin-center pointer-events-none">
                                <circle cx="22" cy="22" r="18" className="stroke-white/10" strokeWidth="3" fill="none" />
                                <circle
                                  cx="22"
                                  cy="22"
                                  r="18"
                                  className={`transition-all duration-1000 ${
                                    percent > 90 ? "stroke-rose-500" : percent > 75 ? "stroke-amber-400" : "stroke-emerald-400"
                                  }`}
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  fill="none"
                                  strokeDasharray={113}
                                  strokeDashoffset={113 * (1 - Math.min(percent, 100) / 100)}
                                />
                              </svg>
                              <span className="text-lg z-10">{cat.icon}</span>
                            </>
                          ) : (
                            <span className="text-lg p-2 bg-white/[0.04] rounded-2xl border border-white/10 shadow-inner">{cat.icon}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{cat.label}</p>
                          <p className="text-[0.625rem] font-bold text-gray-400 mt-0.5">
                            Spent: <span className={`font-black ${percent > 100 ? 'text-rose-400' : percent > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>₹{spent.toLocaleString()}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {limit > 0 && (
                    <div className="my-2 space-y-1">
                      <div className="flex justify-between text-[0.625rem] font-black uppercase tracking-wider mb-1">
                        <span className={percent > 100 ? "text-rose-400" : percent > 80 ? "text-amber-400" : "text-emerald-400"}>{percent.toFixed(0)}% used</span>
                        {remaining >= 0 ? (
                          <span className="text-emerald-400 font-extrabold">₹{remaining.toLocaleString()} left</span>
                        ) : (
                          <span className="text-rose-400 font-extrabold">₹{Math.abs(remaining).toLocaleString()} over</span>
                        )}
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex relative border border-white/10 shadow-inner">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            percent > 90 
                              ? "bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_10px_rgba(244,63,94,0.5)]" 
                              : percent > 75 
                                ? "bg-gradient-to-r from-amber-500 to-yellow-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" 
                                : "bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                          }`} 
                          style={{ width: `${Math.min(percent, 100)}%` }} 
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-medium">
                      {limit > 0 ? (
                        <>
                          Target Limit: <span className="font-extrabold text-cyan-400">₹{limit.toLocaleString()}</span>
                        </>
                      ) : (
                        "No limit set"
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerCategory(cat.label);
                        setDrawerIcon(cat.icon);
                        setDrawerAmount(limit ? limit.toString() : "");
                        setDrawerSpent(spent);
                        setDrawerOpen(true);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border ${
                        limit > 0
                          ? "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30 active:scale-95 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                          : "bg-white/5 hover:bg-white/10 text-gray-300 border-white/10 active:scale-95"
                      }`}
                    >
                      {limit > 0 ? (
                        <Edit2 className="w-3 h-3" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      <span>{limit > 0 ? "Adjust" : "Set Limit"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Analytics & Pacing */}
      {activeTab === "analytics" && (
        <div className="space-y-6 animate-fade-in">
          {/* Embedded Real-Time Budget Overview */}
          <BudgetOverviewWidget items={overviewItems} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 6-Month Trend Chart (col-span-2) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card-static p-5 min-h-[340px] flex flex-col border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">6-Month Budget vs Spend Trajectory</h3>
                    <p className="text-xs text-[--text-secondary] mt-0.5">Visual representation of total spending velocity compared to planning targets.</p>
                  </div>
                </div>
                <div className="w-full h-[260px] mt-2 -ml-2">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} dy={5} />
                        <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} dx={-5} />
                        <RechartsTooltip 
                          contentStyle={{ background: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}
                          itemStyle={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}
                          formatter={(value: any, name?: any) => [`₹${Number(value).toLocaleString()}`, name === "Budget" ? "Target Cap" : "Actual Spent"]}
                        />
                        <Area type="monotone" dataKey="Budget" name="Budget" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorBudget)" />
                        <Area type="monotone" dataKey="Spent" name="Spent" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSpent)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Target Allocation Pie Chart */}
              <div className="glass-card-static p-5 flex flex-col justify-between min-h-[340px] border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent relative">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">
                      {currentBudgets.length > 0 ? "Target Budget Allocation" : "Actual Spending Split"}
                    </h3>
                    <p className="text-xs text-[--text-secondary] mt-0.5">
                      {currentBudgets.length > 0 ? "Category allocation breakdown" : "Current month expenditure distribution"}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    {currentBudgets.length > 0 ? "Planned Caps" : "Actual Spend"}
                  </span>
                </div>

                <div className="w-full h-[210px] my-auto">
                  {mounted && pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />)}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ background: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: 11 }}
                          itemStyle={{ color: "#fff", fontWeight: "bold" }}
                          formatter={(value: unknown) => [`₹${Number(value).toLocaleString()}`, currentBudgets.length > 0 ? "Budget Cap" : "Spent"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                       <span className="text-xl mb-1">📊</span>
                       <span className="text-[0.5625rem] uppercase tracking-widest font-black">No Budget or Expense Data</span>
                    </div>
                  )}
                </div>

                {pieData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mt-2 w-full">
                    {pieData.slice(0, 6).map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                        <span className="text-white font-bold">{entry.name}</span>
                        <span className="text-[10px] text-[--text-muted]">₹{entry.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Pacing, Savings, Legend */}
            <div className="space-y-6">
              {/* Status Color Legend Card */}
              <div className="glass-card-static p-5 border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Status Legend</h3>
                <div className="space-y-2.5 text-xs text-[--text-secondary]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>On Track</span>
                    </div>
                    <span className="text-xs text-[--text-muted] font-medium">&lt; 75% limit</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Near Limit</span>
                    </div>
                    <span className="text-xs text-[--text-muted] font-medium">75% - 90% limit</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>Over Limit</span>
                    </div>
                    <span className="text-xs text-[--text-muted] font-medium">&gt; 90% limit</span>
                  </div>
                </div>
              </div>

              {/* Pacing & Trajectory Card */}
              <div className="glass-card-static p-5 relative overflow-hidden border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
                <div className={`absolute top-0 right-0 w-28 h-28 rounded-full blur-[70px] pointer-events-none ${isBurningFast && totalBudgeted > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`} />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-5">Pacing & Velocity</h3>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <p className="text-3xl font-black text-white">{daysInMonth - daysPassed}</p>
                    <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-[--text-muted] mt-1">Days Remaining</p>
                  </div>
                  <div>
                    <p className={`text-3xl font-black ${isBurningFast && totalBudgeted > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{budgetBurnRatePercent.toFixed(0)}%</p>
                    <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-[--text-muted] mt-1">Budget Burned</p>
                  </div>
                </div>
                
                {totalBudgeted > 0 && (
                  <div className="space-y-3">
                    {predictiveDeplInfo && (
                      <div className={`p-3 rounded-xl flex items-start gap-3 ${predictiveDeplInfo.isExhausted ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-indigo-500/5 border border-indigo-500/10'}`}>
                        <div className="text-xs mt-0.5">{predictiveDeplInfo.isExhausted ? '⚠️' : '🔮'}</div>
                        <div>
                          <p className={`text-xs font-bold ${predictiveDeplInfo.isExhausted ? 'text-rose-400' : 'text-white'}`}>
                            {predictiveDeplInfo.isExhausted ? "Budget Limit Exceeded" : "Projected Exhaustion"}
                          </p>
                          <p className="text-xs text-[--text-secondary] mt-0.5 leading-relaxed">
                            {predictiveDeplInfo.isExhausted
                              ? `Your monthly limit was reached on ${predictiveDeplInfo.dateText}.`
                              : `Based on spending velocity, budget will run out on ${predictiveDeplInfo.dateText}.`
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Insights & Comparison */}
      {activeTab === "insights" && (
        <div className="space-y-6 animate-fade-in">
          <div className="glass-card-static p-6 border-white/10 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">Fiscal Ratio & Outflow Comparison</h3>
                <p className="text-xs text-[--text-muted] mt-1">Real-time comparison between monthly income, set budget limits, and actual expenditure.</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-[--text-muted] font-bold">INCOME</p>
                  <p className="text-lg font-black text-purple-400">₹{totalIncome.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[--text-muted] font-bold">BUDGET</p>
                  <p className="text-lg font-black text-cyan-400">₹{totalBudgeted.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[--text-muted] font-bold">SPENT</p>
                  <p className="text-lg font-black text-rose-400">₹{totalSpent.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-xs font-bold text-[--text-muted]">
                <span>Outflow vs Income Capacity</span>
                <span className="text-white font-extrabold">{totalIncome > 0 ? ((totalSpent / totalIncome) * 100).toFixed(0) : 0}% Consumed</span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex border border-white/10 p-0.5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-700" 
                  style={{ width: `${totalIncome > 0 ? Math.min(100, (totalSpent / totalIncome) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="glass-card-static p-6 border-white/10 overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black text-white tracking-tight">Category Breakdown Table</h3>
              <span className="text-xs text-[--text-muted] font-semibold">{dynamicCategories.length} categories logged</span>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/[0.02]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[--text-muted]">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[--text-muted]">Limit</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[--text-muted]">Actual Spent</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[--text-muted]">Remaining</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[--text-muted]">Usage Status</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[--text-muted]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dynamicCategories.map(cat => {
                    const budget = currentBudgets.find(b => b.category === cat.label);
                    const limit = Number(budget?.amount || 0);
                    const spent = actualSpending[cat.label] || 0;
                    const remaining = limit - spent;
                    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                    const isExceeded = limit > 0 && spent > limit;

                    return (
                      <tr key={cat.label} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className="text-xl p-1.5 bg-white/5 rounded-xl border border-white/10">{cat.icon}</span>
                            <span className="text-sm font-bold text-white">{cat.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap text-sm font-bold text-cyan-400">
                          {limit > 0 ? `₹${limit.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap text-sm font-black text-rose-400">
                          ₹{spent.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap text-sm font-bold">
                          {limit > 0 ? (
                            remaining >= 0 ? (
                              <span className="text-emerald-400">₹{remaining.toLocaleString()}</span>
                            ) : (
                              <span className="text-rose-400">-₹{Math.abs(remaining).toLocaleString()}</span>
                            )
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {limit > 0 ? (
                            isExceeded ? (
                              <span className="px-2.5 py-1 rounded-lg text-[0.625rem] font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                {pct}% (Over)
                              </span>
                            ) : pct >= 80 ? (
                              <span className="px-2.5 py-1 rounded-lg text-[0.625rem] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                {pct}% (Near)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[0.625rem] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {pct}% (OK)
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-[--text-muted]">No Cap</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerCategory(cat.label);
                              setDrawerIcon(cat.icon);
                              setDrawerAmount(limit ? limit.toString() : "");
                              setDrawerSpent(spent);
                              setDrawerOpen(true);
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all active:scale-95"
                          >
                            {limit > 0 ? "Edit" : "Set"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Centered Category Allocation Modal */}
      {drawerOpen && (
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Budget Limit: ${drawerCategory}`}
          variant="center"
          width="max-w-lg md:max-w-xl"
        >
          <div className="space-y-6">
            {/* Category Banner */}
            <div className="flex items-center gap-4 bg-white/[0.03] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-inner">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/10 shrink-0">
                {drawerIcon}
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-lg font-black text-white tracking-tight">{drawerCategory}</h4>
                <p className="text-xs text-[--text-muted] mt-0.5 flex items-center gap-1.5">
                  Spent this month: 
                  <span className="font-extrabold text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                    ₹{drawerSpent.toLocaleString()}
                  </span>
                </p>
              </div>
            </div>

            {/* Budget Limit Input */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-widest text-[--text-muted]" htmlFor="drawer-limit-amount">
                Budget Limit (₹)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-xl font-black text-indigo-400 select-none">₹</span>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={drawerAmount}
                  onChange={(e) => setDrawerAmount(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-2xl pl-10 pr-4 py-3.5 text-xl font-black text-white outline-none transition-all tabular-nums text-right placeholder-[--text-muted]"
                  autoComplete="off"
                  inputMode="decimal"
                  id="drawer-limit-amount"
                />
              </div>
            </div>

            {/* Range Slider for quick adjustments */}
            <div className="space-y-2.5 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-[--text-muted]">
                <span>Adjust Slider</span>
                <span className="text-indigo-400 font-extrabold text-sm">
                  ₹{Number(drawerAmount || 0).toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(100000, Number(drawerAmount || 0) * 1.5)}
                step="500"
                value={Number(drawerAmount || 0)}
                onChange={(e) => setDrawerAmount(e.target.value)}
                className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                aria-label="Budget limit range slider"
              />
              <div className="flex justify-between text-[0.625rem] font-extrabold text-[--text-muted]">
                <span>₹0</span>
                <span>₹{Math.max(100000, Number(drawerAmount || 0) * 1.5).toLocaleString()}</span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="space-y-2">
              <p className="block text-xs font-black uppercase tracking-widest text-[--text-muted]">Quick Presets</p>
              <div className="flex flex-wrap gap-2">
                {[2000, 5000, 10000, 20000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDrawerAmount(preset.toString())}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-indigo-500/15 border border-white/10 hover:border-indigo-500/30 text-xs font-bold text-gray-200 hover:text-white transition-all cursor-pointer active:scale-95"
                  >
                    ₹{preset.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const curr = Number(drawerAmount || 0);
                    setDrawerAmount((curr + 1000).toString());
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  +1k
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const curr = Number(drawerAmount || 0);
                    setDrawerAmount((curr + 5000).toString());
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  +5k
                </button>
              </div>
            </div>

            {/* Save / Clear actions */}
            <div className="pt-4 border-t border-white/10 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="h-12 px-5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition-all active:scale-95"
              >
                Cancel
              </button>
              {Number(drawerAmount) > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleBudgetChange(drawerCategory, "");
                    setDrawerOpen(false);
                  }}
                  disabled={submitting}
                  className="h-12 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold uppercase transition-all border border-rose-500/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await handleBudgetChange(drawerCategory, drawerAmount);
                  setDrawerOpen(false);
                }}
                disabled={submitting}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Allocation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Drawer>
      )}
      {/* #15/#20 — Custom confirm modal (replaces window.confirm for carry-over & clear all) */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card-static w-full max-w-sm p-8 animate-scale-in">
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-white">{confirmModal.title}</h3>
              <p className="text-sm text-[--text-secondary] leading-relaxed">{confirmModal.message}</p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(m => ({ ...m, open: false }))}
                  className="btn-secondary flex-1 h-11 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 h-11 rounded-xl font-bold text-white transition-all active:scale-[0.98] ${
                    confirmModal.confirmStyle === "danger"
                      ? "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/20"
                      : "btn-primary"
                  }`}
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
