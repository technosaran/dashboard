"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

import { 
  logFnoTrade, 
  closeFnoTrade, 
  deleteFnoTrade 
} from "./actions";
import { useFinanceData, type FinanceData, type FnoTrade } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import PnLValue from "@/components/pnl-value";

function formatNum(val: number, decimals = 2): string {
  return val.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function FnoClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { fnoTrades, accounts }, isValidating } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  
  const [showLogForm, setShowLogForm] = useState(searchParams?.get("action") === "new");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<FnoTrade | null>(null);
  const [submitting, withLock] = useSubmitLock();

  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");

  // Form states
  const [logFormData, setLogFormData] = useState({
    symbol: "",
    instrument_type: "FUT" as "FUT" | "CE" | "PE",
    strike_price: "",
    expiry_date: "",
    trade_type: "BUY" as "BUY" | "SELL",
    quantity: "",
    entry_price: "",
    account_id: "",
    notes: "",
    trade_date: new Date().toISOString().split("T")[0]
  });

  const [closeFormData, setCloseFormData] = useState({
    exit_price: "",
    close_date: new Date().toISOString().split("T")[0]
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const active = fnoTrades.filter(t => t.status === "OPEN");
    const closed = fnoTrades.filter(t => t.status === "CLOSED");

    const totalRealizedPnL = closed.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
    const activeCost = active.reduce((acc, t) => acc + (Number(t.quantity) * Number(t.entry_price)), 0);

    const wins = closed.filter(t => Number(t.pnl || 0) > 0).length;
    const losses = closed.filter(t => Number(t.pnl || 0) <= 0).length;
    const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

    return {
      activeCount: active.length,
      closedCount: closed.length,
      totalRealizedPnL,
      activeCost,
      winRate,
      wins,
      losses
    };
  }, [fnoTrades]);

  // Tab filters
  const activePositions = useMemo(() => {
    return fnoTrades.filter(t => t.status === "OPEN");
  }, [fnoTrades]);

  const closedHistory = useMemo(() => {
    return fnoTrades.filter(t => t.status === "CLOSED");
  }, [fnoTrades]);

  function resetLogForm() {
    setLogFormData({
      symbol: "",
      instrument_type: "FUT",
      strike_price: "",
      expiry_date: "",
      trade_type: "BUY",
      quantity: "",
      entry_price: "",
      account_id: "",
      notes: "",
      trade_date: new Date().toISOString().split("T")[0]
    });
    setShowLogForm(false);
  }

  function resetCloseForm() {
    setCloseFormData({
      exit_price: "",
      close_date: new Date().toISOString().split("T")[0]
    });
    setSelectedTrade(null);
    setShowCloseForm(false);
  }

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      try {
        const qty = parseFloat(logFormData.quantity);
        const price = parseFloat(logFormData.entry_price);
        const strike = logFormData.strike_price ? parseFloat(logFormData.strike_price) : undefined;

        if (isNaN(qty) || qty <= 0) {
          toast.error("Please enter a valid quantity");
          return;
        }
        if (isNaN(price) || price < 0) {
          toast.error("Please enter a valid entry price");
          return;
        }

        const res = await logFnoTrade({
          symbol: logFormData.symbol.toUpperCase().trim(),
          instrument_type: logFormData.instrument_type,
          strike_price: strike,
          expiry_date: logFormData.expiry_date,
          trade_type: logFormData.trade_type,
          quantity: qty,
          entry_price: price,
          account_id: logFormData.account_id || undefined,
          notes: logFormData.notes || undefined,
          trade_date: logFormData.trade_date
        });

        if (!res.error) {
          toast.success("FnO Trade logged successfully!");
          resetLogForm();
        } else {
          toast.error(res.error);
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to log trade.");
      }
    });
  }

  async function handleCloseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTrade) return;

    await withLock(async () => {
      try {
        const exitPrice = parseFloat(closeFormData.exit_price);
        if (isNaN(exitPrice) || exitPrice < 0) {
          toast.error("Please enter a valid exit price");
          return;
        }

        const res = await closeFnoTrade(selectedTrade.id, {
          exit_price: exitPrice,
          close_date: closeFormData.close_date
        });

        if (!res.error) {
          toast.success("Position closed successfully!");
          resetCloseForm();
        } else {
          toast.error(res.error);
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to close position.");
      }
    });
  }

  async function handleDeleteTrade(id: string) {
    if (!confirm("Are you sure you want to delete this trade log? Reverting this log will restore linked bank/broker accounts to their pre-trade balances.")) return;

    await withLock(async () => {
      try {
        const res = await deleteFnoTrade(id);
        if (!res.error) {
          toast.success("Trade record deleted successfully");
        } else {
          toast.error(res.error);
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to delete trade.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[--text-primary]">FnO Trading</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Futures & Options Auditing Board</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowLogForm(true)} 
            className="btn-primary !h-12 md:!h-11 !px-8 w-full md:w-auto text-[13px] md:text-[11px] font-black uppercase tracking-widest shadow-[0_4px_20px_rgba(var(--accent-primary-rgb),0.3)]"
          >
            Log New Trade
          </button>
        </div>
      </div>

      {/* ── Statistics Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 mb-4">
        <div className="glass-card-static p-6 flex flex-col gap-2 border border-white/10 bg-white/[0.02]">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Active Capital Deployed</span>
          <span className="text-xl md:text-2xl font-black tabular-nums">₹{formatNum(stats.activeCost)}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2 border border-white/10 bg-white/[0.02]">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Net Realized P&L</span>
          <PnLValue value={stats.totalRealizedPnL} size="lg" className="items-start" />
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2 border border-white/10 bg-white/[0.02]">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Win/Loss (Closed)</span>
          <span className="text-xl md:text-2xl font-black text-white">{stats.wins} <span className="text-slate-500 font-bold">/</span> {stats.losses}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2 border border-white/10 bg-white/[0.02]">
          <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Win Rate (Closed)</span>
          <span className="text-xl md:text-2xl font-black text-[--accent-primary-light] tabular-nums">{stats.winRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 gap-4 px-4">
        <div className="flex items-center gap-8">
           <button 
             onClick={() => setActiveTab("positions")}
             className={`text-xs font-black uppercase tracking-widest pb-3 px-1 transition-all ${activeTab === 'positions' ? 'text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]' : 'text-[--text-muted] hover:text-[--text-primary]'}`}
           >
             Active Positions ({activePositions.length})
           </button>
           <button 
             onClick={() => setActiveTab("history")}
             className={`text-xs font-black uppercase tracking-widest pb-3 px-1 transition-all ${activeTab === 'history' ? 'text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]' : 'text-[--text-muted] hover:text-[--text-primary]'}`}
           >
             Closed History ({closedHistory.length})
           </button>
        </div>
      </div>

      {/* ── Content View ── */}
      <div className="px-4">
        {activeTab === "positions" ? (
          activePositions.length > 0 ? (
            <div className="w-full overflow-x-auto custom-scrollbar border border-white/10 rounded-2xl bg-white/[0.01]">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[9px] text-[--text-muted] uppercase font-black tracking-widest">
                    <th className="py-4 px-6 font-black">Trade Date</th>
                    <th className="py-4 px-4 font-black">Contract</th>
                    <th className="py-4 px-4 font-black">Expiry</th>
                    <th className="py-4 px-4 font-black">Type</th>
                    <th className="py-4 px-4 font-black text-right">Quantity</th>
                    <th className="py-4 px-4 font-black text-right">Entry Price</th>
                    <th className="py-4 px-4 font-black text-right">Premium Paid</th>
                    <th className="py-4 px-4 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {activePositions.map((trade) => {
                    const premium = Number(trade.quantity) * Number(trade.entry_price);
                    return (
                      <tr key={trade.id} className="hover:bg-white/[0.015] transition-all">
                        <td className="py-4 px-6 text-[12px] text-[--text-muted] tabular-nums">
                          {trade.trade_date ? format(new Date(trade.trade_date), "MMM d, yyyy") : "N/A"}
                        </td>
                        <td className="py-4 px-4 font-semibold text-white text-[13px]">
                          {trade.symbol} <span className="text-[10px] text-[--text-muted] font-normal">{trade.instrument_type}</span>
                          {trade.strike_price && <span className="ml-2 text-sky-400 font-mono text-xs">₹{Number(trade.strike_price)}</span>}
                        </td>
                        <td className="py-4 px-4 text-[12px] font-semibold text-slate-300 tabular-nums">
                          {trade.expiry_date ? format(new Date(trade.expiry_date), "MMM d, yyyy") : "N/A"}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${trade.trade_type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {trade.trade_type}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] text-white/90 font-mono">{trade.quantity}</td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] text-white/80">₹{formatNum(trade.entry_price)}</td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] font-bold text-white">₹{formatNum(premium)}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => { setSelectedTrade(trade); setShowCloseForm(true); }}
                              className="h-8 px-4 bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-black rounded-lg shadow-md transition-colors uppercase tracking-widest"
                            >
                              Close
                            </button>
                            <button 
                              onClick={() => handleDeleteTrade(trade.id)}
                              disabled={submitting}
                              className="h-8 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-[10px] font-black rounded-lg transition-colors uppercase tracking-widest"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card-static relative overflow-hidden rounded-2xl border border-white/10 p-8 md:p-12 flex flex-col items-center justify-center text-center min-h-[320px]">
              {/* Background glow blurs */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-purple-500/8 rounded-full blur-[80px] pointer-events-none" />

              {/* Icon container with pulse animation */}
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-cyan-500/20 rounded-2xl blur-xl animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
              </div>

              {/* Heading */}
              <h3 className="text-xl md:text-2xl font-black text-[--text-primary] mb-3">Initialize Your Derivatives Desk</h3>

              {/* Description */}
              <p className="text-sm text-[--text-muted] max-w-md leading-relaxed mb-8">
                Your F&O trading board is clear. Log your first futures or options contract to begin tracking positions, premiums, and realized P&L across your portfolio.
              </p>

              {/* CTA button */}
              <button
                onClick={() => setShowLogForm(true)}
                className="btn-primary !h-11 !px-8 text-[11px] font-black uppercase tracking-widest shadow-[0_4px_20px_rgba(var(--accent-primary-rgb),0.3)]"
              >
                Log First Contract
              </button>
            </div>
          )
        ) : (
          closedHistory.length > 0 ? (
            <div className="w-full overflow-x-auto custom-scrollbar border border-white/10 rounded-2xl bg-white/[0.01]">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[9px] text-[--text-muted] uppercase font-black tracking-widest">
                    <th className="py-4 px-6 font-black">Close Date</th>
                    <th className="py-4 px-4 font-black">Contract</th>
                    <th className="py-4 px-4 font-black">Type</th>
                    <th className="py-4 px-4 font-black text-right">Qty</th>
                    <th className="py-4 px-4 font-black text-right">Entry</th>
                    <th className="py-4 px-4 font-black text-right">Exit</th>
                    <th className="py-4 px-4 font-black text-right">Premium paid</th>
                    <th className="py-4 px-4 font-black text-right">Exit value</th>
                    <th className="py-4 px-4 font-black text-right">Realized P&L</th>
                    <th className="py-4 px-4 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {closedHistory.map((trade) => {
                    const entryVal = Number(trade.quantity) * Number(trade.entry_price);
                    const exitVal = Number(trade.quantity) * Number(trade.exit_price || 0);
                    return (
                      <tr key={trade.id} className="hover:bg-white/[0.015] transition-all">
                        <td className="py-4 px-6 text-[12px] text-[--text-muted] tabular-nums">
                          {trade.close_date ? format(new Date(trade.close_date), "MMM d, yyyy") : "N/A"}
                        </td>
                        <td className="py-4 px-4 font-semibold text-white text-[13px]">
                          {trade.symbol} <span className="text-[10px] text-[--text-muted] font-normal">{trade.instrument_type}</span>
                          {trade.strike_price && <span className="ml-2 text-sky-400 font-mono text-xs">₹{Number(trade.strike_price)}</span>}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${trade.trade_type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {trade.trade_type}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] font-mono text-white/90">{trade.quantity}</td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] text-white/70">₹{formatNum(trade.entry_price)}</td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] text-white/80">₹{formatNum(trade.exit_price || 0)}</td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] text-white/70">₹{formatNum(entryVal)}</td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] text-white/80">₹{formatNum(exitVal)}</td>
                        <td className="py-4 px-4 text-right tabular-nums text-[13px] font-bold">
                          <PnLValue value={Number(trade.pnl || 0)} showSign={true} size="sm" prefix="₹" />
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button 
                            onClick={() => handleDeleteTrade(trade.id)}
                            disabled={submitting}
                            className="h-8 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-[10px] font-black rounded-lg transition-colors uppercase tracking-widest"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card-static relative overflow-hidden rounded-2xl border border-white/10 p-8 md:p-12 flex flex-col items-center justify-center text-center min-h-[320px]">
              {/* Background glow blurs */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-violet-500/8 rounded-full blur-[80px] pointer-events-none" />

              {/* Icon container with pulse animation */}
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              {/* Heading */}
              <h3 className="text-xl md:text-2xl font-black text-[--text-primary] mb-3">Establish Your Trade Ledger</h3>

              {/* Description */}
              <p className="text-sm text-[--text-muted] max-w-md leading-relaxed">
                Closed position history will appear here once you settle your first derivative contract. Track realized gains, losses, and win-rate analytics over time.
              </p>
            </div>
          )
        )}
      </div>

      {/* ── Log Trade Modal ── */}
      {showLogForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card-static w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/20 bg-[--bg-surface]">
            <div className="flex justify-between items-center mb-8 pb-2 border-b border-white/5">
              <h2 className="text-2xl font-black text-white">Log FnO Trade</h2>
              <button onClick={resetLogForm} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <svg className="w-8 h-8 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleLogSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Underlying Symbol</label>
                  <input
                    required value={logFormData.symbol}
                    onChange={e => setLogFormData({ ...logFormData, symbol: e.target.value.toUpperCase() })}
                    className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[13px] text-white outline-none font-bold placeholder:text-[--text-disabled] uppercase"
                    placeholder="e.g. NIFTY, SBIN"
                    autoComplete="off"
                  />
                </div>

                <div className="flex gap-1 p-1 bg-[--bg-base] rounded-xl border border-white/15">
                  {(["FUT", "CE", "PE"] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLogFormData({ ...logFormData, instrument_type: type })}
                      className={`flex-1 h-10 text-[10px] font-black rounded-lg transition-all ${logFormData.instrument_type === type ? "bg-[--accent-primary] text-white shadow-md" : "text-[--text-muted] hover:text-[--text-primary]"}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Strike Price</label>
                  <input
                    type="number"
                    step="any"
                    disabled={logFormData.instrument_type === "FUT"}
                    value={logFormData.strike_price}
                    onChange={e => setLogFormData({ ...logFormData, strike_price: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] disabled:opacity-40 disabled:border-white/5 disabled:placeholder-transparent rounded-xl text-[13px] text-white outline-none font-bold"
                    placeholder="e.g. 18500"
                  />
                </div>

                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Contract Expiry</label>
                  <input
                    required type="date"
                    value={logFormData.expiry_date}
                    onChange={e => setLogFormData({ ...logFormData, expiry_date: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[13px] text-white outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Order Action</label>
                  <select
                    value={logFormData.trade_type}
                    onChange={e => setLogFormData({ ...logFormData, trade_type: e.target.value as "BUY" | "SELL" })}
                    className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[12px] text-white outline-none font-black appearance-none"
                  >
                    <option value="BUY" className="bg-[--bg-surface] text-emerald-400">BUY (Long / Pay Premium)</option>
                    <option value="SELL" className="bg-[--bg-surface] text-rose-400">SELL (Short / Collect Premium)</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Contract Date</label>
                  <input
                    required type="date"
                    value={logFormData.trade_date}
                    onChange={e => setLogFormData({ ...logFormData, trade_date: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[13px] text-white outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Lot Quantity</label>
                  <input
                    required type="number"
                    value={logFormData.quantity}
                    onChange={e => setLogFormData({ ...logFormData, quantity: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[13px] text-white outline-none font-bold"
                    placeholder="e.g. 50"
                  />
                </div>

                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Avg Entry Premium</label>
                  <input
                    required type="number"
                    step="any"
                    value={logFormData.entry_price}
                    onChange={e => setLogFormData({ ...logFormData, entry_price: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[13px] text-white outline-none font-bold"
                    placeholder="e.g. 124.50"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Linked Bank/Broker Account (Premium Flow)</label>
                <select
                  value={logFormData.account_id}
                  onChange={e => setLogFormData({ ...logFormData, account_id: e.target.value })}
                  className="w-full h-12 px-4 pr-10 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[12px] text-white outline-none font-bold appearance-none"
                >
                  <option value="" className="bg-[--bg-surface] text-slate-400">N/A (Historical / Unlinked)</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} className="bg-[--bg-surface] text-white">
                      {acc.name} (₹{formatNum(acc.balance)})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Auditing Notes</label>
                <textarea
                  value={logFormData.notes}
                  onChange={e => setLogFormData({ ...logFormData, notes: e.target.value })}
                  className="w-full min-h-[60px] py-3 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[13px] text-white outline-none font-medium placeholder:text-[--text-disabled]"
                  placeholder="Optional annotations for this derivative trade"
                />
              </div>

              <button
                type="submit" disabled={submitting}
                className="btn-primary w-full h-12 uppercase tracking-widest font-black text-[11px] shadow-lg rounded-xl mt-4"
              >
                {submitting ? "Opening Contract Position..." : "Authorize Derivative Position"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Close Position Modal ── */}
      {showCloseForm && selectedTrade && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card-static w-full max-w-md p-8 border border-white/20 bg-[--bg-surface] rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-white/5">
              <h2 className="text-xl font-black text-white">Close Position</h2>
              <button onClick={resetCloseForm} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <svg className="w-8 h-8 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-2">
              <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-widest">Active Position Details</p>
              <p className="text-sm font-bold text-white">
                {selectedTrade.symbol} {selectedTrade.instrument_type} {selectedTrade.strike_price && `₹${Number(selectedTrade.strike_price)}`}
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <span className="text-[--text-muted]">Holding Size:</span> <span className="font-mono font-bold text-white">{selectedTrade.quantity}</span>
                </div>
                <div>
                  <span className="text-[--text-muted]">Avg Entry:</span> <span className="font-bold text-white">₹{formatNum(selectedTrade.entry_price)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleCloseSubmit} className="space-y-5">
              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Avg Exit Premium</label>
                <input
                  required type="number"
                  step="any"
                  value={closeFormData.exit_price}
                  onChange={e => setCloseFormData({ ...closeFormData, exit_price: e.target.value })}
                  className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[13px] text-white outline-none font-bold"
                  placeholder="e.g. 148.30"
                  autoFocus
                />
              </div>

              <div className="relative">
                <label className="absolute -top-2 left-2 px-1 bg-[--bg-surface] text-[9px] text-[--text-muted] uppercase tracking-widest font-black z-10">Settlement Date</label>
                <input
                  required type="date"
                  value={closeFormData.close_date}
                  onChange={e => setCloseFormData({ ...closeFormData, close_date: e.target.value })}
                  className="w-full h-12 px-4 bg-transparent border border-white/15 focus:border-[--accent-primary] rounded-xl text-[13px] text-white outline-none font-bold"
                />
              </div>

              <button
                type="submit" disabled={submitting}
                className="btn-primary w-full h-12 uppercase tracking-widest font-black text-[11px] shadow-lg rounded-xl mt-4"
              >
                {submitting ? "Settling Position..." : "Finalize Position & Settle P&L"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
