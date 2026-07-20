"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type BondFormData = {
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
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Input validation
    if (!data.bond_name || data.bond_name.trim().length === 0) {
      return { error: "Bond name is required" };
    }
    if (!data.face_value || data.face_value <= 0) {
      return { error: "Face value must be positive" };
    }
    if (!data.quantity || data.quantity <= 0 || !Number.isInteger(data.quantity)) {
      return { error: "Quantity must be a positive integer" };
    }
    if (!data.purchase_price || data.purchase_price <= 0) {
      return { error: "Purchase price must be positive" };
    }
    if (data.coupon_rate < 0) {
      return { error: "Coupon rate cannot be negative" };
    }
    if (data.maturity_date && data.purchase_date && data.maturity_date < data.purchase_date) {
      return { error: "Maturity date must be after purchase date" };
    }

    // Harden input parameters to prevent empty string UUID database crashes
    const cleanAccountId = data.account_id && 
      data.account_id.trim().length > 0 && 
      data.account_id !== "null" && 
      data.account_id !== "undefined" 
        ? data.account_id 
        : null;

    // Use typed RPC to ensure transactional integrity
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: "record_bond_purchase",
      args: {
        p_user_id: string;
        p_bond_name: string;
        p_isin: string;
        p_issuer: string;
        p_bond_type: string;
        p_face_value: number;
        p_quantity: number;
        p_purchase_price: number;
        p_current_price: number;
        p_coupon_rate: number;
        p_ytm: number | null;
        p_purchase_date: string;
        p_maturity_date: string | null;
        p_next_interest_date: string | null;
        p_interest_frequency: string;
        p_credit_rating: string | null;
        p_platform: string;
        p_demat_account: string | null;
        p_account_id: string | null;
        p_notes: string | null;
      }
    ) => Promise<{ data: { success: boolean; error?: string } | null; error: { message: string } | null }>;

    const { data: rpcResult, error } = await rpc("record_bond_purchase", {
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
      p_ytm: data.ytm && !isNaN(data.ytm) ? data.ytm : null,
      p_purchase_date: data.purchase_date,
      p_maturity_date: data.maturity_date || data.purchase_date,
      p_next_interest_date: data.next_interest_date || null,
      p_interest_frequency: data.interest_frequency,
      p_credit_rating: data.credit_rating || null,
      p_platform: data.platform || "Wint",
      p_demat_account: data.demat_account || null,
      p_account_id: cleanAccountId,
      p_notes: data.notes || null,
    });

    if (error) return { error: error.message };

    const result = rpcResult as { success: boolean; error?: string } | null;
    if (!result) return { error: "Failed to communicate with database" };
    if (!result.success) return { error: result.error || "Failed to record bond purchase" };

    revalidatePath("/dashboard/bonds");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Error in createBond:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateBond(id: string, data: {
  bond_name?: string;
  isin?: string;
  issuer?: string;
  bond_type?: "Government" | "Corporate" | "Tax-Free" | "Infrastructure" | "PSU";
  face_value?: number;
  quantity?: number;
  purchase_price?: number;
  current_price?: number;
  coupon_rate?: number;
  ytm?: number;
  purchase_date?: string;
  maturity_date?: string;
  next_interest_date?: string;
  interest_frequency?: "Monthly" | "Quarterly" | "Semi-Annual" | "Annual";
  credit_rating?: string;
  platform?: string;
  notes?: string;
  accrued_interest?: number;
  total_interest_earned?: number;
  current_value?: number;
  total_invested?: number;
  status?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.bond_name !== undefined) payload.bond_name = data.bond_name;
    if (data.isin !== undefined) payload.isin = data.isin;
    if (data.issuer !== undefined) payload.issuer = data.issuer;
    if (data.bond_type !== undefined) payload.bond_type = data.bond_type;
    if (data.face_value !== undefined) payload.face_value = data.face_value;
    if (data.quantity !== undefined) payload.quantity = data.quantity;
    if (data.purchase_price !== undefined) payload.purchase_price = data.purchase_price;
    if (data.current_price !== undefined) payload.current_price = data.current_price;
    if (data.coupon_rate !== undefined) payload.coupon_rate = data.coupon_rate;
    if (data.ytm !== undefined) payload.ytm = data.ytm;
    if (data.purchase_date !== undefined) payload.purchase_date = data.purchase_date;
    if (data.maturity_date !== undefined) payload.maturity_date = data.maturity_date;
    if (data.next_interest_date !== undefined) payload.next_interest_date = data.next_interest_date || null;
    if (data.interest_frequency !== undefined) payload.interest_frequency = data.interest_frequency;
    if (data.credit_rating !== undefined) payload.credit_rating = data.credit_rating;
    if (data.platform !== undefined) payload.platform = data.platform;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (data.accrued_interest !== undefined) payload.accrued_interest = data.accrued_interest;
    if (data.total_interest_earned !== undefined) payload.total_interest_earned = data.total_interest_earned;
    if (data.current_value !== undefined) payload.current_value = data.current_value;
    if (data.total_invested !== undefined) payload.total_invested = data.total_invested;
    if (data.status !== undefined) payload.status = data.status;

    const { error } = await supabase
      .from("bonds")
      .update(payload as any)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/bonds");
    return { success: true };
  } catch (err) {
    console.error("Error in updateBond:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}


