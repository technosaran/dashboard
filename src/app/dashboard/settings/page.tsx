"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@/context/user-context";

export default function SettingsPage() {
  const { username, setUsername } = useUser();
  const [input, setInput] = useState(username);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInput(username);
  }, [username]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInput(newVal);
    
    if (newVal.trim()) {
      setIsSaving(true);
      setUsername(newVal.trim());
      
      // We use a local timeout just for the "Saving" indicator UX
      if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);
      savingTimeoutRef.current = setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        savingTimeoutRef.current = null;
      }, 1000);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Configure your preferences and profile.
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
                Profile
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Manage your display name
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
                  Saved at {lastSaved}
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
                Username
              </label>
              <input
                type="text"
                value={input}
                onChange={handleChange}
                className="input-premium"
                placeholder="Enter your name"
              />
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                Changes are saved automatically as you type.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
