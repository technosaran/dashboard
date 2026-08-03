"use client";

import React, { useState, useEffect } from "react";
import { Zap } from "lucide-react";

interface DiagnosticResult {
  name: string;
  status: string;
  latency: string;
  code: number;
  error?: string;
}

interface SystemStatusTabProps {
  diagnostics: DiagnosticResult[];
  runningDiagnostics: boolean;
  runDiagnostics: () => void;
}

export default function SystemStatusTab({
  diagnostics = [],
  runningDiagnostics,
  runDiagnostics,
}: SystemStatusTabProps) {
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    if (diagnostics.length > 0 && !runningDiagnostics) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  }, [diagnostics, runningDiagnostics]);

  const healthyCount = diagnostics.filter((d) => d.status === "Healthy").length;
  const totalCount = diagnostics.length;
  const healthPercentage = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 100;

  const getLatencyStyle = (latencyStr: string) => {
    if (latencyStr === "—") return "text-gray-500";
    const num = parseInt(latencyStr, 10);
    if (isNaN(num)) return "text-gray-400";
    if (num < 300) return "text-emerald-400 font-bold";
    if (num < 800) return "text-amber-400 font-bold";
    return "text-rose-400 font-bold";
  };

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div className="glass-card-static p-6 md:p-8 relative overflow-hidden bg-slate-900/50 border border-white/10 rounded-3xl">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl shadow-inner">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">System & API Diagnostics</h2>
                {totalCount > 0 && (
                  <span className={`text-[0.6875rem] font-bold px-2.5 py-0.5 rounded-full border ${
                    healthPercentage >= 80 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  }`}>
                    {healthPercentage}% Health ({healthyCount}/{totalCount})
                  </span>
                )}
              </div>
              <p className="text-xs text-[--text-muted] mt-0.5">Check real-time network health, market API latencies, and DB connection stability</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {lastChecked && (
              <span className="text-[0.625rem] font-mono text-gray-400">
                Pinged {lastChecked}
              </span>
            )}
            <button
              type="button"
              onClick={runDiagnostics}
              disabled={runningDiagnostics}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              {runningDiagnostics ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      className="opacity-75"
                    />
                  </svg>
                  Pinging APIs...
                </>
              ) : (
                <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Re-Run Diagnostics</span>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {diagnostics.map((api, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-xs font-bold text-white truncate">{api.name}</span>
                {api.error && (
                  <span className="text-[0.6875rem] text-rose-400 font-mono truncate max-w-sm" title={api.error}>
                    Error: {api.error}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className={`text-xs font-mono ${getLatencyStyle(api.latency)}`}>
                  {api.latency}
                </span>
                <span
                  className={`text-[0.625rem] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                    api.status === "Healthy"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : api.status === "Rate Limited"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  }`}
                >
                  {api.status}
                </span>
              </div>
            </div>
          ))}

          {diagnostics.length === 0 && !runningDiagnostics && (
            <div className="text-center py-8 text-xs text-[--text-muted]">
              No diagnostics run yet. Click &quot;Re-Run Diagnostics&quot; to test API connections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

