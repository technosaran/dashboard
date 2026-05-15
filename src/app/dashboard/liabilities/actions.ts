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
    if (accErr) console.error("Balance adjustment failed:", accErr);
  }

  revalidatePath("/dashboard/liabilities");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
  return { success: true };
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("liabilities")
    .update(formData)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/liabilities");
  return { success: true };
}

export async function deleteLiability(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("liabilities")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/liabilities");
  return { success: true };
}
