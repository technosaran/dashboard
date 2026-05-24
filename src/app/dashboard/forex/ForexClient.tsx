"use client";

import { useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import { 
  createForexAccount, 
  forexDeposit, 
  forexWithdraw, 
  logForexTrade,
  deleteForexAccount,
  updateForexAccount,
  updateForexTrade
} from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { format } from "date-fns";
import PnLValue from "@/components/pnl-value";

export default function ForexClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { accounts, forexAccounts, forexTrades, forexTransactions }, isValidating } = useFinanceData(initialData);
  
  const [activeTab, setActiveTab] = useState<"accounts" | "trades" | "transactions">("accounts");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [fundsType, setFundsType] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [submitting, setSubmitting] = useState(false);

  // Edit States
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [showEditTradeModal, setShowEditTradeModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<any>(null);

  // Form States
  const [accountForm, setAccountForm] = useState({ broker_name: "", account_label: "", account_number: "", currency: "USD" });
  
  const [editAccountForm, setEditAccountForm] = useState({
    broker_name: "",
    account_label: "",
    account_number: "",
    currency: "USD",
    balance: "0",
    total_deposited: "0",
    total_withdrawn: "0",
    total_pnl: "0",
    notes: ""
  });

  const [tradeForm, setTradeForm] = useState({ 
    forex_account_id: "", 
    pair: "EUR/USD", 
    trade_type: "BUY" as "BUY" | "SELL", 
    lot_size: "0.01", 
    pnl: "", 
    trade_date: new Date().toISOString().split("T")[0],
    entry_price: "", 
    exit_price: "", 
    notes: "" 
  });

  const [editTradeForm, setEditTradeForm] = useState({
    forex_account_id: "",
    pair: "",
    trade_type: "BUY" as "BUY" | "SELL",
    lot_size: "0.01",
    pnl: "",
    trade_date: "",
    entry_price: "",
    exit_price: "",
    notes: ""
  });

  const [fundsForm, setFundsForm] = useState({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" });

  // Stats
  const stats = useMemo(() => {
    const totalBalance = forexAccounts.reduce((s, a) => s + Number(a.balance), 0);
    const totalPnL = forexAccounts.reduce((s, a) => s + Number(a.total_pnl), 0);
    const totalDeposited = forexAccounts.reduce((s, a) => s + Number(a.total_deposited), 0);
    const totalWithdrawn = forexAccounts.reduce((s, a) => s + Number(a.total_withdrawn), 0);
    return { totalBalance, totalPnL, totalDeposited, totalWithdrawn };
  }, [forexAccounts]);

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await createForexAccount(accountForm);
    if (res.success) {
      toast.success("Forex account created");
      setShowAccountModal(false);
      setAccountForm({ broker_name: "", account_label: "", account_number: "", currency: "USD" });
    } else toast.error(res.error || "Failed");
    setSubmitting(false);
  }

  const startEditAccount = (acc: any) => {
    setEditingAccount(acc);
    setEditAccountForm({
      broker_name: acc.broker_name || "",
      account_label: acc.account_label || "",
      account_number: acc.account_number || "",
      currency: acc.currency || "USD",
      balance: acc.balance !== undefined ? acc.balance.toString() : "0",
      total_deposited: acc.total_deposited !== undefined ? acc.total_deposited.toString() : "0",
      total_withdrawn: acc.total_withdrawn !== undefined ? acc.total_withdrawn.toString() : "0",
      total_pnl: acc.total_pnl !== undefined ? acc.total_pnl.toString() : "0",
      notes: acc.notes || ""
    });
    setShowEditAccountModal(true);
  };

  async function handleUpdateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAccount) return;
    setSubmitting(true);
    const res = await updateForexAccount(editingAccount.id, {
      broker_name: editAccountForm.broker_name,
      account_label: editAccountForm.account_label,
      account_number: editAccountForm.account_number || undefined,
      currency: editAccountForm.currency,
      balance: parseFloat(editAccountForm.balance),
      total_deposited: parseFloat(editAccountForm.total_deposited),
      total_withdrawn: parseFloat(editAccountForm.total_withdrawn),
      total_pnl: parseFloat(editAccountForm.total_pnl),
      notes: editAccountForm.notes || undefined
    });
    if (res.success) {
      toast.success("Forex account updated successfully");
      setShowEditAccountModal(false);
      setEditingAccount(null);
    } else {
      toast.error(res.error || "Failed to update account");
    }
    setSubmitting(false);
  }

  async function handleLogTrade(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await logForexTrade({
      ...tradeForm,
      lot_size: parseFloat(tradeForm.lot_size),
      pnl: parseFloat(tradeForm.pnl),
      trade_date: tradeForm.trade_date || undefined,
      entry_price: tradeForm.entry_price ? parseFloat(tradeForm.entry_price) : undefined,
      exit_price: tradeForm.exit_price ? parseFloat(tradeForm.exit_price) : undefined,
      notes: tradeForm.notes || undefined,
    });
    if (res.success) {
      toast.success("Trade logged successfully");
      setShowTradeModal(false);
      setTradeForm({ 
        forex_account_id: "", 
        pair: "EUR/USD", 
        trade_type: "BUY", 
        lot_size: "0.01", 
        pnl: "", 
        trade_date: new Date().toISOString().split("T")[0],
        entry_price: "", 
        exit_price: "", 
        notes: "" 
      });
    } else toast.error(res.error || "Failed");
    setSubmitting(false);
  }

  const startEditTrade = (trade: any) => {
    setEditingTrade(trade);
    setEditTradeForm({
      forex_account_id: trade.forex_account_id || "",
      pair: trade.pair || "",
      trade_type: (trade.trade_type || "BUY") as "BUY" | "SELL",
      lot_size: trade.lot_size !== undefined ? trade.lot_size.toString() : "0.01",
      pnl: trade.pnl !== undefined ? trade.pnl.toString() : "0",
      trade_date: trade.trade_date ? new Date(trade.trade_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      entry_price: trade.entry_price !== undefined && trade.entry_price !== null ? trade.entry_price.toString() : "",
      exit_price: trade.exit_price !== undefined && trade.exit_price !== null ? trade.exit_price.toString() : "",
      notes: trade.notes || ""
    });
    setShowEditTradeModal(true);
  };

  async function handleUpdateTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTrade) return;
    setSubmitting(true);
    const res = await updateForexTrade(editingTrade.id, {
      forex_account_id: editTradeForm.forex_account_id,
      pair: editTradeForm.pair,
      trade_type: editTradeForm.trade_type,
      lot_size: parseFloat(editTradeForm.lot_size),
      pnl: parseFloat(editTradeForm.pnl),
      trade_date: editTradeForm.trade_date,
      entry_price: editTradeForm.entry_price ? parseFloat(editTradeForm.entry_price) : undefined,
      exit_price: editTradeForm.exit_price ? parseFloat(editTradeForm.exit_price) : undefined,
      notes: editTradeForm.notes || undefined
    });
    if (res.success) {
      toast.success("Trade updated successfully");
      setShowEditTradeModal(false);
      setEditingTrade(null);
    } else {
      toast.error(res.error || "Failed to update trade");
    }
    setSubmitting(false);
  }

  async function handleFunds(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const action = fundsType === "DEPOSIT" ? forexDeposit : forexWithdraw;
    const res = await action({
      ...fundsForm,
      amount: parseFloat(fundsForm.amount),
    });
    if (res.success) {
      toast.success(`${fundsType} completed`);
      setShowFundsModal(false);
      setFundsForm({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" });
    } else toast.error(res.error || "Failed");
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-8 p-4 max-w-7xl mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Forex Terminal</h1>
          <p className="text-xs text-[--text-muted] font-bold uppercase tracking-[0.3em] mt-2">Global Currency Markets</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={() => setShowAccountModal(true)} className="btn-secondary !h-11">Add Account</button>
          <button onClick={() => { setFundsType("DEPOSIT"); setShowFundsModal(true); }} className="btn-secondary !h-11">Deposit</button>
          <button onClick={() => { setFundsType("WITHDRAW"); setShowFundsModal(true); }} className="btn-secondary !h-11">Withdraw</button>
          <button onClick={() => setShowTradeModal(true)} className="btn-primary !h-11 shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.4)]">Log Trade</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Balance", value: stats.totalBalance, sub: "Available Capital", color: "text-white", icon: "💰" },
          { label: "Total P&L", value: stats.totalPnL, sub: "Trading Performance", color: stats.totalPnL >= 0 ? "text-success" : "text-danger", icon: "📊" },
          { label: "Deposits", value: stats.totalDeposited, sub: "Total Inflow", color: "text-[--accent-primary-light]", icon: "📥" },
          { label: "Withdrawals", value: stats.totalWithdrawn, sub: "Total Outflow", color: "text-warning", icon: "📤" },
        ].map((s, i) => (
          <div key={i} className="glass-card-static p-4 md:p-6 border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-4xl opacity-[0.03] group-hover:opacity-[0.07] transition-opacity rotate-12">{s.icon}</div>
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 md:mb-3">{s.label}</p>
            <p className={`text-xl md:text-2xl font-black tabular-nums ${s.color}`}>${s.value.toLocaleString()}</p>
            <p className="text-[8px] md:text-[9px] font-bold text-[--text-muted] mt-1 md:mt-2 uppercase tracking-widest opacity-60">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-white/5 overflow-x-auto custom-scrollbar">
        {["accounts", "trades", "transactions"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`pb-4 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === tab ? "text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]" : "text-[--text-muted] hover:text-white"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === "accounts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forexAccounts.map((acc) => (
              <div key={acc.id} className="glass-card flex flex-col min-h-[260px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1 group border-white/5">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[--accent-primary] via-[--accent-secondary] to-[--accent-tertiary]" />
                
                <div className="absolute top-4 right-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all flex gap-2">
                   <button onClick={() => startEditAccount(acc)} className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                   </button>
                   <button onClick={() => { if(confirm("Are you sure you want to delete this Forex account?")) deleteForexAccount(acc.id); }} className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                   </button>
                </div>

                <div className="flex justify-between items-start mb-8 pr-16">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[--accent-primary]/10 flex items-center justify-center text-xl shadow-inner border border-white/5">
                      🌎
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white group-hover:text-[--accent-primary-light] transition-colors">{acc.account_label}</h3>
                      <p className="text-[10px] font-bold text-[--text-muted] uppercase tracking-[0.2em] mt-0.5">{acc.broker_name}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-3 py-1 bg-[--accent-primary]/10 text-[--accent-primary-light] rounded-full uppercase tracking-widest border border-[--accent-primary]/20">
                    {acc.currency}
                  </span>
                </div>

                <div className="mt-auto space-y-6">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Net Worth</span>
                    <span className="text-2xl font-black text-white tabular-nums">${Number(acc.balance).toLocaleString()}</span>
                  </div>
                  
                  <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-[8px] font-black text-[--text-muted] uppercase tracking-widest mb-1">Total P&L</p>
                      <PnLValue value={acc.total_pnl} prefix="$" size="sm" className="items-start" />
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-right">
                      <p className="text-[8px] font-black text-[--text-muted] uppercase tracking-widest mb-1">Capital Flow</p>
                      <PnLValue value={Number(acc.total_deposited || 0) - Number(acc.total_withdrawn || 0)} prefix="$" size="sm" className="items-end" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "trades" && (
          <>
            {/* Desktop Trades Table */}
            <div className="hidden md:block glass-card-static overflow-x-auto custom-scrollbar border-white/5">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                    <th className="p-4">Date</th>
                    <th className="p-4">Symbol</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Lots</th>
                    <th className="p-4 text-right">Entry Price</th>
                    <th className="p-4 text-right">Exit Price</th>
                    <th className="p-4 text-right">P&L</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {forexTrades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-[--text-muted] italic">No trades logged yet.</td>
                    </tr>
                  ) : (
                    forexTrades.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 text-[12px] font-medium text-[--text-muted]">{format(new Date(t.trade_date), "MMM d, yyyy")}</td>
                        <td className="p-4 font-black text-white">{t.pair}</td>
                        <td className="p-4">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${t.trade_type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {t.trade_type}
                          </span>
                        </td>
                        <td className="p-4 text-[12px] font-bold text-white tabular-nums">{t.lot_size}</td>
                        <td className="p-4 text-right text-[12px] font-medium text-[--text-secondary] tabular-nums">{t.entry_price || "—"}</td>
                        <td className="p-4 text-right text-[12px] font-medium text-[--text-secondary] tabular-nums">{t.exit_price || "—"}</td>
                        <td className="p-4 text-right">
                          <PnLValue value={t.pnl} prefix="$" size="sm" className="items-end" />
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => startEditTrade(t)} className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white text-[9px] font-black uppercase rounded transition-all">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Trades Cards layout */}
            <div className="md:hidden space-y-4">
              {forexTrades.length === 0 ? (
                <div className="p-8 text-center text-[--text-muted] italic text-sm">No trades logged yet.</div>
              ) : (
                forexTrades.map((t) => (
                  <div key={t.id} className="glass-card-static p-5 active:bg-white/[0.04] transition-all relative overflow-hidden border-white/5">
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <div>
                        <span className="text-sm font-black text-white">{t.pair}</span>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${t.trade_type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {t.trade_type}
                          </span>
                          <span className="text-[10px] font-medium text-[--text-muted]">
                            {format(new Date(t.trade_date), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <PnLValue value={t.pnl} prefix="$" size="md" className="items-end" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 border-t border-white/5 pt-3 mb-4 text-[12px]">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Lots</p>
                        <p className="font-bold text-white tabular-nums">{t.lot_size}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Account Label</p>
                        <p className="font-bold text-[#eee] truncate max-w-[120px] ml-auto">{
                          forexAccounts.find(a => a.id === t.forex_account_id)?.account_label || '—'
                        }</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Entry Price</p>
                        <p className="font-bold text-white tabular-nums">{t.entry_price || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Exit Price</p>
                        <p className="font-bold text-white tabular-nums">{t.exit_price || "—"}</p>
                      </div>
                      {t.notes && (
                        <div className="col-span-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Notes</p>
                          <p className="text-xs text-[--text-secondary] italic">{t.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => startEditTrade(t)}
                        className="flex-1 py-2 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit Trade
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === "transactions" && (
          <>
            {/* Desktop Transactions Table */}
            <div className="hidden md:block glass-card-static overflow-x-auto custom-scrollbar border-white/5">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                    <th className="p-4">Date</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Note</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {forexTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-sm text-[--text-muted] italic">No transactions logged yet.</td>
                    </tr>
                  ) : (
                    forexTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 text-[12px] font-medium text-[--text-muted]">{format(new Date(tx.transaction_date), "MMM d, yyyy")}</td>
                        <td className="p-4">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${tx.transaction_type === 'DEPOSIT' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="p-4 text-[12px] text-[--text-muted]">{tx.notes || "—"}</td>
                        <td className={`p-4 text-right font-black tabular-nums ${tx.transaction_type === 'DEPOSIT' ? 'text-[--accent-primary-light]' : 'text-warning'}`}>
                          {tx.transaction_type === 'DEPOSIT' ? '+' : '-'}${tx.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Transactions Cards */}
            <div className="md:hidden space-y-4">
              {forexTransactions.length === 0 ? (
                <div className="p-8 text-center text-[--text-muted] italic text-sm">No transactions logged yet.</div>
              ) : (
                forexTransactions.map((tx) => (
                  <div key={tx.id} className="glass-card-static p-5 active:bg-white/[0.04] transition-all relative overflow-hidden border-white/5">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${tx.transaction_type === 'DEPOSIT' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                          {tx.transaction_type}
                        </span>
                        <p className="text-[10px] text-[--text-muted] mt-1.5 font-bold uppercase">
                          {format(new Date(tx.transaction_date), "MMM d, yyyy")}
                        </p>
                        {tx.notes && (
                          <p className="text-xs text-[--text-secondary] italic mt-2 border-t border-white/5 pt-2">{tx.notes}</p>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={`text-sm font-black tabular-nums ${tx.transaction_type === 'DEPOSIT' ? 'text-[--accent-primary-light]' : 'text-warning'}`}>
                          {tx.transaction_type === 'DEPOSIT' ? '+' : '-'}${tx.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Account Modal */}
      {showAccountModal && (
        <div className="mobile-dialog-shell fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md p-8 animate-in zoom-in duration-300">
            <h2 className="text-2xl font-black mb-6 text-white">Connect Broker</h2>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <input required className="input-premium" placeholder="Broker Name (e.g. Exness)" value={accountForm.broker_name} onChange={e => setAccountForm({...accountForm, broker_name: e.target.value})} />
              <input required className="input-premium" placeholder="Account Label" value={accountForm.account_label} onChange={e => setAccountForm({...accountForm, account_label: e.target.value})} />
              <input className="input-premium" placeholder="Account Number (Optional)" value={accountForm.account_number} onChange={e => setAccountForm({...accountForm, account_number: e.target.value})} />
              <select className="input-premium" value={accountForm.currency} onChange={e => setAccountForm({...accountForm, currency: e.target.value})}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="INR">INR</option>
              </select>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAccountModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? "Creating..." : "Create Account"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditAccountModal && (
        <div className="mobile-dialog-shell fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md p-6 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-black mb-6 text-white">Edit Forex Account</h2>
            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Broker Name</label>
                <input required className="input-premium" placeholder="Broker Name (e.g. Exness)" value={editAccountForm.broker_name} onChange={e => setEditAccountForm({...editAccountForm, broker_name: e.target.value})} />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Account Label</label>
                <input required className="input-premium" placeholder="Account Label" value={editAccountForm.account_label} onChange={e => setEditAccountForm({...editAccountForm, account_label: e.target.value})} />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Account Number</label>
                <input className="input-premium" placeholder="Account Number (Optional)" value={editAccountForm.account_number} onChange={e => setEditAccountForm({...editAccountForm, account_number: e.target.value})} />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Currency</label>
                <select className="input-premium" value={editAccountForm.currency} onChange={e => setEditAccountForm({...editAccountForm, currency: e.target.value})}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                  <option value="INR">INR</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Net Balance</label>
                  <input required type="number" step="0.01" className="input-premium" placeholder="Balance" value={editAccountForm.balance} onChange={e => setEditAccountForm({...editAccountForm, balance: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Total P&L</label>
                  <input required type="number" step="0.01" className="input-premium" placeholder="Total P&L" value={editAccountForm.total_pnl} onChange={e => setEditAccountForm({...editAccountForm, total_pnl: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Deposits</label>
                  <input required type="number" step="0.01" className="input-premium" placeholder="Deposited" value={editAccountForm.total_deposited} onChange={e => setEditAccountForm({...editAccountForm, total_deposited: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Withdrawals</label>
                  <input required type="number" step="0.01" className="input-premium" placeholder="Withdrawn" value={editAccountForm.total_withdrawn} onChange={e => setEditAccountForm({...editAccountForm, total_withdrawn: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes</label>
                <textarea className="input-premium min-h-[80px]" placeholder="Notes" value={editAccountForm.notes} onChange={e => setEditAccountForm({...editAccountForm, notes: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditAccountModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? "Updating..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Trade Modal */}
      {showTradeModal && (
        <div className="mobile-dialog-shell fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md p-6 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-black mb-6 text-white">Log Completed Trade</h2>
            <form onSubmit={handleLogTrade} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Forex Account</label>
                <select required className="input-premium" value={tradeForm.forex_account_id} onChange={e => setTradeForm({...tradeForm, forex_account_id: e.target.value})}>
                  <option value="">Select Account</option>
                  {forexAccounts.map(a => <option key={a.id} value={a.id}>{a.account_label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Currency Pair</label>
                  <input required className="input-premium" placeholder="Pair (EUR/USD)" value={tradeForm.pair} onChange={e => setTradeForm({...tradeForm, pair: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Trade Direction</label>
                  <select className="input-premium" value={tradeForm.trade_type} onChange={e => setTradeForm({...tradeForm, trade_type: e.target.value as any})}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Lot Size</label>
                  <input required type="number" step="0.0001" className="input-premium" placeholder="Lot Size" value={tradeForm.lot_size} onChange={e => setTradeForm({...tradeForm, lot_size: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Net P&L ($)</label>
                  <input required type="number" step="0.01" className="input-premium" placeholder="Net P&L ($)" value={tradeForm.pnl} onChange={e => setTradeForm({...tradeForm, pnl: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Entry Price</label>
                  <input type="number" step="0.00001" className="input-premium" placeholder="Entry Price" value={tradeForm.entry_price} onChange={e => setTradeForm({...tradeForm, entry_price: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Exit Price</label>
                  <input type="number" step="0.00001" className="input-premium" placeholder="Exit Price" value={tradeForm.exit_price} onChange={e => setTradeForm({...tradeForm, exit_price: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Trade Date</label>
                <input required type="date" className="input-premium text-white" value={tradeForm.trade_date} onChange={e => setTradeForm({...tradeForm, trade_date: e.target.value})} />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes</label>
                <textarea className="input-premium min-h-[80px]" placeholder="Trade notes..." value={tradeForm.notes} onChange={e => setTradeForm({...tradeForm, notes: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowTradeModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? "Logging..." : "Log Trade"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Trade Modal */}
      {showEditTradeModal && (
        <div className="mobile-dialog-shell fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md p-6 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-black mb-6 text-white">Edit Forex Trade</h2>
            <form onSubmit={handleUpdateTrade} className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Forex Account</label>
                <select required className="input-premium" value={editTradeForm.forex_account_id} onChange={e => setEditTradeForm({...editTradeForm, forex_account_id: e.target.value})}>
                  <option value="">Select Account</option>
                  {forexAccounts.map(a => <option key={a.id} value={a.id}>{a.account_label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Currency Pair</label>
                  <input required className="input-premium" placeholder="Pair (EUR/USD)" value={editTradeForm.pair} onChange={e => setEditTradeForm({...editTradeForm, pair: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Trade Direction</label>
                  <select className="input-premium" value={editTradeForm.trade_type} onChange={e => setEditTradeForm({...editTradeForm, trade_type: e.target.value as any})}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Lot Size</label>
                  <input required type="number" step="0.0001" className="input-premium" placeholder="Lot Size" value={editTradeForm.lot_size} onChange={e => setEditTradeForm({...editTradeForm, lot_size: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Net P&L ($)</label>
                  <input required type="number" step="0.01" className="input-premium" placeholder="Net P&L ($)" value={editTradeForm.pnl} onChange={e => setEditTradeForm({...editTradeForm, pnl: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Entry Price</label>
                  <input type="number" step="0.00001" className="input-premium" placeholder="Entry Price" value={editTradeForm.entry_price} onChange={e => setEditTradeForm({...editTradeForm, entry_price: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Exit Price</label>
                  <input type="number" step="0.00001" className="input-premium" placeholder="Exit Price" value={editTradeForm.exit_price} onChange={e => setEditTradeForm({...editTradeForm, exit_price: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Trade Date</label>
                <input required type="date" className="input-premium text-white" value={editTradeForm.trade_date} onChange={e => setEditTradeForm({...editTradeForm, trade_date: e.target.value})} />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes</label>
                <textarea className="input-premium min-h-[80px]" placeholder="Trade notes..." value={editTradeForm.notes} onChange={e => setEditTradeForm({...editTradeForm, notes: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditTradeModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? "Updating..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Funds Modal (Deposit/Withdrawal) */}
      {showFundsModal && (
        <div className="mobile-dialog-shell fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md p-8 animate-in zoom-in duration-300">
            <h2 className="text-2xl font-black mb-6 text-white">{fundsType === 'DEPOSIT' ? 'Add Funds' : 'Withdraw Funds'}</h2>
            <form onSubmit={handleFunds} className="space-y-4">
              <select required className="input-premium" value={fundsForm.forex_account_id} onChange={e => setFundsForm({...fundsForm, forex_account_id: e.target.value})}>
                <option value="">Select Forex Account</option>
                {forexAccounts.map(a => <option key={a.id} value={a.id}>{a.account_label}</option>)}
              </select>
              <select className="input-premium" value={fundsForm.bank_account_id} onChange={e => setFundsForm({...fundsForm, bank_account_id: e.target.value})}>
                <option value="">No Bank Link (Manual)</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input required type="number" step="0.01" className="input-premium" placeholder="Amount ($)" value={fundsForm.amount} onChange={e => setFundsForm({...fundsForm, amount: e.target.value})} />
              <textarea className="input-premium min-h-[80px]" placeholder="Notes" value={fundsForm.notes} onChange={e => setFundsForm({...fundsForm, notes: e.target.value})} />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowFundsModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? "Processing..." : "Process"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
