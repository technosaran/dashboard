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
    "Income & Expenses": { icon: <DollarSign className="w-5 h-5" />, desc: "Track daily revenue, recurring debits, and cash flow", category: "Core Cashflow" },
    "Budget": { icon: <BarChart2 className="w-5 h-5" />, desc: "Set spending limits and receive over-budget alerts", category: "Planning" },
    "Investments": { icon: <TrendingUp className="w-5 h-5" />, desc: "Manage Stocks, Mutual Funds, Bonds, FnO & Forex portfolios", category: "Wealth" },
    "Tax & Reports": { icon: <FileText className="w-5 h-5" />, desc: "India-first tax center, fiscal reports, and CA-ready export packs", category: "Compliance" },
    "Alt Assets": { icon: <Building2 className="w-5 h-5" />, desc: "Track Real Estate, Gold, Startup equity, & Collectibles", category: "Wealth" },
    "Liabilities": { icon: <CreditCard className="w-5 h-5" />, desc: "Monitor Loans, EMIs, Mortgages, and Outstanding Debt", category: "Debt" },
    "Goals": { icon: <Target className="w-5 h-5" />, desc: "Target savings milestones and track progress live", category: "Planning" },
    "Family Management": { icon: <Users className="w-5 h-5" />, desc: "Coordinate household budgets, allowances, and member transfers", category: "Household" },
    "Ledger": { icon: <BookOpen className="w-5 h-5" />, desc: "Immutable audit trail of all balance adjustments", category: "Audit" },
  };

  const categories = ["All", "Core Cashflow", "Planning", "Wealth", "Debt", "Compliance", "Household", "Audit"];

  const handleEnableAllClick = () => {
    if (onEnableAll) {
      onEnableAll();
    } else {
      MODULE_KEYS.forEach((mod) => {
        if (!enabledModules.includes(mod)) toggleModule(mod);
      });
    }
  };

  const filteredModules = MODULE_KEYS.filter((key) => {
    if (selectedCategory === "All") return true;
    const cat = MODULE_METADATA[key]?.category || "General";
    return cat === selectedCategory;
  });

  const activeCount = MODULE_KEYS.filter((key) => enabledModules.includes(key)).length;

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden bg-gradient-to-br from-cyan-950/20 via-slate-900/40 to-slate-950/80 border border-cyan-500/20 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 to-blue-600" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xl shadow-inner">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">Module Architecture & Visibility</h2>
                <span className="text-[0.6875rem] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  {activeCount} / {MODULE_KEYS.length} Active
                </span>
              </div>
              <p className="text-xs text-[--text-muted] mt-0.5">Customize active workspace modules. Disabling hides sections from UI without deleting data.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnableAllClick}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" /> Enable All Modules
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-4">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                    : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredModules.map((module) => {
            const displayLabel = MODULE_DISPLAY_LABELS[module];
            const isEnabled = enabledModules.includes(module);
            const meta = MODULE_METADATA[module] || { icon: <Settings className="w-5 h-5" />, desc: "Module feature section", category: "General" };

            return (
              <div
                key={module}
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-3 ${
                  isEnabled
                    ? "bg-white/[0.03] border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.08)]"
                    : "bg-black/20 border-white/5 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                      {meta.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-white">{displayLabel}</h3>
                        <span className="text-[0.5625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                          {meta.category}
                        </span>
                      </div>
                      <p className="text-[0.6875rem] text-[--text-muted] mt-1 leading-relaxed">{meta.desc}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Toggle module ${displayLabel}`}
                    onClick={() => toggleModule(module)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                      isEnabled ? "bg-cyan-500" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-xs text-[--text-muted]">
          <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Disabling a module instantly updates your sidebar and dashboard widgets while preserving database integrity.</span>
        </div>
      </div>
    </div>
  );
}
