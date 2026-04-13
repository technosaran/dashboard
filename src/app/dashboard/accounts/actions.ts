"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

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

  const { data: rpcData, error } = await supabase.rpc("create_account_atomic", {
    p_user_id: user.id,
    p_name: data.name,
    p_type: data.type,
    p_balance: data.balance ?? 0,
    p_currency: data.currency || 'INR',
    p_bank_name: data.bank_name || null
  });

  if (error) return { error: error.message };
  const result = rpcData as { success: boolean, error?: string };
  if (!result.success) return { error: result.error || "Failed to create account" };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function updateAccount(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // SECURITY: Prevent direct balance manipulation via generic update
  const { balance, user_id, id: _id, created_at, ...safeData } = data;

  const { error } = await supabase
    .from("accounts")
    .update(safeData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Get account name for logging
  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", id)
    .single();

  // Log update - awaited for integrity
  await supabase.from("ledger_logs").insert({
    user_id: user.id,
    account_id: id,
    account_name: account?.name || "Account",
    action_type: "UPDATE",
    details: `Updated settings for ${account?.name || 'account'}: ${Object.keys(safeData).join(", ")}`,
  });

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: rpcData, error } = await supabase.rpc("delete_account_atomic_v2" as any, {
    p_user_id: user.id,
    p_account_id: id
  });

  if (error) return { error: error.message };
  const result = rpcData as { success: boolean, error?: string };
  if (!result.success) return { error: result.error || "Failed to delete account" };

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

  const { data: rpcData, error } = await supabase.rpc("process_transfer", {
    p_user_id: user.id,
    p_from_account_id: data.from_account_id,
    p_to_account_id: data.to_account_id,
    p_amount: data.amount,
    p_note: data.note || null
  });

  if (error) return { error: error.message };
  const result = rpcData as { success: boolean, error?: string };
  if (!result.success) return { error: result.error || "Transfer failed" };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function adjustBalance(id: string, amount: number, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: rpcData, error } = await supabase.rpc("adjust_account_balance", {
    p_user_id: user.id,
    p_account_id: id,
    p_amount: amount,
    p_note: note
  });

  if (error) return { error: error.message };
  const result = rpcData as { success: boolean, error?: string };
  if (!result.success) return { error: result.error || "Adjustment failed" };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
