"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { searchBanks, type Bank } from "@/lib/banks";
import { formatCurrency } from "@/lib/format";
import { createAccount, updateAccount, deleteAccount, createTransfer } from "./actions";

type Account = Tables<"accounts">;

const supabase = createClient();

const TYPE_STYLES: Record<string, { bg: string; badge: string; color: string }> = {
  checking: {
    bg: "from-sky-400/24 via-cyan-300/10 to-transparent",
    badge: "border border-sky-400/30 bg-sky-400/12 text-sky-100",
    color: "#78c7ff",
  },
  savings: {
    bg: "from-emerald-400/24 via-teal-300/10 to-transparent",
    badge: "border border-emerald-400/30 bg-emerald-400/12 text-emerald-100",
    color: "#58d5aa",
  },
  credit: {
    bg: "from-amber-300/24 via-orange-300/10 to-transparent",
    badge: "border border-amber-300/30 bg-amber-300/12 text-amber-100",
    color: "#ffba6b",
  },
  investment: {
    bg: "from-fuchsia-300/20 via-pink-300/10 to-transparent",
    badge: "border border-fuchsia-300/30 bg-fuchsia-300/12 text-fuchsia-100",
    color: "#f9a8d4",
  },
};

const inputCls =
  "w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] outline-none transition focus:border-[var(--border-strong)] focus:bg-white/[0.08]";
const selectCls =
  "w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--border-strong)] focus:bg-white/[0.08]";
