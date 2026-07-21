"use client";

import React from "react";

interface DangerZoneTabProps {
  handleResetClick: () => void;
  showResetModal: boolean;
  setShowResetModal: (show: boolean) => void;
  resetConfirmText: string;
  setResetConfirmText: (text: string) => void;
  resetCountdown: number;
  isResetting: boolean;
  handleResetConfirm: () => Promise<void>;
  canExecuteReset: boolean;
}

export default function DangerZoneTab({
  handleResetClick,
  showResetModal,
  setShowResetModal,
  resetConfirmText,
  setResetConfirmText,
  resetCountdown,
  isResetting,
  handleResetConfirm,
  canExecuteReset,
}: DangerZoneTabProps) {
  return (
    <div className="max-w-2xl animate-fade-in-up">
      <div className="glass-card-static p-6 md:p-10 border-rose-500/20 bg-rose-500/[0.02] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-rose-500/70" />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-rose-500">Danger Zone</h2>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500/60 mt-0.5">Destructive Actions</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
          <div>
            <h3 className="text-sm font-bold text-[--text-primary]">Reset Application Data</h3>
            <p className="text-xs text-[--text-muted] mt-1">Erase all transactions, accounts, and investment history permanently.</p>
          </div>
          <button
            type="button"
            onClick={handleResetClick}
            className="btn-danger !h-11 !px-6 whitespace-nowrap shadow-xl shadow-rose-500/20"
          >
            Reset All Data
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowResetModal(false)}
        >
          <div
            className="glass-card-static p-8 max-w-md w-full animate-fade-in-up bg-[--bg-surface] border border-rose-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-rose-500">Confirm Data Reset</h3>
                <p className="text-xs text-[--text-muted]">This action is irreversible</p>
              </div>
            </div>
            <p className="text-sm text-[--text-secondary] mb-6 leading-relaxed">
              This will permanently delete <strong className="text-white">all</strong> your financial data, accounts, transactions, and
              investment history. This action <strong className="text-rose-400">cannot be undone</strong>.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-black uppercase tracking-widest text-[--text-muted] mb-2">
                Type <span className="text-rose-400">RESET</span> to confirm
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="input-premium h-12 text-sm font-bold w-full"
                placeholder='Type "RESET" here'
                autoFocus
                autoComplete="off"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="flex-1 h-12 rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetConfirm}
                disabled={!canExecuteReset}
                className="flex-1 h-12 rounded-xl bg-rose-500 text-white text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-600 shadow-lg shadow-rose-500/20"
              >
                {isResetting
                  ? "Erasing..."
                  : resetCountdown > 0
                  ? `Wait ${resetCountdown}s...`
                  : resetConfirmText !== "RESET"
                  ? "Type RESET"
                  : "Erase All Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
