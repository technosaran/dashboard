"use client";

import { useCallback, useEffect, useState, startTransition, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import { format, getYear, getMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { toast } from "react-hot-toast";
import { useFinanceData } from "@/hooks/use-finance-data";

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

const MONTHS = [
  "All Months", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function LedgerClient() {
  const { data: { ledgerLogs: logs }, isValidating, isLoading } = useFinanceData();
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
    logs.forEach(l => years.add(getYear(new Date(l.created_at)).toString()));
    return ["All Years", ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      const date = new Date(log.created_at);
      const logYear = getYear(date).toString();
      const logMonth = MONTHS[getMonth(date) + 1];

      // Standard filters
      const matchSearch = true;
      const matchType = true;
      const matchAccount = true;

      // Conditional filters (Year/Month VS Date Range)
      let matchDate = true;
      if (startDate || endDate) {
        // Date Range logic
        const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
        const end = endDate ? endOfDay(new Date(endDate)) : new Date();
        matchDate = isWithinInterval(date, { start, end });
      } else {
        // Year/Month logic
        const matchYear = yearFilter === "All Years" || logYear === yearFilter;
        const matchMonth = monthFilter === "All Months" || logMonth === monthFilter;
        matchDate = matchYear && matchMonth;
      }

      return matchSearch && matchType && matchAccount && matchDate;
    });
    
    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [logs, yearFilter, monthFilter, startDate, endDate, currentPage]);

  const totalFilteredCount = useMemo(() => {
    return logs.filter(log => {
      const date = new Date(log.created_at);
      const logYear = getYear(date).toString();
      const logMonth = MONTHS[getMonth(date) + 1];

      const matchSearch = true;
      const matchType = true;
      const matchAccount = true;

      let matchDate = true;
      if (startDate || endDate) {
        const start = startDate ? startOfDay(new Date(startDate)) : new Date(0);
        const end = endDate ? endOfDay(new Date(endDate)) : new Date();
        matchDate = isWithinInterval(date, { start, end });
      } else {
        const matchYear = yearFilter === "All Years" || logYear === yearFilter;
        const matchMonth = monthFilter === "All Months" || logMonth === monthFilter;
        matchDate = matchYear && matchMonth;
      }

      return matchSearch && matchType && matchAccount && matchDate;
    }).length;
  }, [logs, yearFilter, monthFilter, startDate, endDate]);

  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  const getActionBadge = (type: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      CREATE: { bg: "rgba(0, 184, 148, 0.12)", color: "var(--success)", text: "Created" },
      DELETE: { bg: "rgba(214, 48, 49, 0.12)", color: "var(--danger)", text: "Deleted" },
      UPDATE: { bg: "rgba(116, 185, 255, 0.12)", color: "#74b9ff", text: "Updated" },
      TRANSFER_IN: { bg: "rgba(0, 184, 148, 0.12)", color: "var(--success)", text: "Transfer In" },
      TRANSFER_OUT: { bg: "rgba(214, 48, 49, 0.12)", color: "var(--danger)", text: "Transfer Out" },
      ADJUST_UP: { bg: "rgba(0, 184, 148, 0.12)", color: "var(--success)", text: "Adjust Up" },
      ADJUST_DOWN: { bg: "rgba(214, 48, 49, 0.12)", color: "var(--danger)", text: "Adjust Down" },
      SEND_MONEY: { bg: "rgba(214, 48, 49, 0.12)", color: "var(--danger)", text: "Family Transfer" },
    };
    const style = styles[type] || { bg: "rgba(255, 255, 255, 0.05)", color: "var(--text-secondary)", text: type };
    return (
      <span className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center" style={{ background: style.bg, color: style.color }}>
        {style.text}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Audit Trail</h1>
            <p className="text-[11px] md:text-sm mt-1 uppercase tracking-[0.2em] font-black text-[--text-muted]">Financial Registry</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
      </div>

      <div className="space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 px-1">
           <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-[--text-muted] tracking-[0.2em] ml-2">Registry Year</span>
                <select className="input-premium !h-[44px] !text-xs" value={yearFilter} onChange={(e) => {setYearFilter(e.target.value); setStartDate(""); setEndDate("");}}>
                  {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-[--text-muted] tracking-[0.2em] ml-2">Log Month</span>
                <select className="input-premium !h-[44px] !text-xs" value={monthFilter} onChange={(e) => {setMonthFilter(e.target.value); setStartDate(""); setEndDate("");}}>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
           </div>
 
           <div className="grid grid-cols-2 gap-4 md:border-l md:border-white/5 md:pl-8">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-[--text-muted] tracking-[0.2em] ml-2">Bound Start</span>
                <input 
                  type="date" 
                  className="input-premium !h-[44px] !text-xs" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-[--text-muted] tracking-[0.2em] ml-2">Bound End</span>
                <input 
                  type="date" 
                  className="input-premium !h-[44px] !text-xs" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
           </div>
        </div>
      </div>

      <div className="glass-card-static overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Timestamp</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Operation</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Account</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Amount</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Details</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-8"><div className="h-4 bg-white/5 rounded w-full" /></td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">

                    <h3 className="text-2xl font-black text-[--text-primary]">No logs found in this range</h3>
                    <p className="text-sm text-[--text-muted] mt-2">Adjust your start/end dates or clear filters to reset.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isDebit = log.new_balance !== null && log.previous_balance !== null 
                    ? log.new_balance < log.previous_balance 
                    : ["ADJUST_DOWN", "TRANSFER_OUT", "DELETE", "SEND_MONEY"].includes(log.action_type);
                  
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="text-sm font-bold text-[--text-primary]">{format(new Date(log.created_at), "MMM d, yyyy")}</div>
                        <div className="text-[10px] font-medium text-[--text-muted] tracking-tight">{format(new Date(log.created_at), "HH:mm:ss")}</div>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">{getActionBadge(log.action_type)}</td>
                      <td className="px-6 py-6 whitespace-nowrap"><span className="text-sm font-bold text-[--text-secondary]">{log.account_name || "—"}</span></td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <div className="flex flex-col">
                           <span className="text-lg font-black" style={{ color: isDebit ? "var(--danger)" : "var(--success)" }}>
                             {log.amount !== null ? `${isDebit ? '-' : '+'}₹${log.amount.toLocaleString()}` : "—"}
                           </span>
                           <span className="text-[10px] font-black text-[--text-muted]">Net: ₹{log.new_balance?.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6 min-w-[300px]">
                        <div className="text-sm font-medium text-[--text-muted] leading-relaxed group-hover:text-[--text-secondary] transition-colors">
                          {log.details}
                        </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap text-center">
                        <button
                          onClick={() => {
                            setRevertingId(log.id);
                            setShowRevertConfirm(true);
                          }}
                          className="p-3 rounded-2xl bg-white/0 hover:bg-rose-500/10 text-[--text-muted] hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100"
                          title="Undo"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l5 5m-5-5l5-5" /></svg>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-white/5 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[--text-muted] font-bold">
                  Page {currentPage} of {totalPages} ({totalFilteredCount} logs)
                </span>
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="md:hidden divide-y divide-white/[0.03]">
           {filteredLogs.map(l => {
             const isDebit = l.new_balance !== null && l.previous_balance !== null 
               ? l.new_balance < l.previous_balance 
               : ["ADJUST_DOWN", "TRANSFER_OUT", "DELETE", "SEND_MONEY"].includes(l.action_type);

             return (
               <div key={l.id} className="p-5 active:bg-white/[0.02] transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">{format(new Date(l.created_at), "MMM d, yyyy")}</div>
                      <div className="text-[10px] font-bold text-[--text-muted]">{format(new Date(l.created_at), "HH:mm:ss")}</div>
                    </div>
                    {getActionBadge(l.action_type)}
                  </div>
                  <div className="flex items-end justify-between mb-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-tight text-[--text-muted] mb-1">Impact</span>
                      <div className="text-2xl font-black" style={{ color: isDebit ? "var(--danger)" : "var(--success)" }}>
                        {l.amount !== null ? `${isDebit ? '-' : '+'}₹${l.amount.toLocaleString()}` : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-[--text-muted] block mb-1 uppercase tracking-tight">Account Log</span>
                      <div className="text-[13px] font-black text-[--text-primary]">{l.account_name || "System"}</div>
                    </div>
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="text-xs text-[--text-secondary] font-medium leading-relaxed">{l.details}</div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-[10px] font-black text-[--text-muted]">Balance After: ₹{l.new_balance?.toLocaleString()}</div>
                    <button
                      onClick={() => {
                        setRevertingId(l.id);
                        setShowRevertConfirm(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest border border-rose-500/20 active:scale-95 transition-all"
                    >
                      Undo
                    </button>
                  </div>
               </div>
             );
           })}
        </div>
      </div>

      {showRevertConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card-static w-full max-w-sm p-8 animate-scale-in border-orange-500/20 shadow-[0_0_50px_rgba(249,115,22,0.1)]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l5 5m-5-5l5-5" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-[--text-primary] mb-2">Undo this action?</h3>
              <p className="text-sm text-[--text-muted] mb-8 leading-relaxed">
                This will restore your balance and remove this record from your history.
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={async () => {
                    if (!revertingId) return;
                    const { revertLog } = await import("./actions");
                    const res = await revertLog(revertingId);
                    if (res.error) {
                      toast.error(res.error);
                    } else {
                      toast.success("System state restored successfully");
                    }
                    setShowRevertConfirm(false);
                    setRevertingId(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/20"
                >
                  Confirm Undo
                </button>
                <button 
                  onClick={() => { setShowRevertConfirm(false); setRevertingId(null); }}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[--text-primary] font-bold text-sm border border-white/10 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
