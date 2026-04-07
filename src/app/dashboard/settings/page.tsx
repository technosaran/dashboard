"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/user-context";

export default function SettingsPage() {
  const { username, setUsername } = useUser();
  const [input, setInput] = useState(username);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setInput(username);
  }, [username]);

  const handleSave = async () => {
    if (!input.trim()) return;
    await setUsername(input.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
                onChange={(e) => { setInput(e.target.value); setSaved(false); }}
                className="input-premium"
                placeholder="Enter your name"
              />
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                This name appears in your dashboard greeting.
              </p>
            </div>

            <button
              onClick={handleSave}
              className={saved ? "" : "btn-primary"}
              style={saved ? {
                width: "100%",
                padding: "12px 20px",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "default",
                background: "rgba(85, 239, 196, 0.12)",
                color: "#55efc4",
                border: "1px solid rgba(85, 239, 196, 0.25)",
                transition: "all 0.3s",
              } : {
                width: "100%",
                padding: "12px 20px",
              }}
            >
              {saved ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Saved Successfully
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

