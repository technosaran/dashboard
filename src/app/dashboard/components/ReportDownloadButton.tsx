"use client";

import { useState } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { Drawer } from "@/components/ui/drawer";

const AVAILABLE_MODULES = [
  { id: "accounts", label: "Bank & Credit Accounts", desc: "Liquid balances, savings, and credit cards" },
  { id: "transactions", label: "Transactions & Ledger Log", desc: "Income, expenses, and transfer history" },
  { id: "stocks", label: "Equities & Stocks (INR)", desc: "Direct stock holdings and portfolio values" },
  { id: "mutual_funds", label: "Mutual Funds & SIPs", desc: "Holdings across all AMC schemes and units" },
  { id: "bonds", label: "Bonds & Fixed Income", desc: "Fixed rate bonds, T-bills, and coupon yields" },
  { id: "alternative_assets", label: "Alternative Assets", desc: "Real estate, gold, and startup equity" },
  { id: "liabilities", label: "Loans & Outstanding Liabilities", desc: "Home loans, car loans, and EMI status" },
  { id: "usd_portfolio", label: "USD Portfolio & Crypto Assets", desc: "US stocks, crypto tokens, and USD cash" },
];

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

export default function ReportDownloadButton() {
  const mounted = useHasMounted();
  const [isOpen, setIsOpen] = useState(false);

  const now = new Date();
  const [rangeMode, setRangeMode] = useState<"monthly" | "custom">("monthly");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const pad = (n: number) => String(n).padStart(2, "0");
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
  const [endDate, setEndDate] = useState(now.toISOString().split("T")[0]);

  const [selectedModules, setSelectedModules] = useState<Set<string>>(
    new Set(AVAILABLE_MODULES.map((m) => m.id))
  );

  const [format, setFormat] = useState<"pdf" | "csv">("pdf");

  if (!mounted) return null;

  const toggleModule = (id: string) => {
    const next = new Set(selectedModules);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedModules(next);
  };

  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedModules(new Set(AVAILABLE_MODULES.map((m) => m.id)));
    } else {
      setSelectedModules(new Set());
    }
  };

  const handleExport = () => {
    if (selectedModules.size === 0) {
      alert("Please select at least one particular or section to export.");
      return;
    }

    const modulesQuery = Array.from(selectedModules).join(",");
    const params = new URLSearchParams();
    params.set("modules", modulesQuery);
    params.set("format", format);

    if (rangeMode === "monthly") {
      params.set("month", String(month));
      params.set("year", String(year));
    } else {
      const startIso = `${startDate}T00:00:00.000Z`;
      const endIso = `${endDate}T23:59:59.999Z`;
      params.set("startDate", startIso);
      params.set("endDate", endIso);
      params.set("month", String(new Date(startDate).getMonth() + 1));
      params.set("year", String(new Date(startDate).getFullYear()));
    }

    window.open(`/api/reports/download?${params.toString()}`, "_blank");
    setIsOpen(false);
  };

  const yearsList = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="flex items-center">
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary !h-10 px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 shadow-lg shadow-black/20 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-400 transition-all cursor-pointer"
        title="Custom financial statement and particulars export"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export Statement & Particulars
      </button>

      {isOpen && (
        <Drawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Export Statement & Particulars"
        >
          <div className="space-y-6 text-white py-2">
            {/* Format Selection */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-[--text-muted] block mb-2.5">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormat("pdf")}
                  className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                    format === "pdf"
                      ? "bg-cyan-500/15 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/10 font-bold"
                      : "bg-white/[0.02] border-white/10 text-[--text-secondary] hover:bg-white/5"
                  }`}
                >
                  <span className="text-xl">📄</span>
                  <div className="text-left">
                    <div className="text-xs font-bold">PDF Report</div>
                    <div className="text-[10px] opacity-75 font-normal">Formatted executive statement</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("csv")}
                  className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                    format === "csv"
                      ? "bg-cyan-500/15 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/10 font-bold"
                      : "bg-white/[0.02] border-white/10 text-[--text-secondary] hover:bg-white/5"
                  }`}
                >
                  <span className="text-xl">📊</span>
                  <div className="text-left">
                    <div className="text-xs font-bold">CSV Spreadsheet</div>
                    <div className="text-[10px] opacity-75 font-normal">Raw data tables for analysis</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Date Range Selection */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-[--text-muted]">
                  Statement Period / Date Range
                </label>
                <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setRangeMode("monthly")}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      rangeMode === "monthly"
                        ? "bg-[--accent-primary] text-white shadow"
                        : "text-[--text-muted] hover:text-white"
                    }`}
                  >
                    By Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangeMode("custom")}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      rangeMode === "custom"
                        ? "bg-[--accent-primary] text-white shadow"
                        : "text-[--text-muted] hover:text-white"
                    }`}
                  >
                    Custom Range
                  </button>
                </div>
              </div>

              {rangeMode === "monthly" ? (
                <div className="grid grid-cols-2 gap-3 bg-white/[0.02] p-3.5 rounded-xl border border-white/10">
                  <div>
                    <label className="text-[10px] font-semibold text-[--text-muted] block mb-1">Month</label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {MONTHS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[--text-muted] block mb-1">Year</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {yearsList.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 bg-white/[0.02] p-3.5 rounded-xl border border-white/10">
                  <div>
                    <label className="text-[10px] font-semibold text-[--text-muted] block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[--text-muted] block mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Particulars Selection */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-[--text-muted]">
                  Select Particulars / Sections ({selectedModules.size}/{AVAILABLE_MODULES.length})
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {AVAILABLE_MODULES.map((module) => {
                  const isChecked = selectedModules.has(module.id);
                  return (
                    <div
                      key={module.id}
                      onClick={() => toggleModule(module.id)}
                      className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${
                        isChecked
                          ? "bg-cyan-500/10 border-cyan-500/40 text-white"
                          : "bg-white/[0.01] border-white/5 text-[--text-secondary] opacity-75 hover:opacity-100 hover:bg-white/5"
                      }`}
                    >
                      <div className="mt-0.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{module.label}</div>
                        <div className="text-[10px] text-[--text-muted] leading-tight mt-0.5 line-clamp-1">{module.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-[--text-secondary] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={selectedModules.size === 0}
                className="px-5 py-2.5 rounded-xl bg-[--accent-primary] hover:bg-[--accent-primary]/90 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-lg shadow-[--accent-primary]/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>🚀</span> Export Selected ({selectedModules.size})
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
