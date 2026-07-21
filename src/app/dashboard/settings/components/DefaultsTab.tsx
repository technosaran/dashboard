"use client";

import React from "react";
import type { FinanceData } from "@/hooks/use-finance-data";

interface DefaultsTabProps {
  defaultAccounts: Record<string, string | null>;
  accounts: FinanceData["accounts"];
  handleDefaultAccountChange: (sectionKey: string, accountId: string) => void;
  sectionsRequiringAccount: { key: string; label: string; icon: string }[];
}

export default function DefaultsTab({
  defaultAccounts,
  accounts = [],
  handleDefaultAccountChange,
  sectionsRequiringAccount,
}: DefaultsTabProps) {
  return (
    <div className="max-w-2xl animate-fade-in-up">
      <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-violet-500/70" />
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Default Accounts</h2>
            <p className="text-xs text-[--text-muted]">Configure the default account to pre-select for each financial section.</p>
          </div>
        </div>

        <div className="space-y-4">
          {sectionsRequiringAccount.map((section) => {
            const currentVal = defaultAccounts[section.key] || "";
            return (
              <div key={section.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2.5 ml-1">
                  <span className="text-sm select-none">{section.icon}</span>
                  <span className="text-sm font-bold text-white">{section.label}</span>
                </div>
                <select
                  aria-label={`Default account for ${section.label}`}
                  value={currentVal}
                  onChange={(e) => handleDefaultAccountChange(section.key, e.target.value)}
                  className="bg-[--bg-surface] text-white border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[--accent-primary] min-w-[200px]"
                >
                  <option value="">None (Select First Available)</option>
                  {accounts?.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency} {Number(acc.balance).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
