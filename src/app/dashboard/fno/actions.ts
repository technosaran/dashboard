"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function logFnoTrade(data: {
  symbol: string;
  instrument_type: "FUT" | "CE" | "PE";
  strike_price?: number;
  expiry_date: string;
  trade_type: "BUY" | "SELL";
  quantity: number;
  entry_price: number;
  account_id?: string;
  notes?: string;
  trade_date?: string;
  charges?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Validation
  if (!data.symbol || data.symbol.trim().length === 0) return { error: "Symbol is required" };
  if (!data.quantity || data.quantity <= 0) return { error: "Quantity must be positive" };
  if (data.entry_price < 0) return { error: "Entry price cannot be negative" };
  if (data.charges !== undefined && data.charges < 0) return { error: "Charges cannot be negative" };

  const cleanAccountId = data.account_id && data.account_id !== "null" && data.account_id !== "" ? data.account_id : null;
  const cleanStrike = data.instrument_type === "FUT" ? null : (data.strike_price || null);

  const { data: res, error } = await (supabase.rpc as unknown as <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }>)("fno_log_trade", {
    p_user_id: user.id,
    p_symbol: data.symbol.toUpperCase().trim(),
    p_instrument_type: data.instrument_type,
    p_strike_price: cleanStrike,
    p_expiry_date: data.expiry_date,
    p_trade_type: data.trade_type,
    p_quantity: data.quantity,
    p_entry_price: data.entry_price,
    p_account_id: cleanAccountId,
    p_notes: data.notes || null,
    p_trade_date: data.trade_date || new Date().toISOString().split("T")[0],
    p_charges: data.charges || 0
  });

  if (error) return { error: error.message };
  const typedRes = res as { success: boolean; error?: string };
  if (!typedRes?.success) return { error: typedRes?.error || "Failed to log trade" };

  revalidatePath("/dashboard/fno");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function closeFnoTrade(
  tradeId: string,
  data: {
    exit_price: number;
    close_date?: string;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  if (data.exit_price < 0) return { error: "Exit price cannot be negative" };

  const { data: res, error } = await (supabase.rpc as unknown as <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }>)("fno_close_position", {
    p_user_id: user.id,
    p_trade_id: tradeId,
    p_exit_price: data.exit_price,
    p_close_date: data.close_date || new Date().toISOString().split("T")[0]
  });

  if (error) return { error: error.message };
  const typedRes = res as { success: boolean; error?: string };
  if (!typedRes?.success) return { error: typedRes?.error || "Failed to close position" };

  revalidatePath("/dashboard/fno");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteFnoTrade(tradeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: res, error } = await (supabase.rpc as unknown as <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }>)("fno_delete_trade", {
    p_user_id: user.id,
    p_trade_id: tradeId
  });

  if (error) return { error: error.message };
  const typedRes = res as { success: boolean; error?: string };
  if (!typedRes?.success) return { error: typedRes?.error || "Failed to delete trade" };

  revalidatePath("/dashboard/fno");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}
