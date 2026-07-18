"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function createAccount(data: {
  name: string;
  type: string;
  balance?: number;
  currency?: string;
  bank_name?: string | null;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: rpcData, error } = await supabase.rpc("create_account_atomic", {
      p_user_id: user.id,
      p_name: data.name,
      p_type: data.type,
      p_balance: data.balance ?? 0,
      p_currency: data.currency || 'INR',
      p_bank_name: data.bank_name || null
    });

    if (error) return { error: error.message };
    const result = rpcData as { success: boolean, error?: string } | null;
    if (!result) return { error: "Failed to communicate with database" };
    if (!result.success) return { error: result.error || "Failed to create account" };

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    console.error("Error in createAccount:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateAccount(id: string, data: Record<string, unknown>) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // SECURITY: Prevent direct balance manipulation via generic update
    const blockedFields = new Set(["balance", "user_id", "id", "created_at"]);
    const safeData = Object.fromEntries(
      Object.entries(data).filter(([key]) => !blockedFields.has(key))
    );

    const { error } = await supabase
      .from("accounts")
      .update(safeData)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    // Get account name for logging
    const { data: account } = await supabase
      .from("accounts")
      .select("name")
      .eq("id", id)
      .single();

    // Log update - awaited for integrity
    const allowedLogKeys = ["name", "type", "currency", "bank_name", "institution", "color", "account_number"];
    const changedFields = Object.keys(safeData).filter(k => allowedLogKeys.includes(k));
    const { error: logError } = await supabase.from("ledger_logs").insert({
      user_id: user.id,
      account_id: id,
      account_name: account?.name || "Account",
      action_type: "UPDATE",
      details: `Updated settings for ${account?.name || 'account'}: ${changedFields.join(", ") || "metadata"}`,
    });
    if (logError) console.error("Failed to log account update:", logError);

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    console.error("Error in updateAccount:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteAccount(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Unlink any transactions that reference this account to prevent foreign key constraint violations
    // We set the account_id to null instead of deleting the trades, preserving the user's portfolio history
    const unlinkResults = await Promise.all([
      supabase.from("forex_transactions").update({ bank_account_id: null }).eq("bank_account_id", id),
      supabase.from("bond_transactions").update({ account_id: null }).eq("account_id", id),
      supabase.from("mutual_fund_trades").update({ account_id: null }).eq("account_id", id),
    ]);
    const unlinkError = unlinkResults.find(r => r.error);
    if (unlinkError?.error) {
      console.error("Failed to unlink references:", unlinkError.error);
      return { error: `Failed to unlink references: ${unlinkError.error.message}` };
    }

    const { data: rpcData, error } = await supabase.rpc("delete_account_atomic_v2", {
      p_user_id: user.id,
      p_account_id: id
    });

    if (error) return { error: error.message };
    const result = rpcData as { success: boolean, error?: string } | null;
    if (!result) return { error: "Failed to communicate with database" };
    if (!result.success) return { error: result.error || "Failed to delete account" };

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    console.error("Error in deleteAccount:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function getAccounts() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err) {
    console.error("Error in getAccounts:", err);
    return { data: null, error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

type TransferData = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  note: string | null;
  converted_amount?: number;
};

export async function createTransfer(data: TransferData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Input validation
    if (!data.from_account_id || !data.to_account_id) {
      return { error: "Both source and destination accounts are required" };
    }
    if (data.from_account_id === data.to_account_id) {
      return { error: "Source and destination accounts must be different" };
    }
    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Transfer amount must be a positive number" };
    }

    // Fetch accounts to check currencies
    const { data: fromAccount, error: fromErr } = await supabase
      .from("accounts")
      .select("currency")
      .eq("id", data.from_account_id)
      .eq("user_id", user.id)
      .single();

    const { data: toAccount, error: toErr } = await supabase
      .from("accounts")
      .select("currency")
      .eq("id", data.to_account_id)
      .eq("user_id", user.id)
      .single();

    if (fromErr || toErr || !fromAccount || !toAccount) {
      return { error: "Failed to retrieve account details for verification" };
    }

    const isCrossCurrency = fromAccount.currency !== toAccount.currency;
    if (isCrossCurrency) {
      if (data.converted_amount === undefined || data.converted_amount <= 0 || !Number.isFinite(data.converted_amount)) {
        return { error: "Converted amount is required and must be a positive number for cross-currency transfers" };
      }
    }

    const { data: rpcData, error } = await supabase.rpc("process_transfer", {
      p_user_id: user.id,
      p_from_account_id: data.from_account_id,
      p_to_account_id: data.to_account_id,
      p_amount: data.amount,
      p_note: data.note || undefined,
      p_converted_amount: isCrossCurrency ? data.converted_amount : undefined
    });

    if (error) return { error: error.message };
    const result = rpcData as { success: boolean, error?: string } | null;
    if (!result) return { error: "Failed to execute transfer" };
    if (!result.success) return { error: result.error || "Transfer failed" };

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    console.error("Error in createTransfer:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function adjustBalance(id: string, amount: number, note: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Input validation
    if (!id) return { error: "Account ID is required" };
    if (!Number.isFinite(amount) || amount === 0) {
      return { error: "Adjustment amount must be a non-zero finite number" };
    }
    if (!note || note.trim().length === 0) {
      return { error: "A note is required for balance adjustments" };
    }

    const { data: rpcData, error } = await supabase.rpc("adjust_account_balance", {
      p_user_id: user.id,
      p_account_id: id,
      p_amount: amount,
      p_note: note
    });

    if (error) return { error: error.message };
    const result = rpcData as { success: boolean, error?: string } | null;
    if (!result) return { error: "Failed to adjust balance" };
    if (!result.success) return { error: result.error || "Adjustment failed" };

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    console.error("Error in adjustBalance:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
