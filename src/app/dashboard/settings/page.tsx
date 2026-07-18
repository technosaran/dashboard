"use client";

import { useEffect, useState, useRef, startTransition, useMemo } from "react";
import { mutate as globalMutate } from "swr";
import { useUser } from "@/context/user-context";
import { resetUserData, updateSettings, generateTelegramLinkCode } from "./actions";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";
import type { FinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS, MODULE_DISPLAY_LABELS } from "@/lib/modules";
import dynamic from "next/dynamic";
import { exportToCSV } from "@/lib/export-csv";

const ReportDownloadButton = dynamic(
  () => import("../components/ReportDownloadButton"),
  { ssr: false }
);

type TabKey = "profile" | "modules" | "defaults" | "exports" | "danger" | "status" | "integrations";

export default function SettingsPage() {
  const { username, setUsername, loading, isSyncing } = useUser();
  const { data, mutate } = useFinanceData();
  const {
    profile,
    accounts = [],
    transactions = [],
    incomes = [],
    expenses = [],
    stockTrades = [],
    mutualFundTrades = [],
    bondTransactions = [],
    forexTrades = [],
    fnoTrades = []
  } = data || {};
  const [input, setInput] = useState(username);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const prevIsSyncingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [isGmailSyncing, setIsGmailSyncing] = useState(false);

  const handleGmailSync = async () => {
    setIsGmailSyncing(true);
    try {
      const res = await fetch("/api/transactions/gmail-sync", { method: "POST" });
      const resData = await res.json();
      if (!res.ok) {
        toast.error(resData.error || "Gmail sync failed");
      } else {
        if (resData.count > 0) {
          toast.success(`Sync successful! Processed ${resData.count} new transaction alerts.`);
          mutate();
        } else {
          toast.success("Sync completed. No new transaction alerts found.");
        }
      }
    } catch {
      toast.error("An error occurred during Gmail synchronization");
    } finally {
      setIsGmailSyncing(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const gmailStatus = params.get("gmail");
      if (gmailStatus) {
        setActiveTab("integrations");
        
        const url = new URL(window.location.href);
        url.searchParams.delete("gmail");
        url.searchParams.delete("reason");
        window.history.replaceState({}, "", url.toString());

        if (gmailStatus === "success") {
          toast.success("Gmail account linked successfully!");
          mutate();
        } else {
          const reason = params.get("reason") || "Unknown error";
          toast.error(`Failed to link Gmail: ${reason}`);
        }
      }
    }
  }, [mutate]);

  const [diagnostics, setDiagnostics] = useState<{ name: string; status: string; latency: string; code: number; error?: string }[]>([]);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  const runDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      const { checkApiHealth } = await import("./actions");
      const res = await checkApiHealth();
      if (res.success && res.results) {
        setDiagnostics(res.results);
      } else {
        toast.error("Failed to run diagnostics");
      }
    } catch {
      toast.error("An error occurred during diagnostics");
    } finally {
      setRunningDiagnostics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "status" && diagnostics.length === 0) {
      runDiagnostics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const defaultAccounts = profile?.default_accounts || {};
  const baseCurrency = profile?.base_currency || "INR";
  const theme = profile?.theme || "system";
  const timezone = profile?.timezone || "Asia/Kolkata";
  const enabledModules = useMemo(() => {
    const raw = profile?.enabled_modules || [...MODULE_KEYS];
    const populated = [...raw] as string[];
    
    // Bidirectional fallback mapping for Cashflow
    if (raw.includes("Income & Expenses")) {
      populated.push("Income", "Expenses");
    } else if (raw.includes("Income") || raw.includes("Expenses")) {
      populated.push("Income & Expenses");
    }
    
    // Bidirectional fallback mapping for Investments
    if (raw.includes("Investments")) {
      populated.push("Stocks", "Mutual Funds", "Bonds", "FnO", "Forex");
    } else if (
      raw.includes("Stocks") || 
      raw.includes("Mutual Funds") || 
      raw.includes("Bonds") || 
      raw.includes("FnO") || 
      raw.includes("Forex")
    ) {
      populated.push("Investments");
    }
    
    return populated;
  }, [profile]);

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
    const raw = profile?.enabled_modules || [...MODULE_KEYS];
    let newModules: string[];
    
    if (module === "Income & Expenses") {
      const isEnabled = raw.includes("Income & Expenses") || raw.includes("Income") || raw.includes("Expenses");
      newModules = isEnabled
        ? raw.filter(m => m !== "Income & Expenses" && m !== "Income" && m !== "Expenses")
        : [...raw.filter(m => m !== "Income" && m !== "Expenses"), "Income & Expenses"];
    } else if (module === "Investments") {
      const isEnabled = raw.includes("Investments") || raw.includes("Stocks") || raw.includes("Mutual Funds") || raw.includes("Bonds") || raw.includes("FnO") || raw.includes("Forex");
      newModules = isEnabled
        ? raw.filter(m => m !== "Investments" && m !== "Stocks" && m !== "Mutual Funds" && m !== "Bonds" && m !== "FnO" && m !== "Forex")
        : [...raw.filter(m => !["Stocks", "Mutual Funds", "Bonds", "FnO", "Forex"].includes(m)), "Investments"];
    } else {
      newModules = raw.includes(module)
        ? raw.filter(m => m !== module)
        : [...raw, module];
    }
    
    // Purge legacy keys from the final list to keep the database tidy
    newModules = newModules.filter(m => !["Income", "Expenses", "Stocks", "Mutual Funds", "Bonds", "FnO", "Forex"].includes(m));
    
    saveSetting("enabled_modules", newModules, `${module} visibility updated`);
  };

  const SECTIONS_REQUIRING_ACCOUNT = [
    { key: "expenses", label: "Expenses Section", icon: "🔴" },
    { key: "income", label: "Income Section", icon: "🟢" },
    { key: "family", label: "Family Transfers", icon: "💜" },
    { key: "forex", label: "Forex Operations", icon: "💱" },
    { key: "goals", label: "Goals & Savings", icon: "🎯" },
    { key: "fno", label: "Futures & Options", icon: "📈" },
    { key: "stocks", label: "Stock Portfolio", icon: "📊" },
    { key: "mutual_funds", label: "Mutual Funds", icon: "🏦" },
    { key: "bonds", label: "Bond Investments", icon: "🔏" },
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
        }, { revalidate: false });

        globalMutate("finance_family", {
          members: [],
          transfers: []
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

      {/* Premium Segmented Toggle Bar */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
        {[
          { key: "profile", label: "Profile" },
          { key: "modules", label: "Modules" },
          { key: "defaults", label: "Defaults" },
          { key: "integrations", label: "Integrations" },
          { key: "exports", label: "Data Exports" },
          { key: "status", label: "System Status" },
          { key: "danger", label: "Danger Zone" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          
          let activeStyles = "bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]";
          if (tab.key === "danger") activeStyles = "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]";

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer ${
                isActive
                  ? `${activeStyles} border border-transparent`
                  : "text-[--text-muted] hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
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

            {/* Avatar initials badge */}
            <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-white/[0.01] border border-white/5">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/20">
                {input ? input.charAt(0).toUpperCase() : "?"}
              </div>
              <div>
                <h3 className="text-sm font-black text-white">{input || "Anonymous User"}</h3>
                <p className="text-[10px] text-[--text-muted] font-bold uppercase tracking-wider mt-0.5">Active Account Session</p>
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
                  <div key={module} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isEnabled ? 'bg-white/[0.03] border-white/10' : 'bg-black/20 border-white/5 opacity-60'}`}>
                     <div className="flex items-center gap-3">
                        <span className="text-base select-none">{MODULE_ICONS[module] || "⚙️"}</span>
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
                    <div className="flex items-center gap-2.5 ml-1">
                      <span className="text-sm select-none">{section.icon}</span>
                      <span className="text-[13px] font-bold text-white">{section.label}</span>
                    </div>
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

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
        <div className="max-w-5xl animate-fade-in-up space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-black text-white tracking-wide">Connected Integrations</h2>
            <p className="text-xs text-[--text-muted]">Link third-party platforms and mobile automation tools to automate transaction capturing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* SMS Webhook Card */}
            <div className="glass-card-static p-6 border border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[--accent-primary]/10 border border-[--accent-primary]/25 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                      📱
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">SMS Webhook</h3>
                      <p className="text-[10px] text-[--text-muted] mt-0.5">Android Sync</p>
                    </div>
                  </div>
                  {profile?.sms_sync_token ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Listening
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-[--text-muted]">
                      Inactive
                    </span>
                  )}
                </div>

                <p className="text-xs text-[--text-secondary] leading-relaxed mb-6">
                  Track GPay, Amazon Pay, Paytm, and bank transactions instantly by forwarding incoming banking SMS alerts using Android automation tools.
                </p>

                {profile?.sms_sync_token ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Your Personal Webhook URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={typeof window !== "undefined" ? `${window.location.origin}/api/transactions/sms-sync?token=${profile.sms_sync_token}` : `/api/transactions/sms-sync?token=${profile.sms_sync_token}`}
                          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-[--text-secondary] outline-none font-mono text-[10px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = typeof window !== "undefined" ? `${window.location.origin}/api/transactions/sms-sync?token=${profile.sms_sync_token}` : `/api/transactions/sms-sync?token=${profile.sms_sync_token}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Webhook URL copied!");
                          }}
                          className="px-3.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21h10.5a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 7.5v11.25A2.25 2.25 0 006.75 21z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-3.5">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-white">Setup Instructions:</h4>
                      <div className="space-y-3 text-[11px] text-[--text-secondary] leading-relaxed">
                        <div className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-black text-cyan-400 text-[10px] flex-shrink-0">1</span>
                          <p>Install **MacroDroid** or **SMS Forwarder** from the Android Google Play Store.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-black text-cyan-400 text-[10px] flex-shrink-0">2</span>
                          <p>Create a rule to trigger when you receive an SMS containing `debited`, `spent`, or `credited` keywords.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center font-black text-cyan-400 text-[10px] flex-shrink-0">3</span>
                          <p>Forward this SMS via a **POST** request to your Webhook URL with a JSON parameter `text`.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="pt-6 border-t border-white/5 mt-6 flex justify-end">
                {profile?.sms_sync_token ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Are you sure you want to rotate your webhook token? Your current forwarding setup on your phone will stop working until you update it.")) return;
                      const newToken = Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join("");
                      const res = await updateSettings({ sms_sync_token: newToken });
                      if (res.error) toast.error(res.error);
                      else toast.success("Token rotated successfully!");
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-[--text-secondary] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                  >
                    Rotate Token
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const newToken = Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join("");
                      const res = await updateSettings({ sms_sync_token: newToken });
                      if (res.error) toast.error(res.error);
                      else toast.success("SMS webhook sync enabled!");
                    }}
                    className="btn-primary px-4 py-2 text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Enable Webhook
                  </button>
                )}
              </div>
            </div>

            {/* Gmail Auto-Sync Card */}
            <div className="glass-card-static p-6 border border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                      ✉️
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">Gmail Auto-Sync</h3>
                      <p className="text-[10px] text-[--text-muted] mt-0.5">iOS & Android Sync</p>
                    </div>
                  </div>
                  {profile?.is_gmail_linked ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Connected
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-[--text-muted]">
                      Disconnected
                    </span>
                  )}
                </div>

                <p className="text-xs text-[--text-secondary] leading-relaxed mb-6">
                  Link your Google account securely via OAuth 2.0 to scan transaction alert emails in the background. Works universally for iPhone and Android.
                </p>

                {profile?.is_gmail_linked ? (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black text-white">Manual Inbox Scan</p>
                        <p className="text-[10px] text-[--text-muted] mt-0.5">Scan your recent unread alerts right now.</p>
                      </div>
                      <button
                        type="button"
                        disabled={isGmailSyncing}
                        onClick={handleGmailSync}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs font-black text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isGmailSyncing ? (
                          <span className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                        )}
                        Scan Now
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="pt-6 border-t border-white/5 mt-6 flex justify-end">
                {profile?.is_gmail_linked ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Are you sure you want to unlink your Gmail account?")) return;
                      const res = await updateSettings({ gmail_refresh_token: null });
                      if (res.error) toast.error(res.error);
                      else {
                        toast.success("Gmail disconnected.");
                        mutate();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-xs font-bold text-rose-400 active:scale-95 transition-all cursor-pointer"
                  >
                    Disconnect Gmail
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/api/auth/google";
                    }}
                    className="btn-primary px-4 py-2 text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Connect Gmail
                  </button>
                )}
              </div>
            </div>

            {/* Telegram Cash Tracker Card */}
            <div className="glass-card-static p-6 border border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                      💬
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">Telegram Bot</h3>
                      <p className="text-[10px] text-[--text-muted] mt-0.5">Cash Tracker Sync</p>
                    </div>
                  </div>
                  {profile?.telegram_chat_id ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Linked
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-[--text-muted]">
                      Disconnected
                    </span>
                  )}
                </div>

                <p className="text-xs text-[--text-secondary] leading-relaxed mb-6">
                  Log cash or custom expenses instantly by texting your private Telegram Bot. Text <code className="text-cyan-400 font-mono">120 Lunch</code> or <code className="text-cyan-400 font-mono">50 Tea</code>.
                </p>

                {profile?.telegram_chat_id ? (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs">
                      <p className="font-bold">✓ Bot is Active</p>
                      <p className="text-[10px] text-[--text-secondary] mt-0.5">Linked Telegram Chat ID: <code className="font-mono">{profile.telegram_chat_id}</code></p>
                    </div>
                    
                    <div className="pt-2 text-[11px] text-[--text-secondary] leading-relaxed space-y-1.5">
                      <p className="font-bold text-white">Quick Chat Commands:</p>
                      <p>• Text <code className="font-mono text-cyan-400">120 tea</code> to log ₹120 for tea.</p>
                      <p>• Text <code className="font-mono text-cyan-400">/help</code> inside chat to see formatting guidelines.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profile?.telegram_link_code ? (
                      <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400">Your Linking Code</p>
                        <div className="text-lg font-black text-white font-mono tracking-wider">{profile.telegram_link_code}</div>
                        <p className="text-[10px] text-[--text-secondary] leading-relaxed">
                          Open the official Telegram Bot:{" "}
                          <a 
                            href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "SaranFinBot"}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-cyan-400 font-bold underline"
                          >
                            @{process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "SaranFinBot"}
                          </a>
                          , and send this command:
                          <br />
                          <code className="text-cyan-400 font-mono font-bold mt-1.5 block">/link {profile.telegram_link_code}</code>
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[--text-muted]">
                        Generate a link code to connect the official Telegram bot to this account.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-white/5 mt-6 flex justify-end">
                {profile?.telegram_chat_id ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Are you sure you want to disconnect Telegram bot sync?")) return;
                      const res = await updateSettings({ telegram_chat_id: null });
                      if (res.error) toast.error(res.error);
                      else {
                        toast.success("Telegram disconnected.");
                        mutate();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-xs font-bold text-rose-400 active:scale-95 transition-all cursor-pointer"
                  >
                    Disconnect Bot
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await generateTelegramLinkCode();
                      if (res.error) toast.error(res.error);
                      else {
                        toast.success("Link code generated!");
                        mutate();
                      }
                    }}
                    className="btn-primary px-4 py-2 text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    {profile?.telegram_link_code ? "Regenerate Code" : "Generate Code"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Exports Tab */}
      {activeTab === "exports" && (
        <div className="max-w-4xl animate-fade-in-up">
          <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyan-500/70" />
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Data & Statement Exports</h2>
                <p className="text-xs text-[--text-muted]">Download your financial records and asset statements in portable file formats.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PDF Statement */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📄</span> Financial Statement (PDF)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Generate and download a comprehensive monthly financial performance report in PDF.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <ReportDownloadButton />
                </div>
              </div>

              {/* Transactions CSV */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📊</span> Transaction History (CSV)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Export your complete income, expense, and ledger transaction log to spreadsheet-ready CSV format.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => exportToCSV(
                      transactions.map(t => ({
                        date: t.date ? new Date(t.date).toISOString().split('T')[0] : "",
                        description: t.description,
                        type: t.type.toUpperCase(),
                        category: t.category || "Others",
                        amount: t.amount,
                        account: accounts.find(a => a.id === t.account_id)?.name || "N/A"
                      })),
                      "transactions_history",
                      [
                        { key: "date", label: "Date" },
                        { key: "description", label: "Description" },
                        { key: "type", label: "Type" },
                        { key: "category", label: "Category" },
                        { key: "amount", label: "Amount" },
                        { key: "account", label: "Account" }
                      ]
                    )}
                    disabled={!transactions || transactions.length === 0}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Export Transactions ({transactions?.length || 0})
                  </button>
                </div>
              </div>

              {/* Incomes CSV */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>💰</span> Incomes Log (CSV)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Export your detailed income source logs (salary, freelance, dividends) to CSV.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => exportToCSV(
                      incomes.map(i => ({
                        date: i.date ? new Date(i.date).toISOString().split('T')[0] : "",
                        description: i.description,
                        category: i.category,
                        amount: Number(i.amount),
                        account: accounts.find(a => a.id === i.account_id)?.name || "Direct Log"
                      })),
                      "incomes_log",
                      [
                        { key: "date", label: "Date" },
                        { key: "description", label: "Description" },
                        { key: "category", label: "Category" },
                        { key: "amount", label: "Amount" },
                        { key: "account", label: "Account" }
                      ]
                    )}
                    disabled={!incomes || incomes.length === 0}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Export Incomes ({incomes?.length || 0})
                  </button>
                </div>
              </div>

              {/* Expenses CSV */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>💸</span> Expenses Log (CSV)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Export your categorized expenditure and bill payment history to CSV.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => exportToCSV(
                      expenses.map(e => ({
                        date: e.date ? new Date(e.date).toISOString().split('T')[0] : "",
                        description: e.description,
                        category: e.category,
                        amount: Number(e.amount),
                        account: accounts.find(a => a.id === e.account_id)?.name || "Direct Log"
                      })),
                      "expenses_log",
                      [
                        { key: "date", label: "Date" },
                        { key: "description", label: "Description" },
                        { key: "category", label: "Category" },
                        { key: "amount", label: "Amount" },
                        { key: "account", label: "Account" }
                      ]
                    )}
                    disabled={!expenses || expenses.length === 0}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Export Expenses ({expenses?.length || 0})
                  </button>
                </div>
              </div>

              {/* Stock Trades CSV */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📈</span> Stock Trades (CSV)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Export your equities buy/sell executions and charges to CSV.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => exportToCSV(
                      stockTrades.map(s => ({
                        trade_date: s.trade_date ? new Date(s.trade_date).toISOString().split('T')[0] : "",
                        symbol: s.symbol,
                        trade_type: s.trade_type.toUpperCase(),
                        quantity: Number(s.quantity),
                        price: Number(s.price),
                        total_amount: Number(s.total_amount),
                        charges: Number(s.charges || 0)
                      })),
                      "stock_trades",
                      [
                        { key: "trade_date", label: "Date" },
                        { key: "symbol", label: "Symbol" },
                        { key: "trade_type", label: "Type" },
                        { key: "quantity", label: "Quantity" },
                        { key: "price", label: "Price" },
                        { key: "total_amount", label: "Total Amount" },
                        { key: "charges", label: "Charges" }
                      ]
                    )}
                    disabled={!stockTrades || stockTrades.length === 0}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Export Stock Trades ({stockTrades?.length || 0})
                  </button>
                </div>
              </div>

              {/* Mutual Fund Trades CSV */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🏦</span> Mutual Fund Trades (CSV)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Export your SIP and lumpsum mutual fund transaction logs to CSV.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => exportToCSV(
                      mutualFundTrades.map(m => ({
                        date: m.date ? new Date(m.date).toISOString().split('T')[0] : "",
                        fund_name: m.fund_name,
                        trade_type: m.trade_type.toUpperCase(),
                        units: Number(m.units),
                        nav: Number(m.nav),
                        amount: Number(m.amount)
                      })),
                      "mutual_fund_trades",
                      [
                        { key: "date", label: "Date" },
                        { key: "fund_name", label: "Fund Name" },
                        { key: "trade_type", label: "Type" },
                        { key: "units", label: "Units" },
                        { key: "nav", label: "NAV" },
                        { key: "amount", label: "Amount" }
                      ]
                    )}
                    disabled={!mutualFundTrades || mutualFundTrades.length === 0}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Export MF Trades ({mutualFundTrades?.length || 0})
                  </button>
                </div>
              </div>

              {/* Bond Transactions CSV */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🔏</span> Bond Transactions (CSV)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Export your fixed-income and bond subscription/sale logs to CSV.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => exportToCSV(
                      bondTransactions.map(b => ({
                        transaction_date: b.transaction_date ? new Date(b.transaction_date).toISOString().split('T')[0] : "",
                        bond_id: b.bond_id,
                        transaction_type: b.transaction_type,
                        quantity: Number(b.quantity),
                        price_per_bond: Number(b.price_per_bond),
                        amount: Number(b.amount)
                      })),
                      "bond_transactions",
                      [
                        { key: "transaction_date", label: "Date" },
                        { key: "bond_id", label: "Bond ID" },
                        { key: "transaction_type", label: "Type" },
                        { key: "quantity", label: "Quantity" },
                        { key: "price_per_bond", label: "Price Per Bond" },
                        { key: "amount", label: "Amount" }
                      ]
                    )}
                    disabled={!bondTransactions || bondTransactions.length === 0}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Export Bond Txns ({bondTransactions?.length || 0})
                  </button>
                </div>
              </div>

              {/* Forex Trades CSV */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>💱</span> Forex Trades (CSV)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Export your currency pair trades, entry/exit levels, and PnL to CSV.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => exportToCSV(
                      forexTrades.map(f => ({
                        trade_date: f.trade_date ? new Date(f.trade_date).toISOString().split('T')[0] : "",
                        pair: f.pair,
                        trade_type: f.trade_type,
                        lot_size: Number(f.lot_size),
                        entry_price: Number(f.entry_price),
                        exit_price: Number(f.exit_price || 0),
                        pnl: Number(f.pnl || 0)
                      })),
                      "forex_trades",
                      [
                        { key: "trade_date", label: "Date" },
                        { key: "pair", label: "Pair" },
                        { key: "trade_type", label: "Type" },
                        { key: "lot_size", label: "Lot Size" },
                        { key: "entry_price", label: "Entry Price" },
                        { key: "exit_price", label: "Exit Price" },
                        { key: "pnl", label: "PnL" }
                      ]
                    )}
                    disabled={!forexTrades || forexTrades.length === 0}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Export Forex Trades ({forexTrades?.length || 0})
                  </button>
                </div>
              </div>

              {/* FnO Trades CSV */}
              <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📊</span> FnO Trades (CSV)
                  </h3>
                  <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                    Export your futures & options derivatives trading history to CSV.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => exportToCSV(
                      fnoTrades.map(f => ({
                        trade_date: f.trade_date ? new Date(f.trade_date).toISOString().split('T')[0] : "",
                        symbol: f.symbol,
                        instrument_type: f.instrument_type,
                        strike_price: f.strike_price ? Number(f.strike_price) : "",
                        expiry_date: f.expiry_date,
                        trade_type: f.trade_type,
                        quantity: Number(f.quantity),
                        entry_price: Number(f.entry_price),
                        exit_price: f.exit_price ? Number(f.exit_price) : "",
                        pnl: Number(f.pnl || 0)
                      })),
                      "fno_trades",
                      [
                        { key: "trade_date", label: "Date" },
                        { key: "symbol", label: "Symbol" },
                        { key: "instrument_type", label: "Type" },
                        { key: "strike_price", label: "Strike" },
                        { key: "expiry_date", label: "Expiry" },
                        { key: "trade_type", label: "Action" },
                        { key: "quantity", label: "Qty" },
                        { key: "entry_price", label: "Entry Price" },
                        { key: "exit_price", label: "Exit Price" },
                        { key: "pnl", label: "PnL" }
                      ]
                    )}
                    disabled={!fnoTrades || fnoTrades.length === 0}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    Export FnO Trades ({fnoTrades?.length || 0})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Status Tab */}
      {activeTab === "status" && (
        <div className="max-w-2xl animate-fade-in-up">
          <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-500/70" />
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">System & API Diagnostics</h2>
                  <p className="text-xs text-[--text-muted]">Check if external service connections or data APIs are rate-limited or offline</p>
                </div>
              </div>
              <button
                onClick={runDiagnostics}
                disabled={runningDiagnostics}
                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                {runningDiagnostics ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                    Pinging...
                  </>
                ) : (
                  "Run Diagnostics"
                )}
              </button>
            </div>

            <div className="space-y-4">
              {diagnostics.map((api, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-bold text-white">{api.name}</span>
                    {api.error && (
                      <span className="text-[10px] text-rose-400 font-mono max-w-sm truncate" title={api.error}>
                        Error: {api.error}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[--text-muted] font-mono">{api.latency}</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                      api.status === "Healthy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      api.status === "Rate Limited" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {api.status}
                    </span>
                  </div>
                </div>
              ))}
              {diagnostics.length === 0 && !runningDiagnostics && (
                <div className="text-center py-6 text-xs text-[--text-muted]">
                  No diagnostics run yet. Click &quot;Run Diagnostics&quot; to check API health.
                </div>
              )}
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
