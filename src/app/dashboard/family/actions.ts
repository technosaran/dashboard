"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import type { TablesInsert } from "@/lib/database.types";

export async function createRecipient(data: Omit<TablesInsert<"recipients">, "user_id">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  // Basic Validation
  if (!data.name || data.name.trim().length < 2) {
    return { error: "Name must be at least 2 characters long." };
  }

  if (data.account_number && data.account_number.length < 4) {
    return { error: "Account number seems too short." };
  }

  const { error } = await supabase.from("recipients").insert({
    ...data,
    name: data.name.trim(),
    user_id: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/family");
  return { success: true };
}

export async function deleteRecipient(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("recipients")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

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

  if (!user) return { error: "Unauthorized" };

  // Fetch account + recipient in parallel
  const [accountRes, recipientRes] = await Promise.all([
    supabase.from("accounts").select("balance, name, currency").eq("id", payload.account_id).eq("user_id", user.id).single(),
    supabase.from("recipients").select("name").eq("id", payload.recipient_id).eq("user_id", user.id).single(),
  ]);

  if (accountRes.error || !accountRes.data) return { error: "Account not found" };
  if (recipientRes.error || !recipientRes.data) return { error: "Recipient not found" };

  const account = accountRes.data;
  const recipient = recipientRes.data;

  // Logical Bug Fix: Verify currency match (External transfers usually assume INR for now, but we should be explicit)
  if (account.currency !== "INR") {
    // Current UI assumes INR for family transfers. If the account is USD, we need a conversion or we should block it.
    return { error: `Cannot send money from a ${account.currency} account. Currently only INR is supported for family transfers.` };
  }

  if (account.balance < payload.amount) return { error: "Insufficient balance" };

  const newBalance = account.balance - payload.amount;

  // 1. Update balance (Essential)
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", payload.account_id)
    .eq("user_id", user.id);

  if (updateError) return { error: "Failed to update account balance." };

  // 2. Log to ledger and transactions (Awaited for integrity)
  const details = `Sent money to ${recipient.name}${payload.note ? `: ${payload.note}` : ""}`;

  const [ledgerRes, transRes] = await Promise.all([
    supabase.from("ledger_logs").insert({
      user_id: user.id,
      account_id: payload.account_id,
      account_name: account.name,
      action_type: "SEND_MONEY",
      amount: payload.amount,
      previous_balance: account.balance,
      new_balance: newBalance,
      details,
    }),
    supabase.from("transactions").insert({
      user_id: user.id,
      account_id: payload.account_id,
      amount: payload.amount,
      type: "expense",
      description: details,
      category: "Family & Friends",
      date: new Date().toISOString().split('T')[0],
    }),
  ]);

  if (ledgerRes.error) console.error("Failed to create ledger log", ledgerRes.error);
  if (transRes.error) console.error("Failed to create transaction record", transRes.error);

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");

  return { success: true };
}
