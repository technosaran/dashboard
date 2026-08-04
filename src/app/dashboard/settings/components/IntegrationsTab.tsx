"use client";

import React, { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { toast } from "react-hot-toast";
import { updateSettings, generateTelegramLinkCode } from "../actions";
import type { FinanceData } from "@/hooks/use-finance-data";
import { Bot, Key, Send, AlertTriangle, ExternalLink } from "lucide-react";

interface IntegrationsTabProps {
  profile: FinanceData["profile"] | undefined;
  mutate: () => void;
}

export default function IntegrationsTab({
  profile,
  mutate,
}: IntegrationsTabProps) {
  const [showTelegramCommands, setShowTelegramCommands] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState((profile as any)?.gemini_api_key || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const handleDisconnectTelegram = async () => {
    const res = await updateSettings({ telegram_chat_id: null });
    if (res.error) toast.error(res.error);
    else { toast.success("Telegram disconnected."); setShowDisconnectModal(false); mutate(); }
  };

  const telegramActive = !!profile?.telegram_chat_id;
  const geminiEnabled = (profile as any)?.gemini_enabled !== false;
  const hasGeminiKey = !!(profile as any)?.gemini_api_key;

  useEffect(() => {
    if (profile && (profile as any).gemini_api_key !== undefined) {
      setGeminiKeyInput((profile as any).gemini_api_key || "");
    }
  }, [profile]);

  const handleSaveGeminiKey = async () => {
    setIsSavingGemini(true);
    try {
      const res = await updateSettings({ gemini_api_key: geminiKeyInput.trim() || null });
      if (res.error) toast.error(res.error);
      else {
        toast.success(geminiKeyInput.trim() ? "Gemini API key saved successfully!" : "Gemini API key cleared.");
        mutate();
      }
    } catch {
      toast.error("Failed to update Gemini API key");
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleToggleGemini = async () => {
    const nextState = !geminiEnabled;
    try {
      const res = await updateSettings({ gemini_enabled: nextState });
      if (res.error) toast.error(res.error);
      else {
        toast.success(nextState ? "Gemini AI enabled project-wide!" : "Gemini AI turned OFF. System using rule-based fallback.");
        mutate();
      }
    } catch {
      toast.error("Failed to toggle Gemini AI");
    }
  };

  return (
    <div className="max-w-4xl animate-fade-in space-y-5">
      {/* Grid Layout of Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ─── 1. Google Gemini AI Card ─── */}
        <div className="rounded-2xl border border-white/10 bg-[#121620] p-5 flex flex-col justify-between hover:border-purple-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-inner">
                  <Bot className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Google Gemini AI
                  </h3>
                  <span className="text-[0.625rem] text-purple-400 font-bold uppercase tracking-wider">Gemini 2.5 Flash</span>
                </div>
              </div>

              {/* Enable / Disable Toggle Switch */}
              <button
                type="button"
                onClick={handleToggleGemini}
                className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                  geminiEnabled ? "bg-purple-600 justify-end" : "bg-gray-700 justify-start"
                }`}
                title={geminiEnabled ? "Click to Turn OFF Gemini AI" : "Click to Turn ON Gemini AI"}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Powers natural language parsing across dashboard & Telegram bot. If unconfigured or OFF, system falls back to rule-based parsing.
            </p>

            {/* API Key Box */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="gemini-key-input" className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400 shrink-0" /> Gemini API Key
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.6875rem] font-bold text-purple-400 hover:underline flex items-center gap-1"
                >
                  Get Free Key <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="gemini-key-input"
                    type={showApiKey ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-3 pr-12 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.6875rem] text-gray-400 hover:text-white cursor-pointer"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isSavingGemini}
                  onClick={handleSaveGeminiKey}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingGemini ? "..." : "Save"}
                </button>
              </div>

              <p className="text-[0.6875rem] text-gray-500">
                Status: {!geminiEnabled ? (
                  <span className="text-gray-400 font-bold">Turned OFF (Rule Fallback)</span>
                ) : hasGeminiKey ? (
                  <span className="text-emerald-400 font-bold">Configured & Ready</span>
                ) : (
                  <span className="text-amber-400 font-bold">Not Configured (Rule Fallback)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ─── 2. Telegram Bot Card ─── */}
        <div className="rounded-2xl border border-white/10 bg-[#121620] p-5 flex flex-col justify-between hover:border-sky-500/30 transition-all duration-300 relative overflow-hidden group shadow-xl">
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shadow-inner">
                  <Send className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Telegram Assistant</h3>
                  <span className="text-[0.625rem] text-sky-400 font-bold uppercase tracking-wider">Voice Notes • Bills • SMS</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider border ${
                telegramActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-500"
              }`}>
                {telegramActive ? "Connected" : "Disconnected"}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Log transactions via voice notes, bill photos, or SMS alerts. Get real-time report summaries via bot commands.
            </p>

            {telegramActive ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Bot Active
                    </p>
                    <p className="text-[0.6875rem] text-gray-400 mt-0.5">Chat ID: <code className="font-mono text-white">{profile?.telegram_chat_id}</code></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTelegramCommands(!showTelegramCommands)}
                    className="text-[0.6875rem] font-bold text-sky-400 hover:underline cursor-pointer"
                  >
                    {showTelegramCommands ? "Hide Commands" : "View Commands"}
                  </button>
                </div>

                {showTelegramCommands && (
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2 text-[0.6875rem]">
                    <p className="font-bold text-gray-300 uppercase tracking-wider">Bot Commands</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div><code className="text-sky-400">/balance</code> <span className="text-gray-400">— Net Worth</span></div>
                      <div><code className="text-emerald-400">/summary</code> <span className="text-gray-400">— Monthly</span></div>
                      <div><code className="text-purple-400">/recent</code> <span className="text-gray-400">— Last 5</span></div>
                      <div><code className="text-rose-400">/undo</code> <span className="text-gray-400">— Revert</span></div>
                    </div>
                  </div>
                )}
              </div>
            ) : profile?.telegram_link_code ? (
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-3">
                <div className="p-1 bg-white rounded-lg shrink-0">
                  <QRCode
                    value={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "FIN_DASHBOARD_bot"}?start=${profile.telegram_link_code}`}
                    size={64}
                    level="M"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-bold text-white">Scan QR or Click Below</p>
                  <a
                    href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "FIN_DASHBOARD_bot"}?start=${profile.telegram_link_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[0.6875rem] font-bold text-sky-400 underline"
                  >
                    Open Telegram Bot
                  </a>
                </div>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-end gap-2">
            {telegramActive ? (
              <button
                type="button"
                onClick={() => setShowDisconnectModal(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const res = await generateTelegramLinkCode();
                  if (res.error) toast.error(res.error);
                  else { toast.success("Link code generated!"); mutate(); }
                }}
                className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {profile?.telegram_link_code ? "Regenerate Code" : "Connect Telegram"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Disconnect Telegram Custom Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-card rich-border p-6 rounded-2xl max-w-sm w-full space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Disconnect Telegram?</h3>
                <p className="text-xs text-[--text-muted]">Are you sure you want to disconnect Telegram bot sync?</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowDisconnectModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={handleDisconnectTelegram} className="btn-danger flex-1">Disconnect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
