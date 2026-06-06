"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function addLiability(formData: {
  name: string;
  category: string;
  total_amount: number;
  remaining_amount: number;
  interest_rate?: number;
  monthly_payment?: number;
  due_date?: string;
  notes?: string;
  account_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { account_id, ...liabilityData } = formData;

    const { data: liability, error: libErr } = await supabase
      .from("liabilities")
      .insert([{ ...liabilityData, user_id: user.id }])
      .select()
      .single();

    if (libErr) return { error: libErr.message };

    // Handle fund receipt if account provided
    if (account_id && formData.total_amount > 0) {
      const { error: accErr } = await supabase.rpc("adjust_account_balance", {
        p_account_id: account_id,
        p_amount: formData.total_amount, // Positive because it's a loan received
        p_note: `Loan Disbursement: ${formData.name}`,
        p_user_id: user.id,
        p_source_id: liability.id,
        p_source_type: "liability"
      });
      if (accErr) {
        console.error("Balance adjustment failed:", accErr);
        // Rollback: delete the liability record we just inserted to maintain ACID transactional integrity
        await supabase.from("liabilities").delete().eq("id", liability.id);
        return { error: `Failed to adjust account balance: ${accErr.message}` };
      }
    }

    revalidatePath("/dashboard/liabilities");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    return { success: true };
  } catch (err: any) {
    console.error("Error in addLiability:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

type LiabilityUpdate = {
  name?: string;
  category?: string;
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
  } catch (err: any) {
    console.error("Error in updateLiability:", err);
    return { error: err?.message || "An unexpected error occurred" };
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
  } catch (err: any) {
    console.error("Error in deleteLiability:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}
