"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { revertLedgerLog as revertAction } from "../alternative-assets/actions";
import { parseToISODate } from "@/lib/utils";

export async function revertLedgerLog(logId: string) {
  return await revertAction(logId);
}

type RecordInvestmentResult = {
  success: boolean;
  error?: string | null;
};

export async function searchStocks(query: string, exchange: string = "NSE") {
  if (!query || query.length < 2) return [];
  try {
    const suffix = exchange === "BSE" ? ".BO" : ".NS";
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    
    interface YahooQuote {
      quoteType: string;
      symbol: string;
      shortname?: string;
      longname?: string;
      name?: string;
      exchange: string;
    }

    return (data.quotes as YahooQuote[] || [])
      .filter((q) => q.quoteType === "EQUITY" && q.symbol.endsWith(suffix))
      .map((q) => ({
        symbol: q.symbol.split(".")[0],
        fullSymbol: q.symbol,
        name: q.shortname || q.longname || q.name,
        exchange: q.exchange
      }));
  } catch {
    return [];
  }
}

export async function createInvestment(data: {
  name: string; symbol?: string; quantity: number;
  buy_price: number; current_price: number; currency?: string;
  notes?: string; bought_at?: string;
  deduct_account_id?: string; total_cost_with_charges?: number;
  trade_type?: "buy" | "sell";
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Input validation
  if (!data.name || data.name.trim().length === 0) {
    return { error: "Stock name is required" };
  }
  if (!data.quantity || data.quantity <= 0 || !Number.isFinite(data.quantity)) {
    return { error: "Quantity must be a positive number" };
  }
  if (!data.buy_price || data.buy_price <= 0 || !Number.isFinite(data.buy_price)) {
    return { error: "Buy price must be a positive number" };
  }
  if (!data.current_price || data.current_price <= 0 || !Number.isFinite(data.current_price)) {
    return { error: "Current price must be a positive number" };
  }

  // Harden input parameters to prevent empty string UUID and null string database crashes
  const cleanAccountId = data.deduct_account_id && 
    data.deduct_account_id.trim().length > 0 && 
    data.deduct_account_id !== "null" && 
    data.deduct_account_id !== "undefined" 
      ? data.deduct_account_id 
      : null;

  const cleanSymbol = data.symbol && data.symbol.trim().length > 0 ? data.symbol.trim() : "";
  const cleanNotes = data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null;

  const tradeDate = parseToISODate(data.bought_at);
  const turnover = data.quantity * data.buy_price;
  const totalCost = data.total_cost_with_charges ?? turnover;
  const charges = Math.abs(totalCost - turnover);

  const rpc = supabase.rpc as unknown as (
    fn: "record_investment",
    args: {
      p_user_id: string;
      p_name: string;
      p_type: "stock";
      p_symbol: string;
      p_quantity: number;
      p_buy_price: number;
      p_current_price: number;
      p_currency: string;
      p_notes: string | null;
      p_date: string;
      p_account_id: string | null;
      p_total_cost: number;
      p_trade_type: "buy" | "sell";
      p_charges: number;
    }
  ) => Promise<{ data: RecordInvestmentResult | null; error: { message: string } | null }>;

  const { data: rpcRes, error: rpcErr } = await rpc("record_investment", {
    p_user_id: user.id,
    p_name: data.name,
    p_type: "stock",
    p_symbol: cleanSymbol,
    p_quantity: data.quantity,
    p_buy_price: data.buy_price,
    p_current_price: data.current_price,
    p_currency: data.currency || "INR",
    p_notes: cleanNotes,
    p_date: tradeDate,
    p_account_id: cleanAccountId,
    p_total_cost: totalCost,
    p_trade_type: data.trade_type || "buy",
    p_charges: charges
  });

  if (rpcErr) return { error: rpcErr.message };
  if (!rpcRes?.success) return { error: rpcRes?.error || "Failed to record investment" };

  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard");
  return { success: true };
}



export async function updateInvestment(id: string, data: {
  name?: string;
  symbol?: string;
  quantity?: number;
  buy_price?: number;
  current_price?: number;
  currency?: string;
  notes?: string;
  bought_at?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("investments")
    .update({ 
      name: data.name,
      symbol: data.symbol,
      quantity: data.quantity,
      buy_price: data.buy_price,
      current_price: data.current_price,
      currency: data.currency,
      notes: data.notes,
      bought_at: data.bought_at,
      type: "stock", 
      updated_at: new Date().toISOString() 
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/stocks");
  return { success: true };
}

export async function deleteInvestment(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data, error } = await supabase.rpc("atomic_delete_entity", {
    p_user_id: user.id,
    p_entity_type: "investment",
    p_entity_id: id
  });

  if (error) return { error: error.message };
  const res = data as { success: boolean; error?: string };
  if (!res?.success) return { error: res?.error || "Failed to delete investment atomically" };

  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}




export async function getStockDetails(symbol: string, _exchange: string = "NSE"): Promise<{ error: string } | { name: string; price: number; currency: string }> {
  return { error: "Real-time sync is disabled. Enter current price manually." };
}

export async function refreshAllPrices(): Promise<{ success: boolean; error?: string; results?: unknown[] }> {
  return { success: true, results: [] };
}
