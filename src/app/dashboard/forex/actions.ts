"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

// Self-healing bridge: automatically create a forex_accounts entry matching a standard account ID if it is missing
async function ensureForexAccount(supabase: any, forexAccountId: string, userId: string) {
  try {
    // Check if forex account exists
    const { data: existing } = await supabase
      .from("forex_accounts")
      .select("id")
      .eq("id", forexAccountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return { success: true };

    // If not, fetch standard account details
    const { data: stdAcc, error: fetchErr } = await supabase
      .from("accounts")
      .select("name, broker_name, currency, balance")
      .eq("id", forexAccountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr || !stdAcc) {
      return { error: "Standard account not found in system: " + (fetchErr?.message || "") };
    }

    // Insert into forex_accounts to satisfy foreign key constraints
    const { error: insertErr } = await supabase
      .from("forex_accounts")
      .insert({
        id: forexAccountId,
        user_id: userId,
        broker_name: stdAcc.broker_name || "Standard Broker",
        account_label: stdAcc.name,
        currency: stdAcc.currency || "USD",
        balance: stdAcc.balance || 0,
        total_deposited: stdAcc.balance || 0,
        total_withdrawn: 0,
        total_pnl: 0,
        notes: "Auto-linked from standard accounts"
      });

    if (insertErr) {
      return { error: "Failed to initialize forex link for standard account: " + insertErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to bridge standard account to forex accounts" };
  }
}

// Create a new forex broker account
export async function createForexAccount(data: {
  broker_name: string;
  account_label: string;
  account_number?: string;
  currency?: string;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase.from("forex_accounts").insert({
      user_id: user.id,
      broker_name: data.broker_name,
      account_label: data.account_label,
      account_number: data.account_number || null,
      currency: data.currency || "USD",
      notes: data.notes || null,
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/forex");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    console.error("Error in createForexAccount:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

// Deposit funds into forex account (optionally from a bank account)
export async function forexDeposit(data: {
  forex_account_id: string;
  bank_account_id?: string;
  amount: number;
  date?: string;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Ensure the forex account exists by bridging the standard account if needed
    const ensureRes = await ensureForexAccount(supabase, data.forex_account_id, user.id);
    if (ensureRes.error) return { error: ensureRes.error };

    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Deposit amount must be a positive number" };
    }

    const rpc = supabase.rpc as unknown as (
      fn: "forex_deposit",
      args: {
        p_user_id: string;
        p_forex_account_id: string;
        p_bank_account_id: string | null;
        p_amount: number;
        p_date: string;
        p_notes: string | null;
      }
    ) => Promise<{ data: { success: boolean; error?: string } | null; error: { message: string } | null }>;

    const { data: res, error } = await rpc("forex_deposit", {
      p_user_id: user.id,
      p_forex_account_id: data.forex_account_id,
      p_bank_account_id: data.bank_account_id || null,
      p_amount: data.amount,
      p_date: data.date || new Date().toISOString().split("T")[0],
      p_notes: data.notes || null,
    });

    if (error) return { error: error.message };
    const result = res as { success: boolean; error?: string } | null;
    if (!result) return { error: "Failed to communicate with database" };
    if (!result.success) return { error: result.error || "Deposit failed" };

    revalidatePath("/dashboard/forex");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    return { success: true };
  } catch (err: any) {
    console.error("Error in forexDeposit:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

// Withdraw funds from forex account (optionally to a bank account)
export async function forexWithdraw(data: {
  forex_account_id: string;
  bank_account_id?: string;
  amount: number;
  date?: string;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Ensure the forex account exists by bridging the standard account if needed
    const ensureRes = await ensureForexAccount(supabase, data.forex_account_id, user.id);
    if (ensureRes.error) return { error: ensureRes.error };

    if (!data.amount || data.amount <= 0 || !Number.isFinite(data.amount)) {
      return { error: "Withdrawal amount must be a positive number" };
    }

    const rpc = supabase.rpc as unknown as (
      fn: "forex_withdraw",
      args: {
        p_user_id: string;
        p_forex_account_id: string;
        p_bank_account_id: string | null;
        p_amount: number;
        p_date: string;
        p_notes: string | null;
      }
    ) => Promise<{ data: { success: boolean; error?: string } | null; error: { message: string } | null }>;

    const { data: res, error } = await rpc("forex_withdraw", {
      p_user_id: user.id,
      p_forex_account_id: data.forex_account_id,
      p_bank_account_id: data.bank_account_id || null,
      p_amount: data.amount,
      p_date: data.date || new Date().toISOString().split("T")[0],
      p_notes: data.notes || null,
    });

    if (error) return { error: error.message };
    const result = res as { success: boolean; error?: string } | null;
    if (!result) return { error: "Failed to communicate with database" };
    if (!result.success) return { error: result.error || "Withdrawal failed" };

    revalidatePath("/dashboard/forex");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/ledger");
    return { success: true };
  } catch (err: any) {
    console.error("Error in forexWithdraw:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

// Log a completed forex trade
export async function logForexTrade(data: {
  forex_account_id: string;
  pair: string;
  trade_type: "BUY" | "SELL";
  lot_size: number;
  pnl: number;
  trade_date?: string;
  entry_price?: number;
  exit_price?: number;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Ensure the forex account exists by bridging the standard account if needed
    const ensureRes = await ensureForexAccount(supabase, data.forex_account_id, user.id);
    if (ensureRes.error) return { error: ensureRes.error };

    // Input validation
    if (!data.pair || data.pair.trim().length === 0) {
      return { error: "Currency pair is required" };
    }
    if (!data.lot_size || data.lot_size <= 0 || !Number.isFinite(data.lot_size)) {
      return { error: "Lot size must be a positive number" };
    }
    if (!Number.isFinite(data.pnl)) {
      return { error: "P&L must be a valid number" };
    }

    const rpc = supabase.rpc as unknown as (
      fn: "forex_log_trade",
      args: {
        p_user_id: string;
        p_forex_account_id: string;
        p_pair: string;
        p_trade_type: string;
        p_lot_size: number;
        p_pnl: number;
        p_trade_date: string;
        p_entry_price: number | null;
        p_exit_price: number | null;
        p_notes: string | null;
      }
    ) => Promise<{ data: { success: boolean; error?: string } | null; error: { message: string } | null }>;

    const { data: res, error } = await rpc("forex_log_trade", {
      p_user_id: user.id,
      p_forex_account_id: data.forex_account_id,
      p_pair: data.pair,
      p_trade_type: data.trade_type,
      p_lot_size: data.lot_size,
      p_pnl: data.pnl,
      p_trade_date: data.trade_date || new Date().toISOString().split("T")[0],
      p_entry_price: data.entry_price || null,
      p_exit_price: data.exit_price || null,
      p_notes: data.notes || null,
    });

    if (error) return { error: error.message };
    const result = res as { success: boolean; error?: string } | null;
    if (!result) return { error: "Failed to communicate with database" };
    if (!result.success) return { error: result.error || "Trade log failed" };

    revalidatePath("/dashboard/forex");
    return { success: true };
  } catch (err: any) {
    console.error("Error in logForexTrade:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

// Delete a forex account
export async function deleteForexAccount(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase.rpc("atomic_delete_entity", {
      p_user_id: user.id,
      p_entity_type: "forex_account",
      p_entity_id: id
    });

    if (error) return { error: error.message };
    const res = data as { success: boolean; error?: string } | null;
    if (!res?.success) return { error: res?.error || "Failed to delete forex account atomically" };

    revalidatePath("/dashboard/forex");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteForexAccount:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

export async function updateForexAccount(id: string, data: {
  broker_name?: string;
  account_label?: string;
  account_number?: string;
  currency?: string;
  balance?: number;
  total_deposited?: number;
  total_withdrawn?: number;
  total_pnl?: number;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("forex_accounts")
      .update({ 
        broker_name: data.broker_name,
        account_label: data.account_label,
        account_number: data.account_number || null,
        currency: data.currency,
        balance: data.balance,
        total_deposited: data.total_deposited,
        total_withdrawn: data.total_withdrawn,
        total_pnl: data.total_pnl,
        notes: data.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/forex");
    return { success: true };
  } catch (err: any) {
    console.error("Error in updateForexAccount:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}

export async function updateForexTrade(id: string, data: {
  forex_account_id?: string;
  pair?: string;
  trade_type?: "BUY" | "SELL";
  lot_size?: number;
  pnl?: number;
  trade_date?: string;
  entry_price?: number;
  exit_price?: number;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (data.forex_account_id) {
      // Ensure the forex account exists by bridging the standard account if needed
      const ensureRes = await ensureForexAccount(supabase, data.forex_account_id, user.id);
      if (ensureRes.error) return { error: ensureRes.error };
    }

    const { error } = await supabase
      .from("forex_trades")
      .update({ 
        forex_account_id: data.forex_account_id,
        pair: data.pair,
        trade_type: data.trade_type,
        lot_size: data.lot_size,
        pnl: data.pnl,
        trade_date: data.trade_date,
        entry_price: data.entry_price || null,
        exit_price: data.exit_price || null,
        notes: data.notes || null
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/forex");
    return { success: true };
  } catch (err: any) {
    console.error("Error in updateForexTrade:", err);
    return { error: err?.message || "An unexpected error occurred" };
  }
}
