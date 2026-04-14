
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function resetUserData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  const { data, error } = await supabase.rpc("reset_user_data" as any, { p_user_id: user.id });

  if (error) return { error: error.message };
  
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
