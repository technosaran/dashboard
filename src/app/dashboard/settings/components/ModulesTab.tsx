"use client";

import React, { useState } from "react";
import { MODULE_KEYS, MODULE_DISPLAY_LABELS } from "@/lib/modules";
import {
  DollarSign,
  BarChart2,
  TrendingUp,
  FileText,
  Building2,
  CreditCard,
  Target,
  Users,
  BookOpen,
  Puzzle,
  Zap,
  Settings,
} from "lucide-react";

interface ModulesTabProps {
  enabledModules: string[];
  toggleModule: (module: string) => void;
  onEnableAll?: () => void;
}

export default function ModulesTab({ enabledModules, toggleModule, onEnableAll }: ModulesTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const MODULE_METADATA: Record<string, { icon: React.ReactNode; desc: string; category: string }> = {
    "Income & Expenses": { icon: <DollarSign className="w-4 h-4" />, desc: "Track daily revenue, recurring debits, and cash flow", category: "Core Cashflow" },
    "Budget": { icon: <BarChart2 className="w-4 h-4" />, desc: "Set spending limits and receive over-budget alerts", category: "Planning" },
    "Investments": { icon: <TrendingUp className="w-4 h-4" />, desc: "Manage Stocks, Mutual Funds, Bonds, FnO & Forex portfolios", category: "Wealth" },
    "Tax & Reports": { icon: <FileText className="w-4 h-4" />, desc: "India-first tax center, fiscal reports, and export packs", category: "Compliance" },
    "Alt Assets": { icon: <Building2 className="w-4 h-4" />, desc: "Track Real Estate, Gold, Startup equity, & Collectibles", category: "Wealth" },
    "Liabilities": { icon: <CreditCard className="w-4 h-4" />, desc: "Monitor Loans, EMIs, Mortgages, and Outstanding Debt", category: "Debt" },
    "Goals": { icon: <Target className="w-4 h-4" />, desc: "Target savings milestones and track progress live", category: "Planning" },
    "Family Management": { icon: <Users className="w-4 h-4" />, desc: "Coordinate household budgets and member transfers", category: "Household" },
    "Ledger": { icon: <BookOpen className="w-4 h-4" />, desc: "Immutable audit trail of all balance adjustments", category: "Audit" },
  };

  const categories = ["All", "Core Cashflow", "Planning", "Wealth", "Debt", "Compliance", "Household", "Audit"];

  const handleEnableAllClick = () => {
    if (onEnableAll) {
      onEnableAll();
    }
  };

  const filteredModules = MODULE_KEYS.filter((key) => {
    if (selectedCategory === "All") return true;
    const cat = MODULE_METADATA[key]?.category || "General";
    return cat === selectedCategory;
  });

  const activeCount = MODULE_KEYS.filter((key) => enabledModules.includes(key)).length;

  return (
    <div className="max-w-4xl space-y-5 animate-fade-in">
      <div className="glass-card p-5 md:p-6 rounded-2xl relative overflow-hidden bg-gradient-to-br from-cyan-950/20 via-slate-900/40 to-slate-950/80 border border-cyan-500/20 shadow-xl space-y-5">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 to-indigo-500" />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Module Visibility</h2>
                <span className="text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  {activeCount} / {MODULE_KEYS.length} Active
                </span>
              </div>
              <p className="text-xs text-[--text-muted]">Customize active workspace modules without deleting data.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnableAllClick}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" /> Enable All
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-cyan-500 text-black shadow-sm font-bold"
                    : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Grid of Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredModules.map((module) => {
            const displayLabel = MODULE_DISPLAY_LABELS[module];
            const isEnabled = enabledModules.includes(module);
            const meta = MODULE_METADATA[module] || { icon: <Settings className="w-4 h-4" />, desc: "Module feature section", category: "General" };

            return (
              <div
                key={module}
                className={`p-4 rounded-xl border transition-all duration-200 flex items-start justify-between gap-3 ${
                  isEnabled
                    ? "bg-white/[0.03] border-cyan-500/30 shadow-[0_2px_12px_rgba(6,182,212,0.06)]"
                    : "bg-black/20 border-white/5 opacity-60 hover:opacity-90"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white truncate">{displayLabel}</h3>
                      <span className="text-[0.5625rem] font-medium uppercase px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10 shrink-0">
                        {meta.category}
                      </span>
                    </div>
                    <p className="text-[0.6875rem] text-[--text-muted] mt-0.5 leading-tight">{meta.desc}</p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={`Toggle module ${displayLabel}`}
                  onClick={() => toggleModule(module)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none mt-1 ${
                    isEnabled ? "bg-cyan-500" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      isEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
