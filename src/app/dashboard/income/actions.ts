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

