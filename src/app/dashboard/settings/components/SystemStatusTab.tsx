"use client";

import React from "react";

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
  return (
    <div className="max-w-2xl animate-fade-in-up">
      <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-500/70" />
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">System & API Diagnostics</h2>
              <p className="text-xs text-[--text-muted]">Check if external service connections or data APIs are rate-limited or offline</p>
            </div>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={runningDiagnostics}
            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95 cursor-pointer"
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
                Pinging...
              </>
            ) : (
              "Run Diagnostics"
            )}
          </button>
        </div>

        <div className="space-y-4">
          {diagnostics.map((api, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-white">{api.name}</span>
                {api.error && (
                  <span className="text-[10px] text-rose-400 font-mono max-w-sm truncate" title={api.error}>
                    Error: {api.error}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[--text-muted] font-mono">{api.latency}</span>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
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
            <div className="text-center py-6 text-xs text-[--text-muted]">
              No diagnostics run yet. Click &quot;Run Diagnostics&quot; to check API health.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
