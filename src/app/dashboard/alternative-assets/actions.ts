"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function addAlternativeAsset(formData: {
  name: string;
  category: string;
  purchase_price: number;
  current_value: number;
  purchase_date?: string;
  notes?: string;
  account_id?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { account_id, ...assetData } = formData;

  // Insert the asset
  const { data: asset, error: assetErr } = await supabase
    .from("alternative_assets")
    .insert([{ ...assetData, user_id: user.id }])
    .select()
    .single();

  if (assetErr) return { error: assetErr.message };

  // Handle account deduction if provided
  if (account_id && formData.purchase_price > 0) {
    const { error: accErr } = await supabase.rpc("adjust_account_balance", {
      p_account_id: account_id,
      p_amount: -formData.purchase_price,
      p_note: `Asset Purchase: ${formData.name}`,
      p_user_id: user.id
    });
    if (accErr) console.error("Balance adjustment failed:", accErr);
  }

  revalidatePath("/dashboard/alternative-assets");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
  return { success: true };
}

export async function updateAlternativeAsset(id: string, formData: any) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("alternative_assets")
    .update(formData)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/alternative-assets");
  return { success: true };
}

export async function deleteAlternativeAsset(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("alternative_assets")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/alternative-assets");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function revertLedgerLog(logId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data, error } = await supabase.rpc("revert_ledger_log", {
    p_log_id: logId,
    p_user_id: user.id
  });

  if (error) return { error: error.message };
  
  revalidatePath("/dashboard/alternative-assets");
  revalidatePath("/dashboard/liabilities");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  
  return { success: true };
}
