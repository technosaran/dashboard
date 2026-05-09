
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function resetUserData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  // Use typed RPC call pattern consistent with other action files
  const rpc = supabase.rpc as unknown as (
    fn: "reset_user_data",
    args: { p_user_id: string }
  ) => Promise<{ data: { success: boolean; error?: string } | null; error: { message: string } | null }>;

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
