"use client";

import React from "react";
import { MODULE_KEYS, MODULE_DISPLAY_LABELS } from "@/lib/modules";

interface ModulesTabProps {
  enabledModules: string[];
  toggleModule: (module: string) => void;
}

export default function ModulesTab({ enabledModules, toggleModule }: ModulesTabProps) {
  const MODULE_ICONS: Record<string, string> = {
    "Income & Expenses": "💰",
    "Budget": "📊",
    "Investments": "📈",
    "Alt Assets": "🏢",
    "Liabilities": "💸",
    "Goals": "🎯",
    "Family Management": "👨‍👩‍👧‍👦",
    "Ledger": "📑",
  };

  return (
    <div className="max-w-2xl animate-fade-in-up">
      <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyan-500/70" />
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Module Architecture</h2>
            <p className="text-xs text-[--text-muted]">Enable or disable dashboard sections based on your workflow.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULE_KEYS.map((module) => {
            const displayLabel = MODULE_DISPLAY_LABELS[module];
            const isEnabled = enabledModules.includes(module);
            return (
              <div
                key={module}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  isEnabled ? "bg-white/[0.03] border-white/10" : "bg-black/20 border-white/5 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base select-none">{MODULE_ICONS[module] || "⚙️"}</span>
                  <span className="text-sm font-bold text-white">{displayLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleModule(module)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
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
            );
          })}
        </div>

        <p className="text-xs text-[--text-muted] mt-6 italic font-medium px-2">
          * Disabling a module hides it from the UI but preserves all existing data and historical records.
        </p>
      </div>
    </div>
  );
}
