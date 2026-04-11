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

  // Awaited ledger log (Essential for audit)
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

  // Fire-and-forget
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

  // Fire-and-forget
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

export async function createTransfer(data: TransferData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  // 1. Validate accounts belong to user and check currency
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, balance, name, currency")
    .eq("user_id", user.id)
    .in("id", [data.from_account_id, data.to_account_id]);

  if (accountsError || !accounts || accounts.length !== 2) {
    return { error: "Invalid accounts selection" };
  }

  const fromAccount = accounts.find((a) => a.id === data.from_account_id);
  const toAccount = accounts.find((a) => a.id === data.to_account_id);

  if (!fromAccount || !toAccount) return { error: "Could not find selected accounts" };
  
  // Logical Bug Fix: Check currency mismatch
  if (fromAccount.currency !== toAccount.currency) {
    return { error: `Currency mismatch: Cannot transfer between ${fromAccount.currency} and ${toAccount.currency} accounts.` };
  }

  if (fromAccount.balance < data.amount) return { error: "Insufficient balance in source account" };

  // 2. Perform updates sequentially with careful await
  // Note: True atomicity requires RPC/PostgreSQL transaction
  
  // Step A: Create transfer record
  const { error: transferError } = await supabase.from("transfers").insert({
    user_id: user.id,
    from_account_id: data.from_account_id,
    to_account_id: data.to_account_id,
    amount: data.amount,
    note: data.note,
  });

  if (transferError) return { error: `Transaction failed: ${transferError.message}` };

  // Step B: Deduct from source
  const { error: fromError } = await supabase.from("accounts")
    .update({ balance: fromAccount.balance - data.amount })
    .eq("id", data.from_account_id)
    .eq("user_id", user.id);

  if (fromError) {
    // Critical: Transfer record exists but balance deduction failed
    return { error: "Failed to update source account balance." };
  }

  // Step C: Add to destination
  const { error: toError } = await supabase.from("accounts")
    .update({ balance: toAccount.balance + data.amount })
    .eq("id", data.to_account_id)
    .eq("user_id", user.id);

  if (toError) {
    // FATAL: Money deducted from source but not added to destination!
    // In a production app, we should attempt an automated rollback or log a high-priority alert.
    console.error("FATAL ERROR: Balance deducted from source but failed to add to destination", toError);
    return { error: "Critical error during balance update. Please contact support." };
  }

  // 3. Log to ledger (Awaited for integrity)
  await Promise.all([
    supabase.from("ledger_logs").insert({
      user_id: user.id,
      account_id: data.from_account_id,
      account_name: fromAccount.name,
      action_type: "TRANSFER_OUT",
      amount: data.amount,
      previous_balance: fromAccount.balance,
      new_balance: fromAccount.balance - data.amount,
      details: `Transfer to ${toAccount.name}: ${data.note || 'No note'}`,
    }),
    supabase.from("ledger_logs").insert({
      user_id: user.id,
      account_id: data.to_account_id,
      account_name: toAccount.name,
      action_type: "TRANSFER_IN",
      amount: data.amount,
      previous_balance: toAccount.balance,
      new_balance: toAccount.balance + data.amount,
      details: `Transfer from ${fromAccount.name}: ${data.note || 'No note'}`,
    }),
  ]);

  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard");
  
  return { success: true };
}

export async function adjustBalance(id: string, amount: number, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

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

  // 2. Log to ledger and transactions (Awaited for integrity)
  const [ledgerRes, transRes] = await Promise.all([
    supabase.from("ledger_logs").insert({
      user_id: user.id,
      account_id: id,
      account_name: account.name,
      action_type: amount > 0 ? "ADJUST_UP" : "ADJUST_DOWN",
      amount: Math.abs(amount),
      previous_balance: account.balance,
      new_balance: newBalance,
      details: note || (amount > 0 ? "Balance increased" : "Balance decreased"),
    }),
    supabase.from("transactions").insert({
      user_id: user.id,
      account_id: id,
      amount: Math.abs(amount),
      type: amount > 0 ? "income" : "expense",
      description: note || "Balance adjustment",
      date: new Date().toISOString().split('T')[0],
    }),
  ]);

  if (ledgerRes.error) console.error("Failed to create ledger log", ledgerRes.error);
  if (transRes.error) console.error("Failed to create transaction record", transRes.error);

  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}
