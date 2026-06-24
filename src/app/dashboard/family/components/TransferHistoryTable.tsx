import React from "react";
import { format } from "date-fns";
import { CheckCircle2, X } from "lucide-react";
import type { Tables } from "@/lib/database.types";

interface TransferHistoryTableProps {
  recentSends: Tables<"ledger_logs">[];
  recipients: Tables<"recipients">[];
  getRecipientId: (log: Tables<"ledger_logs">) => string | null;
  getAccountCurrency: (accountId: string | null) => string;
  selectedHistoryRecipient: string | null;
  onClearFilter: () => void;
}

export default function TransferHistoryTable({
  recentSends,
  recipients,
  getRecipientId,
  getAccountCurrency,
  selectedHistoryRecipient,
  onClearFilter,
}: TransferHistoryTableProps) {
  return (
    <div className="bg-[#111111] border border-white/10 rounded-md overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-[#151515] flex justify-between items-center">
        <h2 className="text-sm font-semibold text-white">
          {selectedHistoryRecipient
            ? `Transactions: ${recipients.find((r) => r.id === selectedHistoryRecipient)?.name}`
            : "Recent Transactions"}
        </h2>
        {selectedHistoryRecipient && (
          <button
            onClick={onClearFilter}
            className="text-xs font-medium text-[--text-muted] hover:text-white flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear Filter
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-[--text-secondary]">
          <thead className="text-xs uppercase bg-[#181818] text-[--text-muted] border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-semibold">Date & Time</th>
              <th className="px-6 py-4 font-semibold">Details</th>
              <th className="px-6 py-4 font-semibold text-right">Amount</th>
              <th className="px-6 py-4 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {recentSends.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-[--text-muted]">
                  No transactions found.
                </td>
              </tr>
            ) : (
              recentSends.map((send) => (
                <tr key={send.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-white">
                      {send.created_at ? format(new Date(send.created_at), "MMM dd, yyyy") : "—"}
                    </span>
                    <span className="text-xs text-[--text-muted] ml-2 block sm:inline">
                      {send.created_at ? format(new Date(send.created_at), "h:mm a") : ""}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-white">
                    <div className="flex flex-col">
                      <span>{send.details || "Transfer"}</span>
                      <span className="text-xs text-[--text-muted]">
                        To: {recipients.find((r) => r.id === getRecipientId(send))?.name || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-danger">
                      -{getAccountCurrency(send.account_id) === "USD" ? "$" : "₹"}
                      {(send.amount || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
