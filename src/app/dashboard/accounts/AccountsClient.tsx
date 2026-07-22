"use client";

import { useMemo, useState, useEffect, useRef, memo } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import type { Tables } from "@/lib/database.types";
import { searchBanks, type Bank } from "@/lib/banks";
import { createAccount, updateAccount, deleteAccount, createTransfer, adjustBalance } from "./actions";
import BankLogo from "@/components/bank-logo";
import { Drawer } from "@/components/ui/drawer";

import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { getChartColour } from "@/lib/chart-colours";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { getCurrencySymbol } from "@/lib/utils";

// Dynamic imports for chart performance
const PieChart = dynamic(() => import("recharts").then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then(mod => mod.Cell), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(mod => mod.ResponsiveContainer), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(mod => mod.Tooltip), { ssr: false });

type Account = Tables<"accounts">;
type LedgerLog = Tables<"ledger_logs">;

const CategoryIcon = memo(({ type, className = "w-6 h-6" }: { type: string; className?: string }) => {
  const styles: Record<string, { bg: string; color: string; path: string }> = {
    checking: { bg: "rgba(14, 165, 233, 0.05)", color: "var(--accent-primary)", path: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
    savings: { bg: "rgba(16, 185, 129, 0.05)", color: "var(--success)", path: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    credit: { bg: "rgba(239, 68, 68, 0.05)", color: "var(--danger)", path: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
    investment: { bg: "rgba(56, 189, 248, 0.05)", color: "var(--accent-secondary)", path: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
    cash: { bg: "rgba(245, 158, 11, 0.05)", color: "var(--warning)", path: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  };
  const style = styles[type] || styles.checking;
  return (
    <div className={`p-2.5 rounded-xl border border-white/5 shadow-inner ${style.bg} ${className} flex items-center justify-center`}>
      <svg className="w-full h-full" style={{ color: style.color }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={style.path} /></svg>
    </div>
  );
});
CategoryIcon.displayName = "CategoryIcon";

const TYPE_STYLES: Record<string, { gradient: string; badge: string; badgeBorder: string; color: string; iconBg: string }> = {
  checking: { gradient: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)", badge: "rgba(14, 165, 233, 0.05)", badgeBorder: "rgba(14, 165, 233, 0.1)", color: "var(--accent-primary)", iconBg: "rgba(14, 165, 233, 0.05)" },
  savings: { gradient: "linear-gradient(135deg, #10b981 0%, #34d399 100%)", badge: "rgba(16, 185, 129, 0.05)", badgeBorder: "rgba(16, 185, 129, 0.1)", color: "var(--success)", iconBg: "rgba(16, 185, 129, 0.05)" },
  credit: { gradient: "linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)", badge: "rgba(239, 68, 68, 0.05)", badgeBorder: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", iconBg: "rgba(239, 68, 68, 0.05)" },
  investment: { gradient: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)", badge: "rgba(56, 189, 248, 0.05)", badgeBorder: "rgba(56, 189, 248, 0.1)", color: "var(--accent-secondary)", iconBg: "rgba(56, 189, 248, 0.05)" },
  cash: { gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)", badge: "rgba(245, 158, 11, 0.05)", badgeBorder: "rgba(245, 158, 11, 0.1)", color: "var(--warning)", iconBg: "rgba(245, 158, 11, 0.05)" },
};
const ACCOUNT_HISTORY_ACTIONS = new Set(["CREATE", "UPDATE", "DELETE", "TRANSFER_IN", "TRANSFER_OUT", "ADJUST_UP", "ADJUST_DOWN"]);
const DEBIT_ACCOUNT_ACTIONS = new Set(["ADJUST_DOWN", "TRANSFER_OUT", "DELETE"]);

function getHistoryCutoff(range: string): Date | null {
  if (range === "all") return null;
  const days = range === "90d" ? 90 : 30;
  return new Date(Date.now() - days * 86400_000);
}



function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (!/^[\da-f]{3}$|^[\da-f]{6}$/i.test(normalized)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }

  const safeHex = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;

  const value = Number.parseInt(safeHex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default function AccountsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { accounts, ledgerLogs }, isValidating, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get("action") === "new");
  const [activeTab, setActiveTab] = useState<"accounts" | "history">(searchParams.get("tab") === "history" ? "history" : "accounts");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState("");
  const [bankResults, setBankResults] = useState<Bank[]>([]);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setBankResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [submitting, withLock] = useSubmitLock();
  const [showTransferModal, setShowTransferModal] = useState(searchParams.get("action") === "transfer");
  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferData, setTransferData] = useState({ to_account_id: "", amount: "", note: "" });
  const [conversionRate, setConversionRate] = useState("");

  const fromAccount = useMemo(() => accounts.find(a => a.id === transferFromId), [accounts, transferFromId]);
  const toAccount = useMemo(() => accounts.find(a => a.id === transferData.to_account_id), [accounts, transferData.to_account_id]);
  const isCrossCurrency = useMemo(() => {
    return !!(fromAccount && toAccount && fromAccount.currency !== toAccount.currency);
  }, [fromAccount, toAccount]);

  const calculatedConvertedAmount = useMemo(() => {
    if (!transferData.amount || !conversionRate) return 0;
    const amt = parseFloat(transferData.amount);
    const rate = parseFloat(conversionRate);
    if (isNaN(amt) || isNaN(rate) || amt <= 0 || rate <= 0) return 0;
    return amt * rate;
  }, [transferData.amount, conversionRate]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingAccountId, setAdjustingAccountId] = useState<string | null>(null);
  const [adjustData, setAdjustData] = useState({ amount: "", note: "", type: "add" as "add" | "subtract" });
  const [formData, setFormData] = useState({ name: "", type: "checking", balance: "0", currency: "INR", bank_name: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [historyAccountId, setHistoryAccountId] = useState("all");
  const [historyDateRange, setHistoryDateRange] = useState<"30d" | "90d" | "all">("30d");

  function handleBankSearch(query: string) {
    setBankSearch(query);
    const results = searchBanks(query);
    setBankResults(results);
  }

  function selectBank(bank: Bank) {
    setFormData({ ...formData, bank_name: bank.name });
    setBankSearch(bank.name);
    setBankResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const data = { name: formData.name, type: formData.type, balance: parseFloat(formData.balance), currency: formData.currency, bank_name: formData.bank_name || null };
      const result = editingId ? await updateAccount(editingId, data) : await createAccount(data);
      if (!result?.error) {
        toast.success(editingId ? "Account updated successfully" : "New account created successfully");
        resetForm();
        mutate();
      } else {
        toast.error(result.error);
      }
    });
  }

  function resetForm() {
    setFormData({ name: "", type: "checking", balance: "0", currency: "INR", bank_name: "" });
    setBankSearch("");
    setBankResults([]);
    setShowForm(false);
    setEditingId(null);
  }



  function getActionIcon(action: string) {
    switch (action) {
      case 'CREATE': return '✨';
      case 'UPDATE': return '📝';
      case 'DELETE': return '🗑️';
      case 'TRANSFER_IN': return '↙️';
      case 'TRANSFER_OUT': return '↗️';
      case 'ADJUST_UP': return '📈';
      case 'ADJUST_DOWN': return '📉';
      default: return '⚡';
    }
  }

  function startEdit(account: Account) {
    setFormData({ name: account.name, type: account.type, balance: account.balance.toString(), currency: account.currency, bank_name: account.bank_name || "" });
    setBankSearch(account.bank_name || "");
    setBankResults([]);
    setEditingId(account.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    const account = accounts.find((a: Account) => a.id === id);
    if (account?.name === "Cash") { toast.error("Cannot delete Cash"); return; }
    setDeletingAccountId(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!deletingAccountId) return;
    await withLock(async () => {
      const res = await deleteAccount(deletingAccountId);
      if (!res?.error) {
        toast.success(res.message || "Account permanently removed from portfolio");
        mutate();
      } else {
        toast.error(res.error);
      }
      setShowDeleteConfirm(false);
      setDeletingAccountId(null);
    });
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingAccountId) return;
    await withLock(async () => {
      const amount = parseFloat(adjustData.amount);
      const finalAmount = adjustData.type === "subtract" ? -amount : amount;
      const res = await adjustBalance(adjustingAccountId, finalAmount, adjustData.note);
      if (!res?.error) {
        toast.success(res.message || "Account balance adjusted successfully");
        setShowAdjustModal(false);
        mutate();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferFromId) return;
    await withLock(async () => {
      const payload: any = {
        from_account_id: transferFromId,
        to_account_id: transferData.to_account_id,
        amount: parseFloat(transferData.amount),
        note: transferData.note || null
      };
      if (isCrossCurrency) {
        payload.converted_amount = calculatedConvertedAmount;
      }
      const res = await createTransfer(payload);
      if (!res?.error) {
        toast.success(res.message || "Inter-account transfer executed successfully");
        setShowTransferModal(false);
        // Reset states
        setTransferFromId(null);
        setTransferData({ to_account_id: "", amount: "", note: "" });
        setConversionRate("");
        mutate();
      } else {
        toast.error(res.error);
      }
    });
  }

  const [showUSD, setShowUSD] = useState(false);
  const displayedCurrency = showUSD ? "USD" : "INR";

  // Display all accounts in the list as requested by the user
  const filteredAccounts = useMemo(() => accounts, [accounts]);

  // Total balance summates only matching currency accounts
  const totalBalance = useMemo(() => 
    accounts
      .filter(a => a.currency === displayedCurrency)
      .reduce((acc, a) => acc + a.balance, 0),
    [accounts, displayedCurrency]
  );

  // Pie chart displays allocation only for matching currency accounts to avoid mixing USD/INR values
  const chartData = useMemo(() => 
    accounts
      .filter(a => a.currency === displayedCurrency)
      .map((a, i) => { 
        return {
          name: a.name, 
          value: Math.abs(a.balance), 
          fill: getChartColour(i),
          color: getChartColour(i), 
          currency: displayedCurrency,
          account: a
        };
      }),
    [accounts, displayedCurrency]
  );

  const accountHistory = useMemo(() => {
    const cutoff = getHistoryCutoff(historyDateRange);

    return (ledgerLogs as LedgerLog[])
      .filter((log) => ACCOUNT_HISTORY_ACTIONS.has(log.action_type))
      .filter((log) => !!log.created_at)
      .filter((log) => historyAccountId === "all" || log.account_id === historyAccountId)
      .filter((log) => !cutoff || new Date(log.created_at as string) >= cutoff)
      .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
  }, [ledgerLogs, historyAccountId, historyDateRange]);

  function getActionLabel(type: string) {
    const labels: Record<string, string> = {
      CREATE: "Created",
      UPDATE: "Updated",
      DELETE: "Deleted",
      TRANSFER_IN: "Transfer In",
      TRANSFER_OUT: "Transfer Out",
      ADJUST_UP: "Adjusted +",
      ADJUST_DOWN: "Adjusted -",
    };
    return labels[type] || type;
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Accounts Portfolio</h1>
            <p className="text-sm md:text-sm mt-1 font-medium text-[--text-muted]">Manage your financial footprint</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button type="button" onClick={() => { setTransferFromId(null); setShowTransferModal(true); }} className="btn-secondary h-11 w-full sm:w-auto flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>Transfer</button>
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary h-11 w-full sm:w-auto flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>New Account</button>
        </div>
      </div>

      {accounts.length === 0 ? (
          <div className="glass-card-static rich-border relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
            {/* Glowing background */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            {/* Dashed Border Container for Icon */}
            <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-[--accent-primary]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-purple-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
                <svg className="w-8 h-8 text-[--accent-primary-light]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>

            <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">Establish Your First Balance Node</h3>
            <p className="text-sm md:text-base text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">
              Build your financial engine. Register a checking, savings, credit, investment, or cash node to start tracking assets, executing transfers, and mapping out your net worth.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
              <button type="button" 
                onClick={() => {
                  setFormData({ name: "", type: "checking", balance: "0", currency: "INR", bank_name: "" });
                  setShowForm(true);
                }} 
                 className="btn-primary shadow-xl shadow-[--accent-primary]/20 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                Create Account
              </button>
            </div>

            {/* Quick Initialize suggestions */}
            <div className="mt-10 pt-8 border-t border-white/5 w-full max-w-md">
              <p className="text-xs font-black text-[--text-muted] uppercase tracking-[0.2em] mb-4">Or Quick-start with a template</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    setFormData({ name: "Primary Checking", type: "checking", balance: "5000", currency: "INR", bank_name: "" });
                    setShowForm(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-bold text-[--text-secondary] flex items-center gap-2"
                >
                  🏦 Primary Checking
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setFormData({ name: "High-Yield Savings", type: "savings", balance: "25000", currency: "INR", bank_name: "" });
                    setShowForm(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-bold text-[--text-secondary] flex items-center gap-2"
                >
                  💰 High-Yield Savings
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setFormData({ name: "Physical Cash Wallet", type: "cash", balance: "1000", currency: "INR", bank_name: "" });
                    setShowForm(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-bold text-[--text-secondary] flex items-center gap-2"
                >
                  💵 Cash Wallet
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
          {/* Portfolio Balance Card with Integrated Chart */}
          <div className="glass-card-static rich-border relative overflow-hidden p-6 md:p-10">
            <p className="text-xs md:text-xs font-bold uppercase tracking-[0.3em] text-[--text-muted] mb-4">Portfolio Assets</p>
            
            {/* Desktop: Side-by-side layout */}
            <div className="hidden lg:grid lg:grid-cols-[2fr_1fr] lg:gap-6 lg:items-center mb-8">
              {/* Left: Balance Info - Takes 2/3 of space */}
              <div>
                <div 
                  className="flex flex-col cursor-pointer group/nw select-none mb-6" 
                  onClick={() => setShowUSD(!showUSD)}
                  title="Click to toggle currency"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black tracking-widest text-[--text-muted] uppercase transition-colors group-hover/nw:text-[--text-primary]">
                      Total Balance ({displayedCurrency})
                    </span>
                    <svg className="w-3 h-3 text-[--text-muted] opacity-50 group-hover/nw:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <h2 
                    key={displayedCurrency} 
                    className={`animate-fade-in bg-clip-text bg-gradient-to-r text-[clamp(2.2rem,5vw,3.5rem)] font-[950] leading-none tracking-[-0.04em] text-transparent [font-family:'Outfit',sans-serif] whitespace-nowrap overflow-x-auto no-scrollbar transition-all duration-500 ${
                      displayedCurrency === 'USD' 
                        ? "from-white via-sky-200 to-indigo-300 drop-shadow-[0_10px_35px_rgba(99,102,241,0.3)]" 
                        : "from-white via-white to-slate-300 drop-shadow-[0_10px_35px_rgba(14,165,233,0.3)]"
                    }`}
                  >
                    {getCurrencySymbol(displayedCurrency)}{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {accounts.map((a, i) => {
                    const color = getChartColour(i);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
                        style={{ background: hexToRgba(color, 0.12), border: `1px solid ${hexToRgba(color, 0.28)}` }}
                      >
                        <div className="relative flex-shrink-0">
                          {a.bank_name ? <BankLogo bankName={a.bank_name!} size={32} /> : <CategoryIcon type={a.type} className="w-8 h-8" />}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 text-left">
                          <p className="font-bold text-xs text-[--text-secondary] truncate">{a.name}</p>
                          <p className="font-black text-sm" style={{ color: color }}>{getCurrencySymbol(a.currency)}{a.balance.toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Chart - Takes 1/3 of space */}
              <div className="relative w-full h-[280px]">
                <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie 
                      data={chartData} 
                      innerRadius="60%" 
                      outerRadius="85%" 
                      paddingAngle={5} 
                      dataKey="value" 
                      stroke="none"
                      animationDuration={1000}
                    >
                      {chartData.map((e, i) => (<Cell key={`cell-${i}`} fill={e.fill} />))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: 'var(--bg-surface)', 
                        border: '1px solid var(--border-default)', 
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-lg)',
                        fontWeight: 700
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <p className="text-[0.5rem] uppercase font-black text-[--text-muted] mb-1 tracking-widest">Net Value</p>
                  <div className="flex flex-col gap-2">
                    <p key={displayedCurrency} className="text-base font-black text-[--text-primary] leading-tight">
                      {getCurrencySymbol(displayedCurrency)}{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile/Tablet: Stacked layout */}
            <div className="lg:hidden">
              <div 
                className="flex flex-col items-center cursor-pointer group/nw select-none mb-6" 
                onClick={() => setShowUSD(!showUSD)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black tracking-widest text-[--text-muted] uppercase transition-colors group-hover/nw:text-[--text-primary]">
                    Total Balance ({displayedCurrency})
                  </span>
                  <svg className="w-3 h-3 text-[--text-muted] opacity-50 group-hover/nw:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <h2 
                  key={displayedCurrency} 
                  className={`animate-fade-in bg-clip-text bg-gradient-to-r text-3xl sm:text-5xl font-[950] tracking-tight text-transparent transition-all duration-500 ${
                    displayedCurrency === 'USD' 
                      ? "from-white via-sky-200 to-indigo-300 drop-shadow-[0_10px_35px_rgba(99,102,241,0.3)]" 
                      : "from-white via-white to-slate-300 drop-shadow-[0_10px_35px_rgba(14,165,233,0.3)]"
                  }`}
                >
                  {getCurrencySymbol(displayedCurrency)}{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </h2>
              </div>

              {/* Chart below balance on mobile */}
              <div className="relative w-full h-[280px] md:h-[350px] mb-6">
                <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie 
                      data={chartData} 
                      innerRadius="60%" 
                      outerRadius="85%" 
                      paddingAngle={5} 
                      dataKey="value" 
                      stroke="none"
                      animationDuration={1000}
                    >
                      {chartData.map((e, i) => (<Cell key={`cell-${i}`} fill={e.fill} />))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: 'var(--bg-surface)', 
                        border: '1px solid var(--border-default)', 
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-lg)',
                        fontWeight: 700
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <p className="text-[0.5625rem] md:text-xs uppercase font-black text-[--text-muted] mb-1 tracking-widest">Net Value</p>
                  <div className="flex flex-col gap-2">
                    <p key={displayedCurrency} className="text-lg md:text-2xl font-black text-[--text-primary] leading-tight">
                      {getCurrencySymbol(displayedCurrency)}{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account list below chart on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accounts.map((a, i) => {
                  const color = getChartColour(i);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 h-[64px] md:h-[72px] transition-all"
                      style={{ background: hexToRgba(color, 0.12), border: `1px solid ${hexToRgba(color, 0.28)}` }}
                    >
                      <div className="relative flex-shrink-0">
                        {a.bank_name ? <BankLogo bankName={a.bank_name!} size={40} /> : <CategoryIcon type={a.type} className="w-10 h-10" />}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 text-left">
                        <p className="font-bold text-xs md:text-xs text-[--text-secondary] truncate">{a.name}</p>
                        <p className="font-black text-sm md:text-sm" style={{ color: color }}>{getCurrencySymbol(a.currency)}{a.balance.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Premium Segmented Toggle Bar on top of accounts cards list */}
          <div className="flex justify-start w-full my-6">
            <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white/[0.02] border border-white/5 p-1.5 max-w-fit shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
              {[
                { key: "accounts", label: "Accounts" },
                { key: "history", label: "Transfer History" }
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                
                let activeStyles = "bg-[--accent-primary] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]";
                if (tab.key === "history") activeStyles = "bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]";

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
          </div>

          {activeTab === "accounts" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {filteredAccounts.length === 0 && (
              <div className="col-span-full py-12 text-center text-[--text-muted] bg-white/5 rounded-2xl border border-white/10 border-dashed">
                <p className="text-sm font-bold uppercase tracking-widest">No accounts found.</p>
              </div>
            )}
            {filteredAccounts.map((a) => {
              const style = TYPE_STYLES[a.type] || TYPE_STYLES.checking;
              const glowRgb = {
                checking: "14, 165, 233",
                savings: "16, 185, 129",
                credit: "244, 63, 94",
                investment: "56, 189, 248",
                cash: "245, 158, 11"
              }[a.type] || "148, 163, 184";
              
              return (
                <div 
                  key={a.id} 
                  className="glass-card rich-border flex flex-col min-h-[260px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1"
                  style={{
                    ['--hover-border-color' as any]: style.color,
                    ['--hover-glow-shadow' as any]: `0 12px 30px -10px rgba(${glowRgb}, 0.25)`
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: style.gradient }} />
                  <div className="flex justify-between items-start mb-6">
                     <div><span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider" style={{ background: style.badge, color: style.color, border: `1px solid ${style.badgeBorder}` }}>{a.type}</span><div className="flex items-center gap-3 mt-4">{a.bank_name ? <BankLogo bankName={a.bank_name} size={48} /> : <CategoryIcon type={a.type} className="w-12 h-12" />}<span className="text-base font-bold text-[--text-secondary]">{a.bank_name || a.name}</span></div></div>
                     {a.name !== "Cash" && <button type="button" onClick={() => startEdit(a)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>}
                  </div>
                  <div className="mt-auto">
                    <h3 className="text-lg font-bold truncate">{a.name}</h3>
                    <p className="text-2xl font-black mt-1" style={{ color: style.color }}>{getCurrencySymbol(a.currency)} {a.balance.toLocaleString()}</p>
                    <div className="flex gap-2 mt-6">
                      <button type="button" onClick={() => { setAdjustingAccountId(a.id); setShowAdjustModal(true); }} className="flex-1 h-11 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2" style={{ background: style.iconBg, color: style.color, border: `1px solid ${style.badgeBorder}` }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Adjust ±
                      </button>
                      {a.name !== "Cash" && <button type="button" onClick={() => handleDelete(a.id)} className="w-11 h-11 rounded-xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
          <div className="glass-card-static overflow-hidden animate-in fade-in duration-500">
        <div className="p-6 border-b border-white/5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[--text-primary]">Account History</h2>
            <p className="text-xs font-medium text-[--text-muted] mt-1">Past account activity</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[--text-muted]">{accountHistory.length} entries</span>
        </div>

        <div className="p-4 border-b border-white/5 flex flex-col gap-3">
          {/* Date range quick filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[--text-muted] shrink-0">Period</span>
            <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/5 p-0.5">
              {([
                { key: "30d", label: "Last 30 days" },
                { key: "90d", label: "Last 90 days" },
                { key: "all", label: "All time" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setHistoryDateRange(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    historyDateRange === opt.key
                      ? "bg-[--accent-primary] text-white shadow-sm"
                      : "text-[--text-muted] hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Account chips */}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setHistoryAccountId("all")} className={`px-4 h-9 rounded-xl text-xs font-semibold transition-all ${historyAccountId === "all" ? "bg-[--accent-primary]/20 text-[--accent-primary-light] border border-[--accent-primary]/30" : "bg-white/5 text-[--text-muted] border border-white/10 hover:text-[--text-primary]"}`}>All accounts</button>
            {accounts.map((account) => (
              <button type="button" key={account.id} onClick={() => setHistoryAccountId(account.id)} className={`px-4 h-9 rounded-xl text-xs font-semibold transition-all ${historyAccountId === account.id ? "bg-[--accent-primary]/20 text-[--accent-primary-light] border border-[--accent-primary]/30" : "bg-white/5 text-[--text-muted] border border-white/10 hover:text-[--text-primary]"}`}>{account.name}</button>
            ))}
          </div>
        </div>

        {accountHistory.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-bold text-[--text-primary]">No history found</p>
            <p className="text-sm text-[--text-muted] mt-1">Try another account filter or create activity.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-xs font-semibold text-[--text-muted] whitespace-nowrap">Timestamp</th>
                  <th className="p-4 text-xs font-semibold text-[--text-muted] whitespace-nowrap">Account</th>
                  <th className="p-4 text-xs font-semibold text-[--text-muted] whitespace-nowrap">Action</th>
                  <th className="p-4 text-xs font-semibold text-[--text-muted] w-full">Details</th>
                  <th className="p-4 text-xs font-semibold text-[--text-muted] text-right whitespace-nowrap">Amount</th>
                  <th className="p-4 text-xs font-semibold text-[--text-muted] text-right whitespace-nowrap">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {accountHistory.map((log) => {
                  const account = accounts.find((a) => a.id === log.account_id);
                  const isDebit = log.new_balance !== null && log.previous_balance !== null
                    ? log.new_balance < log.previous_balance
                    : DEBIT_ACCOUNT_ACTIONS.has(log.action_type);

                  const ActionIcon = getActionIcon(log.action_type);
                  const currency = account?.currency || "INR";

                  return (
                    <tr key={log.id}>
                      <td className="p-4 whitespace-nowrap">
                        <p className="text-xs font-bold text-white tracking-tight">
                          {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "—"}
                        </p>
                        <p className="text-xs font-mono text-[--text-muted] mt-0.5 tracking-widest uppercase">
                          {log.created_at ? format(new Date(log.created_at), "hh:mm a") : ""}
                        </p>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-white tracking-tight px-2 py-1 rounded bg-white/5 border border-white/10">
                          {account?.name || log.account_name || "System"}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDebit ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {ActionIcon}
                          </span>
                          <span className="text-xs font-semibold text-slate-300">
                            {getActionLabel(log.action_type)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-xs text-[--text-secondary] truncate max-w-[250px] lg:max-w-[400px]" title={log.details || ""}>
                          {log.details || "—"}
                        </p>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <p className={`text-sm font-black tracking-tight ${isDebit ? "text-rose-400" : "text-emerald-400"}`}>
                          {log.amount === null ? "—" : `${isDebit ? "-" : "+"}${getCurrencySymbol(currency)}${Math.abs(log.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </p>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {log.new_balance !== null ? (
                          <span className="text-xs font-bold text-white bg-white/5 px-2 py-1 rounded-md border border-white/10 shadow-inner">
                            {getCurrencySymbol(currency)}{log.new_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-xs text-[--text-muted]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
      </>
      )}

      {/* DRAWERS */}
      <Drawer
        isOpen={showForm}
        onClose={resetForm}
        title={editingId ? "Update Account" : "Open New Account"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Account Label</label>
            <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-premium" placeholder="e.g. Primary Savings" autoComplete="new-password" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Asset Category</label>
              <select aria-label="Select asset category" id="account-type" name="type" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="input-premium">
                {Object.keys(TYPE_STYLES).map(t => <option key={t} value={t} className="bg-[#181A20] text-white font-medium">{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Currency</label>
              <select aria-label="Select currency" id="account-currency" name="currency" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="input-premium">
                <option value="INR" className="bg-[#181A20] text-white font-medium">INR (₹)</option>
                <option value="USD" className="bg-[#181A20] text-white font-medium">USD ($)</option>
              </select>
            </div>
          </div>
          {!editingId && (
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Opening Balance</label>
              <input type="number" value={formData.balance} onChange={e => setFormData({...formData, balance: e.target.value})} className="input-premium" placeholder="0.00" autoComplete="new-password" inputMode="decimal" />
            </div>
          )}
          <div ref={searchContainerRef} className="relative space-y-3">
            <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Bank Institution</label>
            <input 
              value={bankSearch} 
              onChange={e => handleBankSearch(e.target.value)} 
              onFocus={() => {
                if (bankSearch) {
                  const results = searchBanks(bankSearch);
                  setBankResults(results);
                }
              }}
              className="input-premium" 
              placeholder="Search Banks..." 
              autoComplete="off" 
            />
            {bankResults.length > 0 && (
              <div 
                className="absolute top-full left-0 right-0 mt-2 border border-white/10 rounded-xl shadow-2xl z-50 overflow-y-auto max-h-48 custom-scrollbar"
                style={{ backgroundColor: "rgba(21, 27, 38, 0.98)", backdropFilter: "blur(12px)" }}
              >
                {bankResults.slice(0, 10).map(b => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => selectBank(b)}
                    className="w-full p-3.5 flex items-center gap-3 hover:bg-white/5 text-left border-b border-white/5 last:border-0"
                  >
                    <BankLogo bankName={b.name} size={28} />
                    <div>
                      <p className="font-bold text-sm text-white">{b.name}</p>
                      <p className="text-xs text-[--text-muted]">{b.domain}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="pt-2 mt-4">
            <button type="submit" disabled={submitting} className="btn-primary w-full h-11 shadow-xl shadow-[--accent-primary]/20 transition-all text-xs font-black uppercase tracking-widest">
              {submitting ? "Processing Registry..." : (editingId ? "Update Portfolio" : "Activate Account")}
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Adjust Balance"
      >
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button" 
              onClick={() => setAdjustData({...adjustData, type: 'add'})} 
              className={`py-4 rounded-xl font-bold text-sm transition-all border shadow-lg ${adjustData.type === 'add' ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
            >
              + Add funds
            </button>
            <button 
              type="button" 
              onClick={() => setAdjustData({...adjustData, type: 'subtract'})} 
              className={`py-4 rounded-xl font-bold text-sm transition-all border shadow-lg ${adjustData.type === 'subtract' ? 'bg-rose-500 border-rose-400 text-white shadow-rose-500/20' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
            >
              − Remove funds
            </button>
          </div>
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Amount</label>
            <input required type="number" step="0.01" value={adjustData.amount} onChange={e => setAdjustData({...adjustData, amount: e.target.value})} className="input-premium !h-14 text-xl font-black" placeholder="0.00" autoComplete="new-password" inputMode="decimal" />
          </div>
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Reason / Note</label>
            <input value={adjustData.note} onChange={e => setAdjustData({...adjustData, note: e.target.value})} className="input-premium" placeholder="Why the change?" autoComplete="new-password" />
          </div>
          <div className="pt-2 mt-4">
            <button type="submit" disabled={submitting} className="btn-primary w-full h-11 text-xs font-black uppercase tracking-widest shadow-xl shadow-[--accent-primary]/20">
              {submitting ? "Processing..." : "Finalize Adjustment"}
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setTransferFromId(null);
          setTransferData({ to_account_id: "", amount: "", note: "" });
          setConversionRate("");
        }}
        title="Inter-Account Transfer"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">SOURCE ACCOUNT</label>
              <select aria-label="Select source account" id="transfer-source" name="from_account" required value={transferFromId || ""} onChange={e => setTransferFromId(e.target.value)} className="input-premium text-xs">
                <option value="" className="bg-[#181A20] text-white font-medium">Select source</option>
                {accounts.map(a => <option key={a.id} value={a.id} className="bg-[#181A20] text-white font-medium">{a.name} ({getCurrencySymbol(a.currency)}{a.balance.toLocaleString()})</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">DESTINATION ACCOUNT</label>
              <select aria-label="Select destination account" id="transfer-destination" name="to_account" required value={transferData.to_account_id} onChange={e => setTransferData({...transferData, to_account_id: e.target.value})} className="input-premium text-xs">
                <option value="" className="bg-[#181A20] text-white font-medium">Select target</option>
                {accounts.map(a => a.id !== transferFromId && <option key={a.id} value={a.id} className="bg-[#181A20] text-white font-medium">{a.name} ({getCurrencySymbol(a.currency)}{a.balance.toLocaleString()})</option>)}
              </select>
            </div>
          </div>

          <div className={isCrossCurrency ? "grid grid-cols-2 gap-4" : "space-y-2"}>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">AMOUNT</label>
              <input required type="number" step="0.01" value={transferData.amount} onChange={e => setTransferData({...transferData, amount: e.target.value})} className="input-premium text-base font-black" placeholder="0.00" autoComplete="new-password" inputMode="decimal" />
            </div>
            {isCrossCurrency && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">CONVERSION RATE</label>
                <input required type="number" step="0.0001" value={conversionRate} onChange={e => setConversionRate(e.target.value)} className="input-premium text-base font-black bg-white/[0.02]" placeholder="e.g. 83.50" autoComplete="off" inputMode="decimal" />
              </div>
            )}
          </div>

          {/* Conditional Multi-Currency Conversion Section */}
          {isCrossCurrency && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-1.5 text-amber-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-[0.5625rem] font-black uppercase tracking-wider">Multi-Currency: {fromAccount?.currency} to {toAccount?.currency}</span>
              </div>

              {transferData.amount && conversionRate && parseFloat(transferData.amount) > 0 && parseFloat(conversionRate) > 0 && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-xs text-[--text-muted]">
                    <span>Calculation</span>
                    <span>{parseFloat(transferData.amount).toFixed(2)} {fromAccount?.currency} × {parseFloat(conversionRate).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-emerald-400 border-t border-white/5 pt-2">
                    <span>Total Converted Value</span>
                    <span>{calculatedConvertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {toAccount?.currency}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">Note / Description</label>
            <input 
              value={transferData.note} 
              onChange={e => setTransferData({...transferData, note: e.target.value})} 
              className="input-premium" 
              placeholder="What is this transfer for?" 
              autoComplete="off" 
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={submitting || !transferFromId || !transferData.to_account_id || !transferData.amount || (isCrossCurrency && !conversionRate)} 
              className="btn-primary w-full h-11 shadow-xl shadow-[--accent-primary]/20 text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Execute Transfer"}
            </button>
          </div>
        </form>
      </Drawer>

      {showDeleteConfirm && (
        <div className="mobile-dialog-shell fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-sm p-8 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-[--text-primary]">Delete Account</h3>
                <p className="text-sm text-[--text-secondary] mt-2">Are you sure you want to delete <span className="font-bold text-rose-400">{accounts.find(a => a.id === deletingAccountId)?.name}</span>? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletingAccountId(null); }} className="btn-secondary flex-1 h-11 font-bold rounded-xl">Cancel</button>
                <button type="button" onClick={confirmDelete} className="btn-danger flex-1 h-11 font-bold rounded-xl">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
