"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { upsertBudget, deleteBudget, copyPreviousMonthBudgets, clearAllBudgets } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, parseISO, getDaysInMonth, isSameMonth, subMonths } from "date-fns";
import { getCategoryColour, getColorByLabel } from "@/lib/chart-colours";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((mod) => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((mod) => mod.Area), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false });
const RechartsTooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false });

import { Drawer } from "@/components/ui/drawer";
import { Copy, Trash2, Edit2, Plus, Check } from "lucide-react";

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
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategory, setDrawerCategory] = useState<string>("");
  const [drawerIcon, setDrawerIcon] = useState<string>("📦");
  const [drawerAmount, setDrawerAmount] = useState<string>("");
  const [drawerSpent, setDrawerSpent] = useState<number>(0);

  // #15/#20 — custom confirm modal instead of window.confirm
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

  const actualSpending = useMemo(() => {
    const spending: Record<string, number> = {};
    expenses.forEach(e => {
      if (!e.date) return;
      const date = parseISO(e.date);
      if (date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear) {
        const amt = Number(e.amount);
        spending[e.category] = (spending[e.category] || 0) + amt;
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
    return budgets.filter(b => b.period_month === selectedMonth && b.period_year === selectedYear);
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

  const predictiveDeplDate = useMemo(() => {
    if (totalSpent <= 0 || daysPassed <= 0 || totalBudgeted <= 0) return null;
    const avgDailySpent = totalSpent / daysPassed;
    if (avgDailySpent <= 0) return null;
    const daysToBurn = totalBudgeted / avgDailySpent;
    const date = new Date(selectedYear, selectedMonth - 1, 1);
    date.setDate(1 + Math.floor(daysToBurn));
    return date;
  }, [totalSpent, daysPassed, totalBudgeted, selectedMonth, selectedYear]);

  const dynamicCategories = useMemo(() => {
    const catsMap = new Map<string, string>();
    BUDGET_CATEGORIES.forEach(c => catsMap.set(c.label, c.icon));
    
    Object.keys(actualSpending).forEach(c => {
      if (!catsMap.has(c)) catsMap.set(c, "📦");
    });
    currentBudgets.forEach(b => {
      if (!catsMap.has(b.category)) catsMap.set(b.category, "📦");
    });
    
    return Array.from(catsMap.entries()).map(([label, icon]) => {
      let finalIcon = icon;
      const lower = label.toLowerCase();
      if (lower === "food & dining") finalIcon = "🍔";
      else if (lower === "housing") finalIcon = "🏠";
      else if (lower === "bills & utilities") finalIcon = "⚡";
      else if (lower === "transportation") finalIcon = "🚌";
      
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
    }).reverse();
  }, [budgets, expenses, selectedMonth, selectedYear]);

  const pieData = useMemo(() => {
    return currentBudgets.map(b => {
      const color = getCategoryColour(b.category);
      return {
        name: b.category,
        value: Number(b.amount),
        fill: (color && color !== "undefined") ? color : getColorByLabel(b.category)
      };
    }).sort((a, b) => b.value - a.value);
  }, [currentBudgets]);

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

    // #15 — include categories with actual spending this month even if not in previous budgets
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
    // #18/#20 — custom modal instead of window.confirm
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



  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
    return `₹${value.toLocaleString()}`;
  };

return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Budget Planner</h1>
          <p className="text-sm md:text-sm mt-1 text-[--text-secondary]">Fiscal strategy, category limits, and monthly controls.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="btn-secondary !h-11 px-4" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} aria-label="Select month" id="budget-month-select" name="month">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1}>{format(new Date(2000, i), "MMMM")}</option>
            ))}
          </select>
          <select className="btn-secondary !h-11 px-4" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} aria-label="Select year" id="budget-year-select" name="year">
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Key Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="glass-card-static p-5 border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2">Planned spend</p>
          <p className="text-2xl font-black text-white">₹{totalBudgeted.toLocaleString()}</p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-60">Total monthly limit</p>
        </div>
        <div className="glass-card-static p-5 border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2">Actual spend</p>
          <p className={`text-2xl font-black ${totalSpent > totalBudgeted && totalBudgeted > 0 ? "text-rose-400" : "text-white"}`}>₹{totalSpent.toLocaleString()}</p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-60">Real-time outflow</p>
        </div>
        <div className="glass-card-static p-5 border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2">Margin</p>
          <p className={`text-2xl font-black ${totalBudgeted - totalSpent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            ₹{(totalBudgeted - totalSpent).toLocaleString()}
          </p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-60">Remaining balance</p>
        </div>
        <div className="glass-card-static p-5 border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2">Daily allowance</p>
          <p className={`text-2xl font-black ${(daysInMonth - daysPassed) > 0 && (totalBudgeted - totalSpent) > 0 ? "text-sky-400" : "text-slate-500"}`}>
            ₹{((daysInMonth - daysPassed) > 0 && (totalBudgeted - totalSpent) > 0 ? (totalBudgeted - totalSpent) / (daysInMonth - daysPassed) : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-60">Safe spend / day</p>
        </div>
        <div className="glass-card-static p-5 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent col-span-2 md:col-span-1">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2">Monthly income</p>
          <p className="text-2xl font-black text-[--accent-primary-light]">₹{totalIncome.toLocaleString()}</p>
          <p className="text-[0.5625rem] text-[--text-muted] mt-1 opacity-60">Total revenue stream</p>
        </div>
      </div>

      {/* Main Responsive Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Category Budgets (col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          
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
                className="btn-secondary !h-9 px-3.5 text-xs font-black uppercase tracking-wider flex items-center gap-2 group transition-all duration-200"
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
                  className="h-9 px-3.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all duration-200 group"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

          {/* 6-Month Trend Chart */}
          <div className="glass-card-static p-5 min-h-[300px] flex flex-col border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">6-Month Budget vs Spend Trajectory</h3>
                <p className="text-xs text-[--text-secondary] mt-0.5">Visual representation of total spending velocity compared to planning targets.</p>
              </div>
            </div>
            <div className="flex-1 min-h-[200px] w-full mt-2 -ml-4">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} dy={10} />
                    <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} dx={-10} />
                    <RechartsTooltip 
                      contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px", boxShadow: "var(--shadow-lg)" }}
                      itemStyle={{ color: "var(--text-primary)", fontWeight: "bold", fontSize: 12 }}
                      formatter={(value: unknown) => [`₹${Number(value).toLocaleString()}`, ""]}
                    />
                    <Area type="monotone" dataKey="Budget" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorBudget)" />
                    <Area type="monotone" dataKey="Spent" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorSpent)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Allocation Segment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dynamicCategories.map(cat => {
              const budget = currentBudgets.find(b => b.category === cat.label);
              const spent = actualSpending[cat.label] || 0;
              const limit = Number(budget?.amount || 0);
              const percent = limit > 0 ? (spent / limit) * 100 : 0;

              return (
                <div key={cat.label} className="glass-card-static p-4.5 flex flex-col justify-between border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent hover:from-white/[0.02] transition-all duration-300 min-h-[175px]">
                  <div>
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2 mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 flex-shrink-0 flex items-center justify-center">
                          {limit > 0 ? (
                            <>
                              <svg className="w-full h-full transform -rotate-90 absolute">
                                <circle cx="22" cy="22" r="18" className="stroke-white/5" strokeWidth="2.5" fill="transparent" />
                                <circle
                                  cx="22"
                                  cy="22"
                                  r="18"
                                  className={`transition-all duration-1000 ${
                                    percent > 90 ? "stroke-rose-500" : percent > 75 ? "stroke-amber-500" : "stroke-cyan-400"
                                  }`}
                                  strokeWidth="2.5"
                                  fill="transparent"
                                  strokeDasharray={113}
                                  strokeDashoffset={113 * (1 - Math.min(percent, 100) / 100)}
                                />
                              </svg>
                              <span className="text-lg z-10">{cat.icon}</span>
                            </>
                          ) : (
                            <span className="text-lg p-2 bg-white/[0.02] rounded-2xl border border-white/5 shadow-inner">{cat.icon}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{cat.label}</p>
                          <p className="text-[0.5625rem] font-bold text-[--text-muted] uppercase tracking-wider mt-0.5">
                            Spent: ₹{spent.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Status Tag */}
                      {limit > 0 ? (
                        percent > 100 ? (
                          <span className="text-[0.5625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">Over limit</span>
                        ) : percent > 80 ? (
                          <span className="text-[0.5625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">Near limit</span>
                        ) : (
                          <span className="text-[0.5625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">On track</span>
                        )
                      ) : (
                        <span className="text-[0.5625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 text-[--text-muted] border border-white/10">No limit</span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar with month progress pacing line */}
                  {limit > 0 && (
                    <div className="my-2.5">
                      <div className="flex justify-between text-[0.5625rem] font-black uppercase tracking-wider text-[--text-muted] mb-1">
                        <span>{percent.toFixed(0)}% used</span>
                        <span>Limit: ₹{limit.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex relative border border-white/5">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            percent > 90 
                              ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" 
                              : percent > 75 
                                ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]" 
                                : "bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.3)]"
                          }`} 
                          style={{ width: `${Math.min(percent, 100)}%` }} 
                        />
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 bg-sky-400/80 shadow-[0_0_6px_rgba(56,189,248,0.8)] z-10" 
                          style={{ left: `${monthProgressPercent}%` }}
                          title={`Month progress line: ${monthProgressPercent.toFixed(0)}% passed`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-3.5 pt-3 border-t border-white/5 flex justify-between items-center">
                    <span className="text-xs text-[--text-muted] font-medium">
                      {limit > 0 ? (
                        <>
                          Target: <span className="font-bold text-white">₹{limit.toLocaleString()}</span>
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
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer border ${
                        limit > 0
                          ? "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/5 hover:border-white/10 active:scale-95"
                          : "bg-[--accent-primary]/10 hover:bg-[--accent-primary]/25 text-[--accent-primary-light] hover:text-white border-[--accent-primary]/10 hover:border-[--accent-primary]/25 active:scale-95"
                      }`}
                    >
                      {limit > 0 ? (
                        <Edit2 className="w-2.5 h-2.5" />
                      ) : (
                        <Plus className="w-2.5 h-2.5" />
                      )}
                      <span>{limit > 0 ? "Adjust" : "Set Limit"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Analytics, Legend, and pacing details (col-span-1) */}
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
              <div className="pt-3 border-t border-white/5 flex items-start gap-2.5">
                <span className="w-0.5 h-4 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] inline-block mt-0.5" />
                <div>
                  <p className="font-bold text-white text-xs uppercase tracking-wider">Month Progress Line</p>
                  <p className="text-xs text-[--text-muted] mt-1 leading-relaxed">The thin blue line shows calendar progress. Keep your colored spent bar behind it to pace yourself perfectly through the month.</p>
                </div>
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
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                  <div className={`mt-0.5 p-1 rounded-lg ${isBurningFast ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {isBurningFast ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[--text-primary]">
                      {isBurningFast ? "Spending too fast" : "Pacing well"}
                    </p>
                    <p className="text-xs text-[--text-secondary] mt-0.5 leading-relaxed">
                      {isBurningFast 
                        ? `You are running ahead of calendar pacing (${monthProgressPercent.toFixed(0)}% days passed).`
                        : `Your burn velocity is slower than calendar progress (${monthProgressPercent.toFixed(0)}% passed).`
                      }
                    </p>
                  </div>
                </div>
                
                {predictiveDeplDate && budgetBurnRatePercent > 15 && (
                  <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                    <div className="text-xs mt-0.5">🔮</div>
                    <div>
                      <p className="text-xs font-bold text-white">Projected Exhaustion</p>
                      <p className="text-xs text-[--text-secondary] mt-0.5 leading-relaxed">
                        Based on velocity, your budget will run out on <span className="font-bold text-white">{format(predictiveDeplDate, "MMM d, yyyy")}</span>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Target Allocation Pie Chart */}
          <div className="glass-card-static p-5 flex flex-col items-center justify-center relative min-h-[280px] border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-5 left-5">Target Allocation</h3>
            <div className="w-full h-[160px] mt-4">
              {mounted && pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />)}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px", fontSize: 11 }}
                      itemStyle={{ color: "var(--text-primary)", fontWeight: "bold" }}
                      formatter={(value: unknown) => [`₹${Number(value).toLocaleString()}`, "Budget"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                   <span className="text-xl mb-1">📊</span>
                   <span className="text-[0.5625rem] uppercase tracking-widest font-black">No Budget Limits</span>
                </div>
              )}
            </div>
            {pieData.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-2 w-full">
                {pieData.slice(0, 4).map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-[0.5625rem]">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-[--text-secondary] font-medium">{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Savings Potential */}
          <div className="glass-card-static p-5 text-center border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Savings Potential</h3>
            <p className="text-3xl font-black text-white">₹{(totalIncome - totalSpent).toLocaleString()}</p>
            <p className="text-[0.5625rem] font-black uppercase tracking-[0.25em] text-[--accent-primary-light] mt-1">Theoretical Surplus</p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
               <div>
                 <p className="text-lg font-black text-emerald-400">
                   {totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome * 100).toFixed(1) : 0}%
                 </p>
                 <p className="text-[0.5625rem] font-black uppercase tracking-wider text-[--text-muted] mt-0.5">Savings Rate</p>
               </div>
               <div>
                 <p className="text-lg font-black text-amber-500">
                   {totalIncome > 0 ? (totalSpent / totalIncome * 100).toFixed(1) : 0}%
                 </p>
                 <p className="text-[0.5625rem] font-black uppercase tracking-wider text-[--text-muted] mt-0.5">Expense Ratio</p>
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* Slide-out Category Allocation Drawer */}
      {drawerOpen && (
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Limit: ${drawerCategory}`}
        >
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
              <span className="text-4xl p-2 bg-white/[0.02] rounded-2xl border border-white/5 shadow-inner">{drawerIcon}</span>
              <div>
                <h4 className="text-sm font-black text-white">{drawerCategory}</h4>
                <p className="text-xs text-[--text-muted] mt-0.5">Spent this month: <span className="font-bold text-white">₹{drawerSpent.toLocaleString()}</span></p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="drawer-limit-amount">
                Budget Limit (₹)
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={drawerAmount}
                  onChange={(e) => setDrawerAmount(e.target.value)}
                  className="w-full bg-[#151515] border border-white/10 rounded-xl px-4 py-3 text-lg font-black text-white outline-none focus:border-[#2185d0] text-right"
                  autoComplete="off"
                  inputMode="decimal"
                  id="drawer-limit-amount"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
              </div>
            </div>

            {/* Range Slider for quick adjustments */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">
                <span>Adjust Slider</span>
                <span className="text-[--accent-primary-light] font-black">
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
                className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[--accent-primary]"
                aria-label="Budget limit range slider"
              />
              <div className="flex justify-between text-[0.5625rem] font-bold text-[--text-muted]">
                <span>₹0</span>
                <span>₹{Math.max(100000, Number(drawerAmount || 0) * 1.5).toLocaleString()}</span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Presets</p>
              <div className="flex flex-wrap gap-2">
                {[2000, 5000, 10000, 20000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDrawerAmount(preset.toString())}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 hover:border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
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
                  className="px-3 py-1.5 rounded-lg bg-[--accent-primary]/10 hover:bg-[--accent-primary]/20 active:scale-95 border border-[--accent-primary]/10 hover:border-[--accent-primary]/25 text-[--accent-primary-light] text-xs font-bold transition-all cursor-pointer"
                >
                  +1k
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const curr = Number(drawerAmount || 0);
                    setDrawerAmount((curr + 5000).toString());
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[--accent-primary]/10 hover:bg-[--accent-primary]/20 active:scale-95 border border-[--accent-primary]/10 hover:border-[--accent-primary]/25 text-[--accent-primary-light] text-xs font-bold transition-all cursor-pointer"
                >
                  +5k
                </button>
              </div>
            </div>

            {/* Save / Clear actions */}
            <div className="pt-6 border-t border-white/5 flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  await handleBudgetChange(drawerCategory, drawerAmount);
                  setDrawerOpen(false);
                }}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[--accent-primary] to-indigo-600 hover:from-[--accent-primary-hover] hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Allocation</span>
                  </>
                )}
              </button>
              {Number(drawerAmount) > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleBudgetChange(drawerCategory, "");
                    setDrawerOpen(false);
                  }}
                  disabled={submitting}
                  className="px-5 py-3 rounded-xl bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 text-xs font-black uppercase tracking-wider transition-all border border-rose-500/10 hover:border-rose-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
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
