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

const MONTHS = [
  "All Months", "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December",
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
  } = useFinanceData(initialData);

  const getLogCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Calendar states
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date().getMonth());
  const [currentCalendarYear, setCurrentCalendarYear] = useState(new Date().getFullYear());

  const calendarDays = useMemo(() => {
    const days = [];
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();

    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(currentCalendarYear, currentCalendarMonth, i));

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
    setShowCalendar(false);
  };

  const allFilteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!log.created_at) return false;
      const date = new Date(log.created_at);

      if (startDate || endDate) {
        const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
        const end = endDate ? endOfDay(new Date(endDate)) : new Date();
        return isWithinInterval(date, { start, end });
      }
      return true;
    });
  }, [endDate, logs, startDate]);

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

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Capital Inflow", value: totalInflow, sub: "Revenue & Adjustments", color: "text-success", bg: "from-emerald-500/10", border: "hover:border-emerald-500/20", icon: "📈", sign: "+" },
          { label: "Total Capital Outflow", value: totalOutflow, sub: "Expenses & Transfers", color: "text-danger", bg: "from-rose-500/10", border: "hover:border-rose-500/20", icon: "📉", sign: "-" },
          { label: "Total Audit Logs", value: logs.length, sub: "Uncompromised Records", color: "text-white", bg: "from-indigo-500/10", border: "hover:border-indigo-500/20", icon: "🛡️", raw: true },
          { label: "Filtered Records", value: allFilteredLogs.length, sub: "Date Range Filter", color: "text-[--accent-primary-light]", bg: "from-sky-500/10", border: "hover:border-sky-500/20", icon: "🔍", raw: true },
        ].map((s, i) => (
          <div key={i} className={`glass-card-static p-6 flex flex-col justify-between min-h-[140px] rounded-[24px] border border-white/5 bg-gradient-to-br ${s.bg} to-transparent ${s.border} transition-all duration-300 relative group overflow-hidden`}>
            <div className="absolute right-4 top-4 text-3xl opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-300">{s.icon}</div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-4">{s.label}</p>
            <div>
              <p className={`text-2xl font-black tabular-nums tracking-tight ${s.color}`}>
                {s.raw ? s.value.toLocaleString() : `${s.sign}${formatMoney(s.value as number, "INR")}`}
              </p>
              <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest mt-1 opacity-60">{s.sub}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col md:flex-row gap-4 items-center px-2">
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetRange();
                }}
                aria-label="Clear selected date range"
                className="text-[9px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded"
              >
                Clear
              </button>
            ) : (
              <span className="text-xs opacity-40">▼</span>
            )}
          </button>

          {showCalendar && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
              <div 
                className="absolute left-0 md:right-0 top-[calc(100%+0.5rem)] z-50 glass-card-static !p-4 border border-white/10 rounded-2xl w-[320px] shadow-2xl flex flex-col gap-4 animate-scale-in"
                style={{ background: "rgba(10, 14, 28, 0.95)", backdropFilter: "blur(20px)" }}
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <button type="button" onClick={handlePrevMonth} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center font-bold text-xs text-white">◀</button>
                  <span className="text-xs font-black uppercase tracking-wider text-white">{MONTHS[currentCalendarMonth + 1]} {currentCalendarYear}</span>
                  <button type="button" onClick={handleNextMonth} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center font-bold text-xs text-white">▶</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="text-[9px] font-black uppercase text-[--text-muted]">{d}</span>)}
                </div>
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
                        className={`w-9 h-9 rounded-xl text-[11px] font-black transition-all flex items-center justify-center ${isSelectedStart || isSelectedEnd ? "bg-[--accent-primary] text-white shadow-lg shadow-[--accent-primary]/25" : isWithinRange ? "bg-[--accent-primary]/15 text-[--accent-primary-light] border border-[--accent-primary]/10" : "hover:bg-white/5 text-white/70 hover:text-white"}`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-2">
                  {["Today", "Yesterday", "This Month", "Last 30 Days"].map((range) => (
                    <button key={range} type="button" onClick={() => selectQuickRange(range)} className="py-2 bg-white/5 hover:bg-white/10 transition-colors text-[9px] font-black uppercase tracking-wider text-white/80 hover:text-white rounded-lg border border-white/5">{range}</button>
                  ))}
                  <button type="button" onClick={() => selectQuickRange("All Time")} className="col-span-2 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-[9px] font-black uppercase tracking-wider transition-colors rounded-lg">Reset Date Range</button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <LedgerDataTable
        logs={allFilteredLogs}
        getLogCurrency={getLogCurrency}
        isDebitLog={isDebitLog}
        getActionBadge={getActionBadge}
        formatMoney={formatMoney}
        onReset={resetRange}
        onRevert={async (logId) => {
          const { revertLedgerTransaction } = await import("./actions");
          const { toast } = await import("react-hot-toast");
          const res = await revertLedgerTransaction(logId);
          if (res.success) {
            toast.success("Transaction reverted successfully");
          } else {
            toast.error(res.error || "Failed to revert transaction");
          }
        }}
      />
    </div>
  );
}
