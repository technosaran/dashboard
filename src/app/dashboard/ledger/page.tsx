"use client";

import { useCallback, useEffect, useState, startTransition, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import { format, getYear, getMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";

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

const ACTION_TYPES = [
  "All Actions",
  "CREATE",
  "UPDATE",
  "DELETE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ADJUST_UP",
  "ADJUST_DOWN",
  "LOG_ONLY"
];

const MONTHS = [
  "All Months", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function LedgerPage() {
  const [logs, setLogs] = useState<LedgerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Actions");
  const [accountFilter, setAccountFilter] = useState("All Accounts");
  const [yearFilter, setYearFilter] = useState("All Years");
  const [monthFilter, setMonthFilter] = useState("All Months");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
      .channel("ledger-updates-v4")
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_logs" }, () => startTransition(fetchLogs))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs]);

  const uniqueAccounts = useMemo(() => {
    const accs = new Set<string>();
    logs.forEach(l => { if (l.account_name) accs.add(l.account_name); });
    return ["All Accounts", ...Array.from(accs)];
  }, [logs]);

  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    logs.forEach(l => years.add(getYear(new Date(l.created_at)).toString()));
    return ["All Years", ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const date = new Date(log.created_at);
      const logYear = getYear(date).toString();
      const logMonth = MONTHS[getMonth(date) + 1];

      // Standard filters
      const matchSearch = (log.details?.toLowerCase().includes(search.toLowerCase()) || 
                           log.account_name?.toLowerCase().includes(search.toLowerCase()));
      const matchType = typeFilter === "All Actions" || log.action_type === typeFilter;
      const matchAccount = accountFilter === "All Accounts" || log.account_name === accountFilter;

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
  }, [logs, search, typeFilter, accountFilter, yearFilter, monthFilter, startDate, endDate]);

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
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: style.bg, color: style.color, border: `1px solid ${style.bg}` }}>
        {style.text}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-[--text-primary]">
            Audit Trail
          </h1>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-[--text-secondary] font-medium text-xs uppercase tracking-widest">
              Centralized Ledger System
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Filter Architecture */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-[32px] backdrop-blur-3xl shadow-2xl">
          <div className="relative col-span-1 md:col-span-2">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Search audit trail..." 
              className="input-premium pl-10 py-3 text-sm w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input-premium py-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {ACTION_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <select className="input-premium py-3 text-sm" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            {uniqueAccounts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-2">
           {/* Layer 1: Calendar Selection */}
           <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-[--text-muted] tracking-[0.2em] ml-2">Year</span>
                <select className="input-premium py-2.5 text-xs" value={yearFilter} onChange={(e) => {setYearFilter(e.target.value); setStartDate(""); setEndDate("");}}>
                  {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-[--text-muted] tracking-[0.2em] ml-2">Month</span>
                <select className="input-premium py-2.5 text-xs" value={monthFilter} onChange={(e) => {setMonthFilter(e.target.value); setStartDate(""); setEndDate("");}}>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
           </div>

           {/* Layer 2: Specific Date Range */}
           <div className="grid grid-cols-2 gap-4 border-l border-white/5 pl-8">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-[--text-muted] tracking-[0.2em] ml-2">From Date</span>
                <input 
                  type="date" 
                  className="input-premium py-2 text-xs" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-[--text-muted] tracking-[0.2em] ml-2">To Date</span>
                <input 
                  type="date" 
                  className="input-premium py-2 text-xs" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
           </div>
        </div>
      </div>

      <div className="overflow-hidden border border-white/5 bg-[var(--bg-surface)] backdrop-blur-xl shadow-2xl" style={{ borderRadius: "var(--radius-3xl)" }}>
        {/* Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Timestamp</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Operation</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Account</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Amount</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Audit Details</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-center">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-8"><div className="h-4 bg-white/5 rounded w-full" /></td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center">
                    <div className="text-5xl mb-6 opacity-40">📅</div>
                    <h3 className="text-2xl font-black text-[--text-primary]">No logs found in this range</h3>
                    <p className="text-sm text-[--text-muted] mt-2">Adjust your start/end dates or clear filters to reset.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isDebit = ["ADJUST_DOWN", "TRANSFER_OUT", "DELETE"].includes(log.action_type);
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
                           <span className={`text-lg font-black ${isDebit ? "text-red-400" : "text-emerald-400"}`}>
                             {log.amount ? `${isDebit ? '-' : '+'}₹${log.amount.toLocaleString()}` : "—"}
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
                           onClick={async () => {
                             if (!confirm("Proceed with deep reversal? This will restore balances and undo activity.")) return;
                             const { revertLog } = await import("./actions");
                             const res = await revertLog(log.id);
                             if (res.error) alert(res.error);
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
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-white/5">
           {filteredLogs.map(l => (
             <div key={l.id} className="p-6">
                <div className="flex justify-between items-center mb-3">
                   <div className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">{format(new Date(l.created_at), "MMM d, yyyy")}</div>
                   {getActionBadge(l.action_type)}
                </div>
                <div className="text-xl font-bold mb-2">₹{l.amount?.toLocaleString()}</div>
                <div className="text-xs text-[--text-muted]">{l.details}</div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
