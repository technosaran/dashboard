"use client";

import { useMemo, useState } from "react";
import { endOfDay, format, getMonth, getYear, isWithinInterval, startOfDay } from "date-fns";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";
import { revertLog } from "./actions";
import { useSubmitLock } from "@/hooks/use-submit-lock";

type LedgerLog = {
  id: string;
  created_at: string | null;
  account_name: string | null;
  action_type: string;
  amount: number | null;
  previous_balance: number | null;
  new_balance: number | null;
  details: string | null;
};

const MONTHS = [
  "All Months",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

const formatMoney = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  return `₹${value.toLocaleString()}`;
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

export default function LedgerClient() {
  const {
    data: { ledgerLogs: logs },
    isValidating,
    isLoading,
  } = useFinanceData();

  const [yearFilter, setYearFilter] = useState("All Years");
  const [monthFilter, setMonthFilter] = useState("All Months");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, withLock] = useSubmitLock();

  const itemsPerPage = 50;

  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    logs.forEach((log) => {
      if (log.created_at) {
        years.add(getYear(new Date(log.created_at)).toString());
      }
    });

    return ["All Years", ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  }, [logs]);

  const allFilteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!log.created_at) return false;

      const date = new Date(log.created_at);

      // Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const detailsMatch = log.details?.toLowerCase().includes(query) || false;
        const accountMatch = log.account_name?.toLowerCase().includes(query) || false;
        const actionMatch = log.action_type.toLowerCase().includes(query) || false;
        const amountMatch = log.amount?.toString().includes(query) || false;
        if (!detailsMatch && !accountMatch && !actionMatch && !amountMatch) {
          return false;
        }
      }

      // Date Range Filter
      if (startDate || endDate) {
        const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
        const end = endDate ? endOfDay(new Date(endDate)) : new Date();
        return isWithinInterval(date, { start, end });
      }

      // Year/Month dropdown filters
      const logYear = getYear(date).toString();
      const logMonth = MONTHS[getMonth(date) + 1];
      const matchYear = yearFilter === "All Years" || logYear === yearFilter;
      const matchMonth = monthFilter === "All Months" || logMonth === monthFilter;

      return matchYear && matchMonth;
    });
  }, [endDate, logs, monthFilter, startDate, yearFilter, searchQuery]);

  const totalFilteredCount = allFilteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);

  const filteredLogs = useMemo(() => {
    const startIndex = (activePage - 1) * itemsPerPage;
    return allFilteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [allFilteredLogs, activePage]);

  const groupedLogs = useMemo(() => {
    const groups: Record<string, LedgerLog[]> = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    filteredLogs.forEach((log) => {
      if (!log.created_at) return;

      const logDate = new Date(log.created_at);
      const logDateKey = format(logDate, "yyyy-MM-dd");
      const todayKey = format(today, "yyyy-MM-dd");
      const yesterdayKey = format(yesterday, "yyyy-MM-dd");

      let dateLabel = format(logDate, "MMMM d, yyyy");
      if (logDateKey === todayKey) dateLabel = "Today";
      if (logDateKey === yesterdayKey) dateLabel = "Yesterday";

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }

      groups[dateLabel].push(log);
    });

    return groups;
  }, [filteredLogs]);

  const totalInflow = useMemo(() => {
    return logs.reduce((sum, log) => {
      if (!isCreditLog(log)) return sum;
      return sum + (log.amount || 0);
    }, 0);
  }, [logs]);

  const totalOutflow = useMemo(() => {
    return logs.reduce((sum, log) => {
      if (!isDebitLog(log)) return sum;
      return sum + (log.amount || 0);
    }, 0);
  }, [logs]);

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

  return (
    <div className="flex flex-col gap-[var(--section-gap)] max-w-7xl mx-auto w-full px-2">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-2">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Financial Ledger</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.3em] mt-1.5">Consolidated Audit Trail & Balance History</p>
          </div>
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[--text-muted] mt-1">
            <span className={`h-2 w-2 rounded-full shadow-lg ${isValidating ? "animate-pulse bg-warning shadow-warning/40" : "bg-success shadow-success/40"}`} />
            {isValidating ? "Synchronizing" : "Live"}
          </div>
        </div>
      </header>

      {/* Analytics Summary */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Capital Inflow", value: totalInflow, sub: "Revenue & Adjustments", color: "text-success", bg: "from-emerald-500/10", border: "hover:border-emerald-500/20", icon: "📈", sign: "+" },
          { label: "Total Capital Outflow", value: totalOutflow, sub: "Expenses & Transfers", color: "text-danger", bg: "from-rose-500/10", border: "hover:border-rose-500/20", icon: "📉", sign: "-" },
          { label: "Total Audit Logs", value: logs.length, sub: "Uncompromised Records", color: "text-white", bg: "from-indigo-500/10", border: "hover:border-indigo-500/20", icon: "🛡️", raw: true },
          { label: "Matched Query Filters", value: totalFilteredCount, sub: "Active Search Query", color: "text-[--accent-primary-light]", bg: "from-sky-500/10", border: "hover:border-sky-500/20", icon: "🔍", raw: true },
        ].map((s, i) => (
          <div key={i} className={`glass-card-static p-6 flex flex-col justify-between min-h-[140px] rounded-[24px] border border-white/5 bg-gradient-to-br ${s.bg} to-transparent ${s.border} transition-all duration-300 relative group overflow-hidden`}>
            <div className="absolute right-4 top-4 text-3xl opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300">{s.icon}</div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-4">{s.label}</p>
            <div>
              <p className={`text-2xl font-black tabular-nums tracking-tight ${s.color}`}>
                {s.raw ? s.value.toLocaleString() : `${s.sign}${formatMoney(s.value as number)}`}
              </p>
              <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest mt-1 opacity-60">{s.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Modern Filter toolbar */}
      <section className="glass-card-static p-6 rounded-[28px] border border-white/5 space-y-6 bg-gradient-to-r from-white/[0.01] to-transparent hover:border-white/10 transition-all duration-300">
        {/* Real-time Search input */}
        <div className="relative w-full group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-40 group-focus-within:opacity-100 transition-opacity">🔍</span>
          <input
            type="text"
            placeholder="Clearview Search — Filter logs by description, account name, action type, or exact amount..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-white/[0.015] border border-white/[0.05] rounded-2xl pl-12 pr-4 py-4 text-sm font-semibold text-[--text-primary] focus:border-[--accent-primary] focus:bg-white/[0.03] outline-none transition-all placeholder-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus:shadow-[0_0_20px_rgba(99,102,241,0.08)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-wider text-[--text-muted] hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dropdowns and Dates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[--text-muted] ml-1">Period Year</span>
            <select
              className="input-premium !h-12 !text-xs !bg-white/[0.015] !border-white/[0.05] focus:!border-[--accent-primary] hover:!border-white/10 transition-all rounded-xl cursor-pointer"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setCurrentPage(1);
                resetRange();
              }}
            >
              {uniqueYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[--text-muted] ml-1">Period Month</span>
            <select
              className="input-premium !h-12 !text-xs !bg-white/[0.015] !border-white/[0.05] focus:!border-[--accent-primary] hover:!border-white/10 transition-all rounded-xl cursor-pointer"
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setCurrentPage(1);
                resetRange();
              }}
            >
              {MONTHS.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[--text-muted] ml-1">Start Date</span>
            <input
              type="date"
              className="input-premium !h-12 !text-xs !bg-white/[0.015] !border-white/[0.05] focus:!border-[--accent-primary] hover:!border-white/10 transition-all rounded-xl cursor-pointer"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[--text-muted] ml-1">End Date</span>
            <input
              type="date"
              className="input-premium !h-12 !text-xs !bg-white/[0.015] !border-white/[0.05] focus:!border-[--accent-primary] hover:!border-white/10 transition-all rounded-xl cursor-pointer"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setYearFilter("All Years");
                setMonthFilter("All Months");
                setSearchQuery("");
                resetRange();
                setCurrentPage(1);
              }}
              className="h-12 w-full rounded-xl border border-white/5 bg-white/5 px-4 text-xs font-black uppercase tracking-wider text-[--text-secondary] transition hover:bg-white/10 hover:text-white"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </section>

      {/* Main Ledger Event Trail (Clearview Feed) */}
      <section className="glass-card-static p-0 rounded-[32px] border border-white/5 overflow-hidden bg-transparent shadow-none relative">
        {isLoading ? (
          <div className="space-y-4 p-8">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex gap-4 items-center animate-pulse">
                <div className="w-12 h-12 rounded-2xl bg-white/5" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center justify-center gap-4 glass-card-static border-white/5">
            <div className="text-5xl">🛡️</div>
            <div>
              <p className="text-lg font-black text-white">No Ledger Entries Located</p>
              <p className="text-sm text-[--text-muted] mt-1 max-w-sm">No transaction matches the current filters or query string.</p>
            </div>
            <button
              onClick={() => {
                setYearFilter("All Years");
                setMonthFilter("All Months");
                setSearchQuery("");
                resetRange();
                setCurrentPage(1);
              }}
              className="btn-secondary !h-10 !px-6 mt-2 text-[10px] font-black uppercase tracking-widest rounded-xl"
            >
              Restore Audit Stream
            </button>
          </div>
        ) : (
          <div className="flex flex-col relative">
            {/* Timeline Vertical Thread Line */}
            <div className="absolute left-[72px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-indigo-500/25 via-sky-500/15 to-emerald-500/25 pointer-events-none hidden md:block z-0" />

            {Object.entries(groupedLogs).map(([dateLabel, logsInGroup]) => (
              <div key={dateLabel} className="flex flex-col relative z-10">
                {/* Floating Date Capsule Header */}
                <div className="sticky top-3 z-20 px-6 py-2 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-3 bg-white/[0.04] border border-white/10 backdrop-blur-xl px-4 py-1.5 rounded-full shadow-lg shadow-black/30 pointer-events-auto">
                    <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[--accent-primary-light]">{dateLabel}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black bg-white/5 text-[--text-muted] uppercase tracking-widest border border-white/5">
                      {logsInGroup.length} {logsInGroup.length === 1 ? "Event" : "Events"}
                    </span>
                  </div>
                </div>

                {/* Timeline Entries inside group */}
                <div className="flex flex-col">
                  {logsInGroup.map((log) => {
                    const isDebit = isDebitLog(log);
                    const cfg = getActionConfig(log.action_type);

                    return (
                      <div 
                        key={log.id} 
                        className="group flex flex-col md:flex-row md:items-center justify-between p-6 m-3 mx-6 rounded-[24px] bg-white/[0.01] hover:bg-white/[0.025] border border-white/[0.02] hover:border-[--accent-primary]/15 transition-all duration-300 relative gap-6 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.15)] z-10"
                      >
                        {/* Left Info: Icon, Action, Timestamp, Details */}
                        <div className="flex items-start gap-5 flex-1 min-w-0">
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105 border-2 z-10 shadow-lg"
                            style={{ 
                              backgroundColor: cfg.bg, 
                              color: cfg.text, 
                              borderColor: cfg.ring,
                              boxShadow: `0 0 12px ${cfg.ring}`
                            }}
                          >
                            {cfg.icon}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-white tracking-tight">{cfg.label}</span>
                              {log.account_name && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-white/5 border border-white/10 text-[--text-secondary]">
                                  {log.account_name}
                                </span>
                              )}
                              <span className="text-[10px] text-[--text-muted] font-medium hidden sm:inline">
                                • {log.created_at ? format(new Date(log.created_at), "h:mm:ss a") : ""}
                              </span>
                            </div>
                            <p className="text-sm text-[--text-secondary] leading-relaxed break-words">{log.details || "No transactional details provided"}</p>
                          </div>
                        </div>

                        {/* Right: Flow & Actions */}
                        <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 border-t border-white/[0.02] pt-4 md:pt-0 md:border-0">
                          {/* Financial Flows */}
                          <div className="text-left md:text-right flex flex-col justify-center">
                            <span className={`text-xl font-black tabular-nums tracking-tight filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)] ${isDebit ? "text-danger" : "text-success"}`}>
                              {log.amount !== null ? `${isDebit ? "-" : "+"}${formatMoney(log.amount)}` : "—"}
                            </span>
                            {log.new_balance !== null && (
                              <span className="text-[10px] font-bold text-[--text-muted] mt-1 uppercase tracking-widest opacity-60">
                                Bal: {formatMoney(log.new_balance)}
                              </span>
                            )}
                          </div>

                          {/* Action Button: Locked Undo */}
                          <button
                            disabled={submitting}
                            onClick={() => {
                              setRevertingId(log.id);
                              setShowRevertConfirm(true);
                            }}
                            className="h-10 px-5 border border-white/5 hover:border-danger/30 bg-white/5 hover:bg-danger/10 text-[10px] font-black uppercase tracking-widest text-[--text-secondary] hover:text-danger rounded-xl flex items-center justify-center gap-1.5 transition-all md:opacity-0 md:group-hover:opacity-100 disabled:opacity-30 disabled:pointer-events-none"
                            title="Undo Transaction"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                            Undo
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {totalFilteredCount > 0 && (
          <div className="flex items-center justify-between border-t border-white/5 p-6 bg-white/[0.01] m-3 mx-6 rounded-[24px] border border-white/[0.02]">
            <button
              type="button"
              onClick={() => {
                setCurrentPage((page) => Math.max(1, Math.min(totalPages, page) - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={activePage === 1}
              className="btn-secondary !h-10 !px-4 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
              Page {activePage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => {
                setCurrentPage((page) => Math.min(totalPages, Math.min(totalPages, page) + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={activePage === totalPages}
              className="btn-secondary !h-10 !px-4 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Confirmation Undo Dialog */}
      {showRevertConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card-static w-full max-w-md p-8 border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.15)] rounded-[32px] text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-danger/10 text-danger mx-auto flex items-center justify-center mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-white mb-2 uppercase italic">Revert Ledger Entry?</h3>
            <p className="text-sm text-[--text-muted] mb-8 leading-relaxed">
              This action will completely purge this event log from history, restore account balance to its previous state, and undo any automatic ledger logs.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  if (!revertingId) return;
                  await withLock(async () => {
                    const result = await revertLog(revertingId);
                    if (result.error) {
                      toast.error(result.error);
                    } else {
                      toast.success("Transaction entry reverted");
                    }
                    setShowRevertConfirm(false);
                    setRevertingId(null);
                  });
                }}
                className="flex-1 py-3.5 bg-danger hover:bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-500/10 disabled:opacity-50"
              >
                {submitting ? "Reverting..." : "Confirm Undo"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRevertConfirm(false);
                  setRevertingId(null);
                }}
                className="flex-1 py-3.5 border border-white/5 bg-white/5 hover:bg-white/10 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all"
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
