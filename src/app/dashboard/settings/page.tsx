"use client";

import { useState } from "react";
import { useUser } from "@/context/user-context";

export default function SettingsPage() {
  const { username, setUsername } = useUser();
  const [input, setInput] = useState(username);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!input.trim()) return;
    setUsername(input.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Configure your preferences.</p>

      <div className="mt-8 max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setSaved(false); }}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>
          <button
            onClick={handleSave}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              saved
                ? "bg-emerald-500 text-white"
                : "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200"
            }`}
          >
            {saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
