"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function searchStocks(query: string, exchange: string = "NSE") {
  if (!query || query.length < 2) return [];
  try {
    const suffix = exchange === "BSE" ? ".BO" : ".NS";
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.quotes || [])
      .filter((q: any) => q.quoteType === "EQUITY" && q.symbol.endsWith(suffix))
      .map((q: any) => ({
        symbol: q.symbol.split(".")[0],
        fullSymbol: q.symbol,
        name: q.shortname || q.longname || q.name,
        exchange: q.exchange
      }));
  } catch (e) {
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

  const isBuy = data.trade_type !== "sell";
  const tradeDate = data.bought_at || new Date().toISOString().split("T")[0];
  const turnover = data.quantity * data.buy_price;
  const totalCost = data.total_cost_with_charges ?? turnover;
  const charges = Math.abs(totalCost - turnover);

  const { data: rpcRes, error: rpcErr } = await supabase.rpc("record_investment", {
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
  const result = rpcRes as { success: boolean; error?: string };
  if (!result.success) return { error: result.error || "Failed to record investment" };

  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/ledger");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getStockTrades() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data, error } = await supabase
    .from("stock_trades")
    .select("*")
    .eq("user_id", user.id)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { data };
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

export async function updateCurrentPrice(id: string, current_price: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("investments")
    .update({ current_price, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/stocks");
  return { success: true };
}

export async function getStockDetails(symbol: string, exchange: string = "NSE") {
  if (!symbol) return { error: "Symbol is required" };

  try {
    let cleanQuery = symbol.trim().toUpperCase().split(".")[0];
    const MANUAL_MAPPINGS: Record<string, string> = { "HDFC": "HDFCBANK", "SBI": "SBIN" };
    if (MANUAL_MAPPINGS[cleanQuery]) cleanQuery = MANUAL_MAPPINGS[cleanQuery];

    const suffix = exchange === "BSE" ? ".BO" : ".NS";
    const ticker = `${cleanQuery}${suffix}`;
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${cleanQuery}&quotesCount=10`;
    const searchRes = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!searchRes.ok) throw new Error("Search failed");
    const searchData = await searchRes.json();
    const quotes = searchData.quotes || [];
    
    let bestMatch = quotes.find((q: any) => q.symbol === ticker);
    if (!bestMatch) bestMatch = quotes.find((q: any) => q.symbol.split(".")[0] === cleanQuery && q.symbol.endsWith(suffix) && q.quoteType === "EQUITY");
    if (!bestMatch) bestMatch = quotes.find((q: any) => q.quoteType === "EQUITY" && q.symbol.endsWith(suffix));

    const finalTicker = bestMatch ? bestMatch.symbol : ticker;
    const finalName = bestMatch ? (bestMatch.shortname || bestMatch.longname) : cleanQuery;

    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(finalTicker)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Market data unavailable for ${finalTicker}`);
    const data = await res.json();
    const result = data.chart.result?.[0];
    if (!result || !result.meta) throw new Error("No market data in response");

    return {
      name: finalName || finalTicker.split(".")[0],
      price: result.meta.regularMarketPrice,
      previousClose: result.meta.previousClose,
      currency: "INR",
      symbol: finalTicker,
      exchange: result.meta.exchangeName || (finalTicker.endsWith(".NS") ? "NSE" : "BSE")
    };
  } catch (error: any) {
    return { error: `Not found on ${exchange}. Check symbol.` };
  }
}

export async function refreshAllPrices() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: stocks, error: fetchError } = await supabase.from("investments").select("id, symbol").eq("user_id", user.id).eq("type", "stock");
  if (fetchError || !stocks) return { error: fetchError?.message || "No stocks found" };

  const results = await Promise.all(stocks.map(async (stock) => {
    if (!stock.symbol) return { id: stock.id, error: "No symbol" };
    try {
      const exchange = stock.symbol.endsWith(".BO") ? "BSE" : "NSE";
      const res = await getStockDetails(stock.symbol, exchange);
      if ("error" in res || !res.price) return { id: stock.id, error: "Price not found" };
      await supabase.from("investments").update({ current_price: res.price, updated_at: new Date().toISOString() }).eq("id", stock.id);
      return { id: stock.id, success: true };
    } catch (e) {
      return { id: stock.id, error: "Fetch failed" };
    }
  }));

  revalidatePath("/dashboard/stocks");
  return { success: true, results };
}
