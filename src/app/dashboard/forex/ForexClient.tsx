"use client";
import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { logForexTrade, updateForexTrade } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format } from "date-fns";
import PnLValue from "@/components/pnl-value";
import type { Tables } from "@/lib/database.types";

export default function ForexClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { accounts, forexTrades } } = useFinanceData(initialData);
  
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showEditTradeModal, setShowEditTradeModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Tables<"forex_trades"> | null>(null);
  const [submitting, withLock] = useSubmitLock();

  // Form States
  const [tradeForm, setTradeForm] = useState({ 
    forex_account_id: "", 
    trade_date: new Date().toISOString().split("T")[0],
    notes: "" 
  });

  const [editTradeForm, setEditTradeForm] = useState({
    forex_account_id: "",
    trade_date: "",
    notes: ""
  });

  // Profit/Loss Toggles and Amounts
  const [tradePnlType, setTradePnlType] = useState<"profit" | "loss">("profit");
  const [tradeAmount, setTradeAmount] = useState("");

  const [editTradePnlType, setEditTradePnlType] = useState<"profit" | "loss">("profit");
  const [editTradeAmount, setEditTradeAmount] = useState("");

  // Stats computed strictly from trade P&L entries
  const stats = useMemo(() => {
    const totalPnL = forexTrades.reduce((sum, t) => sum + Number(t.pnl), 0);
    const totalTrades = forexTrades.length;
    const winningDays = forexTrades.filter(t => Number(t.pnl) > 0).length;
    const losingDays = forexTrades.filter(t => Number(t.pnl) < 0).length;
    const winRate = totalTrades > 0 ? Math.round((winningDays / totalTrades) * 1000) / 10 : 0;
    return { totalPnL, totalTrades, winningDays, losingDays, winRate };
  }, [forexTrades]);

  const getAccountLabel = (id: string | null) => {
    if (!id) return "—";
    const std = accounts.find(a => a.id === id);
    return std ? std.name : "Standard Account";
  };

  async function handleLogTrade(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const rawVal = parseFloat(tradeAmount);
      if (isNaN(rawVal) || rawVal <= 0 || !Number.isFinite(rawVal)) {
        toast.error("Please enter a valid positive amount");
        return;
      }
      const finalPnl = tradePnlType === "profit" ? rawVal : -rawVal;
      const res = await logForexTrade({
        forex_account_id: tradeForm.forex_account_id,
        pair: "DAILY_P&L",
        trade_type: "BUY",
        lot_size: 1,
        pnl: finalPnl,
        trade_date: tradeForm.trade_date || undefined,
        notes: tradeForm.notes || undefined,
      });
      if (res.success) {
        toast.success("Daily profit/loss logged successfully");
        setShowTradeModal(false);
        setTradeForm({ 
          forex_account_id: "", 
          trade_date: new Date().toISOString().split("T")[0],
          notes: "" 
        });
        setTradeAmount("");
        setTradePnlType("profit");
      } else toast.error(res.error || "Failed");
    });
  }

  const startEditTrade = (trade: Tables<"forex_trades">) => {
    setEditingTrade(trade);
    setEditTradePnlType(trade.pnl >= 0 ? "profit" : "loss");
    setEditTradeAmount(Math.abs(trade.pnl).toString());
    setEditTradeForm({
      forex_account_id: trade.forex_account_id || "",
      trade_date: trade.trade_date ? new Date(trade.trade_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      notes: trade.notes || ""
    });
    setShowEditTradeModal(true);
  };

  async function handleUpdateTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTrade) return;
    await withLock(async () => {
      const rawVal = parseFloat(editTradeAmount);
      if (isNaN(rawVal) || rawVal <= 0 || !Number.isFinite(rawVal)) {
        toast.error("Please enter a valid positive amount");
        return;
      }
      const finalPnl = editTradePnlType === "profit" ? rawVal : -rawVal;
      const res = await updateForexTrade(editingTrade.id, {
        forex_account_id: editTradeForm.forex_account_id,
        pair: "DAILY_P&L",
        trade_type: "BUY",
        lot_size: 1,
        pnl: finalPnl,
        trade_date: editTradeForm.trade_date,
        notes: editTradeForm.notes || undefined
      });
      if (res.success) {
        toast.success("Daily summary updated successfully");
        setShowEditTradeModal(false);
        setEditingTrade(null);
      } else {
        toast.error(res.error || "Failed to update trade");
      }
    });
  }

  // Live P&L Form Preview calculations
  const parsedPreviewTrade = useMemo(() => {
    const amt = parseFloat(tradeAmount);
    if (isNaN(amt) || amt <= 0) return "0.00";
    return (tradePnlType === "profit" ? "+" : "-") + amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [tradeAmount, tradePnlType]);

  const parsedPreviewEdit = useMemo(() => {
    const amt = parseFloat(editTradeAmount);
    if (isNaN(amt) || amt <= 0) return "0.00";
    return (editTradePnlType === "profit" ? "+" : "-") + amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [editTradeAmount, editTradePnlType]);

  return (
    <div className="flex flex-col gap-8 p-4 max-w-7xl mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Forex Terminal</h1>
          <p className="text-xs text-[--text-muted] font-bold uppercase tracking-[0.3em] mt-2">Daily Net Profit & Loss Ledger</p>
        </div>
        <div>
          <button onClick={() => setShowTradeModal(true)} className="btn-primary !h-11 shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.4)]">
            Log Daily P&L
          </button>
        </div>
      </div>

      {forexTrades.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-sky-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <svg className="w-8 h-8 text-[--accent-primary-light]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">Launch Your Forex Terminal</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Keep a clean, aggregate ledger of your daily currency trading results. No complex ticket logging — just record your net performance.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <button onClick={() => setShowTradeModal(true)} className="btn-primary h-13 px-8 rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-xl shadow-[--accent-primary]/20 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
              Log First P&L Entry
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Net P&L", value: stats.totalPnL, formatted: `${stats.totalPnL >= 0 ? "+" : ""}$${stats.totalPnL.toLocaleString()}`, sub: "Net Trading Return", color: stats.totalPnL >= 0 ? "text-success animate-pulse" : "text-danger", icon: "📊" },
          { label: "Win Rate", value: stats.winRate, formatted: `${stats.winRate}%`, sub: "Profitable Logging Days", color: "text-[--accent-primary-light]", icon: "🎯" },
          { label: "Profitable Days", value: stats.winningDays, formatted: `${stats.winningDays} Days`, sub: "Green Sessions", color: "text-emerald-400", icon: "🟢" },
          { label: "Losing Days", value: stats.losingDays, formatted: `${stats.losingDays} Days`, sub: "Red Sessions", color: "text-rose-400", icon: "🔴" },
        ].map((s, i) => (
          <div key={i} className="glass-card-static p-4 md:p-6 border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-4xl opacity-[0.03] group-hover:opacity-[0.07] transition-opacity rotate-12">{s.icon}</div>
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 md:mb-3">{s.label}</p>
            <p className={`text-xl md:text-2xl font-black tabular-nums ${s.color}`}>{s.formatted}</p>
            <p className="text-[8px] md:text-[9px] font-bold text-[--text-muted] mt-1 md:mt-2 uppercase tracking-widest opacity-60">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Trades List Section */}
      <div className="min-h-[400px]">
        {/* Desktop Trades Table */}
        <div className="hidden md:block glass-card-static overflow-x-auto custom-scrollbar border-white/5">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                <th className="p-4">Date</th>
                <th className="p-4">Account</th>
                <th className="p-4">Notes</th>
                <th className="p-4 text-right">Net P&L</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {forexTrades.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-[12px] font-medium text-[--text-muted]">{format(new Date(t.trade_date), "MMM d, yyyy")}</td>
                  <td className="p-4 text-[12px] font-bold text-[--text-secondary]">{getAccountLabel(t.forex_account_id)}</td>
                  <td className="p-4 text-[12px] text-[--text-muted] max-w-xs truncate" title={t.notes || ""}>{t.notes || "—"}</td>
                  <td className="p-4 text-right">
                    <PnLValue value={t.pnl} prefix="$" size="sm" className="items-end" />
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => startEditTrade(t)} className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white text-[9px] font-black uppercase rounded transition-all">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Trades Cards layout */}
        <div className="md:hidden space-y-4">
          {forexTrades.map((t) => (
            <div key={t.id} className="glass-card-static p-5 active:bg-white/[0.04] transition-all relative overflow-hidden border-white/5">
              <div className="flex justify-between items-start gap-2 mb-2">
                <div>
                  <span className="text-xs font-bold text-[--text-muted]">
                    {format(new Date(t.trade_date), "MMMM d, yyyy")}
                  </span>
                  <p className="text-sm font-black text-white mt-0.5">{getAccountLabel(t.forex_account_id)}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <PnLValue value={t.pnl} prefix="$" size="md" className="items-end" />
                </div>
              </div>

              {t.notes && (
                <div className="border-t border-white/5 pt-2 mt-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Notes</p>
                  <p className="text-xs text-[--text-secondary] italic">{t.notes}</p>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => startEditTrade(t)}
                  className="flex-1 py-2 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit Entry
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* Log Trade Modal */}
      {showTradeModal && (
        <div className="mobile-dialog-shell fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md p-6 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-black mb-6 text-white text-left uppercase italic tracking-wide">Log Daily Profit/Loss</h2>

            <form onSubmit={handleLogTrade} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Select Account</label>
                {accounts.length === 0 ? (
                  <div className="text-xs text-rose-400 font-bold p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    No accounts found. Please create an account in the standard{" "}
                    <a href="/dashboard/accounts" className="underline text-sky-400 hover:text-sky-300">
                      Accounts Section
                    </a>{" "}
                    first.
                  </div>
                ) : (
                  <select required className="input-premium" value={tradeForm.forex_account_id} onChange={e => setTradeForm({...tradeForm, forex_account_id: e.target.value})}>
                    <option value="" className="bg-[--bg-surface]">Select Account</option>
                    {accounts.map(a => <option key={a.id} value={a.id} className="bg-[--bg-surface]">{a.name} ({a.currency})</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1.5">Entry Type</label>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-2">
                  <button
                    type="button"
                    onClick={() => setTradePnlType("profit")}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${tradePnlType === "profit" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/5" : "text-[--text-muted] hover:text-white border border-transparent"}`}
                  >
                    🟢 Profit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradePnlType("loss")}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${tradePnlType === "loss" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/5" : "text-[--text-muted] hover:text-white border border-transparent"}`}
                  >
                    🔴 Loss (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Total P&L Amount ($)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  className="input-premium font-bold text-white text-base" 
                  placeholder="e.g. 150.00" 
                  value={tradeAmount} 
                  onChange={e => setTradeAmount(e.target.value)} 
                />
              </div>

              {/* Foolproof calculation preview block */}
              {parseFloat(tradeAmount) > 0 && (
                <div className={`p-4 rounded-xl border flex justify-between items-center transition-all animate-in slide-in-from-top-2 duration-300 ${tradePnlType === "profit" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest">Calculation Preview</span>
                  <span className="text-base font-black tabular-nums">{parsedPreviewTrade}</span>
                </div>
              )}

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Date</label>
                <input required type="date" className="input-premium text-white" value={tradeForm.trade_date} onChange={e => setTradeForm({...tradeForm, trade_date: e.target.value})} />
              </div>
              
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes</label>
                <textarea className="input-premium min-h-[80px]" placeholder="Summary of today's trading results, session details..." value={tradeForm.notes} onChange={e => setTradeForm({...tradeForm, notes: e.target.value})} />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowTradeModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting || accounts.length === 0} className="btn-primary flex-1">
                  {submitting ? "Logging..." : "Log Profit/Loss"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Trade Modal */}
      {showEditTradeModal && (
        <div className="mobile-dialog-shell fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md p-6 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-black mb-6 text-white text-left uppercase italic tracking-wide">Edit Daily Profit/Loss</h2>

            <form onSubmit={handleUpdateTrade} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Select Account</label>
                <select required className="input-premium" value={editTradeForm.forex_account_id} onChange={e => setEditTradeForm({...editTradeForm, forex_account_id: e.target.value})}>
                  <option value="" className="bg-[--bg-surface]">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id} className="bg-[--bg-surface]">{a.name} ({a.currency})</option>)}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1.5">Entry Type</label>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTradePnlType("profit")}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${editTradePnlType === "profit" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/5" : "text-[--text-muted] hover:text-white border border-transparent"}`}
                  >
                    🟢 Profit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTradePnlType("loss")}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${editTradePnlType === "loss" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/5" : "text-[--text-muted] hover:text-white border border-transparent"}`}
                  >
                    🔴 Loss (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Total P&L Amount ($)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  className="input-premium font-bold text-white text-base" 
                  placeholder="e.g. 150.00" 
                  value={editTradeAmount} 
                  onChange={e => setEditTradeAmount(e.target.value)} 
                />
              </div>

              {/* Foolproof calculation preview block */}
              {parseFloat(editTradeAmount) > 0 && (
                <div className={`p-4 rounded-xl border flex justify-between items-center transition-all animate-in slide-in-from-top-2 duration-300 ${editTradePnlType === "profit" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest">Calculation Preview</span>
                  <span className="text-base font-black tabular-nums">{parsedPreviewEdit}</span>
                </div>
              )}

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Date</label>
                <input required type="date" className="input-premium text-white" value={editTradeForm.trade_date} onChange={e => setEditTradeForm({...editTradeForm, trade_date: e.target.value})} />
              </div>
              
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes</label>
                <textarea className="input-premium min-h-[80px]" placeholder="Trade notes..." value={editTradeForm.notes} onChange={e => setEditTradeForm({...editTradeForm, notes: e.target.value})} />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditTradeModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
