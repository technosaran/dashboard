"use client";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { User } from "lucide-react";

interface ProfileTabProps {
  input: string;
  username: string;
  isSyncing: boolean;
  lastSaved: string | null;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  baseCurrency?: string;
  theme?: string;
  timezone?: string;
  onSaveSetting?: (key: string, value: unknown, msg: string) => void;
  profile?: any;
  user?: SupabaseUser | null;
}

export default function ProfileTab({
  input,
  username,
  isSyncing,
  lastSaved,
  handleChange,
  handleBlur,
  handleKeyDown,
  profile,
  user,
}: ProfileTabProps) {
  const email = user?.email || profile?.email || (user_id => user_id ? `User (${user_id.slice(0, 8)})` : "Authenticated Session")(user?.id || profile?.id);
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.full_name || profile?.username || username || "arthaX User";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile?.avatar_url;
  const userId = user?.id || profile?.id || "N/A";
  const rawCreatedAt = user?.created_at || profile?.created_at;
  const createdAt = rawCreatedAt
    ? new Date(rawCreatedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Active Session";

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Profile & Account Identity Card */}
      <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden bg-gradient-to-br from-indigo-950/30 via-slate-900/50 to-slate-950/90 border border-indigo-500/20 shadow-2xl space-y-6">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl shadow-inner">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Logged-in User Profile</h2>
              <p className="text-xs text-[--text-muted]">Active account credentials & identity settings</p>
            </div>
          </div>
          <div>
            {isSyncing ? (
              <div className="flex items-center gap-2 text-[0.625rem] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>Syncing...</span>
              </div>
            ) : lastSaved ? (
              <div className="flex items-center gap-2 text-[0.625rem] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                <span>Saved {lastSaved}</span>
              </div>
            ) : (
              <span className="text-[0.625rem] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Session
              </span>
            )}
          </div>
        </div>

        {/* User Identity Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-16 h-16 rounded-2xl object-cover border border-white/20 shadow-lg shadow-indigo-500/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/25 border border-white/20 shrink-0">
                {input ? input.charAt(0).toUpperCase() : username ? username.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-white">{input || fullName}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Verified Owner
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium">{email}</p>
              <p className="text-[0.6875rem] text-gray-400 font-mono">ID: {userId}</p>
            </div>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5 space-y-1">
            <span className="text-[0.625rem] font-bold text-indigo-400 uppercase tracking-wider block">Auth Method</span>
            <span className="text-xs font-bold text-white block">Google OAuth 2.0 / RLS</span>
            <span className="text-[0.6875rem] text-gray-400 block">Member since {createdAt}</span>
          </div>
        </div>

        {/* Display Name Input */}
        <div className="space-y-2">
          <label htmlFor="display-name-input" className="block text-xs font-black uppercase tracking-wider text-gray-300">
            Display Name / Account Alias
          </label>
          <input
            id="display-name-input"
            type="text"
            value={input}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            maxLength={30}
            className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-gray-600 shadow-inner"
            placeholder="Enter your full name"
          />
          <p className="text-[0.6875rem] text-[--text-muted] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Press Enter or click away to save. Automatically synced to your dashboard header.
          </p>
        </div>

        {/* Login & Security Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Login Email</span>
            <p className="text-xs font-bold text-white truncate">{email}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-gray-400">Security Layer</span>
            <p className="text-xs font-bold text-emerald-400">Row-Level Security (RLS) Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}

