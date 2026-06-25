"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/ui/drawer";

type Account = {
  id: string;
  name: string;
  currency: string;
  balance: number;
};

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  submitting: boolean;
  accounts: Account[];
  categories: { label: string }[];
  defaultDate: string;
  defaultAccountId?: string;
}

export default function ExpenseForm({ isOpen, onClose, onSubmit, submitting, accounts, categories, defaultDate, defaultAccountId }: ExpenseFormProps) {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Food",
    date: defaultDate,
    account_id: defaultAccountId || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...formData, amount: parseFloat(formData.amount), account_id: formData.account_id || undefined });
    setFormData({
      description: "",
      amount: "",
      category: "Food",
      date: defaultDate,
      account_id: "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
          {["Food", "Shopping", "Entertainment"].includes(formData.category) ? "Merchant / Store" : "Description / Purpose"}
        </label>
        <input autoFocus type="text" required className="input-premium" placeholder="e.g. Starbucks" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} autoComplete="new-password" id="expense-description" name="description" />
      </div>
      
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Debit Amount</label>
        <input type="number" required className="input-premium" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} autoComplete="new-password" inputMode="decimal" id="expense-amount" name="amount" />
      </div>
      
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Expenditure Sector</label>
        <select className="input-premium" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} aria-label="Select expenditure category" id="expense-category" name="category">
          {categories.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
        </select>
      </div>
      
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transaction Date</label>
        <input type="date" required className="input-premium" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} autoComplete="new-password" id="expense-date" name="date" />
      </div>
      
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Deduct from Account</label>
        <select className="input-premium" value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })} aria-label="Select debit account" id="expense-account" name="account_id">
          <option value="">No Deduction (Track only)</option>
          {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency} {acc.balance.toLocaleString()})</option>)}
        </select>
        {formData.account_id && (() => {
          const selectedAcc = accounts.find((a) => a.id === formData.account_id);
          return selectedAcc ? (
            <div className="mt-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
              <span className="font-medium">Selected Balance</span>
              <span className="font-bold text-white">
                {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
              </span>
            </div>
          ) : null;
        })()}
      </div>
      
      <div className="pt-4 mt-8">
        <button type="submit" disabled={submitting} className="btn-primary w-full h-12 shadow-xl shadow-[--accent-primary]/20 text-[11px] font-black uppercase tracking-widest">
          {submitting ? "Processing..." : "Confirm Record"}
        </button>
      </div>
    </form>
  );
}