const btnCls = "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition";

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
  const [formData, setFormData] = useState({
    name: "",
    type: "checking",
    balance: "0",
    currency: "USD",
    bank_name: "",
    bank_logo: "",
  });

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
        setAccounts(data || []);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error loading accounts:", err);
      setError(err instanceof Error ? err.message : "Failed to load accounts");
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccounts();

    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel("accounts-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "accounts",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void loadAccounts();
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }

    void setupRealtime();
  }, []);

  function handleBankSearch(query: string) {
    setBankSearch(query);
    if (query.length > 1) {
      setBankResults(searchBanks(query));
    } else {
      setBankResults([]);
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
    setFormData({ name: "", type: "checking", balance: "0", currency: "USD", bank_name: "", bank_logo: "" });
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
    if (confirm("Delete this account?")) {
      const result = await deleteAccount(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      await loadAccounts();
    }
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
  const primaryCurrency = accounts[0]?.currency ?? "USD";
  const liquidBalance = accounts
    .filter((account) => account.type === "checking" || account.type === "savings")
    .reduce((sum, account) => sum + account.balance, 0);
  const investmentBalance = accounts
    .filter((account) => account.type === "investment")
    .reduce((sum, account) => sum + account.balance, 0);
  
  // Generate distinct colors for each account
  const accountColors = [
    "#78c7ff",
    "#58d5aa",
    "#ffba6b",
    "#f9a8d4",
    "#c4b5fd",
    "#fb7185",
  ];
  
  const chartData = accounts.map((account, index) => ({
    name: account.name,
    value: account.balance,
    color: accountColors[index % accountColors.length],
    type: account.type,
  }));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-[var(--muted-strong)]">
          Loading accounts...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-white/[0.04] p-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Accounts</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Keep every balance in one elegant ledger
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">
            Review account mix, update balances, and move money without leaving the
            portfolio view.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => {
              if (accounts.length < 2) {
                setError("You need at least 2 accounts to make a transfer");
                return;
              }
              setTransferFromId(accounts[0].id);
              setTransferData({ to_account_id: "", amount: "", note: "" });
              setShowTransferModal(true);
              setError(null);
            }}
            disabled={accounts.length < 2}
            className={`${btnCls} border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Internal Transfers
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`${btnCls} bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] text-slate-950 hover:brightness-110`}
          >
            New Account
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-tile rounded-[26px] p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Tracked balance</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {formatCurrency(totalBalance, primaryCurrency)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            All balances combined in your primary currency view.
          </p>
        </div>
        <div className="metric-tile rounded-[26px] p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Liquid funds</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {formatCurrency(liquidBalance, primaryCurrency)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Checking and savings ready for your next move.
          </p>
        </div>
        <div className="metric-tile rounded-[26px] p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Invested</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {formatCurrency(investmentBalance, primaryCurrency)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Long-term capital separated from day-to-day cash.
          </p>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="app-panel rounded-[32px] p-6 sm:p-7">
          <div className="grid grid-cols-1 items-center gap-8 xl:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Portfolio spread</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Balance distribution across accounts
              </h2>
              <p className="hidden">
                ₹{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-strong)]">
                Spot concentration quickly and rebalance before one account carries too much
                of the month.
              </p>
              <p className="mt-6 text-4xl font-semibold tracking-tight text-white">
                {formatCurrency(totalBalance, primaryCurrency)}
              </p>
              <div className="mt-6 space-y-3">
                {chartData.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/[0.04] p-4 transition hover:border-[var(--border-strong)] hover:bg-white/[0.08]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className="h-3 w-3 flex-shrink-0 rounded-full shadow-lg"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="text-white font-medium truncate">{item.name}</span>
                        <span className="text-xs capitalize text-[var(--muted)]">{item.type}</span>
                      </div>
                    </div>
                    <div className="ml-3 flex-shrink-0 text-right">
                      <span className="hidden">
                        ₹{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-lg font-bold text-white">
                        {formatCurrency(item.value, primaryCurrency)}
                      </span>
                      <div className="text-xs text-[var(--muted)]">
                        {((item.value / totalBalance) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center items-center">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) => percent && percent > 0.05 ? `${((percent || 0) * 100).toFixed(1)}%` : ''}
                    outerRadius={110}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `₹${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "12px" }}
                    labelStyle={{ color: "#fff", fontWeight: "bold", marginBottom: "8px" }}
                    itemStyle={{ color: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="app-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] p-6 sm:p-7">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">{editingId ? "Edit Account" : "Create Account"}</h2>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Account Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className={selectCls}
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Currency</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className={inputCls}
                    maxLength={3}
                  />
                </div>
                <div className="col-span-2 relative">
                  <label className="block text-sm text-zinc-400 mb-2">Bank (optional)</label>
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={(e) => handleBankSearch(e.target.value)}
                    className={inputCls}
                    placeholder="Search for a bank..."
                  />
                  {bankResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl max-h-48 overflow-y-auto">
                      {bankResults.map((bank) => (
                        <button
                          key={bank.name}
                          type="button"
                          onClick={() => selectBank(bank)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-zinc-700 text-left"
                        >
                          <img src={bank.logo} alt={bank.name} className="w-8 h-8 rounded" />
                          <span className="text-white">{bank.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className={`flex-1 ${btnCls} bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] text-slate-950 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitting ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  disabled={submitting}
                  className={`flex-1 ${btnCls} border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {accounts.map((account) => {
          const style = TYPE_STYLES[account.type] || TYPE_STYLES.checking;
          return (
            <div
              key={account.id}
              className="app-panel group relative flex h-[300px] flex-col overflow-hidden rounded-[30px] p-6 text-white transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${style.bg}`} />
              <div className="relative mb-4 flex items-start justify-between">
                <div className="min-h-[60px]">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${style.badge}`}>
                    {account.type}
                  </span>
                  {account.bank_name ? (
                    <div className="flex items-center gap-2 mt-3">
                      {account.bank_logo && (
                        <div className="rounded-2xl border border-white/10 bg-white p-1.5 shadow-md">
                          <img src={account.bank_logo} alt={account.bank_name} className="w-8 h-8 object-contain" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-[var(--muted-strong)]">{account.bank_name}</span>
                    </div>
                  ) : (
                    <div className="h-[44px]"></div>
                  )}
                </div>
                <span
                  className="mt-1 h-3 w-3 rounded-full shadow-[0_0_22px_rgba(255,255,255,0.24)]"
                  style={{ backgroundColor: style.color }}
                />
              </div>
              <div className="relative flex flex-1 flex-col justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2 line-clamp-1">{account.name}</h3>
                  <p className="text-3xl font-bold mb-4">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </div>
                <div className="mt-auto grid gap-2 sm:grid-cols-3">
                  <button
                    onClick={() => startEdit(account)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition hover:bg-white/10"
                    title="Edit account"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => startTransfer(account.id)}
                    disabled={accounts.length < 2}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Transfer funds"
                  >
                    Transfer
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20"
                    title="Delete account"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {accounts.length === 0 && !showForm && (
        <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.04] px-6 py-8 text-center">
          <p className="text-lg font-semibold text-white">No accounts yet</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Create your first account to start seeing a portfolio overview and transfer
            options.
          </p>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferFromId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="app-panel w-full max-w-md rounded-[32px] p-6 sm:p-7">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Transfer Money</h2>
              <button
                onClick={closeTransferModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">From Account</label>
                <div className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white">
                  {accounts.find((a) => a.id === transferFromId)?.name}
                  <span className="text-zinc-400 ml-2">
                    (Balance: {accounts.find((a) => a.id === transferFromId)?.currency}{" "}
                    {accounts.find((a) => a.id === transferFromId)?.balance.toLocaleString()})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">To Account</label>
                <select
                  value={transferData.to_account_id}
                  onChange={(e) => setTransferData({ ...transferData, to_account_id: e.target.value })}
                  className={selectCls}
                  required
                >
                  <option value="">Select destination account</option>
                  {accounts
                    .filter((a) => a.id !== transferFromId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.currency} {account.balance.toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  className={inputCls}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Note (optional)</label>
                <input
                  type="text"
                  value={transferData.note}
                  onChange={(e) => setTransferData({ ...transferData, note: e.target.value })}
                  className={inputCls}
                  placeholder="e.g., Monthly savings"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Transfer"}
                </button>
                <button
                  type="button"
                  onClick={closeTransferModal}
                  disabled={submitting}
                  className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
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
