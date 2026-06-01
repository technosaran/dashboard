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
  try {
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
        p_user_id: user.id,
        p_source_id: asset.id,
        p_source_type: "alternative_asset"
      });
      if (accErr) console.error("Balance adjustment failed:", accErr);
    }

    revalidatePath("/dashboard/alternative-assets");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    return { success: true };
  } catch (err: any) {
    console.error("Error in addAlternativeAsset:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

type AlternativeAssetUpdate = {
  name?: string;
  category?: string;
  current_value?: number;
  notes?: string | null;
};

export async function updateAlternativeAsset(id: string, formData: AlternativeAssetUpdate) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("alternative_assets")
      .update({
        name: formData.name,
        category: formData.category,
        current_value: formData.current_value,
        notes: formData.notes
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/alternative-assets");
    return { success: true };
  } catch (err: any) {
    console.error("Error in updateAlternativeAsset:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

export async function deleteAlternativeAsset(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase.rpc("atomic_delete_entity", {
      p_user_id: user.id,
      p_entity_type: "alternative_asset",
      p_entity_id: id
    });

    if (error) return { error: error.message };
    const res = data as { success: boolean; error?: string } | null;
    if (!res?.success) return { error: res?.error || "Failed to delete asset atomically" };

    revalidatePath("/dashboard/alternative-assets");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteAlternativeAsset:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

export async function revertLedgerLog(logId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase.rpc("revert_ledger_log", {
      p_log_id: logId,
      p_user_id: user.id
    });

    if (error) return { error: error.message };
    
    revalidatePath("/dashboard/alternative-assets");
    revalidatePath("/dashboard/liabilities");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard/mutual-funds");
    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (err: any) {
    console.error("Error in revertLedgerLog:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}
