"use client";

import { useEffect, useState, useRef, startTransition, useMemo } from "react";
import { mutate as globalMutate } from "swr";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/user-context";
import { resetUserData, updateSettings } from "./actions";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";
import type { FinanceData } from "@/hooks/use-finance-data";
import { MODULE_KEYS, getCanonicalEnabledModules } from "@/lib/modules";

import ProfileTab from "./components/ProfileTab";
import ModulesTab from "./components/ModulesTab";
import DefaultsTab from "./components/DefaultsTab";
import ImportsTab from "./components/ImportsTab";
import ExportsTab from "./components/ExportsTab";
import IntegrationsTab from "./components/IntegrationsTab";
import SystemStatusTab from "./components/SystemStatusTab";
import DangerZoneTab from "./components/DangerZoneTab";
import AdminClient from "../admin/AdminClient";
import {
  User,
  Puzzle,
  Settings,
  Download,
  Upload,
  Zap,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  DollarSign,
  Users,
  Target,
  BarChart2,
  Landmark,
  Lock,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

type TabKey = "profile" | "modules" | "defaults" | "imports" | "integrations" | "exports" | "status" | "admin" | "danger";

interface NavigationCategory {
  category: string;
  items: {
    key: TabKey;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    description: string;
  }[];
}

export default function SettingsPage() {
  const { user, username, setUsername, loading, isSyncing } = useUser();
  const { data, mutate } = useFinanceData();
  const router = useRouter();
  const { profile, accounts = [] } = data || {};

  const [input, setInput] = useState(username);
  const [prevUsername, setPrevUsername] = useState(username);
  
  if (username !== prevUsername) {
    setPrevUsername(username);
    if (!loading && !isSyncing) {
      setInput(username);
    }
  }

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const prevIsSyncingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [searchQuery, setSearchQuery] = useState("");
  const [prevSearchQuery, setPrevSearchQuery] = useState("");

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
        setTimeout(() => handleTabChange("integrations"), 0);
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
      setTimeout(() => runDiagnostics(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const defaultAccounts = profile?.default_accounts || {};
  const baseCurrency = profile?.base_currency || "INR";
  const theme = profile?.theme || "dark";
  const timezone = profile?.timezone || "Asia/Kolkata";

  const enabledModules = useMemo(() => {
    return getCanonicalEnabledModules(profile?.enabled_modules);
  }, [profile]);

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
      enabled_modules: key === "enabled_modules" ? (value as string[]) : (profile?.enabled_modules || [...MODULE_KEYS] as string[]),
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

  const handleClearAllDefaults = () => {
    saveSetting("default_accounts", {}, "All default accounts cleared");
  };

  const toggleModule = (module: string) => {
    // Work with raw MODULE_KEYS only — never save expanded aliases to the database.
    // getCanonicalEnabledModules expands aliases (e.g. "Income" → "Income & Expenses"),
    // which would re-enable modules that were toggled off.
    const rawModules = profile?.enabled_modules;
    const currentRawKeys = Array.isArray(rawModules) && rawModules.length > 0
      ? rawModules.filter((m: string) => (MODULE_KEYS as readonly string[]).includes(m))
      : [...MODULE_KEYS];
    
    const isCurrentlyEnabled = currentRawKeys.includes(module);
    
    let newModules: string[];
    if (isCurrentlyEnabled) {
      newModules = currentRawKeys.filter((m) => m !== module);
    } else {
      newModules = Array.from(new Set([...currentRawKeys, module]));
    }

    saveSetting("enabled_modules", newModules, `${module} visibility updated`);
  };

  const handleEnableAllModules = () => {
    saveSetting("enabled_modules", [...MODULE_KEYS] as string[], "All dashboard modules enabled!");
  };

  const SECTIONS_REQUIRING_ACCOUNT = [
    { key: "expenses", label: "Expenses", icon: <CreditCard className="w-4 h-4 text-rose-400" /> },
    { key: "income", label: "Income", icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
    { key: "family", label: "Family Transfers", icon: <Users className="w-4 h-4 text-purple-400" /> },
    { key: "goals", label: "Goals & Savings", icon: <Target className="w-4 h-4 text-amber-400" /> },
    { key: "stocks", label: "Stock Portfolio", icon: <BarChart2 className="w-4 h-4 text-cyan-400" /> },
    { key: "mutual_funds", label: "Mutual Funds", icon: <Landmark className="w-4 h-4 text-indigo-400" /> },
    { key: "bonds", label: "Bond Investments", icon: <Lock className="w-4 h-4 text-sky-400" /> },
    { key: "fno", label: "Futures & Options", icon: <TrendingUp className="w-4 h-4 text-emerald-400" /> },
    { key: "forex", label: "Forex Operations", icon: <RefreshCw className="w-4 h-4 text-orange-400" /> },
  ];

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetCountdown, setResetCountdown] = useState(0);
  const [hasCountdownStarted, setHasCountdownStarted] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
          router.push("/dashboard?reset=success");
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

  const activeModulesCount = useMemo(() => {
    return MODULE_KEYS.filter((key) => enabledModules.includes(key)).length;
  }, [enabledModules]);

  const isSuperAdmin = (user?.email || "").toLowerCase().trim() === "iamsaran.ai@gmail.com";

  const NAV_CATEGORIES: NavigationCategory[] = useMemo(() => {
    const base: NavigationCategory[] = [
      {
        category: "Account & Workspace",
        items: [
          { key: "profile", label: "Profile & Identity", icon: <User className="w-4 h-4" />, description: "Display name & account identity" },
          { key: "modules", label: "Module Visibility", icon: <Puzzle className="w-4 h-4" />, badge: `${activeModulesCount} Active`, description: "Enable or hide dashboard modules" },
          { key: "defaults", label: "Default Bank Accounts", icon: <Settings className="w-4 h-4" />, description: "Default payment nodes per feature" },
        ],
      },
      {
        category: "Data & Storage",
        items: [
          { key: "imports", label: "Data Imports", icon: <Download className="w-4 h-4" />, badge: "2 Parsers", description: "Bank statement PDF & CAS parser" },
          { key: "exports", label: "Data Exports", icon: <Upload className="w-4 h-4" />, badge: "10 Formats", description: "CSV exports & custom reports" },
        ],
      },
      {
        category: "AI & Integrations",
        items: [
          {
            key: "integrations",
            label: "Connected Services",
            icon: <Zap className="w-4 h-4" />,
            badge: profile?.telegram_chat_id ? "Active" : "Ready",
            description: "Telegram Assistant & Gemini AI",
          },
        ],
      },
    ];

    if (isSuperAdmin) {
      base.push({
        category: "Developer & Admin",
        items: [
          { key: "admin", label: "Super Admin Studio", icon: <Lock className="w-4 h-4 text-amber-400" />, badge: "Owner Only", description: "Market scrapers, AI tax sync & security logs" },
        ],
      });
    }

    base.push({
      category: "System & Safety",
      items: [
        { key: "status", label: "System Status", icon: <ShieldCheck className="w-4 h-4" />, description: "API health & latency checks" },
        { key: "danger", label: "Danger Zone", icon: <AlertTriangle className="w-4 h-4" />, description: "Reset workspace & delete data" },
      ],
    });

    return base;
  }, [activeModulesCount, profile?.telegram_chat_id, isSuperAdmin]);

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

  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    if (searchQuery.trim() && mobileNavItems.length > 0) {
      const hasActiveTab = mobileNavItems.some((item) => item.key === activeTab);
      if (!hasActiveTab) {
        setActiveTab(mobileNavItems[0].key);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Top Banner Header with Quick Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-5 md:p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-950/90 border border-white/10 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Settings & Preferences
          </h1>
          <p className="mt-1 text-xs text-[--text-muted]">
            Manage account identity, module layout, default payment nodes, imports/exports, and connected AI services.
          </p>
        </div>

        {/* Real-time Settings Search Filter */}
        <div className="w-full md:w-72 relative shrink-0">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings..."
            autoComplete="off"
            name="settings-filter-search"
            aria-label="Search settings"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-all font-medium shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Search Result Bar */}
      {searchQuery && (
        <div className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
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
          <div className="glass-card p-3 rounded-2xl bg-slate-900/60 border border-white/10 shadow-xl space-y-3">
            {filteredCategories.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <p className="px-3 text-[0.625rem] font-bold uppercase tracking-wider text-indigo-400/80">
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
                        className={`w-full px-3 py-2 rounded-xl text-left transition-all duration-200 flex items-center justify-between group cursor-pointer ${
                          isActive
                            ? "bg-indigo-600/30 border border-indigo-500/40 text-white shadow-[0_2px_12px_rgba(99,102,241,0.2)] font-semibold"
                            : "text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-sm shrink-0 flex items-center justify-center text-indigo-400 group-hover:text-indigo-300">{item.icon}</span>
                          <span className="text-xs truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={`text-[0.625rem] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
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
                  <span className="text-sm flex items-center justify-center">{tab.icon}</span>
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
              onClearAllDefaults={handleClearAllDefaults}
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

                {activeTab === "admin" && (
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-amber-500/20 space-y-6 shadow-2xl animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                          Super Admin Command Console
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Dedicated standalone full-page studio for market scrapers, AI tax sync, and security logs.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-xs text-gray-300 space-y-2 font-mono">
                      <div className="flex justify-between items-center text-amber-400 font-sans font-bold">
                        <span>Authorized Developer Account</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">iamsaran.ai@gmail.com</span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-sans">
                        Clicking below opens the dedicated, full-screen Super Admin Console in a standalone workspace.
                      </p>
                    </div>

                    <div className="pt-2">
                      <a
                        href="/dashboard/admin"
                        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 transition-all duration-200 active:scale-95 cursor-pointer"
                      >
                        <Zap className="w-4 h-4 fill-current" />
                        <span>Launch Full-Page Admin Console</span>
                      </a>
                    </div>
                  </div>
                )}

                {activeTab === "danger" && (
            <DangerZoneTab
              handleResetClick={handleResetClick}
              showResetModal={showResetModal}
              setShowResetModal={setShowResetModal}
              resetConfirmText={resetConfirmText}
              setResetConfirmText={(text: string) => {
                setResetConfirmText(text);
                if (text === "RESET") {
                  if (!hasCountdownStarted) {
                    setResetCountdown(3);
                    setHasCountdownStarted(true);
                  }
                } else {
                  setHasCountdownStarted(false);
                  setResetCountdown(0);
                }
              }}
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

