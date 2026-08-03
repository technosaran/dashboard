"use client";

import { useMemo, useState, useEffect, useRef, memo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import type { Tables } from "@/lib/database.types";
import { searchBanks, getBankLogoSources, type Bank } from "@/lib/banks";
import { createAccount, updateAccount, deleteAccount, createTransfer, adjustBalance, ensureCashReserveAccount } from "./actions";
import { X } from "lucide-react";
import { useHasMounted } from "@/hooks/use-has-mounted";

import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { getChartColour } from "@/lib/chart-colours";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { getCurrencySymbol, hexToRgba, getHistoryCutoff } from "@/lib/utils";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "@/components/ui/recharts";

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

const BANK_BRAND_PROFILES: Record<string, { monogram: string; gradient: string }> = {
  icici: { monogram: "ICICI", gradient: "from-amber-600 via-orange-600 to-red-700" },
  hdfc: { monogram: "HDFC", gradient: "from-blue-700 via-indigo-700 to-sky-800" },
  sbi: { monogram: "SBI", gradient: "from-sky-500 via-blue-600 to-indigo-700" },
  axis: { monogram: "AXIS", gradient: "from-rose-800 via-pink-900 to-red-950" },
  kotak: { monogram: "KOTAK", gradient: "from-red-600 via-rose-700 to-red-900" },
  pnb: { monogram: "PNB", gradient: "from-amber-500 via-yellow-600 to-amber-700" },
  bob: { monogram: "BOB", gradient: "from-orange-500 via-amber-600 to-red-600" },
  indian: { monogram: "INDIAN", gradient: "from-blue-600 via-sky-600 to-indigo-800" },
  canara: { monogram: "CANARA", gradient: "from-blue-600 via-cyan-600 to-amber-500" },
  union: { monogram: "UNION", gradient: "from-red-700 via-blue-700 to-indigo-800" },
  idfc: { monogram: "IDFC", gradient: "from-red-900 via-rose-900 to-pink-950" },
  cash: { monogram: "💵 CASH", gradient: "from-emerald-500 via-teal-600 to-amber-500" },
};

const BANK_MONOGRAM_GRADIENTS = [
  "from-blue-600 via-indigo-600 to-purple-700",
  "from-emerald-600 via-teal-600 to-cyan-700",
  "from-amber-600 via-orange-600 to-red-700",
  "from-violet-600 via-purple-600 to-fuchsia-700",
  "from-sky-600 via-blue-600 to-indigo-700",
];

const getBankMonogram = (bankName?: string | null, accountName?: string) => {
  const text = (bankName || accountName || "Bank").trim();
  const parenMatch = text.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1].trim().length >= 2) {
    return parenMatch[1].trim().toUpperCase();
  }
  const clean = text.replace(/\([^)]*\)/g, "").replace(/\b(checking|savings|account)\b/gi, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 3).toUpperCase();
};

const getBankGradient = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return BANK_MONOGRAM_GRADIENTS[Math.abs(h) % BANK_MONOGRAM_GRADIENTS.length];
};

