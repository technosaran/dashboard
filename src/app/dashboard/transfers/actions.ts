"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

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

  // Start transaction: Create transfer record
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

  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  
  return { success: true };
}
