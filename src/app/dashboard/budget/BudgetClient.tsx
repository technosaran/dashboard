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
  const [activeView, setActiveView] = useState<"overview" | "categories">("overview");
  
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Budget Planner</h1>
          <p className="text-[13px] md:text-sm mt-1 text-[--text-secondary]">Fiscal strategy, category limits, and monthly controls.</p>
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

      {totalBudgeted === 0 && totalSpent === 0 && totalIncome === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-indigo-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <svg className="w-8 h-8 text-[--accent-primary-light]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">No Budget Data for This Period</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Set spending limits by category to monitor your fiscal discipline. Start by allocating budgets for the selected month below.</p>
          <div className="mt-8 flex justify-center">
             <button 
               onClick={() => setActiveView("categories")} 
               className="btn-primary flex items-center gap-2 group shadow-lg hover:shadow-[--accent-primary]/25 transition-all duration-300"
             >
               <Plus className="w-4 h-4 transition-transform group-hover:scale-110" />
               <span>Set Allocations</span>
             </button>
          </div>
        </div>
      ) : (
      <>
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-xs font-semibold text-[--text-muted] mb-3">Planned spend</p>
            <p className="text-2xl md:text-3xl font-black text-white">₹{totalBudgeted.toLocaleString()}</p>
            <p className="text-[11px] text-[--text-muted] mt-2 opacity-60">Total budget</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-xs font-semibold text-[--text-muted] mb-3">Actual spend</p>
            <p className={`text-2xl md:text-3xl font-black ${totalSpent > totalBudgeted && totalBudgeted > 0 ? "text-danger" : "text-white"}`}>₹{totalSpent.toLocaleString()}</p>
            <p className="text-[11px] text-[--text-muted] mt-2 opacity-60">Real-time outflow</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-xs font-semibold text-[--text-muted] mb-3">Margin</p>
            <p className={`text-2xl md:text-3xl font-black ${totalBudgeted - totalSpent >= 0 ? "text-success" : "text-danger"}`}>
              ₹{(totalBudgeted - totalSpent).toLocaleString()}
            </p>
            <p className="text-[11px] text-[--text-muted] mt-2 opacity-60">Remaining budget</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-xs font-semibold text-[--text-muted] mb-3">Daily allowance</p>
            <p className={`text-2xl md:text-3xl font-black ${(daysInMonth - daysPassed) > 0 && (totalBudgeted - totalSpent) > 0 ? "text-emerald-400" : "text-slate-500"}`}>
              ₹{((daysInMonth - daysPassed) > 0 && (totalBudgeted - totalSpent) > 0 ? (totalBudgeted - totalSpent) / (daysInMonth - daysPassed) : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-[--text-muted] mt-2 opacity-60">Safe spend / day</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
            <p className="text-xs font-semibold text-[--text-muted] mb-3">Monthly income</p>
            <p className="text-2xl md:text-3xl font-black text-[--accent-primary-light]">₹{totalIncome.toLocaleString()}</p>
            <p className="text-[11px] text-[--text-muted] mt-2 opacity-60">Revenue stream</p>
          </div>
        </div>

        {/* Tab Switcher */}
        {/* Premium Segmented Toggle Bar */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
          {[
            { key: "overview", label: "Overview" },
            { key: "categories", label: "Category Allocations", badge: overBudgetCategories.length > 0 ? overBudgetCategories.length : undefined },
          ].map((tab) => {
            const isActive = activeView === tab.key;
            
            let activeStyles = "bg-[--accent-primary] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]";
            if (tab.key === "categories") activeStyles = "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]";

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveView(tab.key as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer ${
                  isActive
                    ? `${activeStyles} border border-transparent`
                    : "text-[--text-muted] hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-black ${
                    isActive ? "bg-white/20 text-white" : "bg-white/10 text-white"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View Content */}
        {activeView === "overview" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trend Chart */}
              <div className="glass-card-static p-6 lg:col-span-2 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Budget vs Spent (6 Mo)</h3>
                    <p className="text-2xl font-black mt-2 text-white">Burn Trajectory</p>
                  </div>
                </div>
                <div className="flex-1 min-h-[250px] w-full mt-4 -ml-4">
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
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} dy={10} />
                        <YAxis tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} dx={-10} />
                        <RechartsTooltip 
                          contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px", boxShadow: "var(--shadow-lg)" }}
                          itemStyle={{ color: "var(--text-primary)", fontWeight: "bold" }}
                          formatter={(value: unknown) => [`₹${Number(value).toLocaleString()}`, ""]}
                        />
                        <Area type="monotone" dataKey="Budget" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorBudget)" />
                        <Area type="monotone" dataKey="Spent" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSpent)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Allocation Pie Chart */}
              <div className="glass-card-static p-6 flex flex-col items-center justify-center relative min-h-[400px]">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Target Allocation</h3>
                <div className="w-full h-[250px] mt-8">
                  {mounted && pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />)}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }}
                          itemStyle={{ color: "var(--text-primary)", fontWeight: "bold" }}
                          formatter={(value: unknown) => [`₹${Number(value).toLocaleString()}`, "Budget"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                       <span className="text-3xl mb-2">📊</span>
                       <span className="text-xs uppercase tracking-widest font-black">No Budget Data</span>
                    </div>
                  )}
                </div>
                {pieData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
                    {pieData.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                        <span className="text-[--text-secondary] font-medium">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card-static p-8 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] pointer-events-none ${isBurningFast && totalBudgeted > 0 ? 'bg-danger/20' : 'bg-success/20'}`} />
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[--text-muted] mb-8">Pacing & Trajectory</h3>
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <p className="text-4xl font-black text-white">{daysInMonth - daysPassed}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[--text-muted] mt-1">Days Remaining</p>
                  </div>
                  <div>
                    <p className={`text-4xl font-black ${isBurningFast && totalBudgeted > 0 ? 'text-danger' : 'text-success'}`}>{budgetBurnRatePercent.toFixed(0)}%</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[--text-muted] mt-1">Budget Burned</p>
                  </div>
                </div>
                {totalBudgeted > 0 && (
                  <>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-4">
                      <div className={`mt-1 p-1.5 rounded-lg ${isBurningFast ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'}`}>
                        {isBurningFast ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[--text-primary]">
                          {isBurningFast ? "Spending too fast" : "Pacing well"}
                        </p>
                        <p className="text-xs text-[--text-secondary] mt-1">
                          {isBurningFast 
                            ? `You've spent ${budgetBurnRatePercent.toFixed(0)}% of your budget, but only ${monthProgressPercent.toFixed(0)}% of the month has passed.`
                            : `You are spending slower than the month is passing (${monthProgressPercent.toFixed(0)}% passed). Great job!`
                          }
                        </p>
                      </div>
                    </div>
                    {predictiveDeplDate && budgetBurnRatePercent > 15 && (
                      <div className="mt-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4 animate-fade-in">
                        <div className="mt-0.5 text-base text-indigo-400">
                          🔮
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Predictive Spending Assistant</p>
                          <p className="text-[11px] text-[--text-secondary] mt-1 leading-relaxed">
                            Based on your current burn velocity, your budget is projected to run out on <span className="font-bold text-white">{format(predictiveDeplDate, "MMM d, yyyy")}</span>.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="glass-card-static p-8">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[--text-muted] mb-8">Savings Potential</h3>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                   <p className="text-5xl font-black text-white mb-2">₹{(totalIncome - totalSpent).toLocaleString()}</p>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[--accent-primary-light]">Theoretical Surplus</p>
                   <div className="mt-8 grid grid-cols-2 gap-8 w-full border-t border-white/5 pt-8">
                      <div>
                        <p className="text-[20px] font-black text-success">
                          {totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome * 100).toFixed(1) : 0}%
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mt-1">Savings Rate</p>
                      </div>
                      <div>
                        <p className="text-[20px] font-black text-warning">
                          {totalIncome > 0 ? (totalSpent / totalIncome * 100).toFixed(1) : 0}%
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mt-1">Expense Ratio</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {overBudgetCategories.length > 0 && (
              <div className="glass-card-static p-8 border-danger/30 bg-gradient-to-br from-danger/5 to-transparent">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-danger mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Over Budget Alerts
                </h3>
                <div className="space-y-4">
                  {overBudgetCategories.map(cat => {
                    const budget = currentBudgets.find(b => b.category === cat.label);
                    const limit = Number(budget?.amount || 0);
                    const spent = actualSpending[cat.label] || 0;
                    const overage = spent - limit;
                    return (
                      <div key={cat.label} className="flex justify-between items-center bg-danger/10 p-3 rounded-xl border border-danger/20">
                        <div className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span className="text-sm font-bold text-white">{cat.label}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-danger">₹{overage.toLocaleString()} over</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category Budgeting */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/[0.01] p-5 rounded-2xl border border-white/5 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-[--text-primary]">Allocation by segment</h3>
                  <p className="text-xs text-[--text-muted] mt-1">Set maximum monthly limits per expense type.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCarryOver}
                    disabled={submitting}
                    className="btn-secondary !h-9 px-3.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 group transition-all duration-200"
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
                      className="h-9 px-3.5 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-400 hover:text-rose-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all duration-200 group"
                      title="Clear all budget limits for this month"
                    >
                      <Trash2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {dynamicCategories.map(cat => {
                  const budget = currentBudgets.find(b => b.category === cat.label);
                  const spent = actualSpending[cat.label] || 0;
                  const limit = Number(budget?.amount || 0);
                  const percent = limit > 0 ? (spent / limit) * 100 : 0;

                  return (
                    <div key={cat.label} className="glass-card-static p-5 flex flex-col justify-between border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent hover:from-white/[0.02] transition-all duration-300 min-h-[190px]">
                      <div>
                        {/* Card Header */}
                        <div className="flex justify-between items-start gap-2 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                              {limit > 0 ? (
                                <>
                                  <svg className="w-full h-full transform -rotate-90 absolute">
                                    <circle cx="24" cy="24" r="20" className="stroke-white/5" strokeWidth="3" fill="transparent" />
                                    <circle
                                      cx="24"
                                      cy="24"
                                      r="20"
                                      className={`transition-all duration-1000 ${
                                        percent > 90 ? "stroke-rose-500" : percent > 75 ? "stroke-amber-500" : "stroke-cyan-400"
                                      }`}
                                      strokeWidth="3"
                                      fill="transparent"
                                      strokeDasharray={125.6}
                                      strokeDashoffset={125.6 * (1 - Math.min(percent, 100) / 100)}
                                    />
                                  </svg>
                                  <span className="text-xl z-10">{cat.icon}</span>
                                </>
                              ) : (
                                <span className="text-xl p-2 bg-white/[0.02] rounded-2xl border border-white/5 shadow-inner">{cat.icon}</span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-black text-white">{cat.label}</p>
                              <p className="text-[10px] font-bold text-[--text-muted] uppercase tracking-wider mt-0.5">
                                Spent: ₹{spent.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Status Tag */}
                          {limit > 0 ? (
                            percent > 100 ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">Over limit</span>
                            ) : percent > 80 ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">Near limit</span>
                            ) : (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">On track</span>
                            )
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-[--text-muted] border border-white/10">No limit</span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {limit > 0 && (
                        <div className="my-4">
                          <div className="flex justify-between text-[10px] font-bold text-[--text-muted] mb-1.5">
                            <span>{percent.toFixed(0)}% used</span>
                            <span>Limit: ₹{limit.toLocaleString()}</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex relative border border-white/5">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                percent > 90 
                                  ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)] animate-pulse" 
                                  : percent > 75 
                                    ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" 
                                    : "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                              }`} 
                              style={{ width: `${Math.min(percent, 100)}%` }} 
                            />
                            <div 
                              className="absolute top-0 bottom-0 w-0.5 bg-sky-400/80 shadow-[0_0_8px_rgba(56,189,248,0.8)] z-10" 
                              style={{ left: `${monthProgressPercent}%` }}
                              title={`Time Progress: ${monthProgressPercent.toFixed(0)}%`}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[11px] text-[--text-muted] font-medium">
                          {limit > 0 ? (
                            <>
                              Limit: <span className="font-bold text-white">₹{limit.toLocaleString()}</span>
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            limit > 0
                              ? "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/5 hover:border-white/10 active:scale-95"
                              : "bg-[--accent-primary]/10 hover:bg-[--accent-primary]/25 text-[--accent-primary-light] hover:text-white border-[--accent-primary]/10 hover:border-[--accent-primary]/25 active:scale-95"
                          }`}
                        >
                          {limit > 0 ? (
                            <Edit2 className="w-3 h-3 transition-transform" />
                          ) : (
                            <Plus className="w-3 h-3 transition-transform" />
                          )}
                          <span>{limit > 0 ? "Adjust" : "Set Limit"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
      )}

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
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]" htmlFor="drawer-limit-amount">
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
              <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
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
              <div className="flex justify-between text-[9px] font-bold text-[--text-muted]">
                <span>₹0</span>
                <span>₹{Math.max(100000, Number(drawerAmount || 0) * 1.5).toLocaleString()}</span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Presets</p>
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
