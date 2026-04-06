"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";

type Account = Tables<"accounts">;

// Temporary fixed user until auth is set up
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000001";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [type, setType] = useState<"checking" | "savings" | "credit" | "investment">("checking");
  const [open, setOpen] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [transferError, setTransferError] = useState("");

  const total = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", TEMP_USER_ID)
      .order("created_at", { ascending: true });
    setAccounts(data ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        name: name.trim(),
        balance: parseFloat(balance) || 0,
        type,
        user_id: TEMP_USER_ID,
      })
      .select()
      .single();
    if (!error && data) {
      setAccounts((prev) => [...prev, data]);
    }
    setName("");
    setBalance("");
    setType("checking");
    setOpen(false);
  }

  async function handleTransfer() {
    setTransferError("");
    const amt = parseFloat(amount);
    if (!fromId || !toId || fromId === toId || !amt || amt <= 0) {
      setTransferError("Please fill all fields correctly.");
      return;
    }
    const from = accounts.find((a) => a.id === fromId);
    if (!from || from.balance < amt) {
      setTransferError("Insufficient balance.");
      return;
    }
    const to = accounts.find((a) => a.id === toId)!;

    const [r1, r2] = await Promise.all([
      supabase.from("accounts").update({ balance: from.balance - amt }).eq("id", fromId).select().single(),
      supabase.from("accounts").update({ balance: to.balance + amt }).eq("id", toId).select().single(),
    ]);

    if (!r1.error && !r2.error) {
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id === fromId) return r1.data!;
          if (a.id === toId) return r2.data!;
          return a;
        })
      );
    }
    setFromId("");
    setToId("");
    setAmount("");
    setTransferOpen(false);
  }

  const fmt = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Accounts</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Manage your financial accounts.</p>
        </div>
        <div className="flex gap-2">
          {accounts.length >= 2 && (
            <button
              onClick={() => setTransferOpen(true)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Transfer
            </button>
          )}
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            + Add Account
          </button>
        </div>
      </div>

      {/* Total Balance Card */}
      <div className="mt-8 rounded-2xl bg-emerald-500 p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
        <p className="text-sm font-medium text-emerald-100">Total Balance</p>
        <p className="mt-3 text-4xl font-bold tracking-tight">{fmt(total)}</p>
        <p className="mt-2 text-xs text-emerald-200">
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Account Cards */}
      {loading ? (
        <div className="mt-6 text-sm text-zinc-400">Loading...</div>
      ) : accounts.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="aspect-square rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{acc.name}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 capitalize mt-0.5">{acc.type}</p>
              </div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{fmt(acc.balance)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-400">No accounts yet. Add one to get started.</p>
      )}

      {/* Add Account Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">New Account</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Account name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit</option>
                <option value="investment">Investment</option>
              </select>
              <input
                type="number"
                placeholder="Balance (optional)"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 rounded-xl bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Transfer Funds</h2>
            <div className="space-y-3">
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">From account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {fmt(a.balance)}
                  </option>
                ))}
              </select>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">To account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {fmt(a.balance)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Amount (₹)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {transferError && <p className="text-xs text-red-500">{transferError}</p>}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setTransferOpen(false); setTransferError(""); }}
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="flex-1 rounded-xl bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
