"use client";

import { useState, useMemo, useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { 
  logForexTrade, 
  updateForexTrade,
  forexDeposit,
  forexWithdraw,
  createForexAccount,
  deleteForexAccount,
  searchForex,
  fetchLiveForexPrice
} from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format } from "date-fns";
import { Drawer } from "@/components/ui/drawer";
import PnLValue from "@/components/pnl-value";
import type { Tables } from "@/lib/database.types";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

import ForexDataTable from "./components/ForexDataTable";

export default function ForexClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { profile, accounts, forexAccounts, forexTrades, forexTransactions, ledgerLogs }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const action = searchParams?.get("action");
  const [activeTab, setActiveTab] = useState<"dashboard" | "accounts" | "pnl" | "transactions">("dashboard");

  const mounted = useHasMounted();

  const [showTradeModal, setShowTradeModal] = useState(action === "new");
  const [showEditTradeModal, setShowEditTradeModal] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(action === "deposit" || action === "withdraw");
  const [showAccountModal, setShowAccountModal] = useState(action === "account");
  const [fundsType, setFundsType] = useState<"DEPOSIT" | "WITHDRAW">(action === "withdraw" ? "WITHDRAW" : "DEPOSIT");
  const [editingTrade, setEditingTrade] = useState<Tables<"forex_trades"> | null>(null);
  const [submitting, withLock] = useSubmitLock();

  const [tradeForm, setTradeForm] = useState({ forex_account_id: "", trade_date: "", notes: "", pair: "DAILY_P&L", lot_size: "1", entry_price: "", exit_price: "" });
  const [editTradeForm, setEditTradeForm] = useState({ forex_account_id: "", trade_date: "", notes: "", pair: "DAILY_P&L", lot_size: "1", entry_price: "", exit_price: "" });
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [editTradeType, setEditTradeType] = useState<"BUY" | "SELL">("BUY");
  const [tradePnlType, setTradePnlType] = useState<"profit" | "loss">("profit");
  const [tradeAmount, setTradeAmount] = useState("");
  const [editTradePnlType, setEditTradePnlType] = useState<"profit" | "loss">("profit");
  const [editTradeAmount, setEditTradeAmount] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPair, setSelectedPair] = useState<any>(null);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchForex(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePairSelect = async (pair: any) => {
    setSelectedPair(pair);
    setSearchQuery("");
    setSearchResults([]);
    setTradeForm({ ...tradeForm, pair: pair.symbol });
    
    // Fetch live price
    const res = await fetchLiveForexPrice(pair.symbol);
    if (res.price) {
      setTradeForm(prev => ({ ...prev, entry_price: res.price.toString() }));
    }
  };

  const [fundsForm, setFundsForm] = useState({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" });
  const [accountForm, setAccountForm] = useState({ broker_name: "", account_label: "", account_number: "", currency: "USD", notes: "" });

  const filteredForexAccounts = useMemo(() => forexAccounts, [forexAccounts]);
  const filteredForexTrades = useMemo(() => forexTrades, [forexTrades]);
  const filteredForexTransactions = useMemo(() => forexTransactions, [forexTransactions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTradeForm(prev => ({ ...prev, trade_date: new Date().toISOString().split("T")[0] }));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && !fundsForm.bank_account_id) {
      const defaultAccId = profile?.default_accounts?.forex;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      setTimeout(() => {
        setFundsForm(prev => ({ ...prev, bank_account_id: defaultAccExists ? defaultAccId : accounts[0].id }));
      }, 0);
    }
  }, [accounts, fundsForm.bank_account_id, profile]);

  const stats = useMemo(() => {
    const totalBalance = filteredForexAccounts.reduce((s, a) => s + Number(a.balance), 0);
    const totalPnL = filteredForexAccounts.reduce((s, a) => s + Number(a.total_pnl), 0);
    const totalDeposited = filteredForexAccounts.reduce((s, a) => s + Number(a.total_deposited), 0);
    const totalWithdrawn = filteredForexAccounts.reduce((s, a) => s + Number(a.total_withdrawn), 0);
    const dailyPnlSum = filteredForexTrades
      .filter(t => t.trade_date && t.trade_date.startsWith(new Date().toISOString().split("T")[0]))
      .reduce((s, t) => s + Number(t.pnl), 0);
    
    return { totalBalance, totalPnL, totalDeposited, totalWithdrawn, dailyPnlSum };
  }, [filteredForexAccounts, filteredForexTrades]);

  const pnlChartData = useMemo(() => {
    // Group trades by month
    const grouped: Record<string, number> = {};
    const sortedTrades = [...filteredForexTrades].sort((a, b) => new Date(a.trade_date || a.created_at || 0).getTime() - new Date(b.trade_date || b.created_at || 0).getTime());
    
    let cumPnL = 0;
    const res: any[] = [];
    sortedTrades.forEach(t => {
      cumPnL += Number(t.pnl);
      const date = t.trade_date || t.created_at || new Date().toISOString();
      const monthStr = format(new Date(date), "MMM yyyy");
      if (!grouped[monthStr]) grouped[monthStr] = cumPnL;
      else grouped[monthStr] = cumPnL;
    });

    for (const [month, val] of Object.entries(grouped)) {
      res.push({ name: month, PnL: val });
    }
    return res;
  }, [filteredForexTrades]);

  const brokerAllocData = useMemo(() => {
    return filteredForexAccounts.map(a => ({
      name: a.account_label,
      Balance: Number(a.balance),
      PnL: Number(a.total_pnl)
    }));
  }, [filteredForexAccounts]);

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
        toast.success("Broker account created");
        setShowAccountModal(false);
        setAccountForm({ broker_name: "", account_label: "", account_number: "", currency: "USD", notes: "" });
        mutate();
      } else toast.error(res.error || "Failed");
    });
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Are you sure you want to delete this broker account?")) return;
    await withLock(async () => {
      const res = await deleteForexAccount(id);
      if (res.success) {
        toast.success("Broker account deleted");
        mutate();
      } else toast.error(res.error || "Failed");
    });
  }

  async function handleLogTrade(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const rawVal = parseFloat(tradeAmount);
      if (isNaN(rawVal) || rawVal <= 0) { toast.error("Valid amount required"); return; }

      if (tradePnlType === "loss") {
        const forexAcc = forexAccounts.find(a => a.id === tradeForm.forex_account_id);
        if (forexAcc && forexAcc.balance < rawVal) { toast.error("Loss cannot exceed balance"); return; }
      }

      const finalPnl = tradePnlType === "profit" ? rawVal : -rawVal;
      const res = await logForexTrade({
        forex_account_id: tradeForm.forex_account_id,
        pair: tradeForm.pair || "DAILY_P&L",
        trade_type: tradeType,
        lot_size: parseFloat(tradeForm.lot_size) || 1,
        pnl: finalPnl,
        trade_date: tradeForm.trade_date || undefined,
        entry_price: tradeForm.entry_price ? parseFloat(tradeForm.entry_price) : undefined,
        exit_price: tradeForm.exit_price ? parseFloat(tradeForm.exit_price) : undefined,
        notes: tradeForm.notes || undefined,
      });
      if (res.success) {
        toast.success("P&L logged");
        setShowTradeModal(false);
        setTradeAmount("");
        mutate();
      } else toast.error(res.error || "Failed");
    });
  }

  const startEditTrade = (trade: Tables<"forex_trades">) => {
    setEditingTrade(trade);
    setEditTradePnlType(trade.pnl >= 0 ? "profit" : "loss");
    setEditTradeAmount(Math.abs(trade.pnl).toString());
    setEditTradeType(trade.trade_type as "BUY" | "SELL");
    setEditTradeForm({
      forex_account_id: trade.forex_account_id || "",
      trade_date: trade.trade_date ? new Date(trade.trade_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      pair: trade.pair || "DAILY_P&L",
      lot_size: trade.lot_size?.toString() || "1",
      entry_price: trade.entry_price?.toString() || "",
      exit_price: trade.exit_price?.toString() || "",
      notes: trade.notes || ""
    });
    setShowEditTradeModal(true);
  };

  async function handleUpdateTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTrade) return;
    await withLock(async () => {
      const rawVal = parseFloat(editTradeAmount);
      if (isNaN(rawVal) || rawVal <= 0) { toast.error("Valid amount required"); return; }
      const finalPnl = editTradePnlType === "profit" ? rawVal : -rawVal;
      const res = await updateForexTrade(editingTrade.id, {
        forex_account_id: editTradeForm.forex_account_id,
        pair: editTradeForm.pair || "DAILY_P&L",
        trade_type: editTradeType,
        lot_size: parseFloat(editTradeForm.lot_size) || 1,
        pnl: finalPnl,
        trade_date: editTradeForm.trade_date,
        entry_price: editTradeForm.entry_price ? parseFloat(editTradeForm.entry_price) : undefined,
        exit_price: editTradeForm.exit_price ? parseFloat(editTradeForm.exit_price) : undefined,
        notes: editTradeForm.notes || undefined
      });
      if (res.success) {
        toast.success("P&L updated");
        setShowEditTradeModal(false);
        setEditingTrade(null);
        mutate();
      } else toast.error(res.error || "Failed");
    });
  }

  async function handleFunds(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const amt = parseFloat(fundsForm.amount);
      if (isNaN(amt) || amt <= 0) { toast.error("Valid amount required"); return; }
      
      let res;
      if (fundsType === "DEPOSIT") {
        res = await forexDeposit({ ...fundsForm, amount: amt });
      } else {
        const forexAcc = forexAccounts.find(a => a.id === fundsForm.forex_account_id);
        if (forexAcc && forexAcc.balance < amt) { toast.error("Insufficient broker balance"); return; }
        res = await forexWithdraw({ ...fundsForm, amount: amt });
      }
      if (res.success) {
        toast.success(fundsType === "DEPOSIT" ? "Deposit successful" : "Withdrawal successful");
        setShowFundsModal(false);
        mutate();
      } else toast.error(res.error || "Failed");
    });
  }


  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Forex</h1>
          <p className="text-xs text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Currency Markets</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setShowAccountModal(true)} className="btn-secondary !h-11">Add Broker Account</button>
          <button type="button" onClick={() => { setFundsType("DEPOSIT"); setFundsForm({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" }); setShowFundsModal(true); }} className="btn-secondary !h-11 text-emerald-400">Deposit</button>
          <button type="button" onClick={() => { setFundsType("WITHDRAW"); setFundsForm({ forex_account_id: "", bank_account_id: "", amount: "", notes: "" }); setShowFundsModal(true); }} className="btn-secondary !h-11 text-amber-400">Withdraw</button>
          <button type="button" onClick={() => setShowTradeModal(true)} className="btn-primary !h-11 shadow-[0_0_30px_rgba(14,165,233,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            Log P&L
          </button>
        </div>
      </div>

      {filteredForexTrades.length === 0 && filteredForexTransactions.length === 0 && filteredForexAccounts.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-emerald-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <span className="text-3xl">💱</span>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">Forex Terminal</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Track currency trading performance, manage deposits/withdrawals, and monitor net returns across forex brokers.</p>
          <div className="mt-8 flex justify-center">
             <button onClick={() => setShowAccountModal(true)} className="btn-primary">Add Broker Account</button>
          </div>
        </div>
      ) : (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total Balance</p>
            <p className="text-2xl md:text-3xl font-black text-white">${stats.totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Across Brokers</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Total P&amp;L</p>
            <PnLValue amount={stats.totalPnL} size="lg" showIcon currency="USD" />
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Trading Performance</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Today&apos;s P&amp;L</p>
            <PnLValue amount={stats.dailyPnlSum} size="lg" showIcon currency="USD" />
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Daily Return</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Deposited</p>
            <p className="text-2xl md:text-3xl font-black text-[--accent-primary-light]">${stats.totalDeposited.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Inflow</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Withdrawn</p>
            <p className="text-xl md:text-2xl font-black text-amber-400">${stats.totalWithdrawn.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[0.5625rem] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Outflow</p>
          </div>
        </div>

        {/* Premium Segmented Switcher */}
        <div className="flex p-1 bg-white/[0.02] border border-white/5 rounded-2xl max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] overflow-x-auto no-scrollbar">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "accounts", label: `Accounts (${filteredForexAccounts.length})` },
            { key: "pnl", label: "P&L Summaries" },
            { key: "transactions", label: "Transactions" }
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            
            // Cyan Theme for Forex
            const activeStyles = "bg-cyan-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]";

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer ${
                  isActive
                    ? `${activeStyles} border border-transparent`
                    : "text-[--text-muted] hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card-static p-6 min-h-[350px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Performance Trend</h3>
                    <p className="text-2xl font-black mt-2 text-white">Cumulative P&L</p>
                  </div>
                </div>
                <div className="flex-1 w-full mt-4 -ml-4">
                  {mounted && pnlChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={pnlChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} tickFormatter={(val: any) => "$" + Number(val).toLocaleString()} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                          formatter={(val: any) => ["$" + Number(val).toLocaleString(), "P&L"]}
                        />
                        <Area type="monotone" dataKey="PnL" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorPnL)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[--text-muted] text-sm italic">Not enough P&L data</div>
                  )}
                </div>
              </div>

              <div className="glass-card-static p-6 min-h-[350px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Broker Allocation</h3>
                    <p className="text-2xl font-black mt-2 text-white">Balances vs P&amp;L</p>
                  </div>
                </div>
                <div className="flex-1 w-full mt-4 -ml-4">
                  {mounted && brokerAllocData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={brokerAllocData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} tickFormatter={(val: any) => "$" + Number(val).toLocaleString()} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                          formatter={(val: any, name: any) => ["$" + Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), name]}
                        />
                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                        <Bar dataKey="Balance" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="PnL" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[--text-muted] text-sm italic">No active broker accounts</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "accounts" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ForexDataTable 
              accounts={filteredForexAccounts}
              onDelete={handleDeleteAccount}
              onAdd={() => setShowAccountModal(true)}
            />
          </div>
        )}

        {activeTab === "pnl" && (
          <div className="glass-card-static rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/5 bg-black/40">
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Account</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Notes</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">P&L</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredForexTrades.map(trade => (
                    <tr key={trade.id}>
                      <td className="px-5 py-4 text-sm font-medium text-white">{format(new Date(trade.trade_date || trade.created_at || 0), "MMM d, yyyy")}</td>
                      <td className="px-5 py-4 text-xs font-bold text-[--text-muted]">{getAccountLabel(trade.forex_account_id)}</td>
                      <td className="px-5 py-4 text-xs text-[--text-muted]">{trade.notes || "—"}</td>
                      <td className="px-5 py-4 text-right">
                        <PnLValue amount={trade.pnl} currency={getAccountCurrency(trade.forex_account_id)} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => startEditTrade(trade)} className="text-xs font-black uppercase tracking-widest text-[--text-muted] hover:text-[--text-primary] transition-colors">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredForexTrades.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-[--text-muted] italic">No daily P&L entries logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "transactions" && (
          <div className="glass-card-static rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/5 bg-black/40">
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Type</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Broker Account</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Notes</th>
                    <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredForexTransactions.map((tx) => {
                    const matchingLog = ledgerLogs?.find(log => log.source_type === 'forex' && log.source_id === tx.id);
                    return (
                      <tr key={tx.id}>
                        <td className="px-5 py-4">
                          <p className="text-[12px] font-bold text-white/80">{matchingLog?.created_at ? format(new Date(matchingLog.created_at || new Date().toISOString()), "MMM d, yyyy") : "N/A"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[0.5625rem] font-black px-2 py-0.5 rounded uppercase tracking-widest ${tx.transaction_type === 'DEPOSIT' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-[--text-secondary]">{getAccountLabel(tx.forex_account_id)}</td>
                        <td className="px-5 py-4 text-xs text-[--text-muted]">{tx.notes || "—"}</td>
                        <td className={`px-5 py-4 text-right font-black tabular-nums ${tx.transaction_type === 'DEPOSIT' ? 'text-[--accent-primary-light]' : 'text-warning'}`}>
                          {tx.transaction_type === 'DEPOSIT' ? '+' : '-'}{getAccountCurrency(tx.forex_account_id) === 'USD' ? '$' : '₹'}{tx.amount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredForexTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-[--text-muted] italic">No transactions logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <Drawer isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} title="Broker Account">
          <div className="p-2 max-w-lg mx-auto w-full">
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Broker Name</label>
                  <input required className="input-premium !h-10 text-xs" placeholder="e.g. MetaTrader 5" value={accountForm.broker_name} onChange={e => setAccountForm({...accountForm, broker_name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Account Label</label>
                  <input required className="input-premium !h-10 text-xs" placeholder="e.g. Live Account" value={accountForm.account_label} onChange={e => setAccountForm({...accountForm, account_label: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Account Number (Optional)</label>
                  <input className="input-premium !h-10 text-xs" placeholder="e.g. 104859" value={accountForm.account_number} onChange={e => setAccountForm({...accountForm, account_number: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Currency</label>
                  <select required className="input-premium !h-10 text-xs text-white" value={accountForm.currency} onChange={e => setAccountForm({...accountForm, currency: e.target.value})}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full h-11 text-xs font-bold shadow-md mt-4 cursor-pointer">
                {submitting ? "Creating..." : "Create Account"}
              </button>
            </form>
          </div>
        </Drawer>
      )}

      {/* Funds Modal */}
      {showFundsModal && (
        <Drawer isOpen={showFundsModal} onClose={() => setShowFundsModal(false)} title={fundsType === "DEPOSIT" ? "Deposit Funds" : "Withdraw Funds"}>
          <div className="p-2 max-w-lg mx-auto w-full">
            <form onSubmit={handleFunds} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Broker Account</label>
                  <select required className="input-premium !h-10 text-xs text-white" value={fundsForm.forex_account_id} onChange={e => setFundsForm({...fundsForm, forex_account_id: e.target.value})}>
                    <option value="">Select Broker</option>
                    {filteredForexAccounts.map(a => <option key={a.id} value={a.id}>{a.account_label} ({a.broker_name})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">{fundsType === "DEPOSIT" ? "From Bank Account" : "To Bank Account"}</label>
                  <select required className="input-premium !h-10 text-xs text-white" value={fundsForm.bank_account_id} onChange={e => setFundsForm({...fundsForm, bank_account_id: e.target.value})}>
                    <option value="">Select Bank</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Amount</label>
                <input required type="number" step="0.01" className="input-premium !h-10 text-xs tabular-nums" placeholder="0.00" value={fundsForm.amount} onChange={e => setFundsForm({...fundsForm, amount: e.target.value})} inputMode="decimal" />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full h-11 text-xs font-bold shadow-md mt-4 cursor-pointer">
                {submitting ? "Processing..." : fundsType === "DEPOSIT" ? "Deposit Funds" : "Withdraw Funds"}
              </button>
            </form>
          </div>
        </Drawer>
      )}

      {/* Trade Modal */}
      {(showTradeModal || showEditTradeModal) && (
        <Drawer isOpen={showTradeModal || showEditTradeModal} onClose={() => { setShowTradeModal(false); setShowEditTradeModal(false); setEditingTrade(null); setSelectedPair(null); setSearchQuery(""); setSearchResults([]); }} title={showEditTradeModal ? "Edit Forex Trade" : "Log Forex Trade"}>
          <div className="p-4 max-w-2xl mx-auto w-full">
            <form onSubmit={showEditTradeModal ? handleUpdateTrade : handleLogTrade} className="space-y-6">
              
              {/* Search Section - Only for new trades */}
              {!showEditTradeModal && (
                <div className="relative z-50">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search currency pairs (e.g. EURUSD=X)..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-lg font-black text-white placeholder:text-white/20 focus:outline-none focus:border-[--accent-primary] transition-all shadow-inner"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {isSearching && (
                      <div className="absolute right-6 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-[--accent-primary] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-[300px] overflow-y-auto">
                      {searchResults.map((pair, idx) => (
                        <div
                          key={idx}
                          onClick={() => handlePairSelect(pair)}
                          className="px-6 py-4 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors flex justify-between items-center"
                        >
                          <div>
                            <div className="font-black text-white">{pair.symbol}</div>
                            <div className="text-xs text-[--text-muted]">{pair.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Form Content - Shows if editing or if a pair is selected/entered */}
              {(showEditTradeModal || (tradeForm.pair && tradeForm.pair !== "DAILY_P&L")) && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Select Broker</label>
                      <select required className="input-premium" value={showEditTradeModal ? editTradeForm.forex_account_id : tradeForm.forex_account_id} onChange={e => showEditTradeModal ? setEditTradeForm({...editTradeForm, forex_account_id: e.target.value}) : setTradeForm({...tradeForm, forex_account_id: e.target.value})}>
                        <option value="">Select Account</option>
                        {filteredForexAccounts.map(a => <option key={a.id} value={a.id}>{a.account_label} ({a.broker_name})</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Date</label>
                      <input required type="date" className="input-premium" value={showEditTradeModal ? editTradeForm.trade_date : tradeForm.trade_date} onChange={e => showEditTradeModal ? setEditTradeForm({...editTradeForm, trade_date: e.target.value}) : setTradeForm({...tradeForm, trade_date: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">P&L Type</label>
                      <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
                        <button type="button" onClick={() => showEditTradeModal ? setEditTradePnlType("profit") : setTradePnlType("profit")} className={`flex-1 h-12 text-xs font-black rounded-lg transition-all ${((showEditTradeModal ? editTradePnlType : tradePnlType) === "profit") ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-[--text-muted]"}`}>Profit</button>
                        <button type="button" onClick={() => showEditTradeModal ? setEditTradePnlType("loss") : setTradePnlType("loss")} className={`flex-1 h-12 text-xs font-black rounded-lg transition-all ${((showEditTradeModal ? editTradePnlType : tradePnlType) === "loss") ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "text-[--text-muted]"}`}>Loss</button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">P&L Amount</label>
                      <input required type="number" step="0.01" min="0.01" className="input-premium tabular-nums" placeholder="0.00" value={showEditTradeModal ? editTradeAmount : tradeAmount} onChange={e => showEditTradeModal ? setEditTradeAmount(e.target.value) : setTradeAmount(e.target.value)} inputMode="decimal" />
                    </div>
                  </div>

                  <details className="group glass-card-static border border-white/5 rounded-xl overflow-hidden mt-6">
                    <summary className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted] p-4 cursor-pointer outline-none hover:text-white transition-colors bg-white/[0.01]">
                      Advanced Trade Details
                    </summary>
                    <div className="p-4 pt-0 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Pair</label>
                          <input className="input-premium uppercase" placeholder="e.g. EURUSD=X" value={showEditTradeModal ? editTradeForm.pair : tradeForm.pair} onChange={e => showEditTradeModal ? setEditTradeForm({...editTradeForm, pair: e.target.value}) : setTradeForm({...tradeForm, pair: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Trade Type</label>
                          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
                            <button type="button" onClick={() => showEditTradeModal ? setEditTradeType("BUY") : setTradeType("BUY")} className={`flex-1 h-12 text-xs font-black rounded-lg transition-all ${((showEditTradeModal ? editTradeType : tradeType) === "BUY") ? "bg-[--accent-primary]/20 text-[--accent-primary] border border-[--accent-primary]/30" : "text-[--text-muted]"}`}>Buy</button>
                            <button type="button" onClick={() => showEditTradeModal ? setEditTradeType("SELL") : setTradeType("SELL")} className={`flex-1 h-12 text-xs font-black rounded-lg transition-all ${((showEditTradeModal ? editTradeType : tradeType) === "SELL") ? "bg-[--accent-primary]/20 text-[--accent-primary] border border-[--accent-primary]/30" : "text-[--text-muted]"}`}>Sell</button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Lot Size</label>
                          <input type="number" step="0.01" className="input-premium tabular-nums" placeholder="1.0" value={showEditTradeModal ? editTradeForm.lot_size : tradeForm.lot_size} onChange={e => showEditTradeModal ? setEditTradeForm({...editTradeForm, lot_size: e.target.value}) : setTradeForm({...tradeForm, lot_size: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Entry Price</label>
                          <input type="number" step="0.00001" className="input-premium tabular-nums" placeholder="Optional" value={showEditTradeModal ? editTradeForm.entry_price : tradeForm.entry_price} onChange={e => showEditTradeModal ? setEditTradeForm({...editTradeForm, entry_price: e.target.value}) : setTradeForm({...tradeForm, entry_price: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Exit Price</label>
                          <input type="number" step="0.00001" className="input-premium tabular-nums" placeholder="Optional" value={showEditTradeModal ? editTradeForm.exit_price : tradeForm.exit_price} onChange={e => showEditTradeModal ? setEditTradeForm({...editTradeForm, exit_price: e.target.value}) : setTradeForm({...tradeForm, exit_price: e.target.value})} />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Notes</label>
                        <input className="input-premium" placeholder="Optional notes about this trade..." value={showEditTradeModal ? editTradeForm.notes : tradeForm.notes} onChange={e => showEditTradeModal ? setEditTradeForm({...editTradeForm, notes: e.target.value}) : setTradeForm({...tradeForm, notes: e.target.value})} />
                      </div>
                    </div>
                  </details>

                  <div className="pt-4 mt-8">
                    <button type="submit" disabled={submitting} className={`btn-primary w-full h-12 shadow-xl text-xs font-black uppercase tracking-widest shadow-[--accent-primary]/20`}>
                      {submitting ? "Processing..." : (showEditTradeModal ? "Update Trade" : "Log Trade")}
                    </button>
                  </div>
                </>
              )}
              
              {/* If no pair selected, show basic P&L fallback for manual entry */}
              {!showEditTradeModal && !tradeForm.pair && (
                <div className="text-center p-8 bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-[--text-muted] mb-4">Or log a generic daily P&L entry without a specific pair.</p>
                  <button type="button" onClick={() => setTradeForm({ ...tradeForm, pair: "DAILY_P&L" })} className="btn-secondary px-6 py-3 text-xs font-black uppercase tracking-widest">
                    Log Daily P&L
                  </button>
                </div>
              )}
            </form>
          </div>
        </Drawer>
      )}

    </div>
  );
}
