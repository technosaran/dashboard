"use client";

import React from "react";

interface ProfileTabProps {
  input: string;
  username: string;
  isSyncing: boolean;
  lastSaved: string | null;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function ProfileTab({
  input,
  username,
  isSyncing,
  lastSaved,
  handleChange,
  handleBlur,
  handleKeyDown,
}: ProfileTabProps) {
  return (
    <div className="max-w-2xl animate-fade-in-up">
      <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-500/70" />
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[--text-primary]">Profile Identity</h2>
              <p className="text-xs text-[--text-muted]">Update your name and account preferences</p>
            </div>
          </div>
          <div>
            {isSyncing ? (
              <div className="flex items-center gap-2 text-[0.5625rem] font-black uppercase tracking-widest text-[--text-muted]">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="hidden sm:inline">Encrypting...</span>
              </div>
            ) : lastSaved ? (
              <div className="flex items-center gap-2 text-[0.5625rem] font-black uppercase tracking-widest text-emerald-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                <span className="hidden sm:inline">Sync Verified</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Avatar initials badge */}
        <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-white/[0.01] border border-white/5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/20">
            {input ? input.charAt(0).toUpperCase() : (username ? username.charAt(0).toUpperCase() : "?")}
          </div>
          <div>
            <h3 className="text-sm font-black text-white">{input || username || "Anonymous User"}</h3>
            <p className="text-xs text-[--text-muted] font-bold uppercase tracking-wider mt-0.5">Active Account Session</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[--text-muted]">Change Display Name</label>
          <input
            type="text"
            value={input}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            maxLength={30}
            className="input-premium h-14 md:h-12 text-[16px] md:text-sm font-bold w-full"
            placeholder="Enter your name"
          />
          <p className="text-xs mt-3 flex items-center gap-1.5 text-[--text-muted]">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Your profile name is synchronized across all devices in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
