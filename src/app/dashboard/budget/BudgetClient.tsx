"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { upsertBudget, deleteBudget } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, parseISO, getDaysInMonth, isSameMonth, subMonths } from "date-fns";
import { getCategoryColour, getColorByLabel } from "@/lib/chart-colours";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";

import { Tabs } from "@/components/ui/tabs";

export default function BudgetClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { budgets, expenses, incomes }, mutate } = useFinanceData(initialData);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeView, setActiveView] = useState<"overview" | "categories">("overview");
  
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

  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    Object.keys(actualSpending).forEach(c => cats.add(c));
    currentBudgets.forEach(b => cats.add(b.category));
    
    return Array.from(cats).map(name => {
      let icon = "📦";
      switch(name.toLowerCase()) {
        case "food": case "food & dining": icon = "🍔"; break;
        case "rent": case "housing": icon = "🏠"; break;
        case "travel": icon = "✈️"; break;
        case "utilities": case "bills & utilities": icon = "⚡"; break;
        case "investment": icon = "📈"; break;
        case "shopping": icon = "🛍️"; break;
        case "entertainment": icon = "🎬"; break;
        case "healthcare": icon = "⚕️"; break;
        case "education": icon = "📚"; break;
        case "transportation": case "transport": icon = "🚗"; break;
        case "groceries": icon = "🛒"; break;
        case "personal care": icon = "🧴"; break;
        case "subscription": icon = "💳"; break;
      }
      return { label: name, icon };
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
               toast.success(`${category} budget cleared`);
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
          toast.success(`${category} budget updated`);
          mutate();
        } else {
          toast.error(res.error);
        }
      });
    } finally {
      activeSubmissionsRef.current[category] = false;
    }
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
             <button onClick={() => setActiveView("categories")} className="btn-primary">Set Allocations</button>
          </div>
        </div>
      ) : (
      <>
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Planned Spend</p>
            <p className="text-2xl md:text-3xl font-black text-white">₹{totalBudgeted.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Budget</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Actual Burn</p>
            <p className={`text-2xl md:text-3xl font-black ${totalSpent > totalBudgeted && totalBudgeted > 0 ? "text-danger" : "text-white"}`}>₹{totalSpent.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Real-time Outflow</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Margin</p>
            <p className={`text-2xl md:text-3xl font-black ${totalBudgeted - totalSpent >= 0 ? "text-success" : "text-danger"}`}>
              ₹{(totalBudgeted - totalSpent).toLocaleString()}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Remaining Budget</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Daily Allowance</p>
            <p className={`text-2xl md:text-3xl font-black ${(daysInMonth - daysPassed) > 0 && (totalBudgeted - totalSpent) > 0 ? "text-emerald-400" : "text-slate-500"}`}>
              ₹{((daysInMonth - daysPassed) > 0 && (totalBudgeted - totalSpent) > 0 ? (totalBudgeted - totalSpent) / (daysInMonth - daysPassed) : 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Safe Spend / Day</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Monthly Income</p>
            <p className="text-2xl md:text-3xl font-black text-[--accent-primary-light]">₹{totalIncome.toLocaleString()}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Revenue Stream</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <Tabs
          items={[
            { key: "overview", label: "Overview" },
            { key: "categories", label: "Category Allocations", badge: overBudgetCategories.length > 0 ? overBudgetCategories.length : undefined },
          ]}
          active={activeView}
          onChange={(key) => setActiveView(key as "overview" | "categories")}
        />

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
            <div className="glass-card-static p-8 space-y-8">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[--text-muted]">Allocation by Segment</h3>
              <div className="space-y-6">
                {dynamicCategories.map(cat => {
                  const budget = currentBudgets.find(b => b.category === cat.label);
                  const spent = actualSpending[cat.label] || 0;
                  const limit = Number(budget?.amount || 0);
                  const percent = limit > 0 ? (spent / limit) * 100 : 0;
                  
                  return (
                    <div key={cat.label} className="group">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl opacity-80 group-hover:opacity-100 transition-opacity">{cat.icon}</span>
                          <div>
                            <p className="text-sm font-bold text-white flex items-center gap-2">
                              {cat.label}
                              {percent > 100 && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" title="Over budget!" />}
                            </p>
                            <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-widest">
                              Spent: ₹{spent.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <input 
                            type="number" 
                            placeholder="Set Limit"
                            defaultValue={limit || ""}
                            disabled={submitting}
                            onBlur={(e) => {
                              const lastVal = limit ? limit.toString() : "";
                              if (e.target.value !== lastVal) {
                                handleBudgetChange(cat.label, e.target.value);
                              }
                            }}
                            className="input-premium !h-10 w-32 text-right !bg-white/5 border-transparent focus:border-[--accent-primary] text-sm font-black"
                            autoComplete="new-password"
                            inputMode="decimal"
                            name="budget-limit"
                            id={`budget-limit-${cat.label}`}
                          />
                        </div>
                      </div>
                      {limit > 0 && (
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex relative">
                          <div 
                            className={`h-full transition-all duration-1000 ${percent > 100 ? "bg-danger" : percent > 80 ? "bg-warning" : "bg-gradient-to-r from-[--accent-primary] to-emerald-400"}`} 
                            style={{ width: `${Math.min(percent, 100)}%` }} 
                          />
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-white/50 shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10" 
                            style={{ left: `${monthProgressPercent}%` }}
                            title={`Month Progress: ${monthProgressPercent.toFixed(0)}%`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
      )}
    </div>
  );
}