const BankLogo = memo(({ bankName, accountName, accountType: _accountType, className = "w-8 h-8" }: { bankName?: string | null; accountName?: string; accountType?: string; className?: string }) => {
  const brandProfile = useMemo(() => {
    const q = (bankName || accountName || "").trim().toLowerCase();
    return Object.entries(BANK_BRAND_PROFILES).find(([k]) => q.includes(k))?.[1];
  }, [bankName, accountName]);

  const sources = useMemo(() => {
    const raw = bankName || accountName || "";
    const q = raw.trim().toLowerCase();
    const cash = _accountType === "cash" || q.includes("cash");
    if (cash) return [];
    return getBankLogoSources(raw);
  }, [bankName, accountName, _accountType]);

  const isCash = _accountType === "cash" || (bankName || accountName || "").trim().toLowerCase().includes("cash");

  const [srcIndex, setSrcIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  const [prevKey, setPrevKey] = useState(`${bankName}-${accountName}`);
  if (prevKey !== `${bankName}-${accountName}`) {
    setPrevKey(`${bankName}-${accountName}`);
    setSrcIndex(0);
    setShowFallback(false);
  }

  if (isCash) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-700 border border-amber-400/30 flex items-center justify-center text-white text-xl shadow-lg shrink-0 select-none`}>
        💵
      </div>
    );
  }

  const monogram = brandProfile?.monogram || getBankMonogram(bankName, accountName);
  const gradient = brandProfile?.gradient || getBankGradient(bankName || accountName || "");

  if (!sources.length || srcIndex >= sources.length || showFallback) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br ${gradient} border border-white/20 flex items-center justify-center text-white font-black text-xs tracking-wider shadow-lg shrink-0 select-none p-1 text-center truncate`}>
        {monogram}
      </div>
    );
  }

  const currentSrc = sources[srcIndex];

  return (
    <div className={`${className} flex items-center justify-center shrink-0 rounded-2xl bg-white p-0.5 shadow-md border border-white/30 overflow-hidden relative group`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={bankName || accountName || "Bank"}
        className="w-full h-full object-contain rounded-xl scale-110 group-hover:scale-115 transition-transform duration-300"
        loading="eager"
        onError={() => {
          if (srcIndex + 1 >= sources.length) {
            setShowFallback(true);
          } else {
            setSrcIndex((prev) => prev + 1);
          }
        }}
      />
    </div>
  );
});

BankLogo.displayName = "BankLogo";

