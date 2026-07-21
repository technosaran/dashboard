"use server";

import { createClient } from "@/lib/supabase-server";
import { getFriendlyErrorMessage } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { parseToISODate } from "@/lib/utils";

export async function addIncome(formData: {
  description: string;
  amount: number;
  category: string;
  date: string;
  account_id?: string;
  is_recurring?: boolean;
  recurrence_frequency?: string;
  recurrence_day?: number;
  recurrence_end_date?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Input validation
    if (!formData.description || formData.description.trim().length === 0) {
      return { error: "Description is required" };
    }
    if (!formData.amount || formData.amount <= 0 || !Number.isFinite(formData.amount)) {
      return { error: "Amount must be a positive number" };
    }
    if (!formData.category || formData.category.trim().length === 0) {
      return { error: "Category is required" };
    }
    if (!formData.date) {
      return { error: "Date is required" };
    }

    const cleanDate = parseToISODate(formData.date);

    // Call the atomic record_income RPC function
    const { data, error } = await supabase.rpc("record_income", {
      p_user_id: user.id,
      p_description: formData.description,
      p_amount: formData.amount,
      p_category: formData.category,
      p_date: cleanDate,
      p_account_id: formData.account_id || undefined
    });

    if (error) {
      console.error("RPC Error:", error);
      return { error: error.message };
    }

    const result = data as { success: boolean, error?: string, income_id?: string } | null;
    if (!result) {
      return { error: "Failed to communicate with database" };
    }
    if (!result.success) {
      return { error: result.error || "Failed to process income transaction" };
    }

    // If marked as recurring, perform secondary update
    if (result.success && formData.is_recurring && result.income_id) {
      const { error: updateErr } = await supabase
        .from("incomes")
        .update({
          is_recurring: true,
          recurrence_frequency: formData.recurrence_frequency || "monthly",
          recurrence_day: formData.recurrence_day || 1,
          recurrence_end_date: formData.recurrence_end_date ? parseToISODate(formData.recurrence_end_date) : null
        })
        .eq("id", result.income_id);
      if (updateErr) {
        console.error("Failed to update income recurrence:", updateErr);
      }
    }

    // Global revalidation
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/income");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    
    return { success: true, message: "Income added successfully" };
  } catch (err) {
    console.error("Error in addIncome:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function deleteIncome(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // 1. Find the associated ledger log for this income
    const { data: logs, error: logErr } = await supabase
      .from("ledger_logs")
      .select("id")
      .eq("source_id", id)
      .eq("source_type", "income")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (logErr) {
      console.error("Error checking ledger logs for income deletion:", logErr);
    }

    // 2. If a ledger log is found, revert it (this also deletes the income atomically)
    if (logs && logs.length > 0) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("revert_ledger_log", {
        p_log_id: logs[0].id,
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
    } else {
      // 3. Fallback: if no ledger log found, delete directly from incomes table
      const { error: delErr } = await supabase
        .from("incomes")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (delErr) {
        console.error("Direct Delete Error:", delErr);
        return { error: delErr.message };
      }
    }

    // Global revalidation
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/income");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");

    return { success: true, message: "Income deleted successfully" };
  } catch (err) {
    console.error("Error in deleteIncome:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}
