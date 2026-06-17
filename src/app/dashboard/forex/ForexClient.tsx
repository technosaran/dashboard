"use client";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { 
  logForexTrade, 
  updateForexTrade,
  forexDeposit,
  forexWithdraw,
  createForexAccount,
  deleteForexAccount
} from "./actions";
import { revertLedgerLog } from "../alternative-assets/actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format } from "date-fns";
import PnLValue from "@/components/pnl-value";
import type { Tables } from "@/lib/database.types";
import { useMediaQuery } from "@/hooks/use-media-query";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

export default function ForexClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { profile, accounts, forexAccounts, forexTrades, forexTransactions, ledgerLogs }, mutate } = useFinanceData(initialData);
  
  const searchParams = useSearchParams();
  const action = searchParams.get("action");
  
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [mobileTab, setMobileTab] = useState<"pnl" | "funds" | "account">(() => {
    if (action === "account") return "account";
    if (action === "deposit" || action === "withdraw") return "funds";
    return "pnl";
  });
  
  const [activeTab, setActiveTab] = useState<"trades" | "transactions" | "accounts">(
    action === "account" ? "accounts" : "trades"
  );
  const [showTradeModal, setShowTradeModal] = useState(action === "new");
  const [showEditTradeModal, setShowEditTradeModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(action === "deposit" || action === "withdraw");
  const [showAccountModal, setShowAccountModal] = useState(action === "account");
  const [fundsType, setFundsType] = useState<"DEPOSIT" | "WITHDRAW">(action === "withdraw" ? "WITHDRAW" : "DEPOSIT");
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

  // Funds form
  const [fundsForm, setFundsForm] = useState({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" });

  // Initialize default bank account for deposits/withdrawals
  useEffect(() => {
    if (accounts.length > 0 && !fundsForm.bank_account_id) {
      const defaultAccId = profile?.settings?.default_accounts?.forex;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      setTimeout(() => {
        setFundsForm(prev => ({ ...prev, bank_account_id: defaultAccExists ? defaultAccId : accounts[0].id }));
      }, 0);
    }
  }, [accounts, fundsForm.bank_account_id, profile]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTradeModal(false);
        setShowEditTradeModal(false);
        setShowFundsModal(false);
        setShowAccountModal(false);
      }
    };
    if (showTradeModal || showEditTradeModal || showFundsModal || showAccountModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTradeModal, showEditTradeModal, showFundsModal, showAccountModal]);

  // Broker Account form
  const [accountForm, setAccountForm] = useState({
    broker_name: "",
    account_label: "",
    account_number: "",
    currency: "USD",
    notes: ""
  });

  // Stats computed from Forex Account aggregates
  const stats = useMemo(() => {
    const totalBalance = forexAccounts.reduce((s, a) => s + Number(a.balance), 0);
    const totalPnL = forexAccounts.reduce((s, a) => s + Number(a.total_pnl), 0);
    const totalDeposited = forexAccounts.reduce((s, a) => s + Number(a.total_deposited), 0);
    const totalWithdrawn = forexAccounts.reduce((s, a) => s + Number(a.total_withdrawn), 0);
    return { totalBalance, totalPnL, totalDeposited, totalWithdrawn };
  }, [forexAccounts]);

  const getAccountLabel = (id: string | null) => {
    if (!id) return "—";
    const fx = forexAccounts.find(a => a.id === id);
    return fx ? `${fx.account_label} (${fx.broker_name})` : "—";
  };

  const getAccountCurrency = (id: string | null) => {
    if (!id) return "USD";
    const fx = forexAccounts.find(a => a.id === id);
    return fx ? fx.currency : "USD";
  };

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const res = await createForexAccount({
        broker_name: accountForm.broker_name,
        account_label: accountForm.account_label,
        account_number: accountForm.account_number || undefined,
        currency: accountForm.currency,
        notes: accountForm.notes || undefined
      });
      if (res.success) {
        toast.success("Broker account created successfully");
        setShowAccountModal(false);
        setAccountForm({
          broker_name: "",
          account_label: "",
          account_number: "",
          currency: "USD",
          notes: ""
        });
        mutate();
      } else {
        toast.error(res.error || "Failed to create account");
      }
    });
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Are you sure you want to delete this broker account? This will also delete all trades and transactions associated with it.")) return;
    await withLock(async () => {
      const res = await deleteForexAccount(id);
      if (res.success) {
        toast.success("Broker account deleted successfully");
        mutate();
      } else {
        toast.error(res.error || "Failed to delete account");
      }
    });
  }

  async function handleLogTrade(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const rawVal = parseFloat(tradeAmount);
      if (isNaN(rawVal) || rawVal <= 0 || !Number.isFinite(rawVal)) {
        toast.error("Please enter a valid positive amount");
        return;
      }

      if (tradePnlType === "loss") {
        const forexAcc = forexAccounts.find(a => a.id === tradeForm.forex_account_id);
        if (forexAcc && forexAcc.balance < rawVal) {
          toast.error("Loss amount cannot exceed available broker balance");
          return;
        }
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
        mutate();
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

      if (editTradePnlType === "loss") {
        const forexAcc = forexAccounts.find(a => a.id === editTradeForm.forex_account_id);
        if (forexAcc) {
          // Adjust balance by adding back the old PnL, then check if the new loss is too high
          const availableBalance = forexAcc.balance - editingTrade.pnl;
          if (availableBalance < rawVal) {
            toast.error("Loss amount cannot exceed available broker balance");
            return;
          }
        }
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
        mutate();
      } else {
        toast.error(res.error || "Failed to update trade");
      }
    });
  }

  async function handleFunds(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const rawVal = parseFloat(fundsForm.amount);
      if (isNaN(rawVal) || rawVal <= 0 || !Number.isFinite(rawVal)) {
        toast.error("Please enter a valid positive amount");
        return;
      }

      if (fundsType === "DEPOSIT" && fundsForm.bank_account_id) {
        const bankAcc = accounts.find(a => a.id === fundsForm.bank_account_id);
        if (bankAcc && bankAcc.balance < rawVal) {
          toast.error("Insufficient funds in selected funding account");
          return;
        }
      }

      if (fundsType === "WITHDRAW") {
        const forexAcc = forexAccounts.find(a => a.id === fundsForm.forex_account_id);
        if (forexAcc && forexAcc.balance < rawVal) {
          toast.error("Insufficient funds in broker account for withdrawal");
          return;
        }
      }

      const action = fundsType === "DEPOSIT" ? forexDeposit : forexWithdraw;
      const res = await action({
        forex_account_id: fundsForm.forex_account_id,
        bank_account_id: fundsForm.bank_account_id || undefined,
        amount: rawVal,
        notes: fundsForm.notes || undefined
      });
      if (res.success) {
        toast.success(`${fundsType === "DEPOSIT" ? "Deposit" : "Withdrawal"} completed successfully`);
        setShowFundsModal(false);
        setFundsForm({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" });
        mutate();
      } else toast.error(res.error || "Failed");
    });
  }

  async function handleRevert(logId: string | null) {
    if (!logId) return toast.error("No ledger log found for this transaction");
    if (!confirm("Revert this transaction? This will undo the deposit/withdrawal and reverse any account transactions.")) return;
    await withLock(async () => {
      const res = await revertLedgerLog(logId);
      if (!res.error) {
        toast.success("Transaction reverted");
        mutate();
      } else toast.error(res.error);
    });
  }

  // Previews
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

  if (isMobile) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-[calc(var(--mobile-bottom-nav-height)+2rem)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[--text-primary]">Forex Record</h1>
            <div className={`status-dot scale-70 ${submitting ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'}`} />
          </div>
          <Link href="/dashboard" className="text-[10px] font-black uppercase text-[--text-muted] no-underline bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
            Back
          </Link>
        </div>

        {/* Mobile Tab Selector */}
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => setMobileTab("pnl")}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mobileTab === "pnl" ? "bg-[--accent-primary] text-white shadow-lg" : "text-[--text-muted]"}`}
          >
            Log P&L
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("funds")}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mobileTab === "funds" ? "bg-[--accent-primary] text-white shadow-lg" : "text-[--text-muted]"}`}
          >
            Funds
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("account")}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mobileTab === "account" ? "bg-[--accent-primary] text-white shadow-lg" : "text-[--text-muted]"}`}
          >
            Account
          </button>
        </div>

        <div className="glass-card-static p-5 border border-white/5 bg-white/[0.01]">
          {mobileTab === "pnl" && (
            <form onSubmit={handleLogTrade} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Select Broker Account</label>
                <select aria-label="Select forex account" required className="input-premium" value={tradeForm.forex_account_id} onChange={e => setTradeForm({...tradeForm, forex_account_id: e.target.value})}>
                  <option value="">Select Account</option>
                  {forexAccounts.map(a => <option key={a.id} value={a.id}>{a.account_label} ({a.broker_name})</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Date</label>
                <input required type="date" className="input-premium" value={tradeForm.trade_date} onChange={e => setTradeForm({...tradeForm, trade_date: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Entry Type</label>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1 h-12">
                  <button
                    type="button"
                    onClick={() => setTradePnlType("profit")}
                    className={`flex-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center ${tradePnlType === "profit" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-[--text-muted]"}`}
                  >
                    + Profit
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradePnlType("loss")}
                    className={`flex-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center ${tradePnlType === "loss" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "text-[--text-muted]"}`}
                  >
                    - Loss
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">P&L Amount ($)</label>
                <input required type="number" step="0.01" min="0.01" className="input-premium font-bold" placeholder="0.00" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)} inputMode="decimal" />
              </div>

              {parseFloat(tradeAmount) > 0 && (
                <div className={`p-3 rounded-xl border flex justify-between items-center transition-all ${tradePnlType === "profit" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest">Calculation Preview</span>
                  <span className="text-sm font-black tabular-nums">{parsedPreviewTrade}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Notes (Optional)</label>
                <textarea className="input-premium min-h-[80px]" placeholder="Trading notes..." value={tradeForm.notes} onChange={e => setTradeForm({...tradeForm, notes: e.target.value})} />
              </div>

              <button type="submit" disabled={submitting || forexAccounts.length === 0} className="btn-primary w-full h-12 shadow-md mt-6">
                {submitting ? "Logging..." : "Log Daily P&L"}
              </button>
            </form>
          )}

          {mobileTab === "funds" && (
            <form onSubmit={handleFunds} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Action Type</label>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1 h-12">
                  <button
                    type="button"
                    onClick={() => setFundsType("DEPOSIT")}
                    className={`flex-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center ${fundsType === "DEPOSIT" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-[--text-muted]"}`}
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => setFundsType("WITHDRAW")}
                    className={`flex-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center ${fundsType === "WITHDRAW" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "text-[--text-muted]"}`}
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Broker Account</label>
                {forexAccounts.length === 0 ? (
                  <div className="text-xs text-rose-400 font-bold p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl leading-snug">
                    No broker accounts found. Create one first.
                  </div>
                ) : (
                  <select aria-label="Select forex account" required className="input-premium" value={fundsForm.forex_account_id} onChange={e => setFundsForm({...fundsForm, forex_account_id: e.target.value})}>
                    <option value="">Select Broker</option>
                    {forexAccounts.map(a => <option key={a.id} value={a.id}>{a.account_label} ({a.broker_name})</option>)}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Funding Account</label>
                {accounts.length === 0 ? (
                  <div className="text-xs text-rose-400 font-bold p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl leading-snug">
                    No bank accounts found in the global standard Accounts.
                  </div>
                ) : (
                  <>
                    <select aria-label="Select bank account" required className="input-premium" value={fundsForm.bank_account_id} onChange={e => setFundsForm({...fundsForm, bank_account_id: e.target.value})}>
                      <option value="">Select Funding</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                    </select>
                    {fundsForm.bank_account_id && (() => {
                      const selectedAcc = accounts.find(a => a.id === fundsForm.bank_account_id);
                      return selectedAcc ? (
                        <div className="mt-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary]">
                          <span className="font-medium">Selected Balance</span>
                          <span className="font-bold text-white">
                            {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Amount ($)</label>
                <input required type="number" step="0.01" className="input-premium" placeholder="0.00" value={fundsForm.amount} onChange={e => setFundsForm({...fundsForm, amount: e.target.value})} inputMode="decimal" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Notes (Optional)</label>
                <textarea className="input-premium min-h-[80px]" placeholder="Transaction notes..." value={fundsForm.notes} onChange={e => setFundsForm({...fundsForm, notes: e.target.value})} />
              </div>

              <button type="submit" disabled={submitting || forexAccounts.length === 0} className="btn-primary w-full h-12 shadow-md mt-6">
                {submitting ? "Processing..." : fundsType === "DEPOSIT" ? "Complete Deposit" : "Complete Withdrawal"}
              </button>
            </form>
          )}

          {mobileTab === "account" && (
            <form onSubmit={handleCreateAccount} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Broker Name</label>
                <input required type="text" className="input-premium" placeholder="e.g. MetaTrader 5" value={accountForm.broker_name} onChange={e => setAccountForm({...accountForm, broker_name: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Account Label</label>
                <input required type="text" className="input-premium" placeholder="e.g. Live Account" value={accountForm.account_label} onChange={e => setAccountForm({...accountForm, account_label: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Account Number (Optional)</label>
                <input type="text" className="input-premium" placeholder="e.g. 104859" value={accountForm.account_number} onChange={e => setAccountForm({...accountForm, account_number: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Currency</label>
                <select aria-label="Select currency" required className="input-premium" value={accountForm.currency} onChange={e => setAccountForm({...accountForm, currency: e.target.value})}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Notes (Optional)</label>
                <textarea className="input-premium min-h-[80px]" placeholder="Leverage details, leverage, etc..." value={accountForm.notes} onChange={e => setAccountForm({...accountForm, notes: e.target.value})} />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full h-12 shadow-md mt-6">
                {submitting ? "Creating..." : "Create Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">Forex Terminal</h1>
          <p className="text-xs text-[--text-muted] font-bold uppercase tracking-[0.3em] mt-2">Global Currency Markets</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setShowAccountModal(true)} className="btn-secondary !h-11">Add Broker Account</button>
          <button type="button" onClick={() => { setFundsType("DEPOSIT"); setFundsForm({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" }); setShowFundsModal(true); }} className="btn-secondary !h-11">Deposit</button>
          <button type="button" onClick={() => { setFundsType("WITHDRAW"); setFundsForm({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" }); setShowFundsModal(true); }} className="btn-secondary !h-11">Withdraw</button>
          <button type="button" onClick={() => setShowTradeModal(true)} className="btn-primary !h-11 shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.4)]">Log Daily P&L</button>
        </div>
      </div>

      {forexTrades.length === 0 && forexTransactions.length === 0 && forexAccounts.length === 0 ? (
        <EmptyState
          title="Launch Your Forex Terminal"
          description="Track currency trading performance, manage deposits/withdrawals, and monitor net returns across forex markets."
          icon={
            <svg className="w-8 h-8 text-[--accent-primary-light]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          }
          glowColor="sky"
          action={
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" onClick={() => setShowAccountModal(true)} className="btn-secondary h-13 px-8 rounded-xl font-bold uppercase tracking-wider text-[11px]">
                Add Broker Account
              </button>
              <button type="button" onClick={() => setShowTradeModal(true)} className="btn-primary h-13 px-8 rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-xl shadow-[--accent-primary]/20 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                Log First P&L Entry
              </button>
            </div>
          }
        />
      ) : (
      <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Balance", value: stats.totalBalance, formatted: `$${stats.totalBalance.toLocaleString()}`, sub: "Available Capital", color: "text-white", icon: "💰" },
          { label: "Total P&L", value: stats.totalPnL, formatted: `${stats.totalPnL >= 0 ? "+" : ""}$${stats.totalPnL.toLocaleString()}`, sub: "Trading Performance", color: stats.totalPnL >= 0 ? "text-success" : "text-danger", icon: "📊" },
          { label: "Deposits", value: stats.totalDeposited, formatted: `$${stats.totalDeposited.toLocaleString()}`, sub: "Total Inflow", color: "text-[--accent-primary-light]", icon: "📥" },
          { label: "Withdrawals", value: stats.totalWithdrawn, formatted: `$${stats.totalWithdrawn.toLocaleString()}`, sub: "Total Outflow", color: "text-warning", icon: "📤" },
        ].map((s, i) => (
          <div key={i} className="glass-card-static p-4 md:p-6 border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-4xl opacity-[0.03] group-hover:opacity-[0.07] transition-opacity rotate-12">{s.icon}</div>
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-2 md:mb-3">{s.label}</p>
            <p className={`text-xl md:text-2xl font-black tabular-nums ${s.color}`}>{s.formatted}</p>
            <p className="text-[8px] md:text-[9px] font-bold text-[--text-muted] mt-1 md:mt-2 uppercase tracking-widest opacity-60">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-white/5 overflow-x-auto custom-scrollbar">
        {["trades", "transactions", "accounts"].map((tab) => (
          <button type="button"
            key={tab}
            onClick={() => setActiveTab(tab as "trades" | "transactions" | "accounts")}
            className={`pb-4 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === tab ? "text-[--accent-primary-light] border-b-2 border-[--accent-primary-light]" : "text-[--text-muted] hover:text-white"}`}
          >
            {tab === "trades" ? "Daily P&L Summaries" : tab === "transactions" ? "Broker Fund Logs" : "Broker Accounts"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === "trades" && (
          <>
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
                  {forexTrades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-[--text-muted] italic">No daily summaries logged yet.</td>
                    </tr>
                  ) : (
                    forexTrades.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 text-[12px] font-medium text-[--text-muted]">{format(new Date(t.trade_date), "MMM d, yyyy")}</td>
                        <td className="p-4 text-[12px] font-bold text-[--text-secondary]">{getAccountLabel(t.forex_account_id)}</td>
                        <td className="p-4 text-[12px] text-[--text-muted] max-w-xs truncate" title={t.notes || ""}>{t.notes || "—"}</td>
                        <td className="p-4 text-right">
                          <PnLValue value={t.pnl} prefix={getAccountCurrency(t.forex_account_id) === 'USD' ? '$' : '₹'} size="sm" className="items-end" />
                        </td>
                        <td className="p-4 text-center">
                          <button type="button" onClick={() => startEditTrade(t)} className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white text-[9px] font-black uppercase rounded transition-all">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Trades Cards */}
            <div className="md:hidden space-y-4">
              {forexTrades.length === 0 ? (
                <div className="p-8 text-center text-[--text-muted] italic text-sm">No daily summaries logged yet.</div>
              ) : (
                forexTrades.map((t) => (
                  <div key={t.id} className="glass-card-static p-5 active:bg-white/[0.04] transition-all relative overflow-hidden border-white/5">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <span className="text-xs font-bold text-[--text-muted]">
                          {format(new Date(t.trade_date), "MMMM d, yyyy")}
                        </span>
                        <p className="text-sm font-black text-white mt-0.5">{getAccountLabel(t.forex_account_id)}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <PnLValue value={t.pnl} prefix={getAccountCurrency(t.forex_account_id) === 'USD' ? '$' : '₹'} size="md" className="items-end" />
                      </div>
                    </div>

                    {t.notes && (
                      <div className="border-t border-white/5 pt-2 mt-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Notes</p>
                        <p className="text-xs text-[--text-secondary] italic">{t.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button type="button" 
                        onClick={() => startEditTrade(t)}
                        className="flex-1 py-2 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit Entry
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
                    <th className="p-4">Account</th>
                    <th className="p-4">Note</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {forexTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-[--text-muted] italic">No transactions logged yet.</td>
                    </tr>
                  ) : (
                    forexTransactions.map((tx) => {
                      const matchingLog = ledgerLogs?.find(log => 
                        log.source_type === 'forex' && 
                        log.source_id === tx.id
                      );
                      return (
                        <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="p-4 text-[12px] font-medium text-[--text-muted]">{format(new Date(tx.transaction_date), "MMM d, yyyy")}</td>
                          <td className="p-4">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${tx.transaction_type === 'DEPOSIT' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                              {tx.transaction_type}
                            </span>
                          </td>
                          <td className="p-4 text-[12px] font-bold text-[--text-secondary]">{getAccountLabel(tx.forex_account_id)}</td>
                          <td className="p-4 text-[12px] text-[--text-muted]">{tx.notes || "—"}</td>
                          <td className={`p-4 text-right font-black tabular-nums flex items-center justify-end gap-4 ${tx.transaction_type === 'DEPOSIT' ? 'text-[--accent-primary-light]' : 'text-warning'}`}>
                            <span>{tx.transaction_type === 'DEPOSIT' ? '+' : '-'}{getAccountCurrency(tx.forex_account_id) === 'USD' ? '$' : '₹'}{tx.amount.toLocaleString()}</span>
                            {matchingLog && (
                              <button type="button" 
                                onClick={() => handleRevert(matchingLog.id)}
                                disabled={submitting}
                                className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10"
                              >
                                Revert
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Transactions Cards */}
            <div className="md:hidden space-y-4">
              {forexTransactions.length === 0 ? (
                <div className="p-8 text-center text-[--text-muted] italic text-sm">No transactions logged yet.</div>
              ) : (
                forexTransactions.map((tx) => {
                  const matchingLog = ledgerLogs?.find(log => 
                    log.source_type === 'forex' && 
                    log.source_id === tx.id
                  );
                  return (
                    <div key={tx.id} className="glass-card-static p-5 active:bg-white/[0.04] transition-all relative overflow-hidden border-white/5">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${tx.transaction_type === 'DEPOSIT' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                            {tx.transaction_type}
                          </span>
                          <p className="text-[10px] text-[--text-muted] mt-1.5 font-bold uppercase">
                            {format(new Date(tx.transaction_date), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs font-bold text-white mt-1">Account: {getAccountLabel(tx.forex_account_id)}</p>
                          {tx.notes && (
                            <p className="text-xs text-[--text-secondary] italic mt-2 border-t border-white/5 pt-2">{tx.notes}</p>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <span className={`text-sm font-black tabular-nums ${tx.transaction_type === 'DEPOSIT' ? 'text-[--accent-primary-light]' : 'text-warning'}`}>
                            {tx.transaction_type === 'DEPOSIT' ? '+' : '-'}{getAccountCurrency(tx.forex_account_id) === 'USD' ? '$' : '₹'}{tx.amount.toLocaleString()}
                          </span>
                          {matchingLog && (
                            <button type="button" 
                              onClick={() => handleRevert(matchingLog.id)}
                              disabled={submitting}
                              className="text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10"
                            >
                              Revert
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === "accounts" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {forexAccounts.length === 0 ? (
              <div className="col-span-full glass-card-static p-12 text-center flex flex-col items-center justify-center min-h-[300px] border-white/5">
                <div className="text-4xl mb-4 opacity-30">🏦</div>
                <h4 className="text-lg font-black text-white">No Broker Accounts Registered</h4>
                <p className="text-xs text-[--text-muted] mt-2 max-w-sm leading-relaxed">Add dedicated broker accounts directly in the Forex terminal. You can then log daily profits or losses and record transfer transactions easily.</p>
                <button type="button" onClick={() => setShowAccountModal(true)} className="btn-primary mt-6 !h-10 text-xs px-6">Add Broker Account</button>
              </div>
            ) : (
              forexAccounts.map((a) => (
                <div key={a.id} className="glass-card-static p-6 border-white/5 hover:border-white/10 transition-all flex flex-col justify-between gap-6 relative overflow-hidden group">
                  <div className="absolute -right-6 -top-6 text-5xl opacity-[0.02] group-hover:opacity-[0.05] transition-opacity rotate-12">📉</div>
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="text-lg font-black text-white tracking-tight">{a.account_label}</h4>
                        <p className="text-[10px] text-[--text-muted] font-extrabold uppercase tracking-widest mt-1">{a.broker_name} {a.account_number ? `#${a.account_number}` : ""}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-lg bg-[--accent-primary]/10 border border-[--accent-primary]/25 text-[9px] font-black text-[--accent-primary-light]">{a.currency}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 mt-6 border-t border-white/5 pt-4 text-xs">
                      <div>
                        <p className="text-[9px] font-black uppercase text-[--text-muted] tracking-wider mb-0.5">Active Balance</p>
                        <p className="font-extrabold text-white tabular-nums">{a.currency === 'USD' ? '$' : '₹'}{Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-[--text-muted] tracking-wider mb-0.5">Performance P&L</p>
                        <p className={`font-extrabold tabular-nums ${Number(a.total_pnl) >= 0 ? "text-success" : "text-danger"}`}>
                          {Number(a.total_pnl) >= 0 ? "+" : ""}{a.currency === 'USD' ? '$' : '₹'}{Number(a.total_pnl).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-[--text-muted] tracking-wider mb-0.5">Total Inflow</p>
                        <p className="font-bold text-[--text-secondary] tabular-nums">{a.currency === 'USD' ? '$' : '₹'}{Number(a.total_deposited).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-[--text-muted] tracking-wider mb-0.5">Total Outflow</p>
                        <p className="font-bold text-[--text-secondary] tabular-nums">{a.currency === 'USD' ? '$' : '₹'}{Number(a.total_withdrawn).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    
                    {a.notes && (
                      <p className="text-[11px] text-[--text-muted] italic mt-4 border-t border-white/5 pt-3 leading-relaxed">{a.notes}</p>
                    )}
                  </div>
                  
                  <div className="border-t border-white/5 pt-4 flex justify-end">
                    <button type="button" onClick={() => handleDeleteAccount(a.id)} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 text-rose-400 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete Broker
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* Log Trade Modal */}
      {showTradeModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="glass-card-static w-full max-w-md p-6 my-auto animate-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <h2 className="text-xl font-black mb-4 text-white text-left uppercase italic tracking-wide">Log Daily Profit/Loss</h2>

            <form onSubmit={handleLogTrade} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Select Broker</label>
                  {forexAccounts.length === 0 ? (
                    <div className="text-[10px] text-rose-400 font-bold p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl leading-snug">
                      No broker accounts found. Create one under the{" "}
                      <button type="button" onClick={() => { setShowTradeModal(false); setActiveTab("accounts"); }} className="underline text-sky-400 hover:text-sky-300 font-extrabold">
                        Accounts tab
                      </button>{" "}
                      first.
                    </div>
                  ) : (
                    <select autoFocus aria-label="Select forex account" id="forex-trade-account" name="forex_account_id" required className="input-premium !h-10 text-xs" value={tradeForm.forex_account_id} onChange={e => setTradeForm({...tradeForm, forex_account_id: e.target.value})}>
                      <option value="" className="bg-[--bg-surface]">Select Account</option>
                      {forexAccounts.map(a => <option key={a.id} value={a.id} className="bg-[--bg-surface]">{a.account_label} ({a.broker_name})</option>)}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Date</label>
                  <input required type="date" className="input-premium text-white !h-10 text-xs" value={tradeForm.trade_date} onChange={e => setTradeForm({...tradeForm, trade_date: e.target.value})} autoComplete="new-password" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Entry Type</label>
                  <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/5 gap-1 h-10">
                    <button
                      type="button"
                      onClick={() => setTradePnlType("profit")}
                      className={`flex-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-0.5 ${tradePnlType === "profit" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-[--text-muted] hover:text-white"}`}
                    >
                      + Profit
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradePnlType("loss")}
                      className={`flex-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-0.5 ${tradePnlType === "loss" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "text-[--text-muted] hover:text-white"}`}
                    >
                      - Loss
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">P&L Amount ($)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    className="input-premium font-bold text-white !h-10 text-xs" 
                    placeholder="0.00" 
                    value={tradeAmount} 
                    onChange={e => setTradeAmount(e.target.value)} 
                    autoComplete="new-password"
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Foolproof calculation preview block */}
              {parseFloat(tradeAmount) > 0 && (
                <div className={`p-2.5 rounded-xl border flex justify-between items-center transition-all animate-in slide-in-from-top-2 duration-300 ${tradePnlType === "profit" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest">Calculation Preview</span>
                  <span className="text-sm font-black tabular-nums">{parsedPreviewTrade}</span>
                </div>
              )}

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes (Optional)</label>
                <textarea className="input-premium min-h-[50px] !h-12 py-1.5 text-xs" placeholder="Trading notes..." value={tradeForm.notes} onChange={e => setTradeForm({...tradeForm, notes: e.target.value})} autoComplete="new-password" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTradeModal(false)} className="btn-secondary flex-1 !h-10 text-xs">Cancel</button>
                <button type="submit" disabled={submitting || forexAccounts.length === 0} className="btn-primary flex-1 !h-10 text-xs">
                  {submitting ? "Logging..." : "Log P&L"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Trade Modal */}
      {showEditTradeModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="glass-card-static w-full max-w-md p-6 my-auto animate-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <h2 className="text-xl font-black mb-4 text-white text-left uppercase italic tracking-wide">Edit Daily Profit/Loss</h2>

            <form onSubmit={handleUpdateTrade} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Select Broker</label>
                  <select autoFocus aria-label="Select forex account" id="forex-edit-trade-account" name="forex_account_id" required className="input-premium !h-10 text-xs" value={editTradeForm.forex_account_id} onChange={e => setEditTradeForm({...editTradeForm, forex_account_id: e.target.value})}>
                    <option value="" className="bg-[--bg-surface]">Select Account</option>
                    {forexAccounts.map(a => <option key={a.id} value={a.id} className="bg-[--bg-surface]">{a.account_label} ({a.broker_name})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Date</label>
                  <input required type="date" className="input-premium text-white !h-10 text-xs" value={editTradeForm.trade_date} onChange={e => setEditTradeForm({...editTradeForm, trade_date: e.target.value})} autoComplete="new-password" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Entry Type</label>
                  <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/5 gap-1 h-10">
                    <button
                      type="button"
                      onClick={() => setEditTradePnlType("profit")}
                      className={`flex-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-0.5 ${editTradePnlType === "profit" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-[--text-muted] hover:text-white"}`}
                    >
                      + Profit
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTradePnlType("loss")}
                      className={`flex-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-0.5 ${editTradePnlType === "loss" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "text-[--text-muted] hover:text-white"}`}
                    >
                      - Loss
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">P&L Amount ($)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    className="input-premium font-bold text-white !h-10 text-xs" 
                    placeholder="0.00" 
                    value={editTradeAmount} 
                    onChange={e => setEditTradeAmount(e.target.value)} 
                    autoComplete="new-password"
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Foolproof calculation preview block */}
              {parseFloat(editTradeAmount) > 0 && (
                <div className={`p-2.5 rounded-xl border flex justify-between items-center transition-all animate-in slide-in-from-top-2 duration-300 ${editTradePnlType === "profit" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest">Calculation Preview</span>
                  <span className="text-sm font-black tabular-nums">{parsedPreviewEdit}</span>
                </div>
              )}

              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes (Optional)</label>
                <textarea className="input-premium min-h-[50px] !h-12 py-1.5 text-xs" placeholder="Trade notes..." value={editTradeForm.notes} onChange={e => setEditTradeForm({...editTradeForm, notes: e.target.value})} autoComplete="new-password" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditTradeModal(false)} className="btn-secondary flex-1 !h-10 text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 !h-10 text-xs">
                  {submitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Funds Deposit/Withdraw Modal */}
      {showFundsModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="glass-card-static w-full max-w-md p-6 my-auto animate-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <h2 className="text-xl font-black mb-4 text-white uppercase italic tracking-wide">{fundsType === "DEPOSIT" ? "Broker Deposit" : "Broker Withdrawal"}</h2>
            <form onSubmit={handleFunds} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Broker Account</label>
                  {forexAccounts.length === 0 ? (
                    <div className="text-[10px] text-rose-400 font-bold p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl leading-snug">
                      No broker accounts found. Create one under the{" "}
                      <button type="button" onClick={() => { setShowFundsModal(false); setActiveTab("accounts"); }} className="underline text-sky-400 hover:text-sky-300 font-extrabold">
                        Accounts tab
                      </button>{" "}
                      first.
                    </div>
                  ) : (
                    <select autoFocus aria-label="Select forex account" id="forex-funds-account" name="forex_account_id" required className="input-premium !h-10 text-xs" value={fundsForm.forex_account_id} onChange={e => setFundsForm({...fundsForm, forex_account_id: e.target.value})}>
                      <option value="" className="bg-[--bg-surface]">Select Broker</option>
                      {forexAccounts.map(a => <option key={a.id} value={a.id} className="bg-[--bg-surface]">{a.account_label} ({a.broker_name})</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Funding Account</label>
                  {accounts.length === 0 ? (
                    <div className="text-[10px] text-rose-400 font-bold p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl leading-snug">
                      No bank accounts found in the global standard Accounts.
                    </div>
                  ) : (
                    <>
                      <select aria-label="Select bank account" id="forex-bank-account" name="bank_account_id" required className="input-premium !h-10 text-xs" value={fundsForm.bank_account_id} onChange={e => setFundsForm({...fundsForm, bank_account_id: e.target.value})}>
                        <option value="" className="bg-[--bg-surface]">Select Funding</option>
                        {accounts.map(a => <option key={a.id} value={a.id} className="bg-[--bg-surface]">{a.name} ({a.currency})</option>)}
                      </select>
                      {fundsForm.bank_account_id && (() => {
                        const selectedAcc = accounts.find(a => a.id === fundsForm.bank_account_id);
                        return selectedAcc ? (
                          <div className="mt-2 p-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] text-[--text-secondary] animate-fade-in">
                            <span className="font-medium">Selected Balance</span>
                            <span className="font-bold text-white">
                              {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Amount ($)</label>
                  <input required type="number" step="0.01" className="input-premium !h-10 text-xs" placeholder="0.00" value={fundsForm.amount} onChange={e => setFundsForm({...fundsForm, amount: e.target.value})} autoComplete="new-password" inputMode="decimal" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes (Optional)</label>
                <textarea className="input-premium min-h-[50px] !h-12 py-1.5 text-xs" placeholder="Transaction notes..." value={fundsForm.notes} onChange={e => setFundsForm({...fundsForm, notes: e.target.value})} autoComplete="new-password" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFundsModal(false)} className="btn-secondary flex-1 !h-10 text-xs">Cancel</button>
                <button type="submit" disabled={submitting || forexAccounts.length === 0} className="btn-primary flex-1 !h-10 text-xs">
                  {submitting ? "Processing..." : fundsType === "DEPOSIT" ? "Complete Deposit" : "Complete Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Broker Account Modal */}
      {showAccountModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="glass-card-static w-full max-w-md p-6 my-auto animate-in zoom-in duration-300 relative max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <h2 className="text-xl font-black mb-4 text-white uppercase italic tracking-wide">Add Broker Account</h2>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Broker Name</label>
                  <input autoFocus required type="text" className="input-premium !h-10 text-xs" placeholder="e.g. MetaTrader 5" value={accountForm.broker_name} onChange={e => setAccountForm({...accountForm, broker_name: e.target.value})} autoComplete="new-password" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Account Label</label>
                  <input required type="text" className="input-premium !h-10 text-xs" placeholder="e.g. Live Account" value={accountForm.account_label} onChange={e => setAccountForm({...accountForm, account_label: e.target.value})} autoComplete="new-password" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Account Number (Opt)</label>
                  <input type="text" className="input-premium !h-10 text-xs" placeholder="e.g. 104859" value={accountForm.account_number} onChange={e => setAccountForm({...accountForm, account_number: e.target.value})} autoComplete="new-password" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Currency</label>
                  <select aria-label="Select currency" id="forex-currency" name="currency" required className="input-premium !h-10 text-xs" value={accountForm.currency} onChange={e => setAccountForm({...accountForm, currency: e.target.value})}>
                    <option value="USD" className="bg-[--bg-surface]">USD</option>
                    <option value="EUR" className="bg-[--bg-surface]">EUR</option>
                    <option value="GBP" className="bg-[--bg-surface]">GBP</option>
                    <option value="INR" className="bg-[--bg-surface]">INR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] block mb-1">Notes (Optional)</label>
                <textarea className="input-premium min-h-[50px] !h-12 py-1.5 text-xs" placeholder="Broker details, leverage, etc..." value={accountForm.notes} onChange={e => setAccountForm({...accountForm, notes: e.target.value})} autoComplete="new-password" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAccountModal(false)} className="btn-secondary flex-1 !h-10 text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 !h-10 text-xs">
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
