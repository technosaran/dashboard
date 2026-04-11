"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import type { TablesInsert } from "@/lib/database.types";

export async function createRecipient(data: Omit<TablesInsert<"recipients">, "user_id">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase.from("recipients").insert({
    ...data,
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
    supabase.from("accounts").select("balance, name").eq("id", payload.account_id).eq("user_id", user.id).single(),
    supabase.from("recipients").select("name").eq("id", payload.recipient_id).eq("user_id", user.id).single(),
  ]);

  if (accountRes.error || !accountRes.data) return { error: "Account not found" };
  if (recipientRes.error || !recipientRes.data) return { error: "Recipient not found" };

  const account = accountRes.data;
  const recipient = recipientRes.data;

  if (account.balance < payload.amount) return { error: "Insufficient balance" };

  const newBalance = account.balance - payload.amount;

  // Update balance
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", payload.account_id)
    .eq("user_id", user.id);

  if (updateError) return { error: "Failed to update balance" };

  // Fire-and-forget: ledger + transaction in parallel (non-blocking)
  const details = `Sent money to ${recipient.name}${payload.note ? `: ${payload.note}` : ""}`;

  Promise.all([
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

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");

  return { success: true };
}
