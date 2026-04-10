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
    <div>
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Manage your account preferences and profile identity.
        </p>
      </div>


      {/* Profile Card */}
      <div className="mt-8 max-w-lg animate-fade-in-up delay-1">
        <div
          className="glass-card-static"
          style={{ padding: "28px", position: "relative", overflow: "hidden" }}
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
            <div className="ml-auto flex items-center gap-2">
              {isSyncing ? (
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[--text-muted]">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  Saving...
                </div>
              ) : lastSaved ? (
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[--accent-primary-light]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Sync Complete
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
                className="input-premium"
                placeholder="Enter your name"
                autoFocus
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
