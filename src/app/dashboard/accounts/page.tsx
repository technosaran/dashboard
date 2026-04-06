"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { searchBanks, type Bank } from "@/lib/banks";
import { createAccount, updateAccount, deleteAccount, createTransfer } from "./actions";

type Account = Tables<"accounts">;

const supabase = createClient();

const TYPE_STYLES: Record<string, { bg: string; badge: string; color: string }> = {
  checking:   { bg: "from-cyan-500 via-blue-500 to-indigo-600",       badge: "bg-cyan-500/20 text-cyan-100",       color: "#06b6d4" },
  savings:    { bg: "from-teal-500 via-emerald-500 to-green-600",     badge: "bg-teal-500/20 text-teal-100",       color: "#14b8a6" },
  credit:     { bg: "from-orange-500 via-red-500 to-pink-600",        badge: "bg-orange-500/20 text-orange-100",   color: "#f97316" },
  investment: { bg: "from-purple-500 via-violet-500 to-fuchsia-600",  badge: "bg-purple-500/20 text-purple-100",   color: "#a855f7" },
};

const inputCls = "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
const selectCls = "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500";
const btnCls = "px-4 py-2 rounded-lg font-medium transition-colors";

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

  useEffect(() => {
    loadAccounts();

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
            loadAccounts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    setupRealtime();
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
        setAccounts(data || []);
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
      await deleteAccount(id);
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
  
  const chartData = Object.entries(
    accounts.reduce((acc, account) => {
      acc[account.type] = (acc[account.type] || 0) + account.balance;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, value]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value,
    color: TYPE_STYLES[type]?.color || "#6b7280",
  }));

  if (loading) {
    return <div className="p-8 text-zinc-400">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Accounts</h1>
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (accounts.length < 2) {
                alert("You need at least 2 accounts to make a transfer");
                return;
              }
              setTransferFromId(accounts[0].id);
              setTransferData({ to_account_id: "", amount: "", note: "" });
              setShowTransferModal(true);
              setError(null);
            }}
            disabled={accounts.length < 2}
            className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Internal Transfers
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            + New Account
          </button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 mb-8 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-white/80 text-lg mb-2">Total Balance</h2>
              <p className="text-white text-5xl font-bold mb-6">
                ₹{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="space-y-3">
                {chartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: item.color }}></div>
                      <span className="text-white font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold text-lg">
                        ₹{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <div className="text-white/70 text-xs">
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
                    label={({ name, percent }) => `${name}\n${((percent || 0) * 100).toFixed(1)}%`}
                    outerRadius={110}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `₹${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "12px", padding: "12px" }}
                    labelStyle={{ color: "#fff", fontWeight: "bold", marginBottom: "8px" }}
                    itemStyle={{ color: "#e4e4e7" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-2xl w-full border border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">{editingId ? "Edit Account" : "Create Account"}</h2>
              <button
                onClick={resetForm}
                className="text-zinc-400 hover:text-white transition-colors"
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
                  className={`flex-1 ${btnCls} bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {submitting ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  disabled={submitting}
                  className={`flex-1 ${btnCls} bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => {
          const style = TYPE_STYLES[account.type] || TYPE_STYLES.checking;
          return (
            <div key={account.id} className={`bg-gradient-to-br ${style.bg} rounded-2xl p-6 text-white relative`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${style.badge}`}>
                    {account.type}
                  </span>
                  {account.bank_name && (
                    <div className="flex items-center gap-2 mt-3">
                      {account.bank_logo && (
                        <div className="bg-white rounded-lg p-1.5 shadow-md">
                          <img src={account.bank_logo} alt={account.bank_name} className="w-8 h-8 object-contain" />
                        </div>
                      )}
                      <span className="text-sm opacity-90 font-medium">{account.bank_name}</span>
                    </div>
                  )}
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{account.name}</h3>
              <p className="text-3xl font-bold mb-6">
                {account.currency} {account.balance.toLocaleString()}
              </p>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => {
                    // TODO: Implement add money functionality
                    alert("Add money feature coming soon!");
                  }}
                  className="flex-1 bg-white/20 hover:bg-white/30 rounded-lg p-2.5 transition-colors flex items-center justify-center"
                  title="Add money"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  className="bg-red-500/20 hover:bg-red-500/40 rounded-lg p-2.5 transition-colors"
                  title="Delete account"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {accounts.length === 0 && !showForm && (
        <div className="text-center py-12 text-zinc-500">
          No accounts yet. Create your first account to get started.
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferFromId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Transfer Money</h2>
              <button
                onClick={closeTransferModal}
                className="text-zinc-400 hover:text-white transition-colors"
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
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "Processing..." : "Transfer"}
                </button>
                <button
                  type="button"
                  onClick={closeTransferModal}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors"
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
