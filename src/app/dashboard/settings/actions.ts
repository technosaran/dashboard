
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type ResetUserDataResult = {
  success: boolean;
  error?: string | null;
};

export async function resetUserData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  // Fix: Call rpc on supabase directly to maintain 'this' context
  const { data, error } = await (supabase.rpc as any)("reset_user_data", { p_user_id: user.id });

  if (error) return { error: error.message };
  
  if (data && data.success === false) {
    return { error: data.error || "Database reset failed internally" };
  }
  
  // Revalidate all major paths
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/mutual-funds");
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard/family");
  
  return { success: true };
}
