"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { searchBanks, type Bank } from "@/lib/banks";
import { createAccount, updateAccount, deleteAccount, createTransfer, adjustBalance } from "./actions";

type Account = Tables<"accounts">;

const supabase = createClient();

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
    bank_logo: "",
  });

  useEffect(() => {
    loadAccounts();

    const channel = supabase
      .channel("accounts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "accounts",
        },
        (payload) => {
          console.log("Real-time update received:", payload);
          loadAccounts();
        }
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadAccounts() {
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
        
        // Check if Cash account exists, if not create it
        const hasCashAccount = accountsList.some(acc => acc.name === "Cash");
        console.log("Has Cash account:", hasCashAccount);
        
        if (!hasCashAccount) {
          console.log("Creating Cash account...");
          const { error: createError } = await supabase.from("accounts").insert({
            user_id: user.id,
            name: "Cash",
            type: "cash",
            balance: 0,
            currency: "INR",
            bank_name: null,
            bank_logo: null,
          });
          
          if (createError) {
            console.error("Error creating Cash account:", createError);
            setAccounts(accountsList);
          } else {
            console.log("Cash account created successfully");
            // Reload accounts after creating Cash account
            const { data: updatedData, error: reloadError } = await supabase
              .from("accounts")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false });
            
            if (reloadError) {
              console.error("Error reloading accounts:", reloadError);
              setAccounts(accountsList);
            } else {
              console.log("Accounts reloaded, total:", updatedData?.length);
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
  }

  function handleBankSearch(query: string) {
    setBankSearch(query);
    if (query.length >= 1) {
      const results = searchBanks(query);
      setBankResults(results);
      
      // If there's a strong match (first result starts with query), pre-view the logo
      const topMatch = results[0];
      if (topMatch && topMatch.name.toLowerCase().includes(query.toLowerCase()) && query.length > 2) {
        setFormData(prev => ({ 
          ...prev, 
          bank_name: topMatch.name, 
          bank_logo: topMatch.logo 
        }));
      } else if (query.length === 0) {
        setFormData(prev => ({ ...prev, bank_name: "", bank_logo: "" }));
      }
    } else {
      setBankResults([]);
      if (!query) {
        setFormData(prev => ({ ...prev, bank_name: "", bank_logo: "" }));
      }
    }
  }

  function selectBank(bank: Bank) {
    setFormData({ ...formData, bank_name: bank.name, bank_logo: bank.logo });
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
      bank_logo: formData.bank_logo || null,
    };

    try {
      let result;
      if (editingId) {
        result = await updateAccount(editingId, data);
      } else {
        result = await createAccount(data);
      }

      if (result?.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      resetForm();
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormData({ name: "", type: "checking", balance: "0", currency: "INR", bank_name: "", bank_logo: "" });
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
      bank_logo: account.bank_logo || "",
    });
    setBankSearch(account.bank_name || "");
    setEditingId(account.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    const account = accounts.find((a) => a.id === id);
    if (account?.name === "Cash") {
      alert("Cannot delete the Cash account");
      return;
    }
    if (confirm("Delete this account?")) {
      await deleteAccount(id);
    }
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
      setError(result.error);
      setSubmitting(false);
      return;
    }

    closeAdjustModal();
    await loadAccounts();
  }

  function startTransfer(fromAccountId: string) {
    setTransferFromId(fromAccountId);
    setTransferData({ to_account_id: "", amount: "", note: "" });
    setShowTransferModal(true);
    setError(null);
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
      setError(result.error);
      setSubmitting(false);
      return;
    }

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
      <div className="flex justify-between items-center mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Accounts
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage your financial accounts
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (accounts.length < 2) {
                alert("You need at least 2 accounts to make a transfer");
                return;
              }
              setTransferFromId(null);
              setTransferData({ to_account_id: "", amount: "", note: "" });
              setShowTransferModal(true);
              setError(null);
            }}
            disabled={accounts.length < 2}
            className="btn-secondary flex items-center gap-2"
            style={{ opacity: accounts.length < 2 ? 0.5 : 1, cursor: accounts.length < 2 ? "not-allowed" : "pointer" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Transfer
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" />
            </svg>
            New Account
          </button>
        </div>
      </div>

      {/* Total Balance Overview with Chart */}
      {accounts.length > 0 && (
        <div className="glass-card-static animate-fade-in-up delay-1" style={{ padding: "32px", marginBottom: "32px" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ minHeight: "420px" }}>
            <div className="flex flex-col" style={{ minHeight: "350px" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="status-dot" />
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Portfolio Overview
                </p>
              </div>
              <p className="text-4xl font-bold mb-6 gradient-text">
                ₹{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2.5" style={{ scrollbarWidth: "thin", maxHeight: "280px" }}>
                {chartData.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex items-center justify-between rounded-xl p-3.5 transition-all cursor-default"
                    style={{
                      background: "rgba(15, 20, 50, 0.5)",
                      border: "1px solid var(--border-subtle)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(99, 115, 255, 0.06)";
                      e.currentTarget.style.borderColor = "var(--border-default)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(15, 20, 50, 0.5)";
                      e.currentTarget.style.borderColor = "var(--border-subtle)";
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}40` }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate text-sm" style={{ color: "var(--text-primary)" }}>
                          {item.name}
                        </span>
                        <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                        {getCurrencySymbol(accounts.find(a => a.name === item.name)?.currency || "INR")}{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {((item.value / totalBalance) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center items-center" style={{ minHeight: "350px" }}>
              <div style={{ width: "100%", height: "350px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) => percent && percent > 0.05 ? `${((percent || 0) * 100).toFixed(1)}%` : ''}
                    outerRadius={115}
                    innerRadius={65}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="rgba(6, 8, 15, 0.5)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const account = accounts.find(a => a.name === name);
                      const symbol = getCurrencySymbol(account?.currency || "INR");
                      return `${symbol}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    }}
                    contentStyle={{
                      backgroundColor: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-md)",
                      padding: "12px 16px",
                      boxShadow: "var(--shadow-lg)",
                    }}
                    labelStyle={{ color: "var(--text-primary)", fontWeight: "bold", marginBottom: "6px" }}
                    itemStyle={{ color: "var(--text-secondary)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              </div>
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
                  className="absolute top-3 right-3 flex items-center justify-center rounded-lg p-1.5 transition-all z-10"
                  style={{
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "rgba(255, 255, 255, 0.6)",
                    backdropFilter: "blur(8px)",
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.5)";
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.3)";
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                  }}
                  title="Edit account details"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
                  {account.name === "Cash" ? (
                    <div className="flex items-center gap-2 mt-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{
                          background: "rgba(253, 203, 110, 0.15)",
                          border: "1px solid rgba(253, 203, 110, 0.25)",
                        }}
                      >
                        <span className="text-2xl">💵</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                        Physical Cash
                      </span>
                    </div>
                  ) : account.bank_name ? (
                    <div className="flex items-center gap-2 mt-3">
                      {account.bank_logo && (
                        <div
                          className="p-1.5 rounded-lg"
                          style={{
                            background: "rgba(255,255,255,0.9)",
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <img src={account.bank_logo} alt={account.bank_name} className="w-7 h-7 object-contain" />
                        </div>
                      )}
                      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        {account.bank_name}
                      </span>
                    </div>
                  ) : (
                    <div style={{ height: "36px" }} />
                  )}
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
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg p-2.5 transition-all text-sm font-medium"
                    style={{
                      background: style.iconBg,
                      border: `1px solid ${style.badgeBorder}`,
                      color: style.color,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                    title="Add/Subtract money"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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
            className="glass-card-static animate-scale-in max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ padding: "28px" }}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {editingId ? "Edit Account" : "Create Account"}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 rounded-lg transition-all"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--glass-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {error && (
              <div
                className="mb-4 animate-fade-in"
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(255, 71, 87, 0.08)",
                  border: "1px solid rgba(255, 71, 87, 0.2)",
                  color: "#ff6b81",
                  fontSize: "0.8125rem",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-premium"
                    disabled={editingId ? accounts.find(a => a.id === editingId)?.name === "Cash" : false}
                    placeholder="e.g., My Savings, Emergency Fund"
                    required
                  />
                  {!editingId && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                      Give your account a nickname to identify it easily
                    </p>
                  )}
                  {editingId && accounts.find(a => a.id === editingId)?.name === "Cash" && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Cash account name cannot be changed
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="input-premium"
                    disabled={editingId ? accounts.find(a => a.id === editingId)?.name === "Cash" : false}
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit</option>
                    <option value="investment">Investment</option>
                    <option value="cash">Cash</option>
                  </select>
                  {!editingId && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                      What type of account is this?
                    </p>
                  )}
                  {editingId && accounts.find(a => a.id === editingId)?.name === "Cash" && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Cash account type cannot be changed
                    </p>
                  )}
                </div>
                {!editingId && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                      Initial Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      className="input-premium"
                      placeholder="0.00"
                      required
                    />
                    <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                      How much money is currently in this account?
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="input-premium"
                    disabled={editingId ? accounts.find(a => a.id === editingId)?.name === "Cash" : false}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                  {!editingId && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                      Which currency does this account use?
                    </p>
                  )}
                  {editingId && accounts.find(a => a.id === editingId)?.name === "Cash" && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Cash account currency cannot be changed
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Bank Selection {editingId && accounts.find(a => a.id === editingId)?.name === "Cash" && "(Not applicable for Cash)"}
                  </label>
                  {!editingId && (
                    <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                      Which bank is this account with? (Optional)
                    </p>
                  )}
                  {editingId && accounts.find(a => a.id === editingId)?.name === "Cash" ? (
                    <div className="input-premium" style={{ opacity: 0.5 }}>
                      Physical cash - no bank association
                    </div>
                  ) : (
                    <div className="flex gap-3 items-start">
                    <div className="relative flex-1">
                      <div className="relative">
                        <input
                          type="text"
                          value={bankSearch}
                          onChange={(e) => handleBankSearch(e.target.value)}
                          className="input-premium pl-10"
                          placeholder="Type bank name (e.g. HDFC, SBI...)"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      
                      {bankResults.length > 0 && (
                        <div
                          className="absolute z-10 w-full mt-2 max-h-60 overflow-y-auto animate-scale-in"
                          style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-default)",
                            borderRadius: "var(--radius-md)",
                            boxShadow: "var(--shadow-lg)",
                            backdropFilter: "blur(12px)",
                          }}
                        >
                          {bankResults.map((bank) => (
                            <button
                              key={bank.name}
                              type="button"
                              onClick={() => selectBank(bank)}
                              className="w-full flex items-center gap-3 p-3 text-left transition-all border-b border-white/5 last:border-0"
                              style={{ color: "var(--text-primary)" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-hover)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              <div className="w-8 h-8 rounded bg-white p-1 flex items-center justify-center">
                                <img src={bank.logo} alt={bank.name} className="w-full h-full object-contain" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{bank.name}</span>
                                <span className="text-[10px] text-muted opacity-60">Click to select</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Live Preview of Selected/Inferred Logo */}
                    <div 
                      className={`w-12 h-12 rounded-xl flex items-center justify-center p-2 transition-all ${formData.bank_logo ? 'bg-white shadow-glow' : 'bg-black/20 border border-dashed border-white/10'}`}
                      title={formData.bank_name || "Bank Logo Preview"}
                    >
                      {formData.bank_logo ? (
                        <img src={formData.bank_logo} alt="Preview" className="w-full h-full object-contain animate-scale-in" />
                      ) : (
                        <svg className="w-5 h-5 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                  </div>
                  )}
                  {formData.bank_name && !(editingId && accounts.find(a => a.id === editingId)?.name === "Cash") && (
                    <p className="text-[10px] mt-2 ml-1 text-accent-primary animate-fade-in flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Selected: {formData.bank_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="btn-primary flex-1"
                  style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  disabled={submitting}
                  className="btn-secondary flex-1"
                  style={{ opacity: submitting ? 0.6 : 1 }}
                >
                  Cancel
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
            className="glass-card-static animate-scale-in max-w-md w-full"
            style={{ padding: "28px" }}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Adjust Balance
              </h2>
              <button
                onClick={closeAdjustModal}
                className="p-2 rounded-lg transition-all"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--glass-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div
                className="mb-4 animate-fade-in"
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(255, 71, 87, 0.08)",
                  border: "1px solid rgba(255, 71, 87, 0.2)",
                  color: "#ff6b81",
                  fontSize: "0.8125rem",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleAdjust} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Account
                  </label>
                  <div
                    className="input-premium"
                    style={{ opacity: 0.7 }}
                  >
                    {accounts.find((a) => a.id === adjustingAccountId)?.name}
                    <span className="ml-2" style={{ color: "var(--text-muted)" }}>
                      (Current: {getCurrencySymbol(accounts.find((a) => a.id === adjustingAccountId)?.currency || "INR")}{" "}
                      {accounts.find((a) => a.id === adjustingAccountId)?.balance.toLocaleString()})
                    </span>
                  </div>
                </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Action
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: "add" })}
                    className="flex-1 rounded-lg p-3 transition-all font-medium text-sm"
                    style={{
                      background: adjustData.type === "add" ? "rgba(85, 239, 196, 0.15)" : "rgba(100, 100, 100, 0.1)",
                      border: adjustData.type === "add" ? "1px solid rgba(85, 239, 196, 0.3)" : "1px solid rgba(100, 100, 100, 0.2)",
                      color: adjustData.type === "add" ? "#55efc4" : "var(--text-muted)",
                    }}
                  >
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M12 4v16m8-8H4" />
                    </svg>
                    Add Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: "subtract" })}
                    className="flex-1 rounded-lg p-3 transition-all font-medium text-sm"
                    style={{
                      background: adjustData.type === "subtract" ? "rgba(255, 71, 87, 0.15)" : "rgba(100, 100, 100, 0.1)",
                      border: adjustData.type === "subtract" ? "1px solid rgba(255, 71, 87, 0.3)" : "1px solid rgba(100, 100, 100, 0.2)",
                      color: adjustData.type === "subtract" ? "#ff6b81" : "var(--text-muted)",
                    }}
                  >
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M20 12H4" />
                    </svg>
                    Subtract Money
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustData.amount}
                  onChange={(e) => setAdjustData({ ...adjustData, amount: e.target.value })}
                  className="input-premium"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Note
                </label>
                <input
                  type="text"
                  value={adjustData.note}
                  onChange={(e) => setAdjustData({ ...adjustData, note: e.target.value })}
                  className="input-premium"
                  placeholder="e.g., Cash deposit, ATM withdrawal"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1"
                  style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Processing..." : adjustData.type === "add" ? "Add Money" : "Subtract Money"}
                </button>
                <button
                  type="button"
                  onClick={closeAdjustModal}
                  disabled={submitting}
                  className="btn-secondary flex-1"
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
            className="glass-card-static animate-scale-in max-w-md w-full"
            style={{ padding: "28px" }}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Transfer Money
              </h2>
              <button
                onClick={closeTransferModal}
                className="p-2 rounded-lg transition-all"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--glass-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div
                className="mb-4 animate-fade-in"
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(255, 71, 87, 0.08)",
                  border: "1px solid rgba(255, 71, 87, 0.2)",
                  color: "#ff6b81",
                  fontSize: "0.8125rem",
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
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
                      {account.name} ({getCurrencySymbol(account.currency)} {account.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
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
                        {account.name} ({getCurrencySymbol(account.currency)} {account.balance.toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  className="input-premium"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={transferData.note}
                  onChange={(e) => setTransferData({ ...transferData, note: e.target.value })}
                  className="input-premium"
                  placeholder="e.g., Monthly savings"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1"
                  style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Processing..." : "Transfer"}
                </button>
                <button
                  type="button"
                  onClick={closeTransferModal}
                  disabled={submitting}
                  className="btn-secondary flex-1"
                  style={{ opacity: submitting ? 0.6 : 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
