"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { revertLedgerLog as revertAction } from "../alternative-assets/actions";

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

  const tradeDate = data.bought_at || new Date().toISOString().split("T")[0];
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
    p_symbol: data.symbol || "",
    p_quantity: data.quantity,
    p_buy_price: data.buy_price,
    p_current_price: data.current_price,
    p_currency: data.currency || "INR",
    p_notes: data.notes || null,
    p_date: tradeDate,
    p_account_id: data.deduct_account_id || null,
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
  current_price?: number;
  currency?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Note: quantity, buy_price, and bought_at cannot be updated directly as they are tied to ledger logs.
  // To change those, the user must revert the ledger log and re-enter the investment.
  const { error } = await supabase
    .from("investments")
    .update({ 
      name: data.name,
      symbol: data.symbol,
      current_price: data.current_price,
      currency: data.currency,
      notes: data.notes,
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




const YAHOO_DOMAINS = [
  "query2.finance.yahoo.com",
  "query1.finance.yahoo.com",
  "query.yahooapis.com"
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0"
];

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const res = await fetch(url, {
        headers: { 
          "User-Agent": userAgent,
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        cache: "no-store",
        next: { revalidate: 0 }
      });
      
      if (res.ok) return res;
      
      if (res.status === 429) {
        // Linear backoff with jitter
        const wait = 1000 * (i + 1) + Math.random() * 500;
        await new Promise(r => setTimeout(r, wait));
      } else if (res.status >= 500) {
        await new Promise(r => setTimeout(r, 500));
      } else {
        throw new Error(`HTTP Error ${res.status}`);
      }
    } catch (e) {
      lastError = e as Error;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

export async function getStockDetails(symbol: string, exchange: string = "NSE"): Promise<{ error: string } | { name: string; price: number; currency: string }> {
  return { error: "Real-time sync is disabled. Enter current price manually." };
}

export async function refreshAllPrices(): Promise<{ success: boolean; error?: string; results?: any[] }> {
  return { success: true, results: [] };
}
