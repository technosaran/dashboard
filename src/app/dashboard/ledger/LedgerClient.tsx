"use client";

import { useMemo, useState, Fragment } from "react";
import { endOfDay, format, isWithinInterval, startOfDay } from "date-fns";
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

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, withLock] = useSubmitLock();
  
  // Calendar states
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date().getMonth());
  const [currentCalendarYear, setCurrentCalendarYear] = useState(new Date().getFullYear());

  const itemsPerPage = 50;

  const calendarDays = useMemo(() => {
    const days = [];
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();

    // Padding for days of previous month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(currentCalendarYear, currentCalendarMonth, i));
    }

    return days;
  }, [currentCalendarMonth, currentCalendarYear]);

  const handleDayClick = (day: Date) => {
    const formattedDate = format(day, "yyyy-MM-dd");
    
    if (!startDate || (startDate && endDate)) {
      setStartDate(formattedDate);
      setEndDate("");
    } else {
      if (formattedDate < startDate) {
        setStartDate(formattedDate);
        setEndDate("");
      } else {
        setEndDate(formattedDate);
        setShowCalendar(false);
      }
    }
    setCurrentPage(1);
  };

  const handlePrevMonth = () => {
    if (currentCalendarMonth === 0) {
      setCurrentCalendarMonth(11);
      setCurrentCalendarYear(currentCalendarYear - 1);
    } else {
      setCurrentCalendarMonth(currentCalendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentCalendarMonth === 11) {
      setCurrentCalendarMonth(0);
      setCurrentCalendarYear(currentCalendarYear + 1);
    } else {
      setCurrentCalendarMonth(currentCalendarMonth + 1);
    }
  };

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
    setCurrentPage(1);
    setShowCalendar(false);
  };

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

      return true;
    });
  }, [endDate, logs, startDate, searchQuery]);

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

  const getActionBadge = (type: string) => {
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
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-2">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Financial Ledger</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.3em] mt-1.5">Consolidated Audit Trail & Balance History</p>
          </div>
          <div className="inline-flex items-center gap-2 mt-1">
            <span className={`h-2 w-2 rounded-full shadow-lg ${isValidating ? "animate-pulse bg-warning shadow-warning/40" : "bg-success shadow-success/40"}`} />
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
      <section className="flex flex-col md:flex-row gap-4 items-center px-2">
        {/* Real-time Search input */}
        <div className="relative flex-1 w-full group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-40 group-focus-within:opacity-100 transition-opacity" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder="Search ledger logs by description, account name, action type, or exact amount..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-14 bg-white/[0.015] border border-white/[0.05] rounded-2xl pl-12 pr-4 py-4 text-sm font-semibold text-[--text-primary] focus:border-[--accent-primary] focus:bg-white/[0.03] outline-none transition-all placeholder-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] focus:shadow-[0_0_20px_rgba(99,102,241,0.08)]"
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

        {/* Date Range Calendar Picker */}
        <div className="relative w-full md:w-[320px] shrink-0">
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full h-14 bg-white/[0.015] border border-white/[0.05] hover:border-white/10 focus:border-[--accent-primary] transition-all rounded-2xl px-4 flex items-center justify-between cursor-pointer text-sm font-bold text-[--text-primary]"
          >
            <span className="flex items-center gap-2">
              <span>📅</span>
              {startDate || endDate ? (
                <span className="text-white text-xs">
                  {startDate ? format(new Date(startDate), "MMM d, yyyy") : "—"} to {endDate ? format(new Date(endDate), "MMM d, yyyy") : "—"}
                </span>
              ) : (
                <span className="text-white/40 text-xs">Filter by Date Range...</span>
              )}
            </span>
            {startDate || endDate ? (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  resetRange();
                  setCurrentPage(1);
                }}
                className="text-[9px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded"
              >
                Clear
              </span>
            ) : (
              <span className="text-xs opacity-40">▼</span>
            )}
          </button>

          {showCalendar && (
            <>
              {/* Click outside overlay */}
              <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
              
              {/* Calendar Card Dropdown */}
              <div 
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 glass-card-static !p-4 border border-white/10 rounded-2xl w-[320px] shadow-2xl flex flex-col gap-4 animate-scale-in"
                style={{ background: "rgba(10, 14, 28, 0.95)", backdropFilter: "blur(20px)" }}
              >
                {/* Calendar Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <button 
                    type="button" 
                    onClick={handlePrevMonth}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center font-bold text-xs text-white"
                  >
                    ◀
                  </button>
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    {MONTHS[currentCalendarMonth + 1]} {currentCalendarYear}
                  </span>
                  <button 
                    type="button" 
                    onClick={handleNextMonth}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center font-bold text-xs text-white"
                  >
                    ▶
                  </button>
                </div>

                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <span key={d} className="text-[9px] font-black uppercase text-[--text-muted]">{d}</span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarDays.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} />;
                    
                    const formatted = format(day, "yyyy-MM-dd");
                    const isSelectedStart = startDate === formatted;
                    const isSelectedEnd = endDate === formatted;
                    const isWithinRange = startDate && endDate && formatted >= startDate && formatted <= endDate;
                    
                    return (
                      <button
                        key={formatted}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={`w-9 h-9 rounded-xl text-[11px] font-black transition-all flex items-center justify-center ${
                          isSelectedStart || isSelectedEnd
                            ? "bg-[--accent-primary] text-white shadow-lg shadow-[--accent-primary]/25"
                            : isWithinRange
                            ? "bg-[--accent-primary]/15 text-[--accent-primary-light] border border-[--accent-primary]/10"
                            : "hover:bg-white/5 text-white/70 hover:text-white"
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Selection Shortcuts */}
                <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-2">
                  {["Today", "Yesterday", "This Month", "Last 30 Days"].map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => selectQuickRange(range)}
                      className="py-2 bg-white/5 hover:bg-white/10 transition-colors text-[9px] font-black uppercase tracking-wider text-white/80 hover:text-white rounded-lg border border-white/5"
                    >
                      {range}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => selectQuickRange("All Time")}
                    className="col-span-2 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-[9px] font-black uppercase tracking-wider transition-colors rounded-lg"
                  >
                    Reset Date Range
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Main Ledger Event Trail (Crisp Financial Grid Table) */}
      <section className="glass-card-static p-0 rounded-[24px] border border-white/10 overflow-hidden bg-white/[0.01] shadow-lg shadow-black/25">
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
          <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
            <div className="text-5xl">🛡️</div>
            <div>
              <p className="text-lg font-black text-white">No Ledger Entries Located</p>
              <p className="text-sm text-[--text-muted] mt-1 max-w-sm">No transaction matches the current filters or query string.</p>
            </div>
            <button
              onClick={() => {
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
          <div className="w-full">
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="min-w-full divide-y divide-white/10 table-fixed">
                <thead className="bg-white/[0.02]">
                  <tr className="border-b border-white/10">
                    <th scope="col" className="w-[16%] px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Timestamp</th>
                    <th scope="col" className="w-[15%] px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Action type</th>
                    <th scope="col" className="w-[15%] px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Registry Account</th>
                    <th scope="col" className="w-[30%] px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Audit details</th>
                    <th scope="col" className="w-[14%] px-4 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Amount Flow</th>
                    <th scope="col" className="w-[10%] px-6 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Reversal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {Object.entries(groupedLogs).map(([dateLabel, logsInGroup]) => (
                    <Fragment key={dateLabel}>
                      {/* Sticky Date Row Section */}
                      <tr className="sticky top-0 z-10 border-y border-white/10 bg-[#0d121f]">
                        <td colSpan={6} className="px-6 py-3 text-[11px] font-black uppercase tracking-[0.25em] text-[--accent-primary-light]">
                          🗓️ {dateLabel}
                        </td>
                      </tr>

                      {/* Entries within this Date Group */}
                      {logsInGroup.map((log) => {
                        const isDebit = isDebitLog(log);
                        return (
                          <tr key={log.id} className="transition-colors hover:bg-white/[0.02] border-b border-white/5">
                            {/* Timestamp */}
                            <td className="px-6 py-4.5 whitespace-nowrap">
                              <p className="text-xs font-bold text-white tracking-tight">
                                {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "—"}
                              </p>
                              <p className="text-[10px] font-mono text-[--text-muted] mt-1 tracking-widest uppercase">
                                {log.created_at ? format(new Date(log.created_at), "hh:mm:ss a") : "—"}
                              </p>
                            </td>

                            {/* Action Badge */}
                            <td className="px-4 py-4.5 whitespace-nowrap">
                              {getActionBadge(log.action_type)}
                            </td>

                            {/* Account Name */}
                            <td className="px-4 py-4.5 whitespace-nowrap">
                              <span className="text-xs font-bold text-white tracking-tight px-2 py-1 rounded bg-white/5 border border-white/10">
                                {log.account_name || "System"}
                              </span>
                            </td>

                            {/* Details */}
                            <td className="px-4 py-4.5 text-xs text-[--text-secondary] leading-relaxed break-words" style={{ wordBreak: "break-word" }}>
                              {log.details || "No transactional details provided"}
                            </td>

                            {/* Amount Flow */}
                            <td className="px-4 py-4.5 whitespace-nowrap text-right">
                              <p className={`text-base font-black tabular-nums tracking-tight ${isDebit ? "text-danger" : "text-success"}`}>
                                {log.amount !== null ? `${isDebit ? "-" : "+"}${formatMoney(log.amount)}` : "—"}
                              </p>
                              {log.new_balance !== null && (
                                <p className="text-[10px] font-bold text-[--text-muted] mt-1.5 uppercase tracking-widest opacity-60">
                                  Bal: {formatMoney(log.new_balance)}
                                </p>
                              )}
                            </td>

                            {/* Reversal Undo Action */}
                            <td className="px-6 py-4.5 whitespace-nowrap text-center">
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                  setRevertingId(log.id);
                                  setShowRevertConfirm(true);
                                }}
                                className="inline-flex items-center gap-1.5 h-8 px-3 border border-white/10 hover:border-danger/30 bg-white/5 hover:bg-danger/10 text-[10px] font-black uppercase tracking-widest text-[--text-secondary] hover:text-danger rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none"
                                title="Undo Transaction"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                </svg>
                                Undo
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="divide-y divide-white/10 md:hidden">
              {Object.entries(groupedLogs).map(([dateLabel, logsInGroup]) => (
                <div key={dateLabel} className="flex flex-col">
                  {/* Date section header on mobile */}
                  <div className="sticky top-0 z-10 px-4 py-2.5 bg-[#0d121f] border-y border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[--accent-primary-light]">{dateLabel}</span>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-white/5 text-[--text-muted] uppercase border border-white/5">
                      {logsInGroup.length} logs
                    </span>
                  </div>

                  {/* Individual Mobile Log Cards */}
                  <div className="divide-y divide-white/5 bg-[#0a0e1c]/40">
                    {logsInGroup.map((log) => {
                      const isDebit = isDebitLog(log);
                      return (
                        <article key={log.id} className="p-4 flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-mono text-[--text-muted] tracking-wider uppercase">
                                {log.created_at ? format(new Date(log.created_at), "hh:mm:ss a") : "—"}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-black text-white tracking-tight px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                  {log.account_name || "System"}
                                </span>
                              </div>
                            </div>
                            {getActionBadge(log.action_type)}
                          </div>

                          <p className="text-xs text-[--text-secondary] leading-relaxed break-words">{log.details || "No transactional details provided"}</p>

                          <div className="flex items-end justify-between mt-1">
                            <div>
                              <p className={`text-base font-black tabular-nums tracking-tight ${isDebit ? "text-danger" : "text-success"}`}>
                                {log.amount !== null ? `${isDebit ? "-" : "+"}${formatMoney(log.amount)}` : "—"}
                              </p>
                              {log.new_balance !== null && (
                                <p className="text-[9px] font-bold text-[--text-muted] mt-0.5 uppercase tracking-widest opacity-60">
                                  Bal: {formatMoney(log.new_balance)}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => {
                                setRevertingId(log.id);
                                setShowRevertConfirm(true);
                              }}
                              className="inline-flex items-center gap-1 h-8 px-3 border border-white/10 hover:border-danger/30 bg-white/5 hover:bg-danger/10 text-[9px] font-black uppercase tracking-wider text-[--text-secondary] hover:text-danger rounded-lg transition-all disabled:opacity-30"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                              </svg>
                              Undo
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination controls */}
        {totalFilteredCount > 0 && (
          <div className="flex items-center justify-between border-t border-white/10 p-5 bg-white/[0.01]">
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
          <div className="glass-card-static w-full max-w-md p-8 border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.15)] rounded-[32px] text-center animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar">
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
