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

  try {
    // 1. Log basic trade history first to get an ID for source tracking
    const { data: trade, error: tradeErr } = await supabase
      .from("stock_trades")
      .insert({
        user_id: user.id,
        symbol: data.symbol || "",
        trade_type: data.trade_type || "buy",
        quantity: data.quantity,
        price: data.buy_price,
        charges: (data.total_cost_with_charges || 0) > 0 
          ? Math.abs((data.quantity * data.buy_price) - (data.total_cost_with_charges ?? 0)) 
          : 0,
        total_amount: data.total_cost_with_charges ?? (data.quantity * data.buy_price),
        exchange: data.symbol?.endsWith(".BO") ? "BSE" : "NSE",
        trade_date: tradeDate
      })
      .select()
      .single();

    if (tradeErr) return { error: tradeErr.message };

    // 2. Handle Fund Movement and Ledger (Manual instead of RPC for source tracking)
    if (data.deduct_account_id && data.total_cost_with_charges !== undefined) {
       const cost = data.total_cost_with_charges;
       const { data: account } = await supabase
         .from("accounts")
         .select("balance, name")
         .eq("id", data.deduct_account_id)
         .single();
       
       if (account) {
         const oldBalance = account.balance;
         const newBalance = isBuy ? oldBalance - cost : oldBalance + cost;
         
         // Update Account
         await supabase.from("accounts").update({ balance: newBalance }).eq("id", data.deduct_account_id);
         
         // Add Transaction Record
         await supabase.from("transactions").insert({
           user_id: user.id,
           account_id: data.deduct_account_id,
           description: `${isBuy ? "Purchase" : "Sale"}: ${data.name} (${data.symbol})`,
           amount: cost,
           type: isBuy ? "expense" : "income",
           category: "Investments",
           date: tradeDate
         });

         // Add Ledger Log with source_type 'stock_trade' for UNDO support
         await supabase.from("ledger_logs").insert({
           user_id: user.id,
           account_id: data.deduct_account_id,
           account_name: account.name,
           action_type: isBuy ? "ADJUST_DOWN" : "ADJUST_UP",
           amount: cost,
           previous_balance: oldBalance,
           new_balance: newBalance,
           details: `${isBuy ? "Bought" : "Sold"} ${data.quantity} units of ${data.symbol}`,
           source_id: trade.id,
           source_type: "stock_trade"
         });
       }
    }

    // 3. Update Investment (Holdings) + Realized P&L
    const { data: existing } = await supabase
      .from("investments")
      .select("*")
      .eq("user_id", user.id)
      .eq("symbol", data.symbol || "")
      .eq("type", "stock")
      .maybeSingle();

    if (existing) {
       let newQuantity = existing.quantity;
       let newAvgPrice = existing.buy_price;
       let newRealizedPnL = existing.realized_pnl || 0;

       if (isBuy) {
         const totalCost = (existing.quantity * existing.buy_price) + (data.quantity * data.buy_price);
         newQuantity = existing.quantity + data.quantity;
         newAvgPrice = Number((totalCost / newQuantity).toFixed(2));
       } else {
         newQuantity = Math.max(0, existing.quantity - data.quantity);
         // Book Realized P&L: (Sell Price - Current Avg Price) * Qty
         const profitOnTrade = (data.buy_price - existing.buy_price) * data.quantity;
         newRealizedPnL += profitOnTrade;
       }

       await supabase
         .from("investments")
         .update({
           quantity: newQuantity,
           buy_price: newAvgPrice,
           current_price: data.current_price,
           realized_pnl: newRealizedPnL,
           updated_at: new Date().toISOString(),
           notes: data.notes || existing.notes
         })
         .eq("id", existing.id);
    } else {
      await supabase
        .from("investments")
        .insert({
          user_id: user.id,
          name: data.name,
          type: "stock",
          symbol: data.symbol || null,
          quantity: data.quantity,
          buy_price: data.buy_price,
          current_price: data.current_price,
          currency: data.currency || "INR",
          notes: data.notes || null,
          bought_at: tradeDate,
        });
    }

    revalidatePath("/dashboard/stocks");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard");
    return { success: true };

  } catch (err: any) {
    return { error: err.message };
  }
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
    
    // Handle specific Indian market mergers/renames
    const MANUAL_MAPPINGS: Record<string, string> = {
      "HDFC": "HDFCBANK",
      "SBI": "SBIN",
      "M&M": "NSE:M&M", // Yahoo has trouble with &
    };

    if (MANUAL_MAPPINGS[cleanQuery]) {
      cleanQuery = MANUAL_MAPPINGS[cleanQuery];
    }

    const suffix = exchange === "BSE" ? ".BO" : ".NS";
    const ticker = `${cleanQuery}${suffix}`;
    
    // Step 1: Search for the query to find the best match on the selected exchange
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${cleanQuery}&quotesCount=10`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store"
    });

    if (!searchRes.ok) throw new Error("Search failed");
    const searchData = await searchRes.json();
    const quotes = searchData.quotes || [];
    
    // Stage 1: Absolute exact match for the ticker on the selected exchange
    let bestMatch = quotes.find((q: any) => q.symbol === ticker);

    // Stage 2: Match where the symbol prefix is exactly the query and on the correct exchange
    if (!bestMatch) {
      bestMatch = quotes.find((q: any) => 
        q.symbol.split(".")[0] === cleanQuery && q.symbol.endsWith(suffix) && q.quoteType === "EQUITY"
      );
    }

    // Stage 3: Broad equity match on the correct suffix
    if (!bestMatch) {
      bestMatch = quotes.find((q: any) => q.quoteType === "EQUITY" && q.symbol.endsWith(suffix));
    }

    const finalTicker = bestMatch ? bestMatch.symbol : ticker;
    const finalName = bestMatch ? (bestMatch.shortname || bestMatch.longname) : cleanQuery;

    return await fetchPriceOnly(finalTicker, finalName);

  } catch (error: any) {
    console.error("Stock Fetch Error:", error.message);
    return { error: `Not found on ${exchange}. Check the symbol.` };
  }
}

async function fetchPriceOnly(ticker: string, displayName?: string) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Yahoo API Error (${ticker}):`, res.status, text);
    throw new Error(`Market data unavailable for ${ticker}`);
  }

  const data = await res.json();
  const result = data.chart.result?.[0];

  if (!result || !result.meta) throw new Error("No market data in response");

  return {
    name: displayName || ticker.split(".")[0],
    price: result.meta.regularMarketPrice,
    previousClose: result.meta.previousClose,
    currency: "INR",
    symbol: ticker,
    exchange: result.meta.exchangeName || (ticker.endsWith(".NS") ? "NSE" : "BSE")
  };
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
      // Auto-detect exchange from symbol suffix
      const exchange = stock.symbol.endsWith(".BO") ? "BSE" : "NSE";
      const res = await getStockDetails(stock.symbol, exchange);
      
      if ("error" in res) {
        return { id: stock.id, error: res.error };
      }

      if (res.price) {
        await supabase
          .from("investments")
          .update({ current_price: res.price, updated_at: new Date().toISOString() })
          .eq("id", stock.id)
          .eq("user_id", user.id);
        return { id: stock.id, success: true };
      }
      
      return { id: stock.id, error: "Price not found" };
    } catch (e) {
      return { id: stock.id, error: "Fetch failed" };
    }
  }));

  revalidatePath("/dashboard/stocks");
  return { success: true, results };
}
