"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "react-hot-toast";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { searchBanks, type Bank } from "@/lib/banks";
import { createAccount, updateAccount, deleteAccount, createTransfer, adjustBalance } from "./actions";

type Account = Tables<"accounts">;

const supabase = createClient();


// Global Category Icons (Premium & Consistent)
const CategoryIcon = ({ type, className = "w-6 h-6" }: { type: string; className?: string }) => {
  const styles: Record<string, { bg: string; color: string; path: string }> = {
    checking: { 
      bg: "bg-indigo-500/10", 
      color: "text-indigo-400",
      path: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
    },
    savings: { 
      bg: "bg-emerald-500/10", 
      color: "text-emerald-400",
      path: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
    },
    credit: { 
      bg: "bg-rose-500/10", 
      color: "text-rose-400",
      path: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" 
    },
    investment: { 
      bg: "bg-sky-500/10", 
      color: "text-sky-400",
      path: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" 
    },
    cash: { 
      bg: "bg-amber-500/10", 
      color: "text-amber-400",
      path: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" 
    },
  };

  const style = styles[type] || styles.checking;

  return (
    <div className={`p-2.5 rounded-xl border border-white/5 shadow-inner ${style.bg} ${className} flex items-center justify-center`}>
      <svg className={`w-full h-full ${style.color}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={style.path} />
      </svg>
    </div>
  );
};

const TYPE_STYLES: Record<string, { gradient: string; badge: string; badgeBorder: string; color: string; iconBg: string }> = {
  checking:   { gradient: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)", badge: "rgba(162,155,254,0.15)", badgeBorder: "rgba(162,155,254,0.25)", color: "#a29bfe", iconBg: "rgba(162,155,254,0.12)" },
  savings:    { gradient: "linear-gradient(135deg, #00cec9 0%, #55efc4 100%)", badge: "rgba(85,239,196,0.15)",  badgeBorder: "rgba(85,239,196,0.25)",  color: "#55efc4", iconBg: "rgba(85,239,196,0.12)" },
  credit:     { gradient: "linear-gradient(135deg, #fd79a8 0%, #fdcb6e 100%)", badge: "rgba(253,121,168,0.15)", badgeBorder: "rgba(253,121,168,0.25)", color: "#fd79a8", iconBg: "rgba(253,121,168,0.12)" },
  investment: { gradient: "linear-gradient(135deg, #0984e3 0%, #00cec9 100%)", badge: "rgba(9,132,227,0.15)",   badgeBorder: "rgba(9,132,227,0.25)",   color: "#74b9ff", iconBg: "rgba(9,132,227,0.12)" },
  cash:       { gradient: "linear-gradient(135deg, #fdcb6e 0%, #ffeaa7 100%)", badge: "rgba(253,203,110,0.15)", badgeBorder: "rgba(253,203,110,0.25)", color: "#fdcb6e", iconBg: "rgba(253,203,110,0.12)" },
};

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
  };
  return symbols[currency] || currency;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState("");
  const [bankResults, setBankResults] = useState<Bank[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferData, setTransferData] = useState({
    to_account_id: "",
    amount: "",
    note: "",
  });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingAccountId, setAdjustingAccountId] = useState<string | null>(null);
  const [adjustData, setAdjustData] = useState({
    amount: "",
    note: "",
    type: "add" as "add" | "subtract",
  });
  const [formData, setFormData] = useState({
    name: "",
    type: "checking",
    balance: "0",
    currency: "INR",
    bank_name: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error loading accounts:", error);
        setError(error.message);
      } else {
        const accountsList = data || [];
        
        const hasCashAccount = accountsList.some(acc => acc.name === "Cash");
        
        if (!hasCashAccount) {
          const { error: createError } = await supabase.from("accounts").insert({
            user_id: user.id,
            name: "Cash",
            type: "cash",
            balance: 0,
            currency: "INR",
            bank_name: null,
          });
          
          if (createError) {
            console.error("Error creating Cash account:", createError);
            setAccounts(accountsList);
          } else {
            const { data: updatedData, error: reloadError } = await supabase
              .from("accounts")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false });
            
            if (reloadError) {
              console.error("Error reloading accounts:", reloadError);
              setAccounts(accountsList);
            } else {
              setAccounts(updatedData || []);
            }
          }
        } else {
          setAccounts(accountsList);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Error loading accounts:", err);
      setError(err instanceof Error ? err.message : "Failed to load accounts");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(loadAccounts);

    const channel = supabase
      .channel("accounts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accounts",
        },
        () => {
          loadAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAccounts]);

  function handleBankSearch(query: string) {
    setBankSearch(query);
    const results = searchBanks(query);
    setBankResults(results);
    
    const topMatch = results.find(r => r.name.toLowerCase().startsWith(query.toLowerCase()));
    if (topMatch && query.length > 2) {
      setFormData(prev => ({ 
        ...prev, 
        bank_name: topMatch.name, 
      }));
    } else if (query.length === 0) {
      setFormData(prev => ({ ...prev, bank_name: "" }));
    }
  }


  function selectBank(bank: Bank) {
    setFormData({ ...formData, bank_name: bank.name });
    setBankSearch(bank.name);
    setBankResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const data = {
      name: formData.name,
      type: formData.type,
      balance: parseFloat(formData.balance),
      currency: formData.currency,
      bank_name: formData.bank_name || null,
    };

    try {
      let result;
      if (editingId) {
        result = await updateAccount(editingId, data);
      } else {
        result = await createAccount(data);
      }

      if (result?.error) {
        toast.error(result.error);
        setSubmitting(false);
        return;
      }

      toast.success(editingId ? "Account updated successfully" : "Account created successfully");
      resetForm();
      await loadAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormData({ name: "", type: "checking", balance: "0", currency: "INR", bank_name: "" });
    setBankSearch("");
    setShowForm(false);
    setEditingId(null);
    setSubmitting(false);
    setError(null);
  }

  function startEdit(account: Account) {
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.balance.toString(),
      currency: account.currency,
      bank_name: account.bank_name || "",
    });
    setBankSearch(account.bank_name || "");
    setEditingId(account.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    const account = accounts.find((a) => a.id === id);
    if (account?.name === "Cash") {
      toast.error("Cannot delete the Cash account");
      return;
    }
    setDeletingAccountId(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!deletingAccountId) return;
    setSubmitting(true);
    const result = await deleteAccount(deletingAccountId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Account deleted successfully");
      await loadAccounts();
    }
    setShowDeleteConfirm(false);
    setDeletingAccountId(null);
    setSubmitting(false);
  }

  function startAdjust(accountId: string) {
    setAdjustingAccountId(accountId);
    setAdjustData({ amount: "", note: "", type: "add" });
    setShowAdjustModal(true);
    setError(null);
  }

  function closeAdjustModal() {
    setShowAdjustModal(false);
    setAdjustingAccountId(null);
    setAdjustData({ amount: "", note: "", type: "add" });
    setError(null);
    setSubmitting(false);
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingAccountId) return;

    setSubmitting(true);
    setError(null);

    const amount = parseFloat(adjustData.amount);
    if (amount <= 0) {
      setError("Amount must be greater than 0");
      setSubmitting(false);
      return;
    }

    const finalAmount = adjustData.type === "subtract" ? -amount : amount;

    const result = await adjustBalance(adjustingAccountId, finalAmount, adjustData.note);

    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }

    toast.success(`Balance ${finalAmount > 0 ? 'increased' : 'decreased'} successfully`);
    closeAdjustModal();
    await loadAccounts();
  }

  function closeTransferModal() {
    setShowTransferModal(false);
    setTransferFromId(null);
    setTransferData({ to_account_id: "", amount: "", note: "" });
    setError(null);
    setSubmitting(false);
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferFromId) return;

    setSubmitting(true);
    setError(null);

    if (transferFromId === transferData.to_account_id) {
      setError("Cannot transfer to the same account");
      setSubmitting(false);
      return;
    }

    const amount = parseFloat(transferData.amount);
    if (amount <= 0) {
      setError("Amount must be greater than 0");
      setSubmitting(false);
      return;
    }

    const fromAccount = accounts.find((a) => a.id === transferFromId);
    if (fromAccount && fromAccount.balance < amount) {
      setError("Insufficient balance");
      setSubmitting(false);
      return;
    }

    const result = await createTransfer({
      from_account_id: transferFromId,
      to_account_id: transferData.to_account_id,
      amount,
      note: transferData.note || null,
    });

    if (result?.error) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }

    toast.success("Transfer completed successfully");
    closeTransferModal();
    await loadAccounts();
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  
  const accountColors = [
    "#a29bfe", "#55efc4", "#fd79a8", "#74b9ff",
    "#fdcb6e", "#00cec9", "#6c5ce7", "#ff6b81",
    "#81ecec", "#fab1a0",
  ];
  
  const chartData = accounts.map((account, index) => ({
    name: account.name,
    value: account.balance,
    color: accountColors[index % accountColors.length],
    type: account.type,
  }));

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="skeleton" style={{ width: "200px", height: "36px", marginBottom: "32px" }} />
        <div className="skeleton" style={{ height: "300px", marginBottom: "24px" }} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: "260px" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 animate-fade-in-up gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
            Accounts
          </h1>
          <p className="text-sm mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
            Manage & monitor your financial footprint
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              if (accounts.length < 2) {
                toast.error("You need at least 2 accounts to make a transfer");
                return;
              }
              setTransferFromId(null);
              setTransferData({ to_account_id: "", amount: "", note: "" });
              setShowTransferModal(true);
              setError(null);
            }}
            disabled={accounts.length < 2}
            className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2.5 h-11 px-5"
            style={{ opacity: accounts.length < 2 ? 0.5 : 1, cursor: accounts.length < 2 ? "not-allowed" : "pointer" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Transfer
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-2.5 h-11 px-5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" />
            </svg>
            New Account
          </button>
        </div>
      </div>

      {/* Total Balance Overview with Chart */}
      {accounts.length > 0 && (
        <div className="glass-card-static animate-fade-in-up delay-1 relative overflow-hidden" 
             style={{ padding: "clamp(20px, 5vw, 32px)", marginBottom: "32px", minHeight: "280px" }}>
          
          {/* Chart positioned in the right corner (Mobile refined) */}
          <div className="absolute top-1/2 -translate-y-1/2 -right-16 md:right-4 w-[240px] h-[240px] md:w-[280px] md:h-[280px] opacity-100 md:opacity-90 pointer-events-none md:pointer-events-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length && payload[0].value !== undefined) {
                      return (
                        <div className="glass-card p-3 shadow-2xl border-white/10" style={{ background: "rgba(19, 24, 51, 0.95)", backdropFilter: "blur(12px)" }}>
                          <p className="text-xs font-bold text-white mb-1">{payload[0].name}</p>
                          <p className="text-sm font-black text-accent-primary-light">
                            ₹{Number(payload[0].value).toLocaleString()}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Text for Chart */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-[-2px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted opacity-60">Total</p>
              <p className="text-lg font-black text-white">₹{(totalBalance/100000).toFixed(1)}L</p>
            </div>
          </div>

          <div className="relative z-10 lg:pr-[320px]">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-2 h-2 rounded-full bg-accent-primary animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                Portfolio Assets
              </p>
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-8 gradient-text tracking-tighter">
              ₹{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h2>

            <div className="flex flex-wrap gap-2 md:gap-3 overflow-visible">
              {chartData.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="flex items-center gap-3 rounded-xl px-4 py-2 transition-all cursor-default w-fit min-w-[190px] h-14 flex-shrink-0"
                  style={{
                    background: "rgba(15, 20, 50, 0.5)",
                    border: "1px solid var(--border-subtle)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(99, 115, 255, 0.15)";
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(15, 20, 50, 0.5)";
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full absolute -top-1 -right-1 z-10"
                      style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}` }}
                    />
                    <CategoryIcon 
                      type={accounts.find(a => a.name === item.name)?.type || "checking"} 
                      className="w-11 h-11" 
                    />
                  </div>
                  
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="font-bold text-[11px] text-white truncate leading-none mb-1">
                      {item.name}
                    </p>
                    <p className="font-black text-[10px] text-accent-primary-light leading-none">
                      {getCurrencySymbol(accounts.find(a => a.name === item.name)?.currency || "INR")}{item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="ml-2 text-[9px] font-bold text-muted opacity-60">
                        {((item.value / totalBalance) * 100).toFixed(0)}%
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((account, index) => {
          const style = TYPE_STYLES[account.type] || TYPE_STYLES.checking;
          return (
            <div
              key={account.id}
              className={`glass-card animate-fade-in-up delay-${Math.min(index + 2, 6)}`}
              style={{
                padding: "24px",
                position: "relative",
                overflow: "hidden",
                minHeight: "260px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Top gradient accent bar */}
              <div
                className="absolute top-0 left-0 right-0"
                style={{
                  height: "3px",
                  background: style.gradient,
                  opacity: 0.8,
                }}
              />

              {/* Edit button - top right corner (hidden for Cash account) */}
              {account.name !== "Cash" && (
                <button
                  onClick={() => startEdit(account)}
                  className="absolute top-4 right-4 flex items-center justify-center rounded-xl p-2 transition-all z-10"
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "rgba(255, 255, 255, 0.5)",
                    backdropFilter: "blur(12px)",
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  title="Edit account details"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}

              {/* Top row: badge + bank */}
              <div className="flex justify-between items-start mb-4">
                <div className="min-h-[56px]">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      background: style.badge,
                      color: style.color,
                      border: `1px solid ${style.badgeBorder}`,
                    }}
                  >
                    {account.type}
                  </span>
                  <div className="flex items-center gap-3 mt-3">
                    <CategoryIcon type={account.type} className="w-12 h-12" />
                    <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-secondary)" }}>
                      {account.bank_name || account.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account info */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    className="text-lg font-semibold mb-2 truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {account.name}
                  </h3>
                  <p className="text-2xl font-bold" style={{ color: style.color }}>
                    {getCurrencySymbol(account.currency)} {account.balance.toLocaleString()}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 items-center mt-5">
                    <button
                      onClick={() => startAdjust(account.id)}
                      className="flex-1 flex items-center justify-center gap-2.5 rounded-xl p-3 transition-all text-[13px] font-bold tracking-tight"
                      style={{
                        background: style.iconBg,
                        border: `1px solid ${style.badgeBorder}`,
                        color: style.color,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
                      title="Add/Subtract money"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path d="M12 4v16m8-8H4" />
                      </svg>
                      Adjust Balance
                    </button>
                  {account.name !== "Cash" && (
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="flex items-center justify-center rounded-lg p-2.5 transition-all"
                      style={{
                        background: "rgba(255, 71, 87, 0.08)",
                        border: "1px solid rgba(255, 71, 87, 0.15)",
                        color: "#ff6b81",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255, 71, 87, 0.15)";
                        e.currentTarget.style.borderColor = "rgba(255, 71, 87, 0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255, 71, 87, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(255, 71, 87, 0.15)";
                      }}
                      title="Delete account"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {accounts.length === 0 && !showForm && (
        <div
          className="glass-card-static text-center animate-fade-in-up"
          style={{ padding: "60px 24px" }}
        >
          <div
            className="mx-auto mb-4 flex items-center justify-center"
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "var(--radius-lg)",
              background: "rgba(162,155,254,0.1)",
              border: "1px solid rgba(162,155,254,0.15)",
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "#a29bfe" }}>
              <path d="M3 10h18M7 15h2m4 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>No accounts yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Create your first account to get started.
          </p>
        </div>
      )}


      {/* Create/Edit Account Modal */}
      {showForm && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4 animate-fade-in">
          <div
            className="glass-card-static animate-scale-in max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ padding: "32px", border: "1px solid var(--border-strong)" }}
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {editingId ? "Update Account" : "Add New Account"}
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  {editingId ? "Modify your account details" : "Connect a new financial source"}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2.5 rounded-xl transition-all"
                style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.03)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--glass-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                    Account Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-premium pl-11"
                      disabled={editingId ? accounts.find(a => a.id === editingId)?.name === "Cash" : false}
                      placeholder="e.g. HDFC Salary, Travel Fund"
                      required
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted opacity-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h2m4 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                    Account Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="input-premium"
                    disabled={editingId ? accounts.find(a => a.id === editingId)?.name === "Cash" : false}
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit Card</option>
                    <option value="investment">Investment</option>
                    <option value="cash">Cash / Physical</option>
                  </select>
                </div>

                {!editingId && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                      Current Balance
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.balance}
                        onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                        className="input-premium pl-11"
                        placeholder="0.00"
                        required
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm text-muted opacity-50">
                        {formData.currency === "INR" ? "₹" : "$"}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="input-premium"
                    disabled={editingId ? accounts.find(a => a.id === editingId)?.name === "Cash" : false}
                  >
                    <option value="INR">Indian Rupee (INR)</option>
                    <option value="USD">US Dollar (USD)</option>
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-3 pt-2">
                  <div className="divider-glow w-full" />
                  <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                    Bank Association
                  </label>
                  
                  {editingId && accounts.find(a => a.id === editingId)?.name === "Cash" ? (
                    <div className="input-premium opacity-50 flex items-center gap-3 bg-white/5 border-dashed">
                      <span className="text-xl">💵</span>
                      <span className="text-sm">Physical cash - no bank needed</span>
                    </div>
                  ) : (
                    <div className="flex gap-4 items-start">
                      <div className="relative flex-1">
                        <div className="relative">
                          <input
                            type="text"
                            value={bankSearch}
                            onChange={(e) => handleBankSearch(e.target.value)}
                            className="input-premium pl-11 h-14"
                            placeholder="Search your bank (e.g. SBI, HDFC...)"
                          />
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted opacity-50">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        </div>
                        
                        {bankResults.length > 0 && (
                          <div
                            className="absolute z-50 w-full mt-3 max-h-64 overflow-y-auto animate-scale-in custom-scrollbar"
                            style={{
                              background: "rgba(19, 24, 51, 0.95)",
                              border: "1px solid var(--border-strong)",
                              borderRadius: "var(--radius-lg)",
                              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                              backdropFilter: "blur(20px)",
                            }}
                          >
                            {bankResults.map((bank) => (
                              <button
                                key={bank.name}
                                type="button"
                                onClick={() => selectBank(bank)}
                                className="w-full flex items-center gap-4 p-4 text-left transition-all hover:bg-white/5 border-b border-white/5 last:border-0"
                              >
                                <CategoryIcon type="checking" className="w-10 h-10" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-white">{bank.name}</span>
                                  <span className="text-[10px] text-muted tracking-wider uppercase">Click to select</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-shrink-0 animate-scale-in">
                        <div className="p-1 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10">
                          <CategoryIcon 
                            type={formData.type} 
                            className="w-14 h-14" 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {formData.bank_name && (
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[11px] text-accent-primary-light font-bold flex items-center gap-1.5 animate-fade-in">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Linked to {formData.bank_name}
                      </p>
                      <button 
                        type="button"
                        onClick={() => { setFormData({...formData, bank_name: ""}); setBankSearch(""); }}
                        className="text-[10px] text-muted hover:text-white transition-colors underline underline-offset-2"
                      >
                        Clear bank
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="btn-primary flex-1 h-12 flex items-center justify-center gap-2"
                  style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {editingId ? "Save Changes" : "Create Account"}
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  disabled={submitting}
                  className="btn-secondary flex-1 h-12"
                  style={{ opacity: submitting ? 0.6 : 1 }}
                >
                  Discard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {showAdjustModal && adjustingAccountId && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4 animate-fade-in">
          <div
            className="glass-card-static animate-scale-in max-w-md w-full overflow-hidden"
            style={{ padding: "32px", border: "1px solid var(--border-strong)" }}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Adjust Balance</h2>
                <p className="text-xs text-muted mt-1 uppercase tracking-widest font-semibold">One-time adjustment</p>
              </div>
              <button
                onClick={closeAdjustModal}
                className="p-2 rounded-xl transition-all"
                style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.03)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--glass-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-6 animate-fade-in flex items-center gap-2 text-[13px] p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleAdjust} className="space-y-6">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Account</label>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{accounts.find((a) => a.id === adjustingAccountId)?.name}</span>
                    <span className="text-xs font-medium text-accent-primary-light">
                      {getCurrencySymbol(accounts.find((a) => a.id === adjustingAccountId)?.currency || "INR")}{" "}
                      {accounts.find((a) => a.id === adjustingAccountId)?.balance.toLocaleString()}
                    </span>
                  </div>
                </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: "add" })}
                    className="rounded-xl py-3 px-4 transition-all font-bold text-xs flex items-center justify-center gap-2 group"
                    style={{
                      background: adjustData.type === "add" ? "rgba(85, 239, 196, 0.12)" : "rgba(255, 255, 255, 0.03)",
                      border: adjustData.type === "add" ? "1px solid rgba(85, 239, 196, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: adjustData.type === "add" ? "#55efc4" : "var(--text-muted)",
                    }}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${adjustData.type === "add" ? "bg-[#55efc4] text-black" : "bg-white/10"}`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    Deposit / Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: "subtract" })}
                    className="rounded-xl py-3 px-4 transition-all font-bold text-xs flex items-center justify-center gap-2 group"
                    style={{
                      background: adjustData.type === "subtract" ? "rgba(255, 71, 87, 0.12)" : "rgba(255, 255, 255, 0.03)",
                      border: adjustData.type === "subtract" ? "1px solid rgba(255, 71, 87, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
                      color: adjustData.type === "subtract" ? "#ff6b81" : "var(--text-muted)",
                    }}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${adjustData.type === "subtract" ? "bg-[#ff6b81] text-white" : "bg-white/10"}`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path d="M20 12H4" />
                      </svg>
                    </div>
                    Withdraw / Sub
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={adjustData.amount}
                    onChange={(e) => setAdjustData({ ...adjustData, amount: e.target.value })}
                    className="input-premium pl-11 h-12 text-lg font-bold"
                    placeholder="0.00"
                    required
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm text-muted opacity-50">
                    {getCurrencySymbol(accounts.find(a => a.id === adjustingAccountId)?.currency || "INR")}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                  Adjustment Note
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adjustData.note}
                    onChange={(e) => setAdjustData({ ...adjustData, note: e.target.value })}
                    className="input-premium pl-11"
                    placeholder="e.g. Cash deposit, ATM withdrawal"
                    required
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted opacity-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 h-12 flex items-center justify-center gap-2"
                  style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Processing..." : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {adjustData.type === "add" ? "Add Money" : "Subtract Money"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeAdjustModal}
                  disabled={submitting}
                  className="btn-secondary flex-1 h-12"
                  style={{ opacity: submitting ? 0.6 : 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4 animate-fade-in">
          <div
            className="glass-card-static animate-scale-in max-w-md w-full overflow-hidden"
            style={{ padding: "32px", border: "1px solid var(--border-strong)" }}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Transfer Money</h2>
                <p className="text-xs text-muted mt-1 uppercase tracking-widest font-semibold">Move funds between accounts</p>
              </div>
              <button
                onClick={closeTransferModal}
                className="p-2 rounded-xl transition-all"
                style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.03)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--glass-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-6 animate-fade-in flex items-center gap-2 text-[13px] p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleTransfer} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                    From Account
                  </label>
                  <select
                    value={transferFromId || ""}
                    onChange={(e) => setTransferFromId(e.target.value)}
                    className="input-premium"
                    required
                  >
                    <option value="">Select source account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} (Balance: {getCurrencySymbol(account.currency)} {account.balance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center -my-2 opacity-30 select-none">
                  <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                    To Account
                  </label>
                  <select
                    value={transferData.to_account_id}
                    onChange={(e) => setTransferData({ ...transferData, to_account_id: e.target.value })}
                    className="input-premium"
                    required
                  >
                    <option value="">Select destination account</option>
                    {accounts
                      .filter((a) => a.id !== transferFromId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} (Balance: {getCurrencySymbol(account.currency)} {account.balance.toLocaleString()})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="divider-glow" />

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                  Transfer Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={transferData.amount}
                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                    className="input-premium pl-11 h-12 text-lg font-bold"
                    placeholder="0.00"
                    required
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm text-muted opacity-50">
                    {getCurrencySymbol(accounts.find(a => a.id === transferFromId)?.currency || "INR")}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "var(--text-muted)" }}>
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={transferData.note}
                  onChange={(e) => setTransferData({ ...transferData, note: e.target.value })}
                  className="input-premium"
                  placeholder="e.g. Monthly savings, Bill payment"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 h-12 flex items-center justify-center gap-2"
                  style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Processing..." : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Execute Transfer
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeTransferModal}
                  disabled={submitting}
                  className="btn-secondary flex-1 h-12"
                  style={{ opacity: submitting ? 0.6 : 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div
             className="glass-card-static animate-scale-in max-w-sm w-full overflow-hidden"
             style={{ padding: "32px", border: "1px solid rgba(255, 71, 87, 0.2)" }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 text-red-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Account?</h3>
              <p className="text-sm text-muted leading-relaxed mb-8">
                Are you sure you want to delete <span className="text-white font-bold">{accounts.find(a => a.id === deletingAccountId)?.name}</span>? 
                This action is permanent and cannot be reversed.
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={confirmDelete}
                  disabled={submitting}
                  className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all shadow-[0_4px_20px_rgba(239,68,68,0.3)] disabled:opacity-50"
                >
                  {submitting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={submitting}
                  className="flex-1 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all disabled:opacity-50"
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
