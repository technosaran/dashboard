"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState, startTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { createTransfer } from "./actions";

type Account = Tables<"accounts">;
type Transfer = Tables<"transfers">;

const supabase = createClient();

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("accounts")
      .select("id, name, balance, currency, type, bank_name, created_at, user_id, bank_logo")
      .eq("user_id", user.id)
      .order("name");

    setAccounts(data || []);
  }, []);

  const loadTransfers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("transfers")
      .select("id, created_at, from_account_id, to_account_id, amount, note, user_id")
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
    startTransition(loadData);

    const channel = supabase
      .channel("transfers-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfers" },
        () => {
          startTransition(loadData);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => {
          startTransition(loadAccounts);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, loadAccounts]);

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
    return (
      <div className="max-w-7xl mx-auto">
        <div className="skeleton" style={{ width: "240px", height: "36px", marginBottom: "32px" }} />
        <div className="skeleton" style={{ height: "200px", marginBottom: "24px" }} />
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: "80px" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Internal Transfers</h1>
          <p className="text-sm mt-1 text-[--text-secondary]">Transfer money between your accounts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`btn-primary h-12 px-8 flex items-center gap-2.5 rounded-2xl shadow-xl shadow-[--accent-primary]/25 transition-all hover:scale-105 active:scale-95 ${showForm ? "btn-secondary" : ""}`}
        >
          {showForm ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
              New Transfer
            </>
          )}
        </button>
      </div>

      {/* Warning for insufficient accounts */}
      {accounts.length < 2 && (
        <div
          className="animate-fade-in-up delay-1"
          style={{
            padding: "16px 20px",
            borderRadius: "var(--radius-lg)",
            background: "rgba(253, 203, 110, 0.08)",
            border: "1px solid rgba(253, 203, 110, 0.2)",
            marginBottom: "32px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(253, 203, 110, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: "#fdcb6e" }}>
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "#fdcb6e" }}>
            You need at least 2 accounts to make transfers. Create more accounts first.
          </p>
        </div>
      )}

      {/* Transfer Form */}
      {showForm && accounts.length >= 2 && (
        <div className="glass-card-static animate-scale-in p-8 mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(162, 155, 254, 0.12)",
                border: "1px solid rgba(162, 155, 254, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: "#a29bfe" }}>
                <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              New Transfer
            </h2>
          </div>

          {error && (
            <div
              className="mb-5 animate-fade-in"
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

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                  From Source Account
                </label>
                <select
                  value={formData.from_account_id}
                  onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value })}
                  className="input-premium"
                  required
                >
                  <option value="">Select source account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency} {account.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
                {formData.from_account_id && (
                  <p className="text-[10px] font-bold text-[--text-muted]">
                    Available: {accounts.find(a => a.id === formData.from_account_id)?.currency === 'USD' ? '$' : '₹'}{getAccountBalance(formData.from_account_id).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                  Destination Account
                </label>
                <select
                  value={formData.to_account_id}
                  onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                  className="input-premium"
                  required
                >
                  <option value="">Select destination</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency} {account.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                  Transfer Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input-premium"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                  Allocation Note (Optional)
                </label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="input-premium"
                  placeholder="e.g. Monthly reallocation"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  "Transfer"
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="btn-secondary"
                style={{ opacity: submitting ? 0.6 : 1 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer History */}
      <div className="glass-card-static overflow-hidden animate-fade-in-up delay-2">
        <div
          className="flex items-center justify-between"
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(0, 206, 201, 0.1)",
                border: "1px solid rgba(0, 206, 201, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: "#00cec9" }}>
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Transfer History
            </h2>
          </div>
          <span
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{
              background: "rgba(0, 206, 201, 0.1)",
              color: "#00cec9",
              border: "1px solid rgba(0, 206, 201, 0.15)",
            }}
          >
            {transfers.length} total
          </span>
        </div>

        {transfers.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div
              className="mx-auto mb-4 flex items-center justify-center"
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "var(--radius-lg)",
                background: "rgba(162,155,254,0.08)",
                border: "1px solid rgba(162,155,254,0.12)",
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--text-muted)" }}>
                <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>No transfers yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Create your first transfer to get started.
            </p>
          </div>
        ) : (
          <div>
            {transfers.map((transfer, index) => (
              <div
                key={transfer.id}
                className={`animate-fade-in-up delay-${Math.min(index + 1, 6)}`}
                style={{
                  padding: "20px 24px",
                  borderBottom: index < transfers.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  transition: "background 0.2s",
                  cursor: "default",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Transfer icon */}
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(162, 155, 254, 0.1)",
                        border: "1px solid rgba(162, 155, 254, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: "#a29bfe" }}>
                        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>

                    {/* Transfer details */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          {getAccountName(transfer.from_account_id)}
                        </span>
                        <div
                          className="flex items-center justify-center"
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: "rgba(108, 92, 231, 0.12)",
                          }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color: "#a29bfe" }}>
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          {getAccountName(transfer.to_account_id)}
                        </span>
                      </div>
                      {transfer.note && (
                        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                          {transfer.note}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {new Date(transfer.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-xl font-bold gradient-text">
                      {accounts.find(a => a.id === transfer.from_account_id)?.currency === 'USD' ? '$' : '₹'}{transfer.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
