"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function upsertBudget(formData: {
  category: string;
  amount: number;
  period_month: number;
  period_year: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("budgets")
    .upsert([{ ...formData, user_id: user.id }], {
      onConflict: "user_id,category,period_month,period_year"
    });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/budget");
  return { success: true };
}

export async function deleteBudget(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/budget");
  return { success: true };
}
