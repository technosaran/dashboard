"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { searchBanks, type Bank } from "@/lib/banks";
import { createAccount, updateAccount, deleteAccount } from "./actions";

type Account = Tables<"accounts">;

const supabase = createClient();

const TYPE_STYLES: Record<string, { bg: string; badge: string; color: string }> = {
  checking:   { bg: "from-blue-600 to-blue-800",       badge: "bg-blue-500/20 text-blue-200",       color: "#3b82f6" },
  savings:    { bg: "from-emerald-600 to-emerald-800", badge: "bg-emerald-500/20 text-emerald-200", color: "#10b981" },
  credit:     { bg: "from-rose-600 to-rose-800",       badge: "bg-rose-500/20 text-rose-200",       color: "#f43f5e" },
  investment: { bg: "from-violet-600 to-violet-800",   badge: "bg-violet-500/20 text-violet-200",   color: "#8b5cf6" },
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
  const [formData, setFormData] = useState({
    name: "",
    type: "checking",
    balance: "0",
    currency: "USD",
    bank_name: "",
    bank_logo: "",
  });

  useEffect(() => {
    async function init() {
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

    loadAccounts();
    init();
  }, []);

  async function loadAccounts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setAccounts(data || []);
    setLoading(false);
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
    const data = {
      name: formData.name,
      type: formData.type,
      balance: parseFloat(formData.balance),
      currency: formData.currency,
      bank_name: formData.bank_name || null,
      bank_logo: formData.bank_logo || null,
    };

    if (editingId) {
      await updateAccount(editingId, data);
    } else {
      await createAccount(data);
    }

    resetForm();
  }

  function resetForm() {
    setFormData({ name: "", type: "checking", balance: "0", currency: "USD", bank_name: "", bank_logo: "" });
    setBankSearch("");
    setShowForm(false);
    setEditingId(null);
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
        <button
          onClick={() => setShowForm(!showForm)}
          className={`${btnCls} ${showForm ? "bg-zinc-700 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
        >
          {showForm ? "Cancel" : "+ New Account"}
        </button>
      </div>

      {accounts.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 mb-8 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-white/80 text-lg mb-2">Total Balance</h2>
              <p className="text-white text-5xl font-bold mb-6">
                ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="space-y-3">
                {chartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-white font-medium">{item.name}</span>
                    </div>
                    <span className="text-white font-semibold">
                      ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" }}
                    labelStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl p-6 mb-8 border border-zinc-800">
          <h2 className="text-xl font-semibold text-white mb-4">{editingId ? "Edit Account" : "Create Account"}</h2>
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
            <button type="submit" className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-700`}>
              {editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className={`${btnCls} bg-zinc-700 text-white hover:bg-zinc-600`}>
              Cancel
            </button>
          </div>
        </form>
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
                    <div className="flex items-center gap-2 mt-2">
                      {account.bank_logo && <img src={account.bank_logo} alt={account.bank_name} className="w-6 h-6 rounded" />}
                      <span className="text-xs opacity-80">{account.bank_name}</span>
                    </div>
                  )}
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{account.name}</h3>
              <p className="text-3xl font-bold mb-4">
                {account.currency} {account.balance.toLocaleString()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(account)}
                  className="flex-1 bg-white/20 hover:bg-white/30 rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  className="flex-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  Delete
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
    </div>
  );
}
