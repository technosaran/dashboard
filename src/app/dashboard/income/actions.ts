"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function addIncome(formData: {
  description: string;
  amount: number;
  category: string;
  date: string;
  account_id?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Call the atomic record_income RPC function
  const { data, error } = await supabase.rpc("record_income", {
    p_user_id: user.id,
    p_description: formData.description,
    p_amount: formData.amount,
    p_category: formData.category,
    p_date: formData.date,
    p_account_id: formData.account_id || undefined
  });

  if (error) {
    console.error("RPC Error:", error);
    return { error: error.message };
  }

  const result = data as { success: boolean, error?: string };

  if (!result.success) {
    return { error: result.error || "Failed to process income transaction" };
  }

  // Global revalidation
  revalidatePath("/dashboard", "layout");
  
  return { success: true };
}

export async function deleteIncome(incomeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // 1. Find the associated ledger log
  const { data: log, error: logError } = await supabase
    .from("ledger_logs")
    .select("id")
    .eq("source_id", incomeId)
    .eq("source_type", "income")
    .single();

  if (logError || !log) {
    return { error: "Audit trail not found for this income entry." };
  }

  // 2. Call the silent reversal RPC
  const { data, error } = await supabase.rpc("revert_ledger_log", {
    p_log_id: log.id,
    p_user_id: user.id
  });

  if (error) {
    console.error("Reversal Error:", error);
    return { error: error.message };
  }

  const result = data as { success: boolean, error?: string };
  if (!result.success) {
    return { error: result.error || "Failed to reverse income entry" };
  }

  revalidatePath("/dashboard", "layout");

  return { success: true };
}

