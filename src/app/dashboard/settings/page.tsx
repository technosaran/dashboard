"use client";

import { useEffect, useState, useRef, startTransition } from "react";
import { useUser } from "@/context/user-context";
import { resetUserData, updateSettings } from "./actions";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";
import type { FinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS, MODULE_DISPLAY_LABELS } from "@/lib/modules";
import ReportDownloadButton from "../components/ReportDownloadButton";

type TabKey = "profile" | "preferences" | "modules" | "defaults" | "danger";

export default function SettingsPage() {
  const { username, setUsername, loading, isSyncing } = useUser();
  const { data: { profile, accounts }, mutate } = useFinanceData();
  const [input, setInput] = useState(username);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const prevIsSyncingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  const defaultAccounts = profile?.default_accounts || {};
  const baseCurrency = profile?.base_currency || "INR";
  const theme = profile?.theme || "system";
  const timezone = profile?.timezone || "Asia/Kolkata";
  const enabledModules = profile?.enabled_modules || [...MODULE_KEYS];

  // Sync internal input state when user details load/change
  useEffect(() => {
    if (!loading && !isSyncing) {
      setInput(username);
    }
  }, [loading, username, isSyncing]);

  // Update lastSaved when sync completes
  useEffect(() => {
    if (prevIsSyncingRef.current && !isSyncing) {
      startTransition(() =>
        setLastSaved(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        )
      );
    }
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleBlur = () => {
    if (input !== username) {
      setUsername(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  // General optimistic update helper
  const saveSetting = async (key: string, value: unknown, successMessage: string) => {
    const optimisticProfile = {
      username: profile?.username || "",
      base_currency: key === "base_currency" ? value : baseCurrency,
      theme: key === "theme" ? value : theme,
      timezone: key === "timezone" ? value : timezone,
      enabled_modules: key === "enabled_modules" ? value : enabledModules,
      default_accounts: key === "default_accounts" ? value : defaultAccounts,
    };

    mutate((prev: FinanceData | undefined) => (prev ? { ...prev, profile: optimisticProfile } : prev), false);

    const res = await updateSettings({ [key]: value });
    if (res.error) {
      toast.error(res.error);
      mutate(); // rollback
    } else {
      toast.success(successMessage);
      mutate(); // sync
    }
  };

  const handleDefaultAccountChange = (sectionKey: string, accountId: string) => {
    const updatedDefaultAccounts = {
      ...defaultAccounts,
      [sectionKey]: accountId || null,
    };
    saveSetting("default_accounts", updatedDefaultAccounts, "Default account updated");
  };

  const toggleModule = (module: string) => {
    const newModules = enabledModules.includes(module)
      ? enabledModules.filter((m: string) => m !== module)
      : [...enabledModules, module];
    saveSetting("enabled_modules", newModules, `${module} visibility updated`);
  };

  const SECTIONS_REQUIRING_ACCOUNT = [
    { key: "expenses", label: "Expenses Section" },
    { key: "income", label: "Income Section" },
    { key: "family", label: "Family Transfers" },
    { key: "forex", label: "Forex Operations" },
    { key: "goals", label: "Goals & Savings" },
    { key: "fno", label: "Futures & Options" },
    { key: "stocks", label: "Stock Portfolio" },
    { key: "mutual_funds", label: "Mutual Funds" },
    { key: "bonds", label: "Bond Investments" },
  ];

  // Reset confirmation state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetCountdown, setResetCountdown] = useState(0);
  const [hasCountdownStarted, setHasCountdownStarted] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (resetConfirmText === "RESET") {
      if (!hasCountdownStarted) {
        setResetCountdown(3);
        setHasCountdownStarted(true);
      }
    } else {
      setHasCountdownStarted(false);
      setResetCountdown(0);
    }
  }, [resetConfirmText, hasCountdownStarted]);

  useEffect(() => {
    if (resetCountdown <= 0) return;
    const timer = setTimeout(() => setResetCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resetCountdown]);

  const handleResetClick = () => {
    setShowResetModal(true);
    setResetConfirmText("");
    setResetCountdown(0);
    setHasCountdownStarted(false);
  };

  const handleResetConfirm = async () => {
    if (resetConfirmText !== "RESET" || resetCountdown > 0) return;
    setIsResetting(true);
    const toastId = toast.loading("Executing full data erasure...");
    try {
      const result = await resetUserData();
      if (result.error) {
        toast.error(`Reset failed: ${result.error}`, { id: toastId });
      } else {
        toast.success("All data erased successfully", { id: toastId });
        
        // Clear local SWR cache instantly to prevent stale data flashing
        mutate({
          profile: profile || null, // keep profile settings like theme
          accounts: [],
          transactions: [],
          ledgerLogs: [],
          investments: [],
          mutualFunds: [],
          bonds: [],
          alternativeAssets: [],
          stockTrades: [],
          mutualFundTrades: [],
          bondTransactions: [],
          fnoTrades: [],
          incomes: [],
          expenses: [],
          budgets: [],
          goals: [],
          liabilities: [],
          forexAccounts: [],
          forexTrades: [],
          forexTransactions: [],
          recipients: [],
        }, { revalidate: false });

        setTimeout(() => {
          window.location.href = "/dashboard?reset=success";
        }, 1500);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`A system error occurred: ${message}`, { id: toastId });
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  const canExecuteReset = resetConfirmText === "RESET" && resetCountdown <= 0 && !isResetting;

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">
            Settings
          </h1>
          <p className="mt-1 text-[13px] md:text-sm text-[--text-secondary]">
            Manage your account preferences, modules, and database defaults.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ReportDownloadButton />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
        {[
          { key: "profile", label: "Profile" },
          { key: "modules", label: "Modules" },
          { key: "defaults", label: "Defaults" },
          { key: "danger", label: "Danger Zone" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? "bg-[--accent-primary] text-white shadow-lg shadow-indigo-500/20"
                : "bg-white/5 text-[--text-secondary] hover:bg-white/10 hover:text-white border border-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Identity */}
      {activeTab === "profile" && (
        <div className="max-w-2xl animate-fade-in-up">
          <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-500/70" />
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[--text-primary]">Profile Identity</h2>
                  <p className="text-xs text-[--text-muted]">Update your name to change the dashboard greeting</p>
                </div>
              </div>
              <div>
                {isSyncing ? (
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[--text-muted]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="hidden sm:inline">Encrypting...</span>
                  </div>
                ) : lastSaved ? (
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                    <span className="hidden sm:inline">Sync Verified</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[--text-muted]">Change Display Name</label>
              <input
                type="text"
                value={input}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                maxLength={30}
                className="input-premium h-14 md:h-12 text-[16px] md:text-sm font-bold w-full"
                placeholder="Enter your name"
              />
              <p className="text-xs mt-3 flex items-center gap-1.5 text-[--text-muted]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Your profile name is synchronized across all devices in real-time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Module Management */}
      {activeTab === "modules" && (
        <div className="max-w-2xl animate-fade-in-up">
          <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyan-500/70" />
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
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
                  <div key={module} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isEnabled ? 'bg-white/[0.03] border-white/10' : 'bg-black/20 border-white/5 opacity-60'}`}>
                     <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-white/10'}`} />
                        <span className="text-[13px] font-bold text-white">{displayLabel}</span>
                     </div>
                     <button type="button" 
                       onClick={() => toggleModule(module)}
                       className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEnabled ? 'bg-cyan-500' : 'bg-white/10'}`}
                     >
                       <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                     </button>
                  </div>
                 );
               })}
            </div>
            
            <p className="text-[10px] text-[--text-muted] mt-6 italic font-medium px-2">* Disabling a module hides it from the UI but preserves all existing data and historical records.</p>
          </div>
        </div>
      )}

      {/* Default Accounts Section */}
      {activeTab === "defaults" && (
        <div className="max-w-2xl animate-fade-in-up">
          <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-violet-500/70" />
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <div>
                 <h2 className="text-base font-bold text-white">Default Accounts</h2>
                 <p className="text-xs text-[--text-muted]">Configure the default account to pre-select for each financial section.</p>
              </div>
            </div>

            <div className="space-y-4">
              {SECTIONS_REQUIRING_ACCOUNT.map((section) => {
                const currentVal = defaultAccounts[section.key] || "";
                return (
                  <div key={section.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <span className="text-[13px] font-bold text-white ml-1">{section.label}</span>
                    <select
                      aria-label={`Default account for ${section.label}`}
                      value={currentVal}
                      onChange={(e) => handleDefaultAccountChange(section.key, e.target.value)}
                      className="bg-[--bg-surface] text-white border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[--accent-primary] min-w-[200px]"
                    >
                      <option value="">None (Select First Available)</option>
                      {accounts.map((acc) => (
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
      )}

      {/* Danger Zone */}
      {activeTab === "danger" && (
        <div className="max-w-2xl animate-fade-in-up">
          <div className="glass-card-static p-6 md:p-10 border-rose-500/20 bg-rose-500/[0.02] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-rose-500/70" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-rose-500">Danger Zone</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500/60 mt-0.5">Destructive Actions</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
              <div>
                <h3 className="text-sm font-bold text-[--text-primary]">Reset Application Data</h3>
                <p className="text-xs text-[--text-muted] mt-1">Erase all transactions, accounts, and investment history permanently.</p>
              </div>
              <button type="button" onClick={handleResetClick} className="btn-danger !h-11 !px-6 whitespace-nowrap shadow-xl shadow-rose-500/20">
                Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowResetModal(false)}>
          <div className="glass-card-static p-8 max-w-md w-full animate-fade-in-up bg-[--bg-surface] border border-rose-500/20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-rose-500">Confirm Data Reset</h3>
                <p className="text-xs text-[--text-muted]">This action is irreversible</p>
              </div>
            </div>
            <p className="text-sm text-[--text-secondary] mb-6 leading-relaxed">
              This will permanently delete <strong className="text-white">all</strong> your financial data, accounts, transactions, and investment history. This action <strong className="text-rose-400">cannot be undone</strong>.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-black uppercase tracking-widest text-[--text-muted] mb-2">Type <span className="text-rose-400">RESET</span> to confirm</label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="input-premium h-12 text-sm font-bold w-full"
                placeholder='Type "RESET" here'
                autoFocus autoComplete="off"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowResetModal(false)} className="flex-1 h-12 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white hover:bg-white/10 transition-all">Cancel</button>
              <button type="button" onClick={handleResetConfirm} disabled={!canExecuteReset} className="flex-1 h-12 rounded-xl bg-rose-500 text-white text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-600 shadow-lg shadow-rose-500/20">
                {isResetting ? "Erasing..." : resetCountdown > 0 ? `Wait ${resetCountdown}s...` : resetConfirmText !== "RESET" ? "Type RESET" : "Erase All Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
