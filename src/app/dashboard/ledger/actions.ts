"use server";

import { createClient } from "@/lib/supabase-server";
import { getFriendlyErrorMessage } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

export async function revertLedgerTransaction(logId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Attempt to revert the ledger log atomically
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("revert_ledger_log", {
      p_log_id: logId,
      p_user_id: user.id
    });

    if (rpcErr) {
      console.error("RPC Revert Error:", rpcErr);
      return { error: rpcErr.message };
    }

    const result = rpcRes as { success: boolean; error?: string } | null;
    
    if (!result) {
      return { error: "Failed to revert transaction" };
    }
    
    if (!result.success) {
      return { error: result.error || "Failed to revert transaction" };
    }

    // Global revalidation
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/income");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/family");

    return { success: true, message: "Revert Ledger Transaction successful" };
  } catch (err) {
    console.error("Error in revertLedgerTransaction:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}
