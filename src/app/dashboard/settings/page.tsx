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

  const trimmedInput = input.trim();
  const canSave = Boolean(trimmedInput) && trimmedInput !== username;

  const handleSave = () => {
    if (!trimmedInput) {
      return;
    }

    setUsername(trimmedInput);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-full flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-white/[0.04] p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
            Preferences
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Shape the workspace around you
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">
            Personal details are stored locally so the dashboard feels familiar every
            time you come back.
          </p>
        </div>

        <div className="rounded-full border border-[var(--border-strong)] bg-[rgba(88,213,170,0.12)] px-4 py-2 text-sm font-medium text-[var(--accent)]">
          Local profile only
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="app-panel rounded-[30px] p-6 sm:p-7">
          <div className="border-b border-white/8 pb-5">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Profile</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Update the name used in greetings and the dashboard header.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
                Display name
              </label>
              <input
                type="text"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setSaved(false);
                }}
                className="mt-3 w-full rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--border-strong)] focus:bg-white/[0.08]"
                placeholder="Enter a short display name"
              />
            </div>

            <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Current welcome line</p>
              <p className="mt-3 text-lg font-semibold text-white">
                Good evening, {trimmedInput || "User"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Keeping this short helps headings stay clean across desktop and mobile.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                  saved
                    ? "bg-[var(--accent)] text-slate-950"
                    : "bg-[linear-gradient(135deg,rgba(88,213,170,0.94),rgba(120,199,255,0.9))] text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                }`}
              >
                {saved ? "Saved" : "Save changes"}
              </button>

              <button
                onClick={() => {
                  setInput(username);
                  setSaved(false);
                }}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="metric-tile rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Design notes</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              The interface now leans calmer and brighter
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">
              Soft glass panels, mint highlights, and warmer contrast make dense finance
              screens easier to scan without feeling cold.
            </p>
          </div>

          <div className="app-panel-soft rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">What is stored</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted-strong)]">
              <li className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3">
                Your display name is saved in local storage for quick personalization.
              </li>
              <li className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3">
                Account and transfer data continue to come from Supabase in real time.
              </li>
              <li className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3">
                You can change this name anytime without affecting your backend records.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
