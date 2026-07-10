"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { parseToISODate } from "@/lib/utils";

type RecordInvestmentResult = {
  success: boolean;
  error?: string | null;
};

interface TickertapeStock {
  ticker: string;
  name: string;
  type: string;
}

interface YahooQuote {
  symbol: string;
  quoteType: string;
  shortname?: string;
  longname?: string;
}

interface YahooSearchResponse {
  quotes?: YahooQuote[];
}

interface TickertapeSearchResponse {
  data?: {
    stocks?: TickertapeStock[];
  };
}

export async function searchStocks(query: string, exchange: string = "NSE") {
  if (!query || query.length < 2) return [];
  try {
    const stocks: TickertapeStock[] = [];
    const seenTickers = new Set<string>();

    const addStocks = (list: { ticker: string; name: string; type: string }[]) => {
      for (const s of list) {
        if (!s.ticker) continue;
        const upperTicker = s.ticker.toUpperCase();
        if (!seenTickers.has(upperTicker)) {
          seenTickers.add(upperTicker);
          stocks.push({ ticker: upperTicker, name: s.name, type: s.type });
        }
      }
    };

    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    // 1. Try Tickertape (Stocks + ETFs)
    try {
      const url = `https://api.tickertape.in/search?text=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { "User-Agent": userAgent }, cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as TickertapeSearchResponse;
        const list = (data?.data?.stocks ?? [])
          .filter((q) => (q.type === "stock" || q.type === "etf") && q.ticker)
          .map((q) => ({ ticker: q.ticker, name: q.name, type: q.type }));
        addStocks(list);
      }
    } catch (e) {
      console.error("Tickertape search failed", e);
    }

    // 2. Try Yahoo Finance query2 (EQUITY + ETF)
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;
      const res = await fetch(url, { headers: { "User-Agent": userAgent }, cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as YahooSearchResponse;
        const list = (data?.quotes ?? [])
          .filter((q) => (q.quoteType === "EQUITY" || q.quoteType === "ETF") && (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO")))
          .map((q) => ({
            ticker: q.symbol.replace(".NS", "").replace(".BO", ""),
            name: q.shortname ?? q.longname ?? q.symbol,
            type: "stock",
          }));
        addStocks(list);
      }
    } catch (e) {
      console.error("Yahoo search failed", e);
    }

    // 3. Fallback to Yahoo query1
    if (stocks.length < 3) {
      try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;
        const res = await fetch(url, { headers: { "User-Agent": userAgent }, cache: "no-store" });
        if (res.ok) {
          const data = await res.json() as YahooSearchResponse;
          const list = (data?.quotes ?? [])
            .filter((q) => (q.quoteType === "EQUITY" || q.quoteType === "ETF") && (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO")))
            .map((q) => ({
              ticker: q.symbol.replace(".NS", "").replace(".BO", ""),
              name: q.shortname ?? q.longname ?? q.symbol,
              type: "stock",
            }));
          addStocks(list);
        }
      } catch (e) {
        console.error("Yahoo query1 search failed", e);
      }
    }

    // 4. Fallback to Groww Stocks API
    if (stocks.length < 3) {
      try {
        const url = `https://groww.in/v1/api/search/v3/query/global/st_p_query?page=0&query=${encodeURIComponent(query)}&size=10`;
        const res = await fetch(url, { headers: { "User-Agent": userAgent }, cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const items = data?.data?.content ?? [];
          const list = items
            .filter((q: any) => q.entity_type === "Stocks" && (q.nse_scrip_code || q.bse_scrip_code))
            .map((q: any) => ({
              ticker: q.nse_scrip_code || q.bse_scrip_code,
              name: q.title || q.company_short_name || q.ticker,
              type: "stock",
            }));
          addStocks(list);
        }
      } catch (e) {
        console.error("Groww stock search failed", e);
      }
    }

    return stocks
      .slice(0, 10)
      .map((q) => {
        const fullSymbol = exchange === "BSE" ? `${q.ticker}.BO` : `${q.ticker}.NS`;
        return {
          symbol: q.ticker,
          fullSymbol,
          name: q.name,
          exchange,
        };
      });
  } catch {
    return [];
  }
}

export async function fetchLiveStockPrice(symbol: string) {
  try {
    let querySymbol = symbol;
    if (querySymbol && !querySymbol.includes(".")) {
      querySymbol = `${querySymbol}.NS`;
    }
    let url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(querySymbol)}`;
    let res: Response | null = null;
    try {
      res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      if (!res.ok) {
        url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(querySymbol)}`;
        res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      }
    } catch {
      // Fallback
    }

    let price = null;
    let previousClose = null;
    if (res && res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      price = meta?.regularMarketPrice;
      previousClose = meta?.chartPreviousClose || meta?.previousClose;
    }

    if (price) {
      return { price: parseFloat(price), previousClose: previousClose ? parseFloat(previousClose) : undefined };
    }

    // Secondary Fallback API: Tickertape
    try {
      const rawSymbol = symbol.split(".")[0];
      const ttUrl = `https://api.tickertape.in/search?text=${encodeURIComponent(rawSymbol)}`;
      const ttRes = await fetch(ttUrl, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
      if (ttRes.ok) {
        const ttData = await ttRes.json();
        const matches = ttData?.data?.stocks ?? [];
        const matchedStock = matches.find(
          (s: any) => s.type === "stock" && s.ticker?.toUpperCase() === rawSymbol.toUpperCase()
        ) || matches[0];
        
        if (matchedStock?.quote) {
          const ttPrice = matchedStock.quote.price;
          const ttClose = matchedStock.quote.close;
          if (ttPrice !== undefined) {
            return {
              price: parseFloat(ttPrice),
              previousClose: ttClose !== undefined ? parseFloat(ttClose) : undefined
            };
          }
        }
      }
    } catch (e) {
      console.error("Tickertape fallback price fetch failed", e);
    }
    return null;
  } catch {
    return null;
  }
}

export async function createInvestment(data: {
  name: string; symbol?: string; quantity: number;
  buy_price: number; current_price: number; currency?: string;
  notes?: string; bought_at?: string;
  deduct_account_id?: string; total_cost_with_charges?: number;
  trade_type?: "buy" | "sell";
}) {
  try {
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

    const rpc = supabase.rpc.bind(supabase) as unknown as (
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
  } catch (err) {
    console.error("Error in createInvestment:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}



export async function updateInvestment(id: string, data: {
  name?: string;
  symbol?: string;
  quantity?: number;
  buy_price?: number;
  current_price?: number;
  previous_close?: number;
  currency?: string;
  notes?: string;
  bought_at?: string;
}) {
  try {
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
        previous_close: data.previous_close,
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
  } catch (err) {
    console.error("Error in updateInvestment:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteInvestment(id: string) {
  try {
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
  } catch (err) {
    console.error("Error in deleteInvestment:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
