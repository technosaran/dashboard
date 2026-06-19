"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function upsertBudget(formData: {
  category: string;
  amount: number;
  period_month: number;
  period_year: number;
}) {
  try {
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
  } catch (err) {
    console.error("Error in upsertBudget:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteBudget(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase.rpc("atomic_delete_entity", {
      p_user_id: user.id,
      p_entity_type: "budget",
      p_entity_id: id
    });

    if (error) return { error: error.message };
    const res = data as { success: boolean; error?: string } | null;
    if (!res?.success) return { error: res?.error || "Failed to delete budget atomically" };

    revalidatePath("/dashboard/budget");
    return { success: true };
  } catch (err) {
    console.error("Error in deleteBudget:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
