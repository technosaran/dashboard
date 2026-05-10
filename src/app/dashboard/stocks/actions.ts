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
    .update({ ...data, type: "stock", updated_at: new Date().toISOString() })
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

  const { error } = await supabase
    .from("investments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard");
  return { success: true };
}



export async function getStockDetails(symbol: string, exchange: string = "NSE") {
  if (!symbol) return { error: "Symbol is required" };

  try {
    let cleanQuery = symbol.trim().toUpperCase().split(".")[0];
    const MANUAL_MAPPINGS: Record<string, string> = { "HDFC": "HDFCBANK", "SBI": "SBIN" };
    if (MANUAL_MAPPINGS[cleanQuery]) cleanQuery = MANUAL_MAPPINGS[cleanQuery];

    const suffix = exchange === "BSE" ? ".BO" : ".NS";
    const ticker = cleanQuery.includes(".") ? cleanQuery : `${cleanQuery}${suffix}`;
    
    // Use the v8 chart API which is quite stable
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, 
      cache: "no-store" 
    });
    
    if (!res.ok) throw new Error(`Market data unavailable for ${ticker}`);
    const data = await res.json();
    const result = data.chart.result?.[0];
    if (!result || !result.meta) throw new Error("No market data in response");

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose || price;
    
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      name: meta.symbol.split(".")[0], // Could fetch name from search if needed
      price: price,
      previousClose: prevClose,
      dayChange: change,
      dayChangePercent: changePercent,
      currency: meta.currency || "INR",
      symbol: meta.symbol,
      exchange: meta.exchangeName || (meta.symbol.endsWith(".NS") ? "NSE" : "BSE"),
      marketState: meta.marketState || 'REGULAR'
    };
  } catch (error) {
    console.error("Stock fetch error:", error instanceof Error ? error.message : "Internal Error");
    return { error: `Market data sync failed. Check symbol or try later.` };
  }
}

export async function refreshAllPrices() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: stocks, error: fetchError } = await supabase
    .from("investments")
    .select("id, symbol")
    .eq("user_id", user.id)
    .eq("type", "stock");

  if (fetchError || !stocks) return { error: fetchError?.message || "No stocks found" };

  const results = await Promise.all(stocks.map(async (stock) => {
    if (!stock.symbol) return { id: stock.id, error: "No symbol" };
    try {
      const exchange = stock.symbol.endsWith(".BO") ? "BSE" : "NSE";
      const res = await getStockDetails(stock.symbol, exchange);
      
      if ("error" in res || !res.price) return { id: stock.id, error: res.error || "Price not found" };
      
      const { error: updateError } = await supabase
        .from("investments")
        .update({ 
          current_price: res.price, 
          previous_close: res.previousClose,
          day_change: res.dayChange,
          day_change_percent: res.dayChangePercent,
          market_state: res.marketState,
          last_fetch_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq("id", stock.id);

      if (updateError) throw updateError;
      return { id: stock.id, success: true };
    } catch (e) {
      console.error(`Refresh error for ${stock.symbol}:`, e instanceof Error ? e.message : "Internal Error");
      return { id: stock.id, error: e instanceof Error ? e.message : "Fetch failed" };
    }
  }));

  revalidatePath("/dashboard/stocks");
  return { success: true, results };
}
