"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import { format } from "date-fns";

const supabase = createClient();

type LedgerLog = {
  id: string;
  created_at: string;
  account_name: string | null;
  action_type: string;
  amount: number | null;
  previous_balance: number | null;
  new_balance: number | null;
  details: string | null;
};

export default function LedgerPage() {
  const [logs, setLogs] = useState<LedgerLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("ledger_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setLogs(data as LedgerLog[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(fetchLogs);

    const channel = supabase
      .channel("ledger-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ledger_logs" },
        (payload) => {
          setLogs((prev) => [payload.new as LedgerLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  const getActionBadge = (type: string) => {
    const styles: Record<string, any> = {
      CREATE: { bg: "rgba(85, 239, 196, 0.12)", color: "#55efc4", text: "Created" },
      DELETE: { bg: "rgba(255, 118, 117, 0.12)", color: "#ff7675", text: "Deleted" },
      UPDATE: { bg: "rgba(116, 185, 255, 0.12)", color: "#74b9ff", text: "Updated" },
      TRANSFER_IN: { bg: "rgba(85, 239, 196, 0.12)", color: "#55efc4", text: "Transfer In" },
      TRANSFER_OUT: { bg: "rgba(255, 118, 117, 0.12)", color: "#ff7675", text: "Transfer Out" },
      ADJUST_UP: { bg: "rgba(85, 239, 196, 0.12)", color: "#55efc4", text: "Adjust Up" },
      ADJUST_DOWN: { bg: "rgba(255, 118, 117, 0.12)", color: "#ff7675", text: "Adjust Down" },
    };

    const style = styles[type] || { bg: "rgba(255, 255, 255, 0.05)", color: "var(--text-secondary)", text: type };

    return (
      <span
        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: style.bg, color: style.color, border: `1px solid ${style.bg}` }}
      >
        {style.text}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-[--text-primary]">
          Financial Ledger
        </h1>
        <p className="text-[--text-secondary]">
          Automated audit trail of all account activities and balance changes.
        </p>
      </div>

      <div
        className="overflow-hidden border border-white/5 bg-[var(--bg-surface)] backdrop-blur-xl"
        style={{ borderRadius: "var(--radius-2xl)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">Date & Time</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">Action</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">Account</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">Prev Balance</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">New Balance</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-8 text-center">
                      <div className="h-4 bg-white/5 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[--text-muted]">
                    No ledger entries found. Activities will be logged automatically.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[--text-primary]">
                        {format(new Date(log.created_at), "MMM d, yyyy")}
                      </div>
                      <div className="text-[10px] text-[--text-muted]">
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(log.action_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-[--text-secondary]">
                        {log.account_name || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-mono ${log.amount && log.amount > 0 ? "text-[--accent-primary-light]" : "text-[--text-primary]"}`}>
                        {log.amount ? `₹${log.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[--text-muted]">
                      {log.previous_balance !== null ? `₹${log.previous_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-[--text-secondary]">
                      {log.new_balance !== null ? `₹${log.new_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[--text-muted] max-w-xs truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:max-w-none transition-all">
                        {log.details}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
