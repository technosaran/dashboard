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

    // Use typed RPC cast for new atomic function (types will be auto-generated after migration deploys)
    type AtomicResult = { success: boolean; error?: string } | null;
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: "add_alternative_asset_atomic",
      args: {
        p_user_id: string;
        p_name: string;
        p_category: string;
        p_purchase_price: number;
        p_current_value: number;
        p_purchase_date: string | null;
        p_notes: string | null;
        p_account_id: string | null;
      }
    ) => Promise<{ data: AtomicResult; error: { message: string } | null }>;

    // Use atomic RPC that handles insert + balance adjustment in a single transaction
    const { data: rpcData, error } = await rpc("add_alternative_asset_atomic", {
      p_user_id: user.id,
      p_name: formData.name,
      p_category: formData.category,
      p_purchase_price: formData.purchase_price,
      p_current_value: formData.current_value,
      p_purchase_date: formData.purchase_date || null,
      p_notes: formData.notes || null,
      p_account_id: formData.account_id || null
    });

    if (error) return { error: error.message };
    if (!rpcData?.success) return { error: rpcData?.error || "Failed to add alternative asset" };

    revalidatePath("/dashboard/alternative-assets");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Error in addAlternativeAsset:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

type AlternativeAssetUpdate = {
  name?: string;
  category?: string;
  purchase_price?: number;
  current_value?: number;
  purchase_date?: string;
  notes?: string | null;
};

export async function updateAlternativeAsset(id: string, formData: AlternativeAssetUpdate) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const payload: Record<string, unknown> = {};
    if (formData.name !== undefined) payload.name = formData.name;
    if (formData.category !== undefined) payload.category = formData.category;
    if (formData.purchase_price !== undefined) payload.purchase_price = formData.purchase_price;
    if (formData.current_value !== undefined) payload.current_value = formData.current_value;
    if (formData.purchase_date !== undefined) payload.purchase_date = formData.purchase_date;
    if (formData.notes !== undefined) payload.notes = formData.notes;

    const { error } = await supabase
      .from("alternative_assets")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/alternative-assets");
    return { success: true };
  } catch (err) {
    console.error("Error in updateAlternativeAsset:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
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
  } catch (err) {
    console.error("Error in deleteAlternativeAsset:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
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
  } catch (err) {
    console.error("Error in revertLedgerLog:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
