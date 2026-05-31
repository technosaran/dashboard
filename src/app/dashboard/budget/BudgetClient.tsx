"use client";

import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { upsertBudget } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

const CATEGORIES = [
  { label: "Food", icon: "🍔" },
  { label: "Rent", icon: "🏠" },
  { label: "Travel", icon: "✈️" },
  { label: "Utilities", icon: "⚡" },
  { label: "Investment", icon: "📈" },
  { label: "Shopping", icon: "🛍️" },
  { label: "Entertainment", icon: "🎬" },
  { label: "Others", icon: "📦" },
];

export default function BudgetClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { budgets, expenses, incomes }, isValidating } = useFinanceData(initialData);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [submitting, withLock] = useSubmitLock();

  // Calculate actual spending for selected period
  const actualSpending = useMemo(() => {
    const spending: Record<string, number> = {};
    expenses.forEach(e => {
      if (!e.date) return;
      const date = parseISO(e.date);
      if (date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear) {
        spending[e.category] = (spending[e.category] || 0) + Number(e.amount);
      }
    });
    return spending;
  }, [expenses, selectedMonth, selectedYear]);

  // Calculate total income for selected period
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

  async function handleBudgetChange(category: string, amount: string) {
    const val = parseFloat(amount);
    if (isNaN(val)) return;
    
    await withLock(async () => {
      const res = await upsertBudget({
        category,
        amount: val,
        period_month: selectedMonth,
        period_year: selectedYear
      });
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Budget Planner</h1>
          <p className="text-xs text-[--text-muted] font-bold uppercase tracking-[0.3em] mt-2">Fiscal Strategy & Controls</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="btn-secondary !h-11 px-4" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1}>{format(new Date(2000, i), "MMMM")}</option>
            ))}
          </select>
          <select className="btn-secondary !h-11 px-4" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
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
          <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em] mt-6">Tip: Log expenses and income first, then set budget limits to track against them.</p>
        </div>
      ) : (
      <>
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card-static p-6 border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Planned Spend</p>
          <p className="text-2xl font-black text-white">₹{totalBudgeted.toLocaleString()}</p>
          <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Budget</p>
        </div>
        <div className="glass-card-static p-6 border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Actual Burn</p>
          <p className={`text-2xl font-black ${totalSpent > totalBudgeted && totalBudgeted > 0 ? "text-danger" : "text-white"}`}>₹{totalSpent.toLocaleString()}</p>
          <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Real-time Outflow</p>
        </div>
        <div className="glass-card-static p-6 border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Margin</p>
          <p className={`text-2xl font-black ${totalBudgeted - totalSpent >= 0 ? "text-success" : "text-danger"}`}>
            ₹{(totalBudgeted - totalSpent).toLocaleString()}
          </p>
          <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Remaining Budget</p>
        </div>
        <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Monthly Income</p>
          <p className="text-2xl font-black text-[--accent-primary-light]">₹{totalIncome.toLocaleString()}</p>
          <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Revenue Stream</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Budgeting */}
        <div className="glass-card-static p-8 space-y-8">
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[--text-muted]">Allocation by Segment</h3>
          <div className="space-y-6">
            {CATEGORIES.map(cat => {
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
                        <p className="text-sm font-bold text-white">{cat.label}</p>
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
                        onBlur={(e) => handleBudgetChange(cat.label, e.target.value)}
                        className="input-premium !h-10 w-32 text-right !bg-white/5 border-transparent focus:border-[--accent-primary] text-sm font-black"
                      />
                    </div>
                  </div>
                  {limit > 0 && (
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${percent > 100 ? "bg-danger" : percent > 80 ? "bg-warning" : "bg-success"}`} 
                        style={{ width: `${Math.min(percent, 100)}%` }} 
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Fiscal Analysis */}
        <div className="space-y-6">
          <div className="glass-card-static p-8">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[--text-muted] mb-8">Savings Potential</h3>
            <div className="flex flex-col items-center justify-center py-10 text-center">
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
          
          <div className="glass-card-static p-8 bg-gradient-to-br from-indigo-500/10 to-transparent">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[--text-muted] mb-4">Strategic Advisory</h3>
            <p className="text-sm text-[--text-secondary] leading-relaxed italic">
              {totalSpent > totalIncome 
                ? "Warning: Your consumption exceeds revenue for this period. Liquidate underperforming assets or reduce discretionary spending immediately."
                : totalSpent > totalBudgeted 
                ? "Caution: You have breached your set budgetary limits. Fiscal discipline is required to maintain long-term milestones."
                : "Operational Efficiency: Your spending is within parameters. Consider allocating the surplus to your 'Financial Milestones' section."}
            </p>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
