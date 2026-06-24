import React from "react";
import { ArrowUpRight } from "lucide-react";
import type { Tables } from "@/lib/database.types";

interface TransferFormProps {
  selectedRecipient: Tables<"recipients">;
  sendAccountId: string;
  setSendAccountId: (id: string) => void;
  sendAmount: string;
  setSendAmount: (amount: string) => void;
  sendNote: string;
  setSendNote: (note: string) => void;
  accounts: Tables<"accounts">[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  QUICK_AMOUNTS: number[];
}

export default function TransferForm({
  selectedRecipient,
  sendAccountId,
  setSendAccountId,
  sendAmount,
  setSendAmount,
  sendNote,
  setSendNote,
  accounts,
  submitting,
  onSubmit,
  QUICK_AMOUNTS,
}: TransferFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[--accent-primary]/20 text-[--accent-primary] flex items-center justify-center font-bold text-lg">
          {selectedRecipient.name.charAt(0)}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
            Recipient
          </p>
          <p className="text-base font-bold text-white mt-1">{selectedRecipient.name}</p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
          Source Account
        </label>
        <select
          required
          value={sendAccountId}
          onChange={(e) => setSendAccountId(e.target.value)}
          className="input-premium"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.currency} {acc.balance.toLocaleString()})
            </option>
          ))}
        </select>
        {sendAccountId && accounts.find((a) => a.id === sendAccountId) && (
          <div className="mt-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
            <span className="font-medium">Available Balance</span>
            <span className="font-bold text-white">
              {accounts.find((a) => a.id === sendAccountId)?.currency === "USD" ? "$" : "₹"}
              {accounts.find((a) => a.id === sendAccountId)?.balance.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
          Transfer Amount
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold text-lg">
            {accounts.find((a) => a.id === sendAccountId)?.currency === "USD" ? "$" : "₹"}
          </span>
          <input
            required
            type="number"
            step="0.01"
            min="1"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            className="input-premium !pl-9 text-lg font-black"
            placeholder="0.00"
          />
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setSendAmount(amt.toString())}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${
                sendAmount === amt.toString()
                  ? "bg-[--accent-primary] text-white border-[--accent-primary]"
                  : "bg-white/5 border-white/10 text-[--text-muted] hover:text-white hover:border-white/20"
              }`}
            >
              +{amt.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
          Note (Optional)
        </label>
        <input
          value={sendNote}
          onChange={(e) => setSendNote(e.target.value)}
          className="input-premium"
          placeholder="e.g. Birthday gift"
        />
      </div>

      <div className="pt-4 mt-8">
        <button
          type="submit"
          disabled={submitting || !sendAmount}
          className="btn-primary w-full h-12 shadow-xl shadow-[--accent-primary]/20 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
        >
          {submitting ? (
            "Processing..."
          ) : (
            <>
              <ArrowUpRight className="w-4 h-4" /> Execute Transfer
            </>
          )}
        </button>
      </div>
    </form>
  );
}
