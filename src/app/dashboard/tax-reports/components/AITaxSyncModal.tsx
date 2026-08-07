"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { Sparkles, Bot, FileText, CheckCircle, AlertCircle, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AITaxSyncModal({ isOpen, onClose, onSuccess }: Props) {
  const [announcementText, setAnnouncementText] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleRunAutoSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    const toastId = toast.loading("AI Engine parsing Union Budget announcements & tax laws...");

    try {
      const res = await fetch("/api/tax/auto-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcementText: announcementText.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "Failed to auto-sync tax rules", { id: toastId });
        setSyncResult({ success: false, error: data.error });
      } else {
        toast.success(data.message || "Tax laws updated via AI!", { id: toastId });
        setSyncResult({ success: true, rule: data.rule, summary: data.summary });
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while syncing tax laws", { id: toastId });
      setSyncResult({ success: false, error: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl p-6 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              AI Tax Rule Auto-Sync Engine
            </h3>
            <p className="text-xs text-gray-400">
              Zero manual coding. AI parses Union Budget speeches & Gazette releases automatically.
            </p>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider">
            Union Budget / Finance Bill Text (Optional — leave blank for latest preset)
          </label>
          <textarea
            rows={4}
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="Paste raw text from Finance Bill PDF, PIB release, or IT Dept notification..."
            className="w-full p-3 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
          />
        </div>

        {/* Result Feedback */}
        {syncResult && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
              syncResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2 font-black">
              {syncResult.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
              <span>{syncResult.success ? `Updated Rule: ${syncResult.rule?.version}` : "Sync Error"}</span>
            </div>
            <p className="text-[11px] opacity-90">{syncResult.summary || syncResult.error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={isSyncing}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isSyncing} onClick={handleRunAutoSync}>
            <Sparkles className="w-4 h-4" />
            <span>Run AI Auto-Sync</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