const TYPE_STYLES: Record<string, { gradient: string; badge: string; badgeBorder: string; color: string; iconBg: string }> = {
  checking: { gradient: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)", badge: "rgba(14, 165, 233, 0.05)", badgeBorder: "rgba(14, 165, 233, 0.1)", color: "var(--accent-primary)", iconBg: "rgba(14, 165, 233, 0.05)" },
  savings: { gradient: "linear-gradient(135deg, #10b981 0%, #34d399 100%)", badge: "rgba(16, 185, 129, 0.05)", badgeBorder: "rgba(16, 185, 129, 0.1)", color: "var(--success)", iconBg: "rgba(16, 185, 129, 0.05)" },
  credit: { gradient: "linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)", badge: "rgba(239, 68, 68, 0.05)", badgeBorder: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", iconBg: "rgba(239, 68, 68, 0.05)" },
  investment: { gradient: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)", badge: "rgba(56, 189, 248, 0.05)", badgeBorder: "rgba(56, 189, 248, 0.1)", color: "var(--accent-secondary)", iconBg: "rgba(56, 189, 248, 0.05)" },
  cash: { gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)", badge: "rgba(245, 158, 11, 0.05)", badgeBorder: "rgba(245, 158, 11, 0.1)", color: "var(--warning)", iconBg: "rgba(245, 158, 11, 0.05)" },
};
const ACCOUNT_HISTORY_ACTIONS = new Set(["CREATE", "UPDATE", "DELETE", "TRANSFER_IN", "TRANSFER_OUT", "ADJUST_UP", "ADJUST_DOWN"]);
const DEBIT_ACCOUNT_ACTIONS = new Set(["ADJUST_DOWN", "TRANSFER_OUT", "DELETE"]);



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

  useEffect(() => {
    const hasCashAccount = accounts.some(a => a.type === "cash" || a.name.toLowerCase().includes("cash"));
    if (!hasCashAccount) {
      ensureCashReserveAccount().then(() => mutate());
    }
  }, [accounts, mutate]);
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
  const [historySearch, setHistorySearch] = useState("");

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
    if (account && (account.type === "cash" || account.name.toLowerCase().includes("cash") || account.name.toLowerCase().includes("zerodha") || (account as any).is_protected)) {
      toast.error("Built-in accounts (Cash Reserve, Zerodha Funds) are permanent and cannot be deleted.");
      return;
    }
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
        setAdjustData({ amount: "", note: "", type: "add" });
        setAdjustingAccountId(null);
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

  // Total balance summates all accounts converted to displayedCurrency (1 USD = 85 INR)
  const totalBalance = useMemo(() => {
    const fxRate = 85.0;
    return accounts.reduce((acc, a) => {
      const isUSD = a.currency === "USD";
      let val = a.balance;
      if (displayedCurrency === "USD" && !isUSD) {
        val = a.balance / fxRate;
      } else if (displayedCurrency === "INR" && isUSD) {
        val = a.balance * fxRate;
      }
      return acc + val;
    }, 0);
  }, [accounts, displayedCurrency]);

  // Pie chart displays allocation for all accounts converted to displayedCurrency
  const chartData = useMemo(() => {
    const fxRate = 85.0;
    return accounts
      .map((a, i) => {
        const isUSD = a.currency === "USD";
        let val = Math.abs(a.balance);
        if (displayedCurrency === "USD" && !isUSD) {
          val = val / fxRate;
        } else if (displayedCurrency === "INR" && isUSD) {
          val = val * fxRate;
        }
        return {
          name: a.name, 
          value: val, 
          fill: getChartColour(i),
          color: getChartColour(i), 
          currency: displayedCurrency,
          account: a
        };
      })
      .filter(item => item.value > 0);
  }, [accounts, displayedCurrency]);

  const accountHistory = useMemo(() => {
    const cutoff = getHistoryCutoff(historyDateRange);

    return (ledgerLogs as LedgerLog[])
      .filter((log) => ACCOUNT_HISTORY_ACTIONS.has(log.action_type))
      .filter((log) => !!log.created_at)
      .filter((log) => historyAccountId === "all" || log.account_id === historyAccountId)
      .filter((log) => !cutoff || new Date(log.created_at as string) >= cutoff)
      .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
  }, [ledgerLogs, historyAccountId, historyDateRange]);

  const historyStats = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    for (const log of accountHistory) {
      if (log.amount !== null && log.amount !== undefined) {
        const isDebit = log.new_balance !== null && log.previous_balance !== null
          ? log.new_balance < log.previous_balance
          : DEBIT_ACCOUNT_ACTIONS.has(log.action_type);
        if (isDebit) {
          totalOutflow += Math.abs(log.amount);
        } else {
          totalInflow += Math.abs(log.amount);
        }
      }
    }
    return { totalInflow, totalOutflow, count: accountHistory.length };
  }, [accountHistory]);

  const filteredAccountHistory = useMemo(() => {
    if (!historySearch.trim()) return accountHistory;
    const q = historySearch.toLowerCase();
    return accountHistory.filter((log) => {
      const acc = accounts.find((a) => a.id === log.account_id);
      const accName = acc?.name.toLowerCase() || "";
      const note = (log.details || "").toLowerCase();
      const action = (log.action_type || "").toLowerCase();
      const amountStr = String(log.amount || "");
      return accName.includes(q) || note.includes(q) || action.includes(q) || amountStr.includes(q);
    });
  }, [accountHistory, historySearch, accounts]);

  const historyTrendData = useMemo(() => {
    const map: Record<string, { date: string; Inflow: number; Outflow: number }> = {};
    [...accountHistory].reverse().forEach((log) => {
      if (!log.created_at) return;
      const dateStr = format(new Date(log.created_at), "MMM d");
      if (!map[dateStr]) {
        map[dateStr] = { date: dateStr, Inflow: 0, Outflow: 0 };
      }
      const isDebit = log.new_balance !== null && log.previous_balance !== null
        ? log.new_balance < log.previous_balance
        : DEBIT_ACCOUNT_ACTIONS.has(log.action_type);
      const amt = Math.abs(Number(log.amount || 0));
      if (isDebit) {
        map[dateStr].Outflow += amt;
      } else {
        map[dateStr].Inflow += amt;
      }
    });
    return Object.values(map).slice(-15);
  }, [accountHistory]);

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
    <>
      <div className="flex flex-col gap-[var(--section-gap)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Accounts Portfolio</h1>
            <p className="text-sm md:text-sm mt-1 font-medium text-[--text-muted]">Manage your financial footprint</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { setTransferFromId(null); setShowTransferModal(true); }} className="btn-secondary !h-11 px-4 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            <span>Transfer</span>
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary !h-11 px-4 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
            <span>New Account</span>
          </button>
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
                    className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-amber-200 tabular-nums whitespace-nowrap"
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
                        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all"
                        style={{ background: hexToRgba(color, 0.12), border: `1px solid ${hexToRgba(color, 0.28)}` }}
                      >
                        <BankLogo bankName={a.bank_name} accountName={a.name} accountType={a.type} className="w-14 h-14" />
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
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie 
                      data={chartData} 
                      innerRadius="60%" 
                      outerRadius="85%" 
                      paddingAngle={5} 
                      dataKey="value" 
                      stroke="none"
                      isAnimationActive={false}
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
                  className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-amber-200 tabular-nums whitespace-nowrap"
                >
                  {getCurrencySymbol(displayedCurrency)}{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </h2>
              </div>

              {/* Chart below balance on mobile */}
              <div className="relative w-full h-[280px] md:h-[350px] mb-6">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie 
                      data={chartData} 
                      innerRadius="60%" 
                      outerRadius="85%" 
                      paddingAngle={5} 
                      dataKey="value" 
                      stroke="none"
                      isAnimationActive={false}
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
                      <BankLogo bankName={a.bank_name} accountName={a.name} accountType={a.type} className="w-9 h-9" />
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
              const isBuiltIn = a.type === "cash" || a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("zerodha") || Boolean((a as any).is_protected);
              const style = TYPE_STYLES[a.type] || TYPE_STYLES.checking;
              const glowRgb = {
                checking: "14, 165, 233",
                savings: "16, 185, 129",
                credit: "244, 63, 94",
                investment: "56, 189, 248",
                cash: "245, 158, 11"
              }[a.type] || "148, 163, 184";
              
              const hasDistinctBankName = Boolean(
                a.bank_name && 
                a.bank_name.trim() && 
                a.bank_name.trim().toLowerCase() !== a.name.trim().toLowerCase()
              );
              const cardTitle = isBuiltIn ? a.name : (hasDistinctBankName ? a.bank_name : a.name);
              const cardSubtitle = (!isBuiltIn && hasDistinctBankName) ? a.name : null;
              
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
                     <div>
                       <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider" style={{ background: style.badge, color: style.color, border: `1px solid ${style.badgeBorder}` }}>
                         {isBuiltIn ? (a.name.toLowerCase().includes("zerodha") ? "In-built Zerodha Wallet" : "In-built Cash Reserve") : a.type}
                       </span>
                       <div className="flex items-center gap-3 mt-4">
                         <BankLogo bankName={a.bank_name} accountName={a.name} accountType={a.type} className="w-14 h-14" />
                       </div>
                     </div>
                     {!isBuiltIn && (
                       <button type="button" onClick={() => startEdit(a)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                     )}
                  </div>
                  <div className="mt-auto">
                    <h3 className="text-lg font-bold truncate">{cardTitle}</h3>
                    {cardSubtitle && (
                      <p className="text-xs font-semibold text-[--text-muted] truncate mt-0.5">{cardSubtitle}</p>
                    )}
                    <p className="text-2xl font-black mt-1" style={{ color: style.color }}>{getCurrencySymbol(a.currency)} {a.balance.toLocaleString()}</p>
                    <div className="flex gap-2 mt-6">
                      <button type="button" onClick={() => { setAdjustingAccountId(a.id); setAdjustData({ amount: "", note: "", type: "add" }); setShowAdjustModal(true); }} className="flex-1 h-11 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2" style={{ background: style.iconBg, color: style.color, border: `1px solid ${style.badgeBorder}` }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Adjust ±
                      </button>
                      {!isBuiltIn && <button type="button" onClick={() => handleDelete(a.id)} className="w-11 h-11 rounded-xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Rich Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rich-border p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-emerald-900/20 via-emerald-950/10 to-slate-900/40 border border-emerald-500/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Total Credits / Inflow</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-sm font-bold">
                    ↓
                  </div>
                </div>
                <p className="text-2xl font-black text-white mt-3">
                  +₹{historyStats.totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[0.6875rem] text-emerald-300/70 font-semibold mt-1">
                  Filtered activity period
                </p>
              </div>

              <div className="glass-card rich-border p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-rose-900/20 via-rose-950/10 to-slate-900/40 border border-rose-500/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-rose-400">Total Debits / Outflow</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 text-sm font-bold">
                    ↑
                  </div>
                </div>
                <p className="text-2xl font-black text-white mt-3">
                  -₹{historyStats.totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[0.6875rem] text-rose-300/70 font-semibold mt-1">
                  Filtered activity period
                </p>
              </div>

              <div className="glass-card rich-border p-5 rounded-2xl relative overflow-hidden bg-gradient-to-br from-indigo-900/20 via-purple-950/10 to-slate-900/40 border border-indigo-500/20 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-300">Activity Log Volume</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-sm font-bold">
                    📊
                  </div>
                </div>
                <p className="text-2xl font-black text-white mt-3">
                  {historyStats.count} <span className="text-sm font-normal text-[--text-muted]">entries</span>
                </p>
                <p className="text-[0.6875rem] text-indigo-300/70 font-semibold mt-1">
                  Verified audit ledger logs
                </p>
              </div>
            </div>

            {/* Rich Activity Trend Chart */}
            {historyTrendData.length > 0 && (
              <div className="glass-card rich-border p-6 rounded-2xl border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Ledger Activity Trend</h3>
                    <p className="text-xl font-black text-white mt-1">Inflow vs Outflow History Curve</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Inflow
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Outflow
                    </span>
                  </div>
                </div>
                <div className="w-full h-[220px] mt-2">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={historyTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="histInflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="histOutflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `₹${v}`} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}
                        itemStyle={{ color: "#fff", fontWeight: "bold" }}
                        formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, ""]}
                      />
                      <Area type="monotone" dataKey="Inflow" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#histInflowGrad)" />
                      <Area type="monotone" dataKey="Outflow" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#histOutflowGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Filter Controls Bar */}
            <div className="glass-card rich-border p-5 rounded-2xl border border-white/10 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Audit & Transfer Ledger</h3>
                  <p className="text-xs text-[--text-muted]">Immutable log of account balance changes & transactions</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Live Search Box */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search history..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="bg-white/5 border border-white/10 focus:border-indigo-500/50 text-xs text-white rounded-xl px-3.5 py-1.5 w-44 placeholder:text-[--text-muted] outline-none transition-all"
                    />
                    {historySearch && (
                      <button
                        onClick={() => setHistorySearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[--text-muted] hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Period Selector */}
                  <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.03] border border-white/10 p-1">
                    {([
                      { key: "30d", label: "30 Days" },
                      { key: "90d", label: "90 Days" },
                      { key: "all", label: "All Time" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setHistoryDateRange(opt.key)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          historyDateRange === opt.key
                            ? "bg-[--accent-primary] text-white shadow-md shadow-indigo-500/20"
                            : "text-[--text-muted] hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Account Filter Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                <span className="text-xs font-bold text-[--text-muted] mr-1">Account:</span>
                <button
                  type="button"
                  onClick={() => setHistoryAccountId("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    historyAccountId === "all"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                      : "bg-white/5 text-[--text-muted] border border-white/10 hover:text-white"
                  }`}
                >
                  🌐 All Accounts
                </button>
                {accounts.map((account) => (
                  <button
                    type="button"
                    key={account.id}
                    onClick={() => setHistoryAccountId(account.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      historyAccountId === account.id
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                        : "bg-white/5 text-[--text-muted] border border-white/10 hover:text-white"
                    }`}
                  >
                    💳 {account.name}
                  </button>
                ))}
              </div>
            </div>

            {/* History Table Container */}
            <div className="glass-card rich-border rounded-2xl overflow-hidden border border-white/10">
              {filteredAccountHistory.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
                    📜
                  </div>
                  <p className="text-lg font-black text-white">No history logs match your filters</p>
                  <p className="text-xs text-[--text-muted] mt-1">Try switching account filter, date range, or clear your search term</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto relative">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md border-b border-white/10 shadow-lg">
                      <tr>
                        <th className="p-4 text-xs font-black uppercase tracking-wider text-[--text-muted]">Date & Time</th>
                        <th className="p-4 text-xs font-black uppercase tracking-wider text-[--text-muted]">Account</th>
                        <th className="p-4 text-xs font-black uppercase tracking-wider text-[--text-muted]">Action</th>
                        <th className="p-4 text-xs font-black uppercase tracking-wider text-[--text-muted] w-full">Activity Details</th>
                        <th className="p-4 text-xs font-black uppercase tracking-wider text-[--text-muted] text-right">Amount</th>
                        <th className="p-4 text-xs font-black uppercase tracking-wider text-[--text-muted] text-right">Updated Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredAccountHistory.map((log) => {
                        const account = accounts.find((a) => a.id === log.account_id);
                        const isDebit = log.new_balance !== null && log.previous_balance !== null
                          ? log.new_balance < log.previous_balance
                          : DEBIT_ACCOUNT_ACTIONS.has(log.action_type);

                        const ActionIcon = getActionIcon(log.action_type);
                        const currency = account?.currency || "INR";

                        return (
                          <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="p-4 whitespace-nowrap">
                              <p className="text-xs font-bold text-white tracking-tight">
                                {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "—"}
                              </p>
                              <p className="text-[0.6875rem] font-mono text-[--text-muted] mt-0.5 tracking-wider">
                                {log.created_at ? format(new Date(log.created_at), "hh:mm a") : ""}
                              </p>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <BankLogo bankName={account?.bank_name} accountName={account?.name} accountType={account?.type || "checking"} className="w-10 h-10" />
                                <span className="text-xs font-bold text-indigo-200 px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                  {account?.name || log.account_name || "System"}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${isDebit ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
                                  {ActionIcon}
                                </span>
                                <span className="text-xs font-bold text-slate-200">
                                  {getActionLabel(log.action_type)}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="text-xs text-[--text-secondary] truncate max-w-[280px] lg:max-w-[420px] font-medium" title={log.details || ""}>
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
                                <span className="text-xs font-mono font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
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
          </div>
        )}
      </>
      )}
    </div>

      {/* CENTERED DATA ENTRY MODALS */}
      <CenteredModal
        isOpen={showForm}
        onClose={resetForm}
        title={editingId ? "Update Account" : "Open New Account"}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[0.625rem] font-bold text-gray-300 uppercase tracking-wider">Account Label</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-premium !h-9.5 text-xs font-semibold" placeholder="e.g. Primary Savings" autoComplete="new-password" />
            </div>

            <div ref={searchContainerRef} className="relative space-y-1">
              <label className="text-[0.625rem] font-bold text-gray-300 uppercase tracking-wider">Bank Institution</label>
              <div className="relative flex items-center">
                {bankSearch.trim().length > 0 && (
                  <div className="absolute left-2.5 flex items-center pointer-events-none z-10">
                    <svg className="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                )}
                <input 
                  value={bankSearch} 
                  onChange={e => handleBankSearch(e.target.value)} 
                  onFocus={() => {
                    if (bankSearch) {
                      const results = searchBanks(bankSearch);
                      setBankResults(results);
                    }
                  }}
                  className={`input-premium !h-9.5 text-xs font-semibold w-full ${bankSearch.trim().length > 0 ? "!pl-8" : ""}`} 
                  placeholder="Search Banks..." 
                  autoComplete="off" 
                />
              </div>
              {bankResults.length > 0 && (
                <div 
                  className="absolute top-full left-0 right-0 mt-1.5 border border-white/10 rounded-xl shadow-2xl z-50 overflow-y-auto max-h-40 custom-scrollbar"
                  style={{ backgroundColor: "rgba(21, 27, 38, 0.98)", backdropFilter: "blur(12px)" }}
                >
                  {bankResults.slice(0, 8).map(b => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => selectBank(b)}
                      className="w-full p-2 flex items-center gap-2.5 hover:bg-white/5 text-left border-b border-white/5 last:border-0 transition-colors"
                    >
                      <BankLogo bankName={b.name} accountType="checking" className="w-11 h-11" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-white truncate">{b.name}</p>
                        <p className="text-[9px] text-[--text-muted] font-mono">{b.domain}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[0.625rem] font-bold text-gray-300 uppercase tracking-wider">Asset Category</label>
              <select aria-label="Select asset category" id="account-type" name="type" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="input-premium !h-9.5 text-xs font-semibold">
                {Object.keys(TYPE_STYLES).map(t => <option key={t} value={t} className="bg-[#151922] text-white font-medium">{t.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[0.625rem] font-bold text-gray-300 uppercase tracking-wider">Currency</label>
              <select aria-label="Select currency" id="account-currency" name="currency" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="input-premium !h-9.5 text-xs font-semibold">
                <option value="INR" className="bg-[#151922] text-white font-medium">INR (₹)</option>
                <option value="USD" className="bg-[#151922] text-white font-medium">USD ($)</option>
              </select>
            </div>
            {!editingId && (
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-[0.625rem] font-bold text-gray-300 uppercase tracking-wider">Opening Balance</label>
                <input type="number" value={formData.balance} onChange={e => setFormData({...formData, balance: e.target.value})} className="input-premium !h-9.5 text-xs font-semibold" placeholder="0.00" autoComplete="new-password" inputMode="decimal" />
              </div>
            )}
          </div>

          <div className="pt-1">
            <button type="submit" disabled={submitting} className="btn-primary w-full !h-10 text-xs font-black uppercase tracking-widest cursor-pointer disabled:opacity-40">
              {submitting ? "Saving..." : (editingId ? "Update Account" : "Add Account")}
            </button>
          </div>
        </form>
      </CenteredModal>

      <CenteredModal
        isOpen={showAdjustModal}
        onClose={() => {
          setShowAdjustModal(false);
          setAdjustingAccountId(null);
          setAdjustData({ amount: "", note: "", type: "add" });
        }}
        title="Adjust Balance"
      >
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button" 
              onClick={() => setAdjustData({...adjustData, type: 'add'})} 
              className={`py-3 rounded-xl font-bold text-xs transition-all border shadow-lg flex items-center justify-center gap-1.5 cursor-pointer ${adjustData.type === 'add' ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
            >
              + Add funds
            </button>
            <button 
              type="button" 
              onClick={() => setAdjustData({...adjustData, type: 'subtract'})} 
              className={`py-3 rounded-xl font-bold text-xs transition-all border shadow-lg flex items-center justify-center gap-1.5 cursor-pointer ${adjustData.type === 'subtract' ? 'bg-rose-500 border-rose-400 text-white shadow-rose-500/20' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}
            >
              − Remove funds
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Amount</label>
            <input required type="number" step="0.01" value={adjustData.amount} onChange={e => setAdjustData({...adjustData, amount: e.target.value})} className="input-premium !h-11 text-sm font-bold" placeholder="0.00" autoComplete="new-password" inputMode="decimal" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Reason / Note</label>
            <input value={adjustData.note} onChange={e => setAdjustData({...adjustData, note: e.target.value})} className="input-premium !h-11 text-xs font-semibold" placeholder="Why the change?" autoComplete="new-password" />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={submitting} className="btn-primary w-full !h-11 text-xs font-black uppercase tracking-widest cursor-pointer disabled:opacity-40">
              {submitting ? "Processing..." : "Finalize Adjustment"}
            </button>
          </div>
        </form>
      </CenteredModal>

      <CenteredModal
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">SOURCE ACCOUNT</label>
              <select aria-label="Select source account" id="transfer-source" name="from_account" required value={transferFromId || ""} onChange={e => setTransferFromId(e.target.value)} className="input-premium !h-11 text-xs font-semibold">
                <option value="" className="bg-[#151922] text-white font-medium">Select source</option>
                {accounts.map(a => {
                  const symbol = getCurrencySymbol(a.currency);
                  const nameLabel = a.bank_name && a.bank_name.trim().toLowerCase() !== a.name.trim().toLowerCase()
                    ? `${a.bank_name} (${a.name})`
                    : a.name;
                  return (
                    <option key={a.id} value={a.id} className="bg-[#151922] text-white font-medium">
                      {nameLabel} — {symbol}{a.balance.toLocaleString()}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">DESTINATION ACCOUNT</label>
              <select aria-label="Select destination account" id="transfer-destination" name="to_account" required value={transferData.to_account_id} onChange={e => setTransferData({...transferData, to_account_id: e.target.value})} className="input-premium !h-11 text-xs font-semibold">
                <option value="" className="bg-[#151922] text-white font-medium">Select target</option>
                {accounts.map(a => {
                  if (a.id === transferFromId) return null;
                  const symbol = getCurrencySymbol(a.currency);
                  const nameLabel = a.bank_name && a.bank_name.trim().toLowerCase() !== a.name.trim().toLowerCase()
                    ? `${a.bank_name} (${a.name})`
                    : a.name;
                  return (
                    <option key={a.id} value={a.id} className="bg-[#151922] text-white font-medium">
                      {nameLabel} — {symbol}{a.balance.toLocaleString()}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className={isCrossCurrency ? "grid grid-cols-2 gap-3" : "space-y-2"}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">AMOUNT</label>
              <input required type="number" step="0.01" value={transferData.amount} onChange={e => setTransferData({...transferData, amount: e.target.value})} className="input-premium !h-11 text-sm font-bold" placeholder="0.00" autoComplete="new-password" inputMode="decimal" />
            </div>
            {isCrossCurrency && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">CONVERSION RATE</label>
                <input required type="number" step="0.0001" value={conversionRate} onChange={e => setConversionRate(e.target.value)} className="input-premium !h-11 text-sm font-bold bg-white/[0.02]" placeholder="e.g. 83.50" autoComplete="off" inputMode="decimal" />
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
                <span className="text-[0.625rem] font-bold uppercase tracking-wider">Multi-Currency: {fromAccount?.currency} to {toAccount?.currency}</span>
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
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Note / Description</label>
            <input 
              value={transferData.note} 
              onChange={e => setTransferData({...transferData, note: e.target.value})} 
              className="input-premium !h-11 text-xs font-semibold" 
              placeholder="What is this transfer for?" 
              autoComplete="off" 
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={submitting || !transferFromId || !transferData.to_account_id || !transferData.amount || (isCrossCurrency && !conversionRate)} 
              className="btn-primary w-full !h-11 text-xs font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Processing..." : "Execute Transfer"}
            </button>
          </div>
        </form>
      </CenteredModal>

      {showDeleteConfirm && (
        <div className="mobile-dialog-shell fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-md md:max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-[--text-primary]">Delete Account</h3>
                <p className="text-xs text-[--text-secondary] mt-1.5 leading-relaxed">Are you sure you want to delete <span className="font-bold text-rose-400">{accounts.find(a => a.id === deletingAccountId)?.name}</span>? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletingAccountId(null); }} className="btn-secondary flex-1 !h-10 text-xs font-bold rounded-xl cursor-pointer">Cancel</button>
                <button type="button" onClick={confirmDelete} className="btn-danger flex-1 !h-10 text-xs font-bold rounded-xl cursor-pointer">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Centered Modal Component for Accounts Data Entry ── */
function CenteredModal({
  isOpen,
  onClose,
  title,
  subtitle = "Data Entry / Actions",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const mounted = useHasMounted();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card-static relative w-full max-w-md md:max-w-lg overflow-hidden border border-white/10 rounded-2xl shadow-2xl animate-scale-in"
        style={{ backgroundColor: "rgba(18, 22, 32, 0.95)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-emerald-500" />
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div>
            <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
            <p className="text-[0.625rem] font-bold uppercase tracking-widest text-[--text-muted] mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[--text-muted] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
