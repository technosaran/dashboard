"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

// ── Optimized: single auth call per action ──

export async function createAccount(data: {
  name: string;
  type: string;
  balance?: number;
  currency?: string;
  bank_name?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: data.name,
      type: data.type,
      balance: data.balance ?? 0,
      currency: data.currency || "INR",
      bank_name: data.bank_name || null,
    });

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function updateAccount(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // SECURITY: Prevent direct balance manipulation via generic update
  const { balance, user_id, id: _id, created_at, ...safeData } = data as Record<string, unknown>;

  const { error } = await supabase
    .from("accounts")
    .update(safeData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function getAccounts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized" };

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

type TransferData = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  note: string | null;
};

export async function createTransfer(data: TransferData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Get source account
  const { data: fromAccount } = await supabase
    .from("accounts")
    .select("balance, currency")
    .eq("id", data.from_account_id)
    .eq("user_id", user.id)
    .single();

  if (!fromAccount) return { error: "Source account not found" };
  if (fromAccount.balance < data.amount) return { error: "Insufficient balance" };

  // Get destination account
  const { data: toAccount } = await supabase
    .from("accounts")
    .select("balance, currency")
    .eq("id", data.to_account_id)
    .eq("user_id", user.id)
    .single();

  if (!toAccount) return { error: "Destination account not found" };
  if (fromAccount.currency !== toAccount.currency) return { error: "Currency mismatch" };

  // Debit source
  const { error: debitErr } = await supabase
    .from("accounts")
    .update({ balance: fromAccount.balance - data.amount })
    .eq("id", data.from_account_id);

  if (debitErr) return { error: debitErr.message };

  // Credit destination
  const { error: creditErr } = await supabase
    .from("accounts")
    .update({ balance: toAccount.balance + data.amount })
    .eq("id", data.to_account_id);

  if (creditErr) return { error: creditErr.message };

  // Record transfer
  await supabase.from("transfers").insert({
    user_id: user.id,
    from_account_id: data.from_account_id,
    to_account_id: data.to_account_id,
    amount: data.amount,
    note: data.note,
  });

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function adjustBalance(id: string, amount: number, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Get current balance
  const { data: account } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!account) return { error: "Account not found" };

  const newBalance = account.balance + amount;
  if (newBalance < 0) return { error: "Insufficient balance" };

  const { error } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
