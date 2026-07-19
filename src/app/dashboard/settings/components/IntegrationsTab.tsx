"use client";

import React from "react";
import QRCode from "react-qr-code";
import { toast } from "react-hot-toast";
import { updateSettings, generateTelegramLinkCode } from "../actions";
import type { FinanceData } from "@/hooks/use-finance-data";

interface IntegrationsTabProps {
  profile: FinanceData["profile"] | undefined;
  isGmailSyncing: boolean;
  handleGmailSync: () => Promise<void>;
  mutate: () => void;
}

export default function IntegrationsTab({
  profile,
  isGmailSyncing,
  handleGmailSync,
  mutate,
}: IntegrationsTabProps) {
  return (
    <div className="max-w-5xl animate-fade-in-up space-y-8">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 border border-white/5 p-6">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-sm">
                ⚡
              </span>
              Connected Integrations
            </h2>
            <p className="text-xs text-[--text-muted] mt-1.5 max-w-lg">
              Automate your financial tracking by linking platforms. Every integration syncs data directly into your ledger in real-time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {[
              { label: "SMS", active: !!profile?.sms_sync_token },
              { label: "Gmail", active: !!profile?.is_gmail_linked },
              { label: "Telegram", active: !!profile?.telegram_chat_id },
            ].map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                  s.active
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-white/5 border border-white/10 text-gray-500"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.active ? "bg-emerald-400" : "bg-gray-600"}`} />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="space-y-6">
        {/* ─── SMS Webhook ─── */}
        <div className="relative group rounded-2xl border border-white/5 bg-gradient-to-br from-[#0d1117] to-[#0a0f16] overflow-hidden hover:border-cyan-500/20 transition-all duration-500">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-cyan-500/0 rounded-l-2xl" />
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-cyan-500/[0.03] rounded-full blur-3xl group-hover:bg-cyan-500/[0.06] transition-all duration-700" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              {/* Left */}
              <div className="flex-1 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(6,182,212,0.12)]">
                      📱
                    </div>
                    {profile?.sms_sync_token && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0d1117] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">SMS Auto-Sync</h3>
                    <p className="text-[10px] text-cyan-400/70 font-semibold uppercase tracking-widest mt-0.5">
                      Android • MacroDroid
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[--text-secondary] leading-relaxed max-w-md">
                  Automatically capture GPay, Amazon Pay, Paytm, and bank transaction alerts by forwarding SMS via Android automation — your spending is logged the instant it happens.
                </p>

                {profile?.sms_sync_token && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                        Webhook Endpoint
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={
                            typeof window !== "undefined"
                              ? `${window.location.origin}/api/transactions/sms-sync?token=${profile.sms_sync_token}`
                              : `/api/transactions/sms-sync?token=${profile.sms_sync_token}`
                          }
                          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] text-[--text-secondary] outline-none font-mono focus:border-cyan-500/30 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url =
                              typeof window !== "undefined"
                                ? `${window.location.origin}/api/transactions/sms-sync?token=${profile.sms_sync_token}`
                                : `/api/transactions/sms-sync?token=${profile.sms_sync_token}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Webhook URL copied!");
                          }}
                          className="px-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 active:scale-95 transition-all cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21h10.5a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 7.5v11.25A2.25 2.25 0 006.75 21z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-white">Quick Setup</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const url =
                              typeof window !== "undefined"
                                ? `${window.location.origin}/api/transactions/sms-sync?token=${profile.sms_sync_token}`
                                : `/api/transactions/sms-sync?token=${profile.sms_sync_token}`;
                            const curl = `curl -X POST ${url} -H "Content-Type: application/json" -d "{\\\"text\\\":\\\"debited 100 for food\\\"}"`;
                            navigator.clipboard.writeText(curl);
                            toast.success("cURL test command copied!");
                          }}
                          className="text-[9px] font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Test cURL
                        </button>
                      </div>
                      <div className="flex gap-3">
                        {[
                          { step: "1", icon: "📥", text: "Install MacroDroid from Play Store" },
                          { step: "2", icon: "⚡", text: "Trigger on SMS with keywords: debited, spent, credited" },
                          { step: "3", icon: "🚀", text: "HTTP POST action to your Webhook URL" },
                        ].map((s) => (
                          <div
                            key={s.step}
                            className="flex-1 p-3 rounded-xl bg-white/[0.02] border border-white/5 relative overflow-hidden hover:border-cyan-500/10 transition-colors"
                          >
                            <div className="absolute top-0 right-0 p-2 opacity-[0.06] text-3xl">{s.icon}</div>
                            <span className="inline-flex w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[9px] font-black items-center justify-center mb-2">
                              {s.step}
                            </span>
                            <p className="text-[10px] text-[--text-secondary] font-medium leading-relaxed">{s.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Action */}
              <div className="flex md:flex-col items-center gap-3 md:pt-2">
                {profile?.sms_sync_token ? (
                  <>
                    <div className="hidden md:flex flex-col items-center gap-1 mb-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Live</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Are you sure you want to rotate your webhook token? Your current forwarding setup on your phone will stop working until you update it."
                          )
                        )
                          return;
                        const newToken = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
                        const res = await updateSettings({ sms_sync_token: newToken });
                        if (res.error) toast.error(res.error);
                        else toast.success("Token rotated successfully!");
                      }}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-[--text-secondary] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Rotate Token
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const newToken = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
                      const res = await updateSettings({ sms_sync_token: newToken });
                      if (res.error) toast.error(res.error);
                      else toast.success("SMS webhook sync enabled!");
                    }}
                    className="btn-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                  >
                    Enable Webhook
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Gmail Auto-Sync ─── */}
        <div className="relative group rounded-2xl border border-white/5 bg-gradient-to-br from-[#0d1117] to-[#0a0f16] overflow-hidden hover:border-rose-500/20 transition-all duration-500">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-rose-500 to-rose-500/0 rounded-l-2xl" />
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-rose-500/[0.03] rounded-full blur-3xl group-hover:bg-rose-500/[0.06] transition-all duration-700" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex-1 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 border border-rose-500/20 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(244,63,94,0.12)]">
                      ✉️
                    </div>
                    {profile?.is_gmail_linked && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0d1117] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">Gmail Auto-Sync</h3>
                    <p className="text-[10px] text-rose-400/70 font-semibold uppercase tracking-widest mt-0.5">
                      Universal • OAuth 2.0
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[--text-secondary] leading-relaxed max-w-md">
                  Securely link your Google account via OAuth 2.0 to automatically scan transaction alert emails in the background. Works on all devices — iPhone, Android, and Desktop.
                </p>

                {profile?.is_gmail_linked && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black text-white">Manual Inbox Scan</p>
                        <p className="text-[10px] text-[--text-muted] mt-0.5">
                          Scan recent unread transaction alerts right now.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isGmailSyncing}
                        onClick={handleGmailSync}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs font-black text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isGmailSyncing ? (
                          <span className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                        )}
                        Scan Now
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex md:flex-col items-center gap-3 md:pt-2">
                {profile?.is_gmail_linked ? (
                  <>
                    <div className="hidden md:flex flex-col items-center gap-1 mb-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Linked</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Are you sure you want to unlink your Gmail account?")) return;
                        const res = await updateSettings({ gmail_refresh_token: null });
                        if (res.error) toast.error(res.error);
                        else {
                          toast.success("Gmail disconnected.");
                          mutate();
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-xs font-bold text-rose-400 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/api/auth/google";
                    }}
                    className="btn-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.2)] flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Connect Gmail
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Telegram Bot ─── */}
        <div className="relative group rounded-2xl border border-white/5 bg-gradient-to-br from-[#0d1117] to-[#0a0f16] overflow-hidden hover:border-blue-500/20 transition-all duration-500">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-500/0 rounded-l-2xl" />
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-500/[0.03] rounded-full blur-3xl group-hover:bg-blue-500/[0.06] transition-all duration-700" />
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex-1 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.12)]">
                      <svg className="w-7 h-7 fill-blue-400" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.9 1.22-5.36 3.56-.51.35-.96.52-1.38.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.41-1.4-.87.03-.24.35-.49.96-.75 3.75-1.63 6.24-2.7 7.48-3.21 3.56-1.48 4.3-1.74 4.79-1.75.11 0 .35.03.5.15.13.11.17.26.19.4z" />
                      </svg>
                    </div>
                    {profile?.telegram_chat_id && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0d1117] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">Telegram Bot</h3>
                    <p className="text-[10px] text-blue-400/70 font-semibold uppercase tracking-widest mt-0.5">
                      Universal • All Modules
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[--text-secondary] leading-relaxed max-w-md">
                  Your personal financial assistant on Telegram. Log expenses, income, stock trades, mutual funds, forex, family
                  transfers, and goal contributions — all by simply texting the bot.
                </p>

                {profile?.telegram_chat_id ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        Bot is Active
                      </p>
                      <p className="text-[10px] text-[--text-secondary] mt-1">
                        Chat ID: <code className="font-mono text-emerald-400/80">{profile.telegram_chat_id}</code>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { cmd: "50 Tea", desc: "Expense", color: "text-rose-400" },
                        { cmd: "income 5000 Salary", desc: "Income", color: "text-emerald-400" },
                        { cmd: "stock buy 10 AAPL 150", desc: "Stock", color: "text-blue-400" },
                        { cmd: "mf sip 5000 NIFTY", desc: "MF", color: "text-purple-400" },
                        { cmd: "forex buy 100 USD", desc: "Forex", color: "text-amber-400" },
                        { cmd: "family sent 500 mom", desc: "Family", color: "text-pink-400" },
                      ].map((c) => (
                        <div
                          key={c.cmd}
                          className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors cursor-default"
                        >
                          <code className={`text-[10px] font-mono ${c.color} block truncate`}>{c.cmd}</code>
                          <span className="text-[9px] text-[--text-muted] uppercase tracking-wider font-bold">{c.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profile?.telegram_link_code ? (
                      <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/10 flex flex-col md:flex-row gap-5 items-center">
                        <div className="p-2 bg-white rounded-xl shadow-lg flex-shrink-0">
                          <QRCode
                            value={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "FIN_DASHBAORD_bot"}?start=${profile.telegram_link_code}`}
                            size={100}
                            level="M"
                          />
                        </div>
                        <div className="flex-1 text-center md:text-left space-y-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-400 mb-1">
                              Link via QR or Click
                            </p>
                            <p className="text-[11px] text-[--text-secondary] leading-relaxed">
                              Scan with your phone camera, or click below to instantly link your Telegram.
                            </p>
                          </div>
                          <a
                            href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "FIN_DASHBAORD_bot"}?start=${profile.telegram_link_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0088cc] hover:bg-[#0088cc]/90 text-white text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,136,204,0.3)] active:scale-95"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.9 1.22-5.36 3.56-.51.35-.96.52-1.38.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.41-1.4-.87.03-.24.35-.49.96-.75 3.75-1.63 6.24-2.7 7.48-3.21 3.56-1.48 4.3-1.74 4.79-1.75.11 0 .35.03.5.15.13.11.17.26.19.4z" />
                            </svg>
                            Link Account Now
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[--text-muted]">
                        Generate a link code to connect the official Telegram bot to this account.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex md:flex-col items-center gap-3 md:pt-2">
                {profile?.telegram_chat_id ? (
                  <>
                    <div className="hidden md:flex flex-col items-center gap-1 mb-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Live</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Are you sure you want to disconnect Telegram bot sync?")) return;
                        const res = await updateSettings({ telegram_chat_id: null });
                        if (res.error) toast.error(res.error);
                        else {
                          toast.success("Telegram disconnected.");
                          mutate();
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-xs font-bold text-rose-400 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await generateTelegramLinkCode();
                      if (res.error) toast.error(res.error);
                      else {
                        toast.success("Link code generated!");
                        mutate();
                      }
                    }}
                    className="btn-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                  >
                    {profile?.telegram_link_code ? "Regenerate Code" : "Generate Code"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
