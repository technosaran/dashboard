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

  const { error } = await supabase.from("recipients").insert({
    ...data,
    name: data.name.trim(),
    user_id: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/family");
  return { success: true };
}

export async function updateRecipient(id: string, data: { name: string; relationship: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  if (!data.name || data.name.trim().length < 2) {
    return { error: "Name must be at least 2 characters long." };
  }

  const { error } = await supabase.from("recipients").update({
    name: data.name.trim(),
    relationship: data.relationship,
  }).eq("id", id).eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/family");
  return { success: true };
}

export async function deleteRecipient(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  const { data, error } = await supabase.rpc("atomic_delete_entity", {
    p_user_id: user.id,
    p_entity_type: "recipient",
    p_entity_id: id
  });

  if (error) return { error: error.message };
  const res = data as { success: boolean; error?: string };
  if (!res?.success) return { error: res?.error || "Failed to delete recipient atomically" };

  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
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

  // Input validation
  if (!payload.amount || payload.amount <= 0 || !Number.isFinite(payload.amount)) {
    return { error: "Amount must be a positive number" };
  }
  if (!payload.account_id) return { error: "Account is required" };
  if (!payload.recipient_id) return { error: "Recipient is required" };

  // Fetch account + recipient in parallel
  const [accountRes, recipientRes] = await Promise.all([
    supabase.from("accounts").select("balance, name, currency").eq("id", payload.account_id).eq("user_id", user.id).single(),
    supabase.from("recipients").select("name").eq("id", payload.recipient_id).eq("user_id", user.id).single(),
  ]);

  if (accountRes.error || !accountRes.data) return { error: "Account not found" };
  if (recipientRes.error || !recipientRes.data) return { error: "Recipient not found" };

  const account = accountRes.data;

  if (account.balance < payload.amount) return { error: "Insufficient balance" };

  // Call the atomic RPC function
  const { data, error: rpcError } = await supabase.rpc("process_family_transfer", {
    p_user_id: user.id,
    p_account_id: payload.account_id,
    p_recipient_id: payload.recipient_id,
    p_amount: payload.amount,
    p_note: payload.note
  });

  if (rpcError) return { error: rpcError.message };
  
  const result = data as { success: boolean; error?: string };
  if (!result.success) return { error: result.error || "Failed to process transfer" };


  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");

  return { success: true };
}
