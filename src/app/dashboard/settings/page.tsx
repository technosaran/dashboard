"use client";

import { useEffect, useState, useRef, startTransition } from "react";
import { useUser } from "@/context/user-context";
import { resetUserData, updateSettings } from "./actions";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";

export default function SettingsPage() {
  const { username, setUsername, loading, isSyncing } = useUser();
  const { data: { profile }, mutate } = useFinanceData();
  const [input, setInput] = useState(username);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [prevUsername, setPrevUsername] = useState(username);
  const [prevLoading, setPrevLoading] = useState(loading);
  const prevIsSyncingRef = useRef(false);

  // Sync internal input state during render to avoid cascading renders in useEffect
  if (loading !== prevLoading) {
    setPrevLoading(loading);
    if (!loading) {
      setInput(username);
      setPrevUsername(username);
    }
  } else if (username !== prevUsername) {
    setPrevUsername(username);
    if (!isSyncing) {
      setInput(username);
    }
  }

  // Update lastSaved when sync completes
  useEffect(() => {
    if (prevIsSyncingRef.current && !isSyncing) {
      startTransition(() =>
        setLastSaved(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        ),
      );
    }
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  useEffect(() => {
    if (loading) return;

    // Debounce the update to the context/server
    const t = setTimeout(() => {
      if (input !== username) {
        setUsername(input);
      }
    }, 400); // reduced from 500ms

    return () => clearTimeout(t);
  }, [input, username, setUsername, loading]);

  const handleReset = async () => {
    const isConfirmed = confirm(
      "WARNING: This will permanently delete ALL your financial data, accounts, and history. This action cannot be undone. Proceed?",
    );

    if (!isConfirmed) return;

    const toastId = toast.loading("Executing full data erasure...");
    try {
      const result = await resetUserData();

      if (result.error) {
        toast.error(`Reset failed: ${result.error}`, { id: toastId });
      } else {
        toast.success("All data erased successfully", { id: toastId });
        // Force a hard reload to clear all local state and contexts
        setTimeout(() => {
          window.location.href = "/dashboard?reset=success";
        }, 1500);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`A system error occurred: ${message}`, { id: toastId });
    }
  };

  const ALL_MODULES = [
    "Income", "Expenses", "Budget", "Stocks", "Mutual Funds", "Alt Assets", "Bonds", "Liabilities", "Goals", "Family", "Forex", "Ledger"
  ];

  const enabledModules = profile?.settings?.enabled_modules || ALL_MODULES;

  const toggleModule = async (module: string) => {
    const newModules = enabledModules.includes(module)
      ? enabledModules.filter(m => m !== module)
      : [...enabledModules, module];
    
    // Optimistic update
    const optimisticProfile = { ...profile, settings: { ...profile?.settings, enabled_modules: newModules } };
    mutate((prev: any) => ({ ...prev, profile: optimisticProfile }), false);

    const res = await updateSettings({ ...profile?.settings, enabled_modules: newModules });
    if (res.error) {
      toast.error(res.error);
      mutate(); // rollback
    } else {
      toast.success(`${module} visibility updated`);
      mutate(); // full re-fetch to be sure
    }
  };

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] md:text-sm text-[--text-secondary]">
          Manage your account preferences and profile identity.
        </p>
      </div>

      {/* Profile Card */}
      <div className="max-w-2xl animate-fade-in-up delay-1">
        <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
          {/* Top accent */}
          <div
            className="absolute top-0 left-0 right-0"
            style={{
              height: "3px",
              background: "var(--gradient-primary)",
              opacity: 0.7,
            }}
          />

          <div className="flex items-center gap-3 mb-6">
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "rgba(162, 155, 254, 0.12)",
                border: "1px solid rgba(162, 155, 254, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
                style={{ color: "#a29bfe" }}
              >
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2
                className="text-base font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                Profile Identity
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Update your name to change the dashboard greeting
              </p>
            </div>

            {/* Status Indicator */}
            <div className="ml-auto">
              {isSyncing ? (
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[--text-muted]">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="hidden sm:inline">Encrypting...</span>
                  <span className="sm:hidden">Busy</span>
                </div>
              ) : lastSaved ? (
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.5}
                    viewBox="0 0 24 24"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="hidden sm:inline">Sync Verified</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Change Display Name
              </label>
              <input
                type="text"
                value={input}
                onChange={handleChange}
                maxLength={30}
                className="input-premium h-14 md:h-12 text-[16px] md:text-sm font-bold"
                placeholder="Enter your name"
              />
              <p
                className="text-xs mt-3 flex items-center gap-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your profile name is synchronized across all devices in
                real-time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Module Management */}
      <div className="max-w-2xl animate-fade-in-up delay-2">
        <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
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
             {ALL_MODULES.map(module => {
               const displayLabel = module === "Alt Assets" ? "Assets" : module === "Liabilities" ? "Loans" : module;
               return (
                <div key={module} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${enabledModules.includes(module) ? 'bg-white/[0.03] border-white/10' : 'bg-black/20 border-white/5 opacity-60'}`}>
                   <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${enabledModules.includes(module) ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-white/10'}`} />
                      <span className="text-[13px] font-bold text-white">{displayLabel}</span>
                   </div>
                   <button 
                     onClick={() => toggleModule(module)}
                     className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabledModules.includes(module) ? 'bg-cyan-500' : 'bg-white/10'}`}
                   >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabledModules.includes(module) ? 'translate-x-6' : 'translate-x-1'}`} />
                   </button>
                </div>
               );
             })}
          </div>
          
          <p className="text-[10px] text-[--text-muted] mt-6 italic font-medium px-2">* Disabling a module hides it from the UI but preserves all existing data and historical records.</p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="max-w-2xl animate-fade-in-up delay-2">
        <div className="glass-card-static p-6 md:p-10 border-rose-500/20 bg-rose-500/[0.02]">
          <div className="flex items-center gap-3 mb-6">
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "rgba(255, 71, 87, 0.12)",
                border: "1px solid rgba(255, 71, 87, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                className="w-5 h-5 text-rose-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-500">Danger Zone</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500/60 mt-0.5">
                Destructive Actions
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
            <div>
              <h3 className="text-sm font-bold text-[--text-primary]">
                Reset Application Data
              </h3>
              <p className="text-xs text-[--text-muted] mt-1">
                Erase all transactions, accounts, and investment history
                permanently.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="btn-danger !h-11 !px-6 whitespace-nowrap shadow-xl shadow-rose-500/20"
            >
              Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
