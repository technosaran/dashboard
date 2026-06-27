"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function addLiability(formData: {
  name: string;
  category: string;
  total_amount: number;
  remaining_amount: number;
  interest_rate?: number | null;
  monthly_payment?: number | null;
  due_date?: string | null;
  notes?: string | null;
  account_id?: string | null;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    // Use typed RPC cast for new atomic function (types will be auto-generated after migration deploys)
    type AtomicResult = { success: boolean; error?: string } | null;
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: "add_liability_atomic",
      args: {
        p_user_id: string;
        p_name: string;
        p_category: string;
        p_total_amount: number;
        p_remaining_amount: number;
        p_interest_rate: number | null;
        p_monthly_payment: number | null;
        p_due_date: string | null;
        p_notes: string | null;
        p_account_id: string | null;
      }
    ) => Promise<{ data: AtomicResult; error: { message: string } | null }>;

    // Use atomic RPC that handles insert + balance adjustment in a single transaction
    const { data: rpcData, error } = await rpc("add_liability_atomic", {
      p_user_id: user.id,
      p_name: formData.name,
      p_category: formData.category,
      p_total_amount: formData.total_amount,
      p_remaining_amount: formData.remaining_amount,
      p_interest_rate: formData.interest_rate || null,
      p_monthly_payment: formData.monthly_payment || null,
      p_due_date: formData.due_date || null,
      p_notes: formData.notes || null,
      p_account_id: formData.account_id || null
    });

    if (error) return { error: error.message };
    if (!rpcData?.success) return { error: rpcData?.error || "Failed to add liability" };

    revalidatePath("/dashboard/liabilities");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Error in addLiability:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

type LiabilityUpdate = {
  name?: string;
  category?: string;
  total_amount?: number;
  remaining_amount?: number;
  interest_rate?: number | null;
  monthly_payment?: number | null;
  due_date?: string | null;
  notes?: string | null;
};

export async function updateLiability(id: string, formData: LiabilityUpdate) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("liabilities")
      .update({
        name: formData.name,
        category: formData.category,
        total_amount: formData.total_amount,
        remaining_amount: formData.remaining_amount,
        interest_rate: formData.interest_rate,
        monthly_payment: formData.monthly_payment,
        due_date: formData.due_date,
        notes: formData.notes
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/liabilities");
    return { success: true };
  } catch (err) {
    console.error("Error in updateLiability:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteLiability(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase.rpc("atomic_delete_entity", {
      p_user_id: user.id,
      p_entity_type: "liability",
      p_entity_id: id
    });

    if (error) return { error: error.message };
    const res = data as { success: boolean; error?: string } | null;
    if (!res?.success) return { error: res?.error || "Failed to delete liability atomically" };

    revalidatePath("/dashboard/liabilities");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    return { success: true };
  } catch (err) {
    console.error("Error in deleteLiability:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
