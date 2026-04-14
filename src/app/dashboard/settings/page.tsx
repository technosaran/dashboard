"use client";

import { useEffect, useState, useRef, startTransition } from "react";
import { useUser } from "@/context/user-context";

export default function SettingsPage() {
  const { username, setUsername, loading, isSyncing } = useUser();
  const [input, setInput] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const prevIsSyncingRef = useRef(false);

  // Sync internal input state with context once loaded
  useEffect(() => {
    if (!loading && !initializedRef.current) {
      startTransition(() => setInput(username));
      initializedRef.current = true;
    }
  }, [loading, username]);

  // Sync internal input state if username changes from external broadcast
  useEffect(() => {
    if (initializedRef.current && username !== input && !isSyncing) {
      startTransition(() => setInput(username));
    }
  }, [username, input, isSyncing]);

  // Update lastSaved when sync completes
  useEffect(() => {
    if (prevIsSyncingRef.current && !isSyncing) {
      startTransition(() => setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })));
    }
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInput(newVal);
    
    // Update context IMMEDIATELY for real-time UI everywhere
    setUsername(newVal);
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
        <div
          className="glass-card-static p-6 md:p-10 relative overflow-hidden"
        >
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: "#a29bfe" }}>
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
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
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
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
                className="input-premium h-14 md:h-12 text-[16px] md:text-sm font-bold"
                placeholder="Enter your name"
              />
              <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your profile name is synchronized across all devices in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
