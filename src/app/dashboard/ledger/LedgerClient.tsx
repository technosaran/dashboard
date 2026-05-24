"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { endOfDay, format, getMonth, getYear, isWithinInterval, startOfDay } from "date-fns";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";

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

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created",
  DELETE: "Deleted",
  UPDATE: "Updated",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  ADJUST_UP: "Adjust Up",
  ADJUST_DOWN: "Adjust Down",
  SEND_MONEY: "Family Transfer",
};

const ACTION_TONE: Record<string, string> = {
  CREATE: "text-success bg-success/10",
  DELETE: "text-danger bg-danger/10",
  UPDATE: "text-[--accent-primary-light] bg-[--accent-primary]/10",
  TRANSFER_IN: "text-success bg-success/10",
  TRANSFER_OUT: "text-danger bg-danger/10",
  ADJUST_UP: "text-success bg-success/10",
  ADJUST_DOWN: "text-danger bg-danger/10",
  SEND_MONEY: "text-danger bg-danger/10",
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
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

      if (startDate || endDate) {
        const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
        const end = endDate ? endOfDay(new Date(endDate)) : new Date();
        return isWithinInterval(date, { start, end });
      }

      const logYear = getYear(date).toString();
      const logMonth = MONTHS[getMonth(date) + 1];
      const matchYear = yearFilter === "All Years" || logYear === yearFilter;
      const matchMonth = monthFilter === "All Months" || logMonth === monthFilter;

      return matchYear && matchMonth;
    });
  }, [endDate, logs, monthFilter, startDate, yearFilter]);

  const totalFilteredCount = allFilteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const filteredLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return allFilteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [allFilteredLogs, currentPage]);

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

      let dateLabel = format(logDate, "MMM d, yyyy");
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

  const getActionBadge = (type: string) => {
    const label = ACTION_LABELS[type] || type;
    const tone = ACTION_TONE[type] || "text-[--text-secondary] bg-white/5";

    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ${tone}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="glass-card-static p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[--text-primary] sm:text-3xl">Ledger</h1>
            <p className="mt-1 text-sm text-[--text-muted]">Track balance movements and account activity in one place.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-[--text-muted]">
            <span className={`h-2.5 w-2.5 rounded-full ${isValidating ? "animate-pulse bg-warning" : "bg-success"}`} />
            {isValidating ? "Syncing" : "Up to date"}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card-static p-4">
          <p className="text-xs text-[--text-muted]">Total inflow</p>
          <p className="mt-2 text-2xl font-semibold text-success">+{formatMoney(totalInflow)}</p>
        </div>
        <div className="glass-card-static p-4">
          <p className="text-xs text-[--text-muted]">Total outflow</p>
          <p className="mt-2 text-2xl font-semibold text-danger">-{formatMoney(totalOutflow)}</p>
        </div>
        <div className="glass-card-static p-4">
          <p className="text-xs text-[--text-muted]">Entries</p>
          <p className="mt-2 text-2xl font-semibold text-[--text-primary]">{logs.length.toLocaleString()}</p>
        </div>
        <div className="glass-card-static p-4">
          <p className="text-xs text-[--text-muted]">Filtered results</p>
          <p className="mt-2 text-2xl font-semibold text-[--text-primary]">{totalFilteredCount.toLocaleString()}</p>
        </div>
      </section>

      <section className="glass-card-static p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[--text-muted]">Year</span>
            <select
              className="input-premium !h-11 !text-sm"
              value={yearFilter}
              onChange={(event) => {
                setYearFilter(event.target.value);
                setCurrentPage(1);
                resetRange();
              }}
            >
              {uniqueYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[--text-muted]">Month</span>
            <select
              className="input-premium !h-11 !text-sm"
              value={monthFilter}
              onChange={(event) => {
                setMonthFilter(event.target.value);
                setCurrentPage(1);
                resetRange();
              }}
            >
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[--text-muted]">Start date</span>
            <input
              type="date"
              className="input-premium !h-11 !text-sm"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setCurrentPage(1);
              }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[--text-muted]">End date</span>
            <input
              type="date"
              className="input-premium !h-11 !text-sm"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setCurrentPage(1);
              }}
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setYearFilter("All Years");
                setMonthFilter("All Months");
                resetRange();
                setCurrentPage(1);
              }}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-[--text-secondary] transition hover:bg-white/10"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <section className="glass-card-static overflow-hidden p-0">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-4 text-xs font-medium text-[--text-muted]">Timestamp</th>
                <th className="px-4 py-4 text-xs font-medium text-[--text-muted]">Action</th>
                <th className="px-4 py-4 text-xs font-medium text-[--text-muted]">Account</th>
                <th className="px-4 py-4 text-xs font-medium text-[--text-muted]">Amount</th>
                <th className="px-4 py-4 text-xs font-medium text-[--text-muted]">Details</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-[--text-muted]">Undo</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-6">
                      <div className="h-4 rounded bg-white/10" />
                    </td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <p className="text-lg font-medium text-[--text-primary]">No entries found</p>
                    <p className="mt-1 text-sm text-[--text-muted]">Try a different date range or clear filters.</p>
                  </td>
                </tr>
              ) : (
                Object.entries(groupedLogs).map(([dateLabel, logsInGroup]) => (
                  <Fragment key={dateLabel}>
                    <tr className="sticky top-0 z-10 border-y border-white/10" style={{ backgroundColor: "rgba(21, 25, 34, 0.95)" }}>
                      <td colSpan={6} className="px-6 py-2.5 text-xs font-medium text-[--accent-primary-light]">
                        {dateLabel}
                      </td>
                    </tr>

                    {logsInGroup.map((log) => {
                      const isDebit = isDebitLog(log);

                      return (
                        <tr key={log.id} className="transition hover:bg-white/[0.03]">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm text-[--text-primary]">
                              {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "—"}
                            </p>
                            <p className="text-xs text-[--text-muted]">
                              {log.created_at ? format(new Date(log.created_at), "HH:mm:ss") : "—"}
                            </p>
                          </td>

                          <td className="px-4 py-4 whitespace-nowrap">{getActionBadge(log.action_type)}</td>

                          <td className="px-4 py-4 text-sm text-[--text-secondary]">{log.account_name || "System"}</td>

                          <td className="px-4 py-4 whitespace-nowrap">
                            <p className={`text-base font-semibold ${isDebit ? "text-danger" : "text-success"}`}>
                              {log.amount !== null ? `${isDebit ? "-" : "+"}${formatMoney(log.amount)}` : "—"}
                            </p>
                            <p className="text-xs text-[--text-muted]">Balance: {formatMoney(log.new_balance)}</p>
                          </td>

                          <td className="px-4 py-4 text-sm text-[--text-muted]">{log.details || "—"}</td>

                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setRevertingId(log.id);
                                setShowRevertConfirm(true);
                              }}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[--text-secondary] transition hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                              title="Undo"
                            >
                              Undo
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>

          {totalFilteredCount > 0 && (
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[--text-secondary] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <p className="text-xs text-[--text-muted]">
                Page {currentPage} of {totalPages}
              </p>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[--text-secondary] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="divide-y divide-white/10 md:hidden">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="animate-pulse p-4">
                <div className="h-4 rounded bg-white/10" />
              </div>
            ))
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-base font-medium text-[--text-primary]">No entries found</p>
              <p className="mt-1 text-xs text-[--text-muted]">Try a different range.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isDebit = isDebitLog(log);

              return (
                <article key={log.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[--text-muted]">
                        {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss") : "—"}
                      </p>
                      <p className="mt-1 text-sm text-[--text-secondary]">{log.account_name || "System"}</p>
                    </div>
                    {getActionBadge(log.action_type)}
                  </div>

                  <p className={`text-xl font-semibold ${isDebit ? "text-danger" : "text-success"}`}>
                    {log.amount !== null ? `${isDebit ? "-" : "+"}${formatMoney(log.amount)}` : "—"}
                  </p>

                  <p className="mt-1 text-xs text-[--text-muted]">Balance: {formatMoney(log.new_balance)}</p>
                  <p className="mt-2 text-sm text-[--text-muted]">{log.details || "—"}</p>

                  <button
                    type="button"
                    onClick={() => {
                      setRevertingId(log.id);
                      setShowRevertConfirm(true);
                    }}
                    className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[--text-secondary] transition hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                  >
                    Undo
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>

      {showRevertConfirm && (
        <div className="mobile-dialog-shell fixed inset-0 z-[200] flex items-center justify-center bg-[--bg-base]/80 p-4 backdrop-blur-sm">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-[--text-primary]">Undo this ledger entry?</h3>
            <p className="mt-2 text-sm text-[--text-muted]">This will restore the prior balance and remove this action from history.</p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!revertingId) return;

                  const { revertLog } = await import("./actions");
                  const result = await revertLog(revertingId);

                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    toast.success("Entry reverted successfully");
                  }

                  setShowRevertConfirm(false);
                  setRevertingId(null);
                }}
                className="flex-1 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white transition hover:bg-danger/90"
              >
                Confirm undo
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRevertConfirm(false);
                  setRevertingId(null);
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[--text-secondary] transition hover:bg-white/10"
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
