"use client";

import { useEffect, useState, useRef, startTransition } from "react";
import { useUser } from "@/context/user-context";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "react-hot-toast";
import { createClient } from "@/lib/supabase-browser";

const supabase = createClient();

export default function SettingsPage() {
  const { username, setUsername, loading, isSyncing } = useUser();
  const [input, setInput] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [biometricSim, setBiometricSim] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const initializedRef = useRef(false);
  const prevIsSyncingRef = useRef(false);

  // Sync internal input state with context once loaded
  useEffect(() => {
    if (!loading && !initializedRef.current) {
      startTransition(() => setInput(username));
      initializedRef.current = true;
    }
  }, [loading, username]);

  // Sync internal input state if username changes from external broadcast
  useEffect(() => {
    if (initializedRef.current && username !== input && !isSyncing) {
      startTransition(() => setInput(username));
    }
  }, [username, input, isSyncing]);

  // Update lastSaved when sync completes
  useEffect(() => {
    if (prevIsSyncingRef.current && !isSyncing) {
      startTransition(() => setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })));
    }
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInput(newVal);
    
    // Update context IMMEDIATELY for real-time UI everywhere
    setUsername(newVal);
  };

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">
          Settings
        </h1>
        <p className="mt-1 text-[13px] md:text-sm text-[--text-secondary]">
          Manage your account preferences and profile identity.
        </p>
      </div>


      {/* Profile Card */}
      <div className="max-w-2xl animate-fade-in-up delay-1">
        <div
          className="glass-card-static p-6 md:p-10 relative overflow-hidden"
        >
          {/* Top accent */}
          <div
            className="absolute top-0 left-0 right-0"
            style={{
              height: "3px",
              background: "var(--gradient-primary)",
              opacity: 0.7,
            }}
          />

          <div className="flex items-center gap-3 mb-6">
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "rgba(162, 155, 254, 0.12)",
                border: "1px solid rgba(162, 155, 254, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: "#a29bfe" }}>
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Profile Identity
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Update your name to change the dashboard greeting
              </p>
            </div>
            
            {/* Status Indicator */}
            <div className="ml-auto">
              {isSyncing ? (
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[--text-muted]">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="hidden sm:inline">Encrypting...</span>
                  <span className="sm:hidden">Busy</span>
                </div>
              ) : lastSaved ? (
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="hidden sm:inline">Sync Verified</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Change Display Name
              </label>
              <input
                type="text"
                value={input}
                onChange={handleChange}
                className="input-premium h-14 md:h-12 text-[16px] md:text-sm font-bold"
                placeholder="Enter your name"
              />
              <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your profile name is synchronized across all devices in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile & PWA Optimization */}
      <div className="max-w-2xl animate-fade-in-up delay-2">
        <div className="glass-card-static p-6 md:p-8">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-[--text-primary]">Mobile & PWA</h2>
                <p className="text-xs text-[--text-muted]">Optimize experience for your handheld devices</p>
              </div>
           </div>

           <div className="space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex flex-col gap-0.5">
                   <span className="text-sm font-bold text-[--text-secondary]">Haptic Feedback</span>
                   <span className="text-[10px] text-[--text-muted]">Tactile response for transactions and buttons</span>
                 </div>
                 <button 
                  onClick={() => {
                    setHapticEnabled(!hapticEnabled);
                    if (!hapticEnabled) triggerHaptic("medium");
                  }}
                  className={`relative w-11 h-6 transition-colors rounded-full ${hapticEnabled ? 'bg-indigo-500' : 'bg-white/10'}`}
                 >
                   <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${hapticEnabled ? 'translate-x-5' : ''}`} />
                 </button>
              </div>

              <div className="flex items-center justify-between">
                 <div className="flex flex-col gap-0.5">
                   <span className="text-sm font-bold text-[--text-secondary]">Auto Real-time Sync</span>
                   <span className="text-[10px] text-[--text-muted]">Resumes data stream immediately on app focus</span>
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-lg">
                    <div className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
                    ALWAYS ACTIVE
                 </div>
              </div>

              <div className="flex items-center justify-between">
                 <div className="flex flex-col gap-0.5">
                   <span className="text-sm font-bold text-[--text-secondary]">Biometric Simulation</span>
                   <span className="text-[10px] text-[--text-muted]">Simulate FaceID for added privacy layer</span>
                 </div>
                 <button 
                  onClick={() => { setBiometricSim(!biometricSim); if (hapticEnabled) triggerHaptic("light"); }}
                  className={`relative w-11 h-6 transition-colors rounded-full ${biometricSim ? 'bg-indigo-500' : 'bg-white/10'}`}
                 >
                   <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${biometricSim ? 'translate-x-5' : ''}`} />
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="max-w-2xl animate-fade-in-up delay-3 mt-4">
        <div className="glass-card-static p-6 md:p-8 border-rose-500/20 bg-rose-500/[0.02]">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-rose-500">Danger Zone</h2>
                <p className="text-xs text-[--text-muted]">Irreversible actions for your account</p>
              </div>
           </div>

           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-[--text-secondary]">Reset All Transaction Data</span>
                <span className="text-[10px] text-[--text-muted]">Clears investments, incomes, expenses and ledger history.</span>
              </div>
              <button 
                onClick={() => { setShowResetConfirm(true); if (hapticEnabled) triggerHaptic("warning"); }}
                className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
              >
                Reset Data
              </button>
           </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
           <div className="glass-card-static max-w-sm w-full p-8 text-center animate-scale-in border-rose-500/30">
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                 <svg className="w-10 h-10 text-rose-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </div>
              <h3 className="text-xl font-black text-[--text-primary] mb-2">Absolute Reset?</h3>
              <p className="text-sm text-[--text-muted] mb-8 leading-relaxed">
                This will permamently delete your entire financial history. This operation is **not reversible**.
              </p>
              <div className="flex gap-3">
                 <button 
                  onClick={async () => {
                    setResetting(true);
                    if (hapticEnabled) triggerHaptic("heavy");
                    // Implement reset logic here (calling a new RPC or several deletions)
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      await Promise.all([
                        supabase.from('transactions').delete().eq('user_id', user.id),
                        supabase.from('ledger_logs').delete().eq('user_id', user.id),
                        supabase.from('investments').delete().eq('user_id', user.id),
                        supabase.from('incomes').delete().eq('user_id', user.id),
                        supabase.from('expenses').delete().eq('user_id', user.id),
                        supabase.from('transfers').delete().eq('user_id', user.id)
                      ]);
                      // Reset account balances to 0 or delete accounts? Let's just reset balances
                      await supabase.from('accounts').update({ balance: 0 }).eq('user_id', user.id);
                    }
                    toast.success("System data purged successfully");
                    setResetting(false);
                    setShowResetConfirm(false);
                    window.location.reload();
                  }}
                  disabled={resetting}
                  className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50"
                 >
                    {resetting ? 'Purging...' : 'Yes, Purge'}
                 </button>
                 <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-[--text-primary] font-bold text-xs uppercase tracking-widest border border-white/10"
                 >
                   Cancel
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
