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

export async function getStockDetails(symbol: string, exchange: string = "NSE") {
  if (!symbol) return { error: "Symbol is required" };

  try {
    let cleanQuery = symbol.trim().toUpperCase().split(".")[0];
    const MANUAL_MAPPINGS: Record<string, string> = { "HDFC": "HDFCBANK", "SBI": "SBIN" };
    if (MANUAL_MAPPINGS[cleanQuery]) cleanQuery = MANUAL_MAPPINGS[cleanQuery];

    const suffix = exchange === "BSE" ? ".BO" : ".NS";
    const ticker = cleanQuery.includes(".") ? cleanQuery : `${cleanQuery}${suffix}`;
    
    let lastErr: string | null = null;
    
    // Try multiple domains
    for (const domain of YAHOO_DOMAINS) {
      try {
        const url = `https://${domain}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const res = await fetchWithRetry(url);
        const data = await res.json();
        const result = data.chart.result?.[0];
        if (!result || !result.meta) continue;

        const meta = result.meta;
        const price = meta.regularMarketPrice;
        const prevClose = meta.previousClose || meta.chartPreviousClose || price;
        
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        return {
          name: meta.symbol.split(".")[0],
          price: price,
          previousClose: prevClose,
          dayChange: change,
          dayChangePercent: changePercent,
          currency: meta.currency || "INR",
          symbol: meta.symbol,
          exchange: meta.exchangeName || (meta.symbol.endsWith(".NS") ? "NSE" : "BSE"),
          marketState: meta.marketState || 'REGULAR'
        };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "Fetch failed";
      }
    }
    
    throw new Error(lastErr || `Market data unavailable for ${ticker}`);
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

  if (stocks.length === 0) return { success: true, results: [] };

  try {
    const symbols = stocks.map(s => {
      if (!s.symbol) return null;
      const suffix = s.symbol.endsWith(".BO") ? ".BO" : ".NS";
      return s.symbol.includes(".") ? s.symbol : `${s.symbol}${suffix}`;
    }).filter(Boolean).join(",");

    if (!symbols) return { success: true, results: [] };

    // Try multiple domains for the batch quote endpoint
    let data = null;
    let lastErr = null;

    for (const domain of YAHOO_DOMAINS) {
      try {
        const url = `https://${domain}/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
        const res = await fetchWithRetry(url);
        data = await res.json();
        if (data?.quoteResponse?.result) break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "Batch fetch failed";
      }
    }

    if (!data?.quoteResponse?.result) {
      throw new Error(lastErr || "Failed to fetch batch quotes from all available domains");
    }

    const quotes = data.quoteResponse.result;
    const results: { id: string; success?: boolean; error?: string }[] = [];

    interface YahooQuoteResult {
      symbol: string;
      regularMarketPrice: number;
      regularMarketPreviousClose?: number;
      marketState?: string;
    }

    // Atomic update for each stock
    await Promise.all(quotes.map(async (quote: YahooQuoteResult) => {
      const symbolBase = quote.symbol.split(".")[0];
      const matchingStock = stocks.find(s => s.symbol === symbolBase || s.symbol === quote.symbol);
      
      if (matchingStock) {
        const price = quote.regularMarketPrice;
        const prevClose = quote.regularMarketPreviousClose || price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        const { error: updateError } = await supabase
          .from("investments")
          .update({ 
            current_price: price, 
            previous_close: prevClose,
            day_change: change,
            day_change_percent: changePercent,
            market_state: quote.marketState,
            last_fetch_at: new Date().toISOString(),
            updated_at: new Date().toISOString() 
          })
          .eq("id", matchingStock.id);

        if (updateError) {
          results.push({ id: matchingStock.id, error: updateError.message });
        } else {
          results.push({ id: matchingStock.id, success: true });
        }
      }
    }));

    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard");
    return { success: true, results };
  } catch (error) {
    console.error("Batch refresh error:", error);
    return { error: error instanceof Error ? error.message : "Mass synchronization failed" };
  }
}
