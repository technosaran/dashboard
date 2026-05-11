
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function resetUserData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  const { data, error } = await supabase.rpc("reset_user_data", { p_user_id: user.id });

  if (error) {
    console.error("RPC Error:", error);
    return { error: error.message };
  }
  
  const result = data as { success: boolean; error?: string } | null;
  
  if (result && result.success === false) {
    return { error: result.error || "Database reset failed internally" };
  }
  
  // Revalidate all major paths
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/mutual-funds");
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard/family");
  revalidatePath("/dashboard/bonds");
  revalidatePath("/dashboard/alternative-assets");
  revalidatePath("/dashboard/liabilities");
  revalidatePath("/dashboard/forex");
  revalidatePath("/dashboard/budget");
  
  return { success: true };
}

export async function updateSettings(settings: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("profiles")
    .update({ settings })
    .eq("id", user.id);

  if (error) return { error: error.message };
  
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { success: true };
}
