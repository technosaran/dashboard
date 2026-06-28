"use client";

import { useMemo, useState } from "react";
import { endOfDay, format, isWithinInterval, startOfDay } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import LedgerDataTable from "./components/LedgerDataTable";

type LedgerLog = {
  id: string;
  created_at: string | null;
  account_name: string | null;
  account_id: string | null;
  action_type: string;
  amount: number | null;
  previous_balance: number | null;
  new_balance: number | null;
  details: string | null;
  source_type: string | null;
  source_id: string | null;
};

const DEBIT_ACTIONS = new Set(["ADJUST_DOWN", "TRANSFER_OUT", "DELETE", "SEND_MONEY"]);
const CREDIT_ACTIONS = new Set(["ADJUST_UP", "TRANSFER_IN", "CREATE"]);

const ACTION_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string; ring: string }> = {
  CREATE: { label: "Created", icon: "✨", bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", ring: "rgba(16, 185, 129, 0.2)" },
  DELETE: { label: "Deleted", icon: "🗑️", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
  UPDATE: { label: "Updated", icon: "✏️", bg: "rgba(99, 102, 241, 0.1)", text: "#818cf8", ring: "rgba(99, 102, 241, 0.2)" },
  TRANSFER_IN: { label: "Inflow", icon: "📥", bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", ring: "rgba(16, 185, 129, 0.2)" },
  TRANSFER_OUT: { label: "Outflow", icon: "📤", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
  ADJUST_UP: { label: "Adjust Up", icon: "📈", bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", ring: "rgba(16, 185, 129, 0.2)" },
  ADJUST_DOWN: { label: "Adjust Down", icon: "📉", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
  SEND_MONEY: { label: "Family Send", icon: "👨‍👩‍👧‍👦", bg: "rgba(244, 63, 94, 0.1)", text: "#f43f5e", ring: "rgba(244, 63, 94, 0.2)" },
};

const formatMoney = (value: number | null | undefined, currency = "INR") => {
  if (value === null || value === undefined) return "—";
  const symbol = currency === "USD" ? "$" : "₹";
  return `${symbol}${value.toLocaleString()}`;
};

const isDebitLog = (log: LedgerLog) => {
  if (log.new_balance !== null && log.previous_balance !== null) {
    return log.new_balance < log.previous_balance;
  }
  return DEBIT_ACTIONS.has(log.action_type);
};

const isCreditLog = (log: LedgerLog) => {
  if (log.new_balance !== null && log.previous_balance !== null) {
    return log.new_balance > log.previous_balance;
  }
  return CREDIT_ACTIONS.has(log.action_type);
};

export default function LedgerClient({ initialData }: { initialData?: FinanceData }) {
  const {
    data: { ledgerLogs: logs, accounts },
    isValidating,
    mutate,
  } = useFinanceData(initialData);

  const getLogCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  const selectQuickRange = (range: string) => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    
    if (range === "Today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (range === "Yesterday") {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (range === "This Month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(format(start, "yyyy-MM-dd"));
      setEndDate(format(end, "yyyy-MM-dd"));
    } else if (range === "Last 30 Days") {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setStartDate(format(start, "yyyy-MM-dd"));
      setEndDate(todayStr);
    } else if (range === "All Time") {
      setStartDate("");
      setEndDate("");
    }
  };

  const allFilteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!log.created_at) return false;

      // Filter by account
      if (selectedAccountId !== "all" && log.account_id !== selectedAccountId) {
        return false;
      }

      const date = new Date(log.created_at);

      if (startDate || endDate) {
        const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
        const end = endDate ? endOfDay(new Date(endDate)) : new Date();
        return isWithinInterval(date, { start, end });
      }
      return true;
    });
  }, [endDate, logs, startDate, selectedAccountId]);

  const openingBalance = useMemo(() => {
    if (allFilteredLogs.length === 0) return 0;
    const oldestLog = allFilteredLogs[allFilteredLogs.length - 1];
    return oldestLog.previous_balance || 0;
  }, [allFilteredLogs]);

  const closingBalance = useMemo(() => {
    if (allFilteredLogs.length === 0) return 0;
    const newestLog = allFilteredLogs[0];
    return newestLog.new_balance || 0;
  }, [allFilteredLogs]);

  const totalInflow = useMemo(() => {
    return allFilteredLogs.reduce((sum, log) => {
      if (!isCreditLog(log)) return sum;
      return sum + (log.amount || 0);
    }, 0);
  }, [allFilteredLogs]);

  const totalOutflow = useMemo(() => {
    return allFilteredLogs.reduce((sum, log) => {
      if (!isDebitLog(log)) return sum;
      return sum + (log.amount || 0);
    }, 0);
  }, [allFilteredLogs]);

  const resetRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const getActionConfig = (type: string) => {
    return ACTION_CONFIG[type] || {
      label: type,
      icon: "⚙️",
      bg: "rgba(255, 255, 255, 0.05)",
      text: "#8b8d98",
      ring: "rgba(255, 255, 255, 0.1)",
    };
  };

  const getActionBadge = (log: LedgerLog) => {
    let type = log.action_type;
    if (log.source_type === "family_transfer") {
      type = "SEND_MONEY";
    }
    const cfg = getActionConfig(type);
    return (
      <span 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[10px] font-black uppercase tracking-wider border whitespace-nowrap"
        style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.ring }}
      >
        <span className="text-[11px] shrink-0" aria-hidden="true">{cfg.icon}</span>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-[var(--section-gap)] max-w-7xl mx-auto w-full px-2">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-2">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Ledger</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.3em] mt-1.5">Console Statement & Balance Audit Trail</p>
          </div>
          <div className="inline-flex items-center gap-2 mt-1">
            <span className={`h-2 w-2 rounded-full shadow-lg ${isValidating ? "animate-pulse bg-warning shadow-warning/40" : "bg-success shadow-success/40"}`} />
          </div>
        </div>
      </header>

      {/* Zerodha Console Filters Form */}
      <section className="bg-[#151515] p-5 rounded border border-white/10 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Account / Segment</label>
            <select
              className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-[#f26522]"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="all">All Accounts (Consolidated)</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px] space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">From Date</label>
            <input
              type="date"
              className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-xs text-[#fff] [color-scheme:dark] outline-none focus:border-[#f26522]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex-1 min-w-[150px] space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">To Date</label>
            <input
              type="date"
              className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-xs text-[#fff] [color-scheme:dark] outline-none focus:border-[#f26522]"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                // Trigger reload/filter
              }}
              className="h-[34px] px-5 bg-[#f26522] hover:bg-[#d85317] text-white text-xs font-bold rounded transition-colors"
            >
              View
            </button>
            <button
              onClick={() => {
                resetRange();
                setSelectedAccountId("all");
              }}
              className="h-[34px] px-5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold rounded border border-white/10 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-2">Quick Ranges:</span>
          {["Today", "Yesterday", "This Month", "Last 30 Days", "All Time"].map((range) => (
            <button
              key={range}
              onClick={() => selectQuickRange(range)}
              className="px-3 py-1 bg-[#1e1e1e] hover:bg-white/5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-[10px] font-bold rounded transition-all"
            >
              {range}
            </button>
          ))}
        </div>
      </section>

      {/* Zerodha Console Summary Statements */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Opening Balance", value: openingBalance, color: "text-white" },
          { label: "Total Credits (Pay-in)", value: totalInflow, color: "text-emerald-500" },
          { label: "Total Debits (Pay-out)", value: totalOutflow, color: "text-rose-500" },
          { label: "Closing Balance", value: closingBalance, color: "text-white" },
        ].map((s, i) => (
          <div key={i} className="p-5 rounded border border-white/10 bg-[#151515] flex flex-col justify-between min-h-[90px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{s.label}</p>
            <p className={`text-xl font-normal tracking-tight ${s.color} mt-2`}>
              {formatMoney(s.value, "INR")}
            </p>
          </div>
        ))}
      </section>

      <LedgerDataTable
        logs={allFilteredLogs}
        getLogCurrency={getLogCurrency}
        isDebitLog={isDebitLog}
        isCreditLog={isCreditLog}
        getActionBadge={getActionBadge}
        formatMoney={formatMoney}
        onReset={resetRange}
        onRevert={async (logId) => {
          const { revertLedgerTransaction } = await import("./actions");
          const { toast } = await import("react-hot-toast");
          const res = await revertLedgerTransaction(logId);
          if (res.success) {
            toast.success("Transaction reverted successfully");
            mutate();
          } else {
            toast.error(res.error || "Failed to revert transaction");
          }
        }}
      />
    </div>
  );
}
