"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type BondFormData = {
  bond_name: string;
  isin: string;
  issuer: string;
  bond_type: "Government" | "Corporate" | "Tax-Free" | "Infrastructure" | "PSU";
  face_value: number;
  quantity: number;
  purchase_price: number;
  current_price: number;
  coupon_rate: number;
  ytm?: number;
  purchase_date: string;
  maturity_date: string;
  next_interest_date?: string;
  interest_frequency: "Monthly" | "Quarterly" | "Semi-Annual" | "Annual";
  credit_rating?: string;
  platform?: string;
  demat_account?: string;
  account_id?: string;
  notes?: string;
};

export async function createBond(data: BondFormData) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Use atomic RPC to ensure transactional integrity
  const { data: rpcResult, error } = await supabase.rpc("record_bond_purchase" as any, {
    p_user_id: user.id,
    p_bond_name: data.bond_name,
    p_isin: data.isin,
    p_issuer: data.issuer,
    p_bond_type: data.bond_type,
    p_face_value: data.face_value,
    p_quantity: data.quantity,
    p_purchase_price: data.purchase_price,
    p_current_price: data.current_price || data.purchase_price,
    p_coupon_rate: data.coupon_rate,
    p_ytm: data.ytm || null,
    p_purchase_date: data.purchase_date,
    p_maturity_date: data.maturity_date || null,
    p_next_interest_date: data.next_interest_date || null,
    p_interest_frequency: data.interest_frequency,
    p_credit_rating: data.credit_rating || null,
    p_platform: data.platform || "Wint",
    p_demat_account: data.demat_account || null,
    p_account_id: data.account_id || null,
    p_notes: data.notes || null,
  });

  if (error) return { error: error.message };

  const result = rpcResult as { success: boolean; error?: string };
  if (!result.success) return { error: result.error || "Failed to record bond purchase" };

  revalidatePath("/dashboard/bonds");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateBond(bondId: string, data: Partial<BondFormData>) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const updateData: Record<string, unknown> = { ...data };
  
  if (data.purchase_price && data.quantity) {
    updateData.total_invested = data.purchase_price * data.quantity;
  }
  
  if (data.current_price && data.quantity) {
    updateData.current_value = data.current_price * data.quantity;
  }

  const { error } = await supabase
    .from("bonds")
    .update(updateData)
    .eq("id", bondId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/bonds");
  return { success: true };
}

export async function deleteBond(bondId: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("bonds")
    .delete()
    .eq("id", bondId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/bonds");
  return { success: true };
}

export async function recordInterestPayment(bondId: string, data: {
  amount: number;
  payment_date: string;
  period_start: string;
  period_end: string;
  account_id?: string;
}) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Use atomic RPC for interest payment
  const { data: rpcResult, error } = await supabase.rpc("record_bond_interest" as any, {
    p_user_id: user.id,
    p_bond_id: bondId,
    p_amount: data.amount,
    p_payment_date: data.payment_date,
    p_period_start: data.period_start,
    p_period_end: data.period_end,
    p_account_id: data.account_id || null,
  });

  if (error) return { error: error.message };

  const result = rpcResult as { success: boolean; error?: string };
  if (!result.success) return { error: result.error || "Failed to record interest" };

  revalidatePath("/dashboard/bonds");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/ledger");
  return { success: true };
}

// Bond price fetching is not yet integrated with a real API.
// This function is intentionally disabled to prevent overwriting real data with mock values.
export async function fetchBondPrice(_isin: string) {
  // TODO: Integrate with Wint API, Goldenpi, or other bond data provider
  return {
    error: "Bond price API not yet integrated. Please update prices manually.",
  };
}

// Auto-refresh bond prices - DISABLED until real API integration
export async function refreshBondPrices() {
  return {
    error: "Bond price refresh requires API integration. Prices must be updated manually for now.",
  };
}
