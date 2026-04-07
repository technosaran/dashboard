"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";

export async function createAccount(data: Omit<TablesInsert<"accounts">, "user_id">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase.from("accounts").insert({
    ...data,
    user_id: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true };
}

export async function updateAccount(id: string, data: TablesUpdate<"accounts">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("accounts")
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true };
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/accounts");
  return { success: true };
}

export async function getAccounts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

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

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Validate accounts belong to user
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("user_id", user.id)
    .in("id", [data.from_account_id, data.to_account_id]);

  if (accountsError || !accounts || accounts.length !== 2) {
    return { error: "Invalid accounts" };
  }

  const fromAccount = accounts.find((a) => a.id === data.from_account_id);
  const toAccount = accounts.find((a) => a.id === data.to_account_id);

  if (!fromAccount || !toAccount) {
    return { error: "Invalid accounts" };
  }

  // Check sufficient balance
  if (fromAccount.balance < data.amount) {
    return { error: "Insufficient balance" };
  }

  // Create transfer record
  const { error: transferError } = await supabase.from("transfers").insert({
    user_id: user.id,
    from_account_id: data.from_account_id,
    to_account_id: data.to_account_id,
    amount: data.amount,
    note: data.note,
  });

  if (transferError) {
    return { error: transferError.message };
  }

  // Update account balances
  const { error: fromError } = await supabase
    .from("accounts")
    .update({ balance: fromAccount.balance - data.amount })
    .eq("id", data.from_account_id)
    .eq("user_id", user.id);

  if (fromError) {
    return { error: "Failed to update source account" };
  }

  const { error: toError } = await supabase
    .from("accounts")
    .update({ balance: toAccount.balance + data.amount })
    .eq("id", data.to_account_id)
    .eq("user_id", user.id);

  if (toError) {
    return { error: "Failed to update destination account" };
  }

  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  
  return { success: true };
}

export async function adjustBalance(id: string, amount: number, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get current balance
  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !account) {
    return { error: "Account not found" };
  }

  const newBalance = account.balance + amount;

  if (newBalance < 0) {
    return { error: "Insufficient balance" };
  }

  // Update balance
  const { error } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Log the adjustment as a transaction
  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: id,
    amount: Math.abs(amount),
    type: amount > 0 ? "income" : "expense",
    description: note || "Balance adjustment",
    date: new Date().toISOString().split('T')[0]
  });

  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}
