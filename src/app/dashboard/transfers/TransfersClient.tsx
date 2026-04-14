"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { createTransfer } from "./actions";

type Account = Tables<"accounts">;
type Transfer = Tables<"transfers">;

const supabase = createClient();

interface TransfersClientProps {
  initialAccounts: Account[];
  initialTransfers: Transfer[];
}

export default function TransfersClient({ initialAccounts, initialTransfers }: TransfersClientProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [transfers, setTransfers] = useState<Transfer[]>(initialTransfers);
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
    const { data } = await supabase.from("accounts").select("*").eq("user_id", user.id).order("name");
    setAccounts(data || []);
  }, []);

  const loadTransfers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("transfers").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setTransfers(data || []);
  }, []);

  const loadData = useCallback(async () => {
    await Promise.all([loadAccounts(), loadTransfers()]);
  }, [loadAccounts, loadTransfers]);

  useEffect(() => {
    const channel = supabase.channel("transfers-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "transfers" }, () => startTransition(loadData))
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => startTransition(loadAccounts))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Internal Transfers</h1>
          <p className="text-[13px] md:text-sm mt-1 text-[--text-secondary]">Transfer money between your accounts</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={`btn-primary flex-1 md:flex-none ${showForm ? "btn-secondary" : ""}`}>
          {showForm ? (<><svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg><span>Cancel</span></>) : (<><svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg><span>New Transfer</span></>)}
        </button>
      </div>

      {accounts.length < 2 && (
        <div className="animate-fade-in-up delay-1 px-5 py-4 rounded-2xl bg-[--warning]/5 border border-[--warning]/20 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[--warning]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[--warning]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[--warning]">You need at least 2 accounts to make transfers. Create more accounts first.</p>
        </div>
      )}

      {showForm && accounts.length >= 2 && (
        <div className="glass-card-static animate-scale-in p-5 md:p-10 mb-8 border-white/10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-[--accent-primary]/10 border border-[--accent-primary]/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-[--accent-primary-light]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-[--text-primary]">Capital Movement</h2>
              <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-0.5">Internal Reallocation</p>
            </div>
          </div>
          {error && (<div className="mb-8 animate-fade-in px-5 py-3 rounded-xl bg-[--danger]/5 border border-[--danger]/20 text-[--danger] text-xs font-bold">{error}</div>)}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3"><label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">From Source Account</label><select value={formData.from_account_id} onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value })} className="input-premium" required><option value="">Select source account</option>{accounts.map((account) => (<option key={account.id} value={account.id}>{account.name} ({account.currency} {account.balance.toLocaleString()})</option>))}</select>{formData.from_account_id && (<p className="text-[10px] font-bold text-[--text-muted]">Available: {accounts.find(a => a.id === formData.from_account_id)?.currency === 'USD' ? '$' : '₹'}{getAccountBalance(formData.from_account_id).toLocaleString()}</p>)}</div>
              <div className="space-y-3"><label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Destination Account</label><select value={formData.to_account_id} onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })} className="input-premium" required><option value="">Select destination</option>{accounts.map((account) => (<option key={account.id} value={account.id}>{account.name} ({account.currency} {account.balance.toLocaleString()})</option>))}</select></div>
              <div className="space-y-3"><label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transfer Amount</label><input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="input-premium" placeholder="0.00" required /></div>
              <div className="space-y-3"><label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Allocation Note (Optional)</label><input type="text" value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} className="input-premium" placeholder="e.g. Monthly reallocation" /></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button type="submit" disabled={submitting} className="btn-primary flex-1 shadow-xl shadow-[--accent-primary]/20">
                {submitting ? "Processing Transfer..." : "Authorize Movement"}
              </button>
              <button type="button" onClick={resetForm} disabled={submitting} className="btn-secondary flex-1">Close</button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card-static overflow-hidden animate-fade-in-up delay-2 border-white/5">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[--success]/10 border border-[--success]/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-[--success]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-[--text-primary]">Transfer Records</h2>
          </div>
          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[--text-muted] uppercase tracking-widest">{transfers.length} entries</span>
        </div>
        {transfers.length === 0 ? (<div style={{ padding: "60px 24px", textAlign: "center" }}><div className="mx-auto mb-4 flex items-center justify-center" style={{ width: "52px", height: "52px", borderRadius: "var(--radius-lg)", background: "rgba(162,155,254,0.08)", border: "1px solid rgba(162,155,254,0.12)" }}><svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--text-muted)" }}><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg></div><p className="font-semibold" style={{ color: "var(--text-primary)" }}>No transfers yet</p><p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Create your first transfer to get started.</p></div>) : (<div>{transfers.map((transfer, index) => (<div key={transfer.id} className={`animate-fade-in-up delay-${Math.min(index + 1, 6)}`} style={{ padding: "16px 20px md:20px 24px", borderBottom: index < transfers.length - 1 ? "1px solid var(--border-subtle)" : "none", transition: "background 0.2s", cursor: "default" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div className="flex items-center gap-3 md:gap-4"><div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[--accent-primary]/10 border border-[--accent-primary]/20 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: "var(--accent-primary)" }}><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg></div><div><div className="flex items-center gap-1.5 md:gap-2 flex-wrap"><span className="font-bold text-[13px] md:text-sm text-[--text-primary]">{getAccountName(transfer.from_account_id)}</span><svg className="w-3 h-3 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg><span className="font-bold text-[13px] md:text-sm text-[--text-primary]">{getAccountName(transfer.to_account_id)}</span></div>{transfer.note && (<p className="text-[11px] md:text-sm mt-0.5 text-[--text-secondary] line-clamp-1">{transfer.note}</p>)}<p className="text-[10px] mt-0.5 text-[--text-muted] font-medium">{format(new Date(transfer.created_at), "MMM d, h:mm a")}</p></div></div><div className="text-left sm:text-right flex-shrink-0 sm:ml-4 pl-[52px] sm:pl-0"><p className="text-lg md:text-xl font-black text-[--text-primary]">{accounts.find(a => a.id === transfer.from_account_id)?.currency === 'USD' ? '$' : '₹'}{transfer.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div></div></div>))}</div>)}
      </div>
    </div>
  );
}
