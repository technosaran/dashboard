"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";

async function logToLedger(data: Omit<TablesInsert<"ledger_logs">, "user_id">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("ledger_logs").insert({
    ...data,
    user_id: user.id,
  });
}

export async function createRecipient(data: Omit<TablesInsert<"recipients">, "user_id">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase.from("recipients").insert({
    ...data,
    user_id: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/family");
  return { success: true };
}

export async function deleteRecipient(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("recipients")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/family");
  return { success: true };
}

export async function sendMoneyToFamily(payload: {
  account_id: string;
  recipient_id: string;
  amount: number;
  note: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get account balance and name
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("balance, name")
    .eq("id", payload.account_id)
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) {
    return { error: "Account not found" };
  }

  if (account.balance < payload.amount) {
    return { error: "Insufficient balance" };
  }

  // Get recipient name
  const { data: recipient, error: recipientError } = await supabase
    .from("recipients")
    .select("name")
    .eq("id", payload.recipient_id)
    .eq("user_id", user.id)
    .single();

  if (recipientError || !recipient) {
    return { error: "Recipient not found" };
  }

  const newBalance = account.balance - payload.amount;

  // Update account balance
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", payload.account_id)
    .eq("user_id", user.id);

  if (updateError) {
    return { error: "Failed to update balance" };
  }

  // Log to ledger
  await logToLedger({
    account_id: payload.account_id,
    account_name: account.name,
    action_type: "SEND_MONEY",
    amount: payload.amount,
    previous_balance: account.balance,
    new_balance: newBalance,
    details: `Sent money to ${recipient.name}${payload.note ? `: ${payload.note}` : ""}`,
  });

  // Log as transaction
  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: payload.account_id,
    amount: payload.amount,
    type: "expense",
    description: `Sent to ${recipient.name}${payload.note ? `: ${payload.note}` : ""}`,
    category: "Family & Friends",
    date: new Date().toISOString().split('T')[0]
  });

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard");

  return { success: true };
}
