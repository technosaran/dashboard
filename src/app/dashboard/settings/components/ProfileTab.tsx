"use client";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { User, ShieldCheck, CheckCircle2 } from "lucide-react";

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
  const email = user?.email || profile?.email || "Authenticated User";
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.full_name || profile?.username || username || "arthaX User";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile?.avatar_url;
  const rawCreatedAt = user?.created_at || profile?.created_at;
  const createdAt = rawCreatedAt
    ? new Date(rawCreatedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Active Session";

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div className="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden bg-gradient-to-br from-indigo-950/30 via-slate-900/50 to-slate-950/90 border border-indigo-500/20 shadow-2xl space-y-6">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />

        {/* Card Header & Status */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Account Profile</h2>
              <p className="text-xs text-[--text-muted]">Personal info & identity settings</p>
            </div>
          </div>

          <div>
            {isSyncing ? (
              <div className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>Syncing...</span>
              </div>
            ) : lastSaved ? (
              <div className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span>Saved {lastSaved}</span>
              </div>
            ) : (
              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Session
              </span>
            )}
          </div>
        </div>

        {/* Unified Identity Overview */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-14 h-14 rounded-2xl object-cover border border-white/20 shadow-md"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-md border border-white/20 shrink-0">
                {input ? input.charAt(0).toUpperCase() : username ? username.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">{input || fullName}</h3>
                <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-bold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Verified Owner
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium">{email}</p>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1 text-xs border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5 w-full sm:w-auto">
            <span className="text-gray-400 block text-[0.6875rem]">Member since <strong className="text-white">{createdAt}</strong></span>
            <span className="text-indigo-400 font-medium flex items-center sm:justify-end gap-1 text-[0.6875rem]">
              <ShieldCheck className="w-3.5 h-3.5" /> RLS Secured
            </span>
          </div>
        </div>

        {/* Display Name Input */}
        <div className="space-y-2">
          <label htmlFor="display-name-input" className="block text-xs font-bold uppercase tracking-wider text-gray-300">
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
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-medium outline-none focus:border-indigo-500 transition-all placeholder:text-gray-600 shadow-inner"
            placeholder="Enter your full name"
          />
          <p className="text-[0.6875rem] text-[--text-muted] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Press Enter or click away to save. Automatically synced to your dashboard header.
          </p>
        </div>
      </div>
    </div>
  );
}
