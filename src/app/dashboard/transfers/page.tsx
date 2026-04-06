"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { createTransfer } from "./actions";

type Account = Tables<"accounts">;
type Transfer = Tables<"transfers">;

const supabase = createClient();
const inputCls =
  "w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] outline-none transition focus:border-[var(--border-strong)] focus:bg-white/[0.08]";
const selectCls =
  "w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--border-strong)] focus:bg-white/[0.08]";

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

  async function loadAccounts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    setAccounts(data || []);
  }

  async function loadTransfers() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("transfers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setTransfers(data || []);
  }

  async function loadData() {
    await Promise.all([loadAccounts(), loadTransfers()]);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();

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
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function getAccountCurrency(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.currency : "USD";
  }

  const totalTransferred = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-[var(--muted-strong)]">
          Loading transfers...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-white/[0.04] p-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Transfers</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Move money with a clearer transfer trail
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">
            Shift balances between accounts, keep the note trail readable, and review the
            latest money movements in one place.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
            showForm
              ? "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              : "bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] text-slate-950 hover:brightness-110"
          }`}
        >
          {showForm ? "Cancel" : "New transfer"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-tile rounded-[26px] p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Transfer count</p>
          <p className="mt-4 text-3xl font-semibold text-white">{transfers.length}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Recent internal movements captured in the audit trail.
          </p>
        </div>
        <div className="metric-tile rounded-[26px] p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Moved recently</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {formatCurrency(totalTransferred, accounts[0]?.currency ?? "USD")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Total value across the latest visible transfers.
          </p>
        </div>
        <div className="metric-tile rounded-[26px] p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Transfer ready</p>
          <p className="mt-4 text-3xl font-semibold text-white">{accounts.length >= 2 ? "Yes" : "No"}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            You need at least two accounts before money can move between them.
          </p>
        </div>
      </div>

      {accounts.length < 2 && (
        <div className="rounded-[24px] border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-100">
          <p>
            You need at least 2 accounts to make transfers. Create more accounts first.
          </p>
        </div>
      )}

      {showForm && accounts.length >= 2 && (
        <form onSubmit={handleSubmit} className="app-panel rounded-[30px] p-6 sm:p-7">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight text-white">New transfer</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">From Account</label>
              <select
                value={formData.from_account_id}
                onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value })}
                className={selectCls}
                required
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({formatCurrency(account.balance, account.currency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">To Account</label>
              <select
                value={formData.to_account_id}
                onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                className={selectCls}
                required
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({formatCurrency(account.balance, account.currency)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className={inputCls}
                placeholder="0.00"
                required
              />
              {formData.from_account_id && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Available:{" "}
                  {formatCurrency(
                    getAccountBalance(formData.from_account_id),
                    getAccountCurrency(formData.from_account_id)
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">Note (optional)</label>
              <input
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className={inputCls}
                placeholder="e.g., Monthly savings"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(88,213,170,0.95),rgba(120,199,255,0.9))] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Transfer"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="app-panel overflow-hidden rounded-[30px]">
        <div className="border-b border-white/8 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Transfer History</h2>
        </div>

        {transfers.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            No transfers yet. Create your first transfer to get started.
          </div>
        ) : (
          <div className="divide-y divide-white/8">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="p-6 transition hover:bg-white/[0.04]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(88,213,170,0.14)]">
                      <svg className="h-5 w-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{getAccountName(transfer.from_account_id)}</span>
                        <svg className="h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-white font-medium">{getAccountName(transfer.to_account_id)}</span>
                      </div>
                      {transfer.note && (
                        <p className="mt-1 text-sm text-[var(--muted-strong)]">{transfer.note}</p>
                      )}
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDateTime(transfer.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">
                      {formatCurrency(
                        transfer.amount,
                        getAccountCurrency(transfer.from_account_id)
                      )}
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
