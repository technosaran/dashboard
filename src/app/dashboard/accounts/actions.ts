"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import type { TablesInsert, TablesUpdate, Tables } from "@/lib/database.types";

// ── Optimized: single auth call per action, pass supabase+userId down ──

export async function createAccount(data: Omit<TablesInsert<"accounts">, "user_id">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: newAccount, error } = await supabase.from("accounts").insert({
    ...data,
    user_id: user.id,
  }).select().single();

  if (error) return { error: error.message };

  if (newAccount) {
    await supabase.from("ledger_logs").insert({
      user_id: user.id,
      account_id: newAccount.id,
      account_name: newAccount.name,
      action_type: "CREATE",
      amount: newAccount.balance,
      previous_balance: 0,
      new_balance: newAccount.balance,
      details: `Created new ${newAccount.type} account: ${newAccount.name}`,
    });
  }

  revalidatePath("/dashboard/accounts");
  return { success: true };
}

export async function updateAccount(id: string, data: TablesUpdate<"accounts">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("accounts")
    .update(data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  supabase.from("ledger_logs").insert({
    user_id: user.id,
    account_id: id,
    action_type: "UPDATE",
    details: `Updated account settings: ${Object.keys(data).join(", ")}`,
  }).then(() => {});

  revalidatePath("/dashboard/accounts");
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

  supabase.from("ledger_logs").insert({
    user_id: user.id,
    account_id: id,
    action_type: "DELETE",
    details: `Deleted account (ID: ${id})`,
  }).then(() => {});

  revalidatePath("/dashboard/accounts");
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

// Logical Enhancement: Use atomic RPC for transfers
export async function createTransfer(data: TransferData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: rpcData, error } = await supabase.rpc("process_transfer", {
    p_user_id: user.id,
    p_from_account_id: data.from_account_id,
    p_to_account_id: data.to_account_id,
    p_amount: data.amount,
    p_note: data.note || null
  });

  if (error) {
    console.error("Transfer RPC Error:", error);
    return { error: error.message };
  }

  const result = rpcData as { success: boolean, error?: string };
  if (!result.success) return { error: result.error || "Transfer failed" };

  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard");
  
  return { success: true };
}

export async function adjustBalance(id: string, amount: number, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // For adjustments, we still use client logic for now but ensure deep linking
  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("balance, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !account) return { error: "Account not found" };

  const newBalance = account.balance + amount;
  if (newBalance < 0) return { error: "Insufficient balance" };

  const { error } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Create transaction record first to get ID for linking
  const { data: newTrans, error: transError } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: id,
    amount: Math.abs(amount),
    type: amount > 0 ? "income" : "expense",
    description: note || "Balance adjustment",
    date: new Date().toISOString().split('T')[0],
  }).select().single();

  if (transError) console.error("Failed to create transaction record", transError);

  // Link to ledger with source ID
  await supabase.from("ledger_logs").insert({
    user_id: user.id,
    account_id: id,
    account_name: account.name,
    action_type: amount > 0 ? "ADJUST_UP" : "ADJUST_DOWN",
    amount: Math.abs(amount),
    previous_balance: account.balance,
    new_balance: newBalance,
    details: note || (amount > 0 ? "Balance increased" : "Balance decreased"),
    source_id: newTrans?.id,
    source_type: "transaction"
  });

  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard");
  return { success: true };
}
