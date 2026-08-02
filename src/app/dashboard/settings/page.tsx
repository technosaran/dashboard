"use client";

import { useEffect, useState, useRef, startTransition, useMemo } from "react";
import { mutate as globalMutate } from "swr";
import { useUser } from "@/context/user-context";
import { resetUserData, updateSettings } from "./actions";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";
import type { FinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS } from "@/lib/modules";

import ProfileTab from "./components/ProfileTab";
import ModulesTab from "./components/ModulesTab";
import DefaultsTab from "./components/DefaultsTab";
import ImportsTab from "./components/ImportsTab";
import ExportsTab from "./components/ExportsTab";
import IntegrationsTab from "./components/IntegrationsTab";
import SystemStatusTab from "./components/SystemStatusTab";
import DangerZoneTab from "./components/DangerZoneTab";

type TabKey = "profile" | "modules" | "defaults" | "imports" | "integrations" | "exports" | "status" | "danger";

interface NavigationCategory {
  category: string;
  items: {
    key: TabKey;
    label: string;
    icon: string;
    badge?: string;
    description: string;
  }[];
}

export default function SettingsPage() {
  const { user, username, setUsername, loading, isSyncing } = useUser();
  const { data, mutate } = useFinanceData();
  const { profile, accounts = [] } = data || {};

  const [input, setInput] = useState(username);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const prevIsSyncingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [searchQuery, setSearchQuery] = useState("");

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    if (typeof window !== "undefined") {
      const mainEl = document.getElementById("main-content");
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const gmailStatus = params.get("gmail");
      if (gmailStatus) {
        handleTabChange("integrations");
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
  const theme = profile?.theme || "dark";
  const timezone = profile?.timezone || "Asia/Kolkata";

  const enabledModules = useMemo(() => {
    const raw = profile?.enabled_modules || [...MODULE_KEYS];
    const populated = [...raw] as string[];

    if (raw.includes("Income & Expenses")) {
      populated.push("Income", "Expenses");
    } else if (raw.includes("Income") || raw.includes("Expenses")) {
      populated.push("Income & Expenses");
    }

    if (raw.includes("Investments")) {
      populated.push("Stocks", "Mutual Funds", "Bonds", "FnO", "Forex", "Crypto");
    } else if (
      raw.includes("Stocks") ||
      raw.includes("Mutual Funds") ||
      raw.includes("Bonds") ||
      raw.includes("FnO") ||
      raw.includes("Forex") ||
      raw.includes("Crypto")
    ) {
      populated.push("Investments");
    }

    return populated;
  }, [profile]);

  useEffect(() => {
    if (!loading && !isSyncing) {
      setInput(username);
    }
  }, [loading, username, isSyncing]);

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

  const saveSetting = async (key: string, value: unknown, successMessage: string) => {
    const optimisticProfile = {
      username: profile?.username || "",
      base_currency: key === "base_currency" ? (value as string) : baseCurrency,
      theme: key === "theme" ? (value as string) : theme,
      timezone: key === "timezone" ? (value as string) : timezone,
      enabled_modules: key === "enabled_modules" ? (value as string[]) : enabledModules,
      default_accounts: key === "default_accounts" ? (value as Record<string, string | null>) : defaultAccounts,
    };

    mutate((prev: FinanceData | undefined) => (prev ? { ...prev, profile: optimisticProfile as any } : prev), false);

    const res = await updateSettings({ [key]: value });
    if (res.error) {
      toast.error(res.error);
      mutate();
    } else {
      toast.success(successMessage);
      mutate();
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
        ? raw.filter((m) => m !== "Income & Expenses" && m !== "Income" && m !== "Expenses")
        : [...raw.filter((m) => m !== "Income" && m !== "Expenses"), "Income & Expenses"];
    } else if (module === "Investments") {
      const isEnabled =
        raw.includes("Investments") ||
        raw.includes("Stocks") ||
        raw.includes("Mutual Funds") ||
        raw.includes("Bonds") ||
        raw.includes("FnO") ||
        raw.includes("Forex");
      newModules = isEnabled
        ? raw.filter(
            (m) => m !== "Investments" && m !== "Stocks" && m !== "Mutual Funds" && m !== "Bonds" && m !== "FnO" && m !== "Forex"
          )
        : [...raw.filter((m) => !["Stocks", "Mutual Funds", "Bonds", "FnO", "Forex"].includes(m)), "Investments"];
    } else {
      newModules = raw.includes(module) ? raw.filter((m) => m !== module) : [...raw, module];
    }

    newModules = newModules.filter(
      (m) => !["Income", "Expenses", "Stocks", "Mutual Funds", "Bonds", "FnO", "Forex"].includes(m)
    );

    saveSetting("enabled_modules", newModules, `${module} visibility updated`);
  };

  const handleEnableAllModules = () => {
    saveSetting("enabled_modules", [...MODULE_KEYS], "All dashboard modules enabled!");
  };

  const SECTIONS_REQUIRING_ACCOUNT = [
    { key: "expenses", label: "Expenses", icon: "💳" },
    { key: "income", label: "Income", icon: "💰" },
    { key: "family", label: "Family Transfers", icon: "💜" },
    { key: "goals", label: "Goals & Savings", icon: "🎯" },
    { key: "stocks", label: "Stock Portfolio", icon: "📊" },
    { key: "mutual_funds", label: "Mutual Funds", icon: "🏦" },
    { key: "bonds", label: "Bond Investments", icon: "🔏" },
    { key: "fno", label: "Futures & Options", icon: "📈" },
    { key: "forex", label: "Forex Operations", icon: "💱" },
  ];

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

        mutate(
          {
            profile: profile || null,
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
          },
          { revalidate: false }
        );

        globalMutate(
          "finance_family",
          { members: [], transfers: [] },
          { revalidate: false }
        );

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

  const NAV_CATEGORIES: NavigationCategory[] = useMemo(() => [
    {
      category: "Account & Workspace",
      items: [
        { key: "profile", label: "Profile & Identity", icon: "👤", description: "Display name & account identity" },
        { key: "modules", label: "Module Visibility", icon: "🧩", badge: `${enabledModules.length} Active`, description: "Enable or hide dashboard modules" },
        { key: "defaults", label: "Default Bank Accounts", icon: "⚙️", description: "Default payment nodes per feature" },
      ],
    },
    {
      category: "Data & Storage",
      items: [
        { key: "imports", label: "Data Imports", icon: "📥", badge: "2 Parsers", description: "Bank statement PDF & CAS parser" },
        { key: "exports", label: "Data Exports", icon: "📤", badge: "10 Formats", description: "CSV exports & custom reports" },
      ],
    },
    {
      category: "AI & Integrations",
      items: [
        {
          key: "integrations",
          label: "Connected Services",
          icon: "⚡",
          badge: profile?.telegram_chat_id ? "Active" : "Ready",
          description: "Telegram Assistant & Gemini AI",
        },
      ],
    },
    {
      category: "System & Safety",
      items: [
        { key: "status", label: "System Status", icon: "🟢", description: "API health & latency checks" },
        { key: "danger", label: "Danger Zone", icon: "⚠️", description: "Reset workspace & delete data" },
      ],
    },
  ], [enabledModules.length, profile?.telegram_chat_id]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return NAV_CATEGORIES;
    const q = searchQuery.toLowerCase().trim();
    return NAV_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.key.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [searchQuery, NAV_CATEGORIES]);

  const totalMatchingItems = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [filteredCategories]);

  const mobileNavItems = useMemo(() => {
    return filteredCategories.flatMap((c) => c.items);
  }, [filteredCategories]);

  const activeTabMeta = useMemo(() => {
    return NAV_CATEGORIES.flatMap((category) => category.items).find((item) => item.key === activeTab);
  }, [NAV_CATEGORIES, activeTab]);

  useEffect(() => {
    if (!searchQuery.trim() || mobileNavItems.length === 0) return;
    const hasActiveTab = mobileNavItems.some((item) => item.key === activeTab);
    if (!hasActiveTab) {
      setActiveTab(mobileNavItems[0].key);
    }
  }, [searchQuery, mobileNavItems, activeTab]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Top Banner Header with Quick Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 md:p-8 rounded-3xl bg-gradient-to-r from-slate-900/80 via-indigo-950/30 to-slate-950/80 border border-white/10 shadow-2xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-wider mb-2">
            <span>⚙️ Workspace Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
            Settings & Preferences
          </h1>
          <p className="mt-1 text-xs md:text-sm text-[--text-muted]">
            Manage account identity, module layout, default bank nodes, imports/exports, and connected AI services.
          </p>
        </div>

        {/* Real-time Settings Search Filter */}
        <div className="w-full md:w-80 relative shrink-0">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search preferences or settings..."
            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-all font-medium shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-3.5 flex items-center text-xs text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Search Result Bar */}
      {searchQuery && (
        <div className="px-4 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
          <span>
            Found <strong>{totalMatchingItems}</strong> setting section{totalMatchingItems !== 1 ? "s" : ""} matching &quot;{searchQuery}&quot;
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-xs font-bold text-indigo-400 hover:underline"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Main Dual Pane Layout Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar Navigation (Desktop md:grid-cols-4) with Independent Overflow Scroll */}
        <div className="hidden md:block md:col-span-4 lg:col-span-3 sticky top-6 max-h-[calc(100vh-5rem)] overflow-y-auto no-scrollbar pr-1">
          <div className="glass-card p-3 rounded-3xl bg-slate-900/60 border border-white/10 shadow-xl space-y-3.5">
            {filteredCategories.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <p className="px-3 text-[0.625rem] font-black uppercase tracking-[0.2em] text-indigo-400/80">
                  {cat.category}
                </p>
                 <div className="space-y-0.5" role="tablist" aria-label={`${cat.category} settings tabs`}>
                  {cat.items.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleTabChange(item.key)}
                         role="tab"
                         aria-selected={isActive}
                         aria-current={isActive ? "page" : undefined}
                         className={`w-full p-2.5 rounded-2xl text-left transition-all duration-200 flex items-center justify-between group cursor-pointer ${
                           isActive
                             ? "bg-gradient-to-r from-indigo-600/30 to-purple-600/20 border border-indigo-500/40 text-white shadow-[0_4px_20px_rgba(99,102,241,0.2)]"
                            : "text-[--text-muted] hover:text-white hover:bg-white/[0.04] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-base select-none shrink-0">{item.icon}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate group-hover:text-white">{item.label}</p>
                            <p className="text-[0.625rem] text-gray-500 truncate">{item.description}</p>
                          </div>
                        </div>
                        {item.badge && (
                          <span
                            className={`text-[0.5625rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 border ${
                              isActive
                                ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-200"
                                : "bg-white/5 border-white/10 text-gray-400"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="p-4 text-center text-xs text-gray-400">
                No settings matching &quot;{searchQuery}&quot; found.
              </div>
            )}
          </div>
        </div>

        {/* Mobile Horizontal Sticky Pill Scrollbar (< md) */}
        <div className="md:hidden sticky top-0 z-20 w-full overflow-x-auto no-scrollbar scroll-smooth py-2 bg-[#0b0f19]/90 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-900/80 border border-white/10 p-2 w-max min-w-full" role="tablist" aria-label="Settings tabs">
            {mobileNavItems.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0 transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30"
                      : "text-gray-400 hover:text-white bg-white/5 border border-transparent"
                  }`}
                >
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {mobileNavItems.length === 0 && (
              <span className="text-xs text-gray-400 px-3 py-2">No matching settings tab.</span>
            )}
          </div>
        </div>

        {/* Right Main Content Canvas (Desktop md:grid-cols-8) */}
        <div className="col-span-1 md:col-span-8 lg:col-span-9 min-w-0">
          <div className="glass-card rounded-3xl border border-white/10 bg-slate-900/45 p-4 sm:p-5 md:p-6 shadow-xl">
            {activeTabMeta && (
              <div className="mb-5 border-b border-white/10 pb-4">
                <p className="text-[0.625rem] font-black uppercase tracking-[0.2em] text-indigo-400/90">
                  {activeTabMeta.label}
                </p>
                <p className="mt-1 text-xs text-[--text-muted]">{activeTabMeta.description}</p>
              </div>
            )}

            {mobileNavItems.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center">
                <p className="text-sm font-bold text-white">No settings match your search.</p>
                <p className="mt-1 text-xs text-[--text-muted]">Try a different keyword or clear the search filter.</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-bold text-indigo-300 transition-all hover:bg-indigo-500/20"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <>
                {activeTab === "profile" && (
            <ProfileTab
              input={input}
              username={username}
              isSyncing={isSyncing}
              lastSaved={lastSaved}
              handleChange={handleChange}
              handleBlur={handleBlur}
              handleKeyDown={handleKeyDown}
              baseCurrency={baseCurrency}
              theme={theme}
              timezone={timezone}
              onSaveSetting={saveSetting}
              profile={profile}
              user={user}
            />
                )}

                {activeTab === "modules" && (
            <ModulesTab
              enabledModules={enabledModules}
              toggleModule={toggleModule}
              onEnableAll={handleEnableAllModules}
            />
                )}

                {activeTab === "defaults" && (
            <DefaultsTab
              defaultAccounts={defaultAccounts}
              accounts={accounts}
              handleDefaultAccountChange={handleDefaultAccountChange}
              sectionsRequiringAccount={SECTIONS_REQUIRING_ACCOUNT}
            />
                )}

                {activeTab === "imports" && (
            <ImportsTab accounts={accounts} mutate={mutate} />
                )}

                {activeTab === "exports" && (
            <ExportsTab />
                )}

                {activeTab === "integrations" && (
            <IntegrationsTab profile={profile} mutate={mutate} />
                )}

                {activeTab === "status" && (
            <SystemStatusTab
              diagnostics={diagnostics}
              runningDiagnostics={runningDiagnostics}
              runDiagnostics={runDiagnostics}
            />
                )}

                {activeTab === "danger" && (
            <DangerZoneTab
              handleResetClick={handleResetClick}
              showResetModal={showResetModal}
              setShowResetModal={setShowResetModal}
              resetConfirmText={resetConfirmText}
              setResetConfirmText={setResetConfirmText}
              resetCountdown={resetCountdown}
              isResetting={isResetting}
              handleResetConfirm={handleResetConfirm}
              canExecuteReset={canExecuteReset}
            />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

