"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useUser } from "@/context/user-context";

export default function SettingsPage() {
  const { username, setUsername, loading } = useUser();
  const [input, setInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // Sync internal input state with context once loaded
  useEffect(() => {
    if (!loading && !initializedRef.current) {
      setInput(username);
      initializedRef.current = true;
    }
  }, [loading, username]);

  // Sync internal input state if username changes from external broadcast
  useEffect(() => {
    if (initializedRef.current && username !== input && !isSaving) {
      setInput(username);
    }
  }, [username]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInput(newVal);
    
    // Update context IMMEDIATELY for real-time UI everywhere
    // This triggers re-renders in other components (like Greetings) instantly
    setUsername(newVal);
    
    setIsSaving(true);
    
    // UI indicator timeout
    if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
    savingTimeoutRef.current = setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      savingTimeoutRef.current = null;
    }, 1200);
  };

  const hour = new Date().getHours();
  const greetingText = useMemo(() => {
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, [hour]);

  return (
    <div>
      {/* Header with Live Greeting Preview */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            {greetingText}, {" "}
            {loading ? (
              <span className="inline-block w-24 h-8 bg-[var(--glass-border)] animate-pulse rounded-lg align-middle" />
            ) : (
              <span className="gradient-text">{username || "User"}</span>
            )}
          </h1>
          <span className="inline-block animate-float text-2xl">
            {hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙"}
          </span>
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Your profile name is synchronized across all devices in real-time.
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
              {isSaving ? (
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
                Your greeting above will update as you type.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
