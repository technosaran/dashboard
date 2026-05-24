
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function resetUserData() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error("Auth retrieval error during reset:", authError);
      return { error: `Authentication failed: ${authError.message}` };
    }
    
    if (!user) {
      console.error("No active user session found for data reset.");
      return { error: "Unauthorized: No active session found. Please log in again." };
    }

    console.log(`Executing reset_user_data RPC for user: ${user.id}`);
    const { data, error } = await supabase.rpc("reset_user_data", { p_user_id: user.id });

    if (error) {
      console.error("reset_user_data RPC failed with error:", error);
      return { error: `Database error: ${error.message} (${error.code})` };
    }
    
    const result = data as Record<string, unknown> | null;
    
    if (result && result.success === false) {
      console.error("reset_user_data returned internal failure:", result.error);
      return { error: (result.error as string) || "Database reset failed internally." };
    }
    
    console.log("Database reset completed successfully. Revalidating Next.js cache paths...");
    
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Unhandled exception during resetUserData server action:", err);
    return { error: `System exception: ${err.message || "Unknown error"}` };
  }
}

type ProfileSettings = {
  enabled_modules?: string[];
  [key: string]: string | number | boolean | null | string[] | undefined;
};

export async function updateSettings(settings: ProfileSettings) {
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
