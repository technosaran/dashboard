"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function revertLog(logId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("revert_ledger_log", {
    p_log_id: logId,
    p_user_id: user.id
  });

  if (error) {
    console.error("Revert Error:", error);
    return { error: error.message };
  }

  const result = data as { success: boolean, error?: string };

  if (!result.success) {
    return { error: result.error || "Failed to revert transaction" };
  }

  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  
  return { success: true };
}
