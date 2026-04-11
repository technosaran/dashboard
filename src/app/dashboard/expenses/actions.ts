"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function addExpense(formData: {
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

  // Call the atomic RPC function
  // This ensures that balance deduction, ledger logging, and expense recording
  // all happen or all fail (transactional integrity).
  const { data, error } = await supabase.rpc("record_expense", {
    p_user_id: user.id,
    p_description: formData.description,
    p_amount: formData.amount,
    p_category: formData.category,
    p_date: formData.date,
    p_account_id: formData.account_id || null
  });

  if (error) {
    console.error("RPC Error:", error);
    return { error: error.message };
  }

  const result = data as { success: boolean, error?: string };

  if (!result.success) {
    return { error: result.error || "Failed to process transaction" };
  }

  // Global revalidation
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/ledger");
  
  return { success: true };
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting expense:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/expenses");
  return { success: true };
}
