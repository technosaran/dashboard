"use client";

import React from "react";
import Link from "next/link";
import { Settings, Landmark } from "lucide-react";
import type { FinanceData } from "@/hooks/use-finance-data";

interface SectionConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
}

interface DefaultsTabProps {
  defaultAccounts: Record<string, string | null>;
  accounts: FinanceData["accounts"];
  handleDefaultAccountChange: (sectionKey: string, accountId: string) => void;
  onClearAllDefaults?: () => void;
  sectionsRequiringAccount: SectionConfig[];
}

export default function DefaultsTab({
  defaultAccounts,
  accounts = [],
  handleDefaultAccountChange,
  onClearAllDefaults,
  sectionsRequiringAccount,
}: DefaultsTabProps) {
  const hasAccounts = accounts && accounts.length > 0;
  const configuredCount = Object.values(defaultAccounts).filter(Boolean).length;

  const handleClearAllDefaults = () => {
    if (onClearAllDefaults) {
      onClearAllDefaults();
    } else {
      sectionsRequiringAccount.forEach((s) => {
        if (defaultAccounts[s.key]) {
          handleDefaultAccountChange(s.key, "");
        }
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl bg-slate-900/50 border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">Default Payment Accounts</h2>
              <span className="text-[0.6875rem] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                {configuredCount} Configured
              </span>
            </div>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Pre-select the default bank account to auto-fill for each financial section.
            </p>
          </div>
        </div>

        {configuredCount > 0 && (
          <button
            type="button"
            onClick={handleClearAllDefaults}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-gray-400 hover:text-rose-400 text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            Clear All Defaults
          </button>
        )}
      </div>

      {!hasAccounts && (
        <div className="p-6 rounded-3xl glass-card bg-indigo-950/20 border border-indigo-500/30 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-2xl mx-auto">
            <Landmark className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Bank Accounts Found</h3>
          <p className="text-xs text-[--text-muted] max-w-md mx-auto leading-relaxed">
            You haven&apos;t added any bank accounts or wallet nodes yet. Add an account first to set default payment sources.
          </p>
          <Link
            href="/dashboard/accounts"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
          >
            <span>+ Add Bank Account</span>
          </Link>
        </div>
      )}

      {/* Clean 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sectionsRequiringAccount.map((section) => {
          const currentVal = defaultAccounts[section.key] || "";
          const selectedAcc = accounts?.find((a) => a.id === currentVal);

          return (
            <div
              key={section.key}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                selectedAcc
                  ? "bg-white/[0.03] border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.06)]"
                  : "bg-black/20 border-white/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg select-none flex items-center justify-center text-cyan-400">{section.icon}</span>
                  <span className="text-xs font-black text-white tracking-wide">{section.label}</span>
                </div>
                {selectedAcc && (
                  <span className="text-[0.6875rem] font-bold text-cyan-400 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    {selectedAcc.currency} {Number(selectedAcc.balance).toLocaleString()}
                  </span>
                )}
              </div>

              <select
                aria-label={`Default account for ${section.label}`}
                value={currentVal}
                onChange={(e) => handleDefaultAccountChange(section.key, e.target.value)}
                disabled={!hasAccounts}
                className="w-full bg-black/50 text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:border-cyan-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">None (Select First Available)</option>
                {accounts?.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                    {acc.name} ({acc.currency} {Number(acc.balance).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

