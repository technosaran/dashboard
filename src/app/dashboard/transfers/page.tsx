"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { createTransfer } from "./actions";

type Account = Tables<"accounts">;
type Transfer = Tables<"transfers">;

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    note: "",
  });

  const loadAccounts = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    setAccounts(data || []);
  }, []);

  const loadTransfers = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("transfers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setTransfers(data || []);
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([loadAccounts(), loadTransfers()]);
    setLoading(false);
  }, [loadAccounts, loadTransfers]);

  useEffect(() => {
    const supabase = createClient();
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    const channel = supabase
      .channel("transfers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfers" },
        () => {
          void loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => {
          void loadAccounts();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadAccounts, loadData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (formData.from_account_id === formData.to_account_id) {
      setError("Cannot transfer to the same account");
      setSubmitting(false);
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount <= 0) {
      setError("Amount must be greater than 0");
      setSubmitting(false);
      return;
    }

    const fromAccount = accounts.find((a) => a.id === formData.from_account_id);
    if (fromAccount && fromAccount.balance < amount) {
      setError("Insufficient balance in source account");
      setSubmitting(false);
      return;
    }

    const result = await createTransfer({
      from_account_id: formData.from_account_id,
      to_account_id: formData.to_account_id,
      amount,
      note: formData.note || null,
    });

    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    resetForm();
    await loadData();
  }

  function resetForm() {
    setFormData({ from_account_id: "", to_account_id: "", amount: "", note: "" });
    setShowForm(false);
    setSubmitting(false);
    setError(null);
  }

  function getAccountName(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.name : "Unknown Account";
  }

  function getAccountBalance(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.balance : 0;
  }

  if (loading) {
    return <div className="p-8 text-zinc-400">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Internal Transfers</h1>
          <p className="text-zinc-400 mt-1">Transfer money between your accounts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showForm ? "bg-zinc-700 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {showForm ? "Cancel" : "+ New Transfer"}
        </button>
      </div>

      {accounts.length < 2 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-8">
          <p className="text-yellow-400 text-sm">
            You need at least 2 accounts to make transfers. Create more accounts first.
          </p>
        </div>
      )}

      {showForm && accounts.length >= 2 && (
        <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-2xl p-6 mb-8 border border-zinc-800">
          <h2 className="text-xl font-semibold text-white mb-4">New Transfer</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">From Account</label>
              <select
                value={formData.from_account_id}
                onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value })}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency} {account.balance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">To Account</label>
              <select
                value={formData.to_account_id}
                onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
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
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
                required
              />
              {formData.from_account_id && (
                <p className="text-xs text-zinc-500 mt-1">
                  Available: {getAccountBalance(formData.from_account_id).toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Note (optional)</label>
              <input
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Monthly savings"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Processing..." : "Transfer"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              className="px-4 py-2 rounded-lg font-medium bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">Transfer History</h2>
        </div>

        {transfers.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No transfers yet. Create your first transfer to get started.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="p-6 hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{getAccountName(transfer.from_account_id)}</span>
                        <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-white font-medium">{getAccountName(transfer.to_account_id)}</span>
                      </div>
                      {transfer.note && (
                        <p className="text-sm text-zinc-400 mt-1">{transfer.note}</p>
                      )}
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(transfer.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">
                      ${transfer.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
