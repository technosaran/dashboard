"use client";

import { useState, useEffect } from "react";

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
  categories: { label: string; icon?: string }[];
  defaultDate: string;
  defaultAccountId?: string;
  editingExpense?: {
    id: string;
    description: string;
    amount: string | number;
    category: string;
    date: string | null;
    account_id: string | null;
  };
}

type FieldErrors = {
  description?: string;
  amount?: string;
  date?: string;
};

export default function ExpenseForm({
  isOpen,
  onClose,
  onSubmit,
  submitting,
  accounts,
  categories,
  defaultDate,
  defaultAccountId,
  editingExpense,
}: ExpenseFormProps) {
  const [formData, setFormData] = useState({
    description: editingExpense?.description ?? "",
    amount: editingExpense ? String(editingExpense.amount) : "",
    category: editingExpense?.category ?? "Food",
    date: editingExpense?.date ?? defaultDate,
    account_id: editingExpense?.account_id ?? defaultAccountId ?? "",
  });

  // #13 — inline field error state
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Re-populate when editingExpense changes (e.g. user opens a different row)
  useEffect(() => {
    if (editingExpense) {
      setFormData({
        description: editingExpense.description,
        amount: String(editingExpense.amount),
        category: editingExpense.category,
        date: editingExpense.date ?? defaultDate,
        account_id: editingExpense.account_id ?? defaultAccountId ?? "",
      });
    }
  }, [editingExpense?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate(data: typeof formData): FieldErrors {
    const errs: FieldErrors = {};
    if (!data.description.trim()) errs.description = "Description is required.";
    const amt = parseFloat(data.amount);
    if (!data.amount || isNaN(amt)) errs.amount = "Enter a valid amount.";
    else if (amt <= 0) errs.amount = "Amount must be greater than 0.";
    if (!data.date) errs.date = "Date is required.";
    return errs;
  }

  function handleBlur(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(formData));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = { description: true, amount: true, date: true };
    setTouched(allTouched);
    const errs = validate(formData);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    await onSubmit({
      ...(editingExpense ? { id: editingExpense.id } : {}),
      ...formData,
      amount: parseFloat(formData.amount),
      account_id: formData.account_id || undefined,
    });

    // reset only when adding (not editing — caller closes drawer)
    if (!editingExpense) {
      setFormData({
        description: "",
        amount: "",
        category: "Food",
        date: defaultDate,
        account_id: defaultAccountId ?? "",
      });
      setErrors({});
      setTouched({});
    }
  };

  const fieldError = (field: keyof FieldErrors) =>
    touched[field] && errors[field] ? (
      <p role="alert" className="text-[11px] text-rose-400 mt-1">{errors[field]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="expense-description" className="text-xs font-semibold text-[--text-muted]">
          {["Food", "Shopping", "Entertainment"].includes(formData.category) ? "Merchant / Store" : "Description"}
        </label>
        <input
          autoFocus
          type="text"
          required
          id="expense-description"
          name="description"
          className={`input-premium ${touched.description && errors.description ? "border-rose-500/50 focus:border-rose-500" : ""}`}
          placeholder="e.g. Starbucks"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          onBlur={() => handleBlur("description")}
          autoComplete="off"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "err-description" : undefined}
        />
        <span id="err-description">{fieldError("description")}</span>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label htmlFor="expense-amount" className="text-xs font-semibold text-[--text-muted]">Amount</label>
        <input
          type="number"
          required
          id="expense-amount"
          name="amount"
          className={`input-premium ${touched.amount && errors.amount ? "border-rose-500/50 focus:border-rose-500" : ""}`}
          placeholder="0.00"
          min="0.01"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          onBlur={() => handleBlur("amount")}
          autoComplete="off"
          inputMode="decimal"
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? "err-amount" : undefined}
        />
        <span id="err-amount">{fieldError("amount")}</span>
      </div>

      {/* Category — #12: preset chips only, no redundant <select> */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[--text-muted]">Category</label>
        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setFormData({ ...formData, category: c.label })}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                formData.category === c.label
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold shadow-[0_2px_10px_rgba(244,63,94,0.15)]"
                  : "bg-white/5 border-white/10 text-[--text-muted] hover:text-white"
              }`}
            >
              {c.icon && <span className="mr-1">{c.icon}</span>}
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label htmlFor="expense-date" className="text-xs font-semibold text-[--text-muted]">Date</label>
        <input
          type="date"
          required
          id="expense-date"
          name="date"
          className={`input-premium ${touched.date && errors.date ? "border-rose-500/50 focus:border-rose-500" : ""}`}
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          onBlur={() => handleBlur("date")}
          autoComplete="off"
          aria-invalid={!!errors.date}
          aria-describedby={errors.date ? "err-date" : undefined}
        />
        <span id="err-date">{fieldError("date")}</span>
      </div>

      {/* Account */}
      <div className="space-y-2">
        <label htmlFor="expense-account" className="text-xs font-semibold text-[--text-muted]">Account</label>
        <select
          id="expense-account"
          name="account_id"
          className="input-premium"
          value={formData.account_id}
          onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
          aria-label="Select debit account"
        >
          <option value="">No deduction (track only)</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.currency} {acc.balance.toLocaleString()})
            </option>
          ))}
        </select>
        {formData.account_id && (() => {
          const sel = accounts.find((a) => a.id === formData.account_id);
          return sel ? (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
              <span>Selected balance</span>
              <span className="font-bold text-white">{sel.currency === "USD" ? "$" : "₹"}{sel.balance.toLocaleString()}</span>
            </div>
          ) : null;
        })()}
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full h-12 shadow-xl shadow-[--accent-primary]/20 text-[11px] font-black uppercase tracking-widest"
        >
          {submitting ? "Processing…" : editingExpense ? "Save Changes" : "Confirm Record"}
        </button>
      </div>
    </form>
  );
}
