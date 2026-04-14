
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

  const rpc = supabase.rpc as unknown as (
    fn: "reset_user_data",
    args: { p_user_id: string }
  ) => Promise<{ data: ResetUserDataResult | null; error: { message: string } | null }>;

  const { data, error } = await rpc("reset_user_data", { p_user_id: user.id });

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
