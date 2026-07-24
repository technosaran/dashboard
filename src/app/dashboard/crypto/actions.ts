"use server";

import { createClient } from "@/lib/supabase-server";
import { getFriendlyErrorMessage } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

export type CryptoMarketData = {
  symbol: string;
  name: string;
  price: number;
  high24h: number;
  low24h: number;
  dayChange: number;
  dayChangePercent: number;
  quoteVolume24h: number;
  marketCap?: number;
  rank?: number;
};

// Map popular symbols to CoinGecko IDs for market cap mapping
const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  SUI: "sui",
  PEPE: "pepe",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
};

// ─── Fetch Single Ticker ─────────────────────────────────────────────────────
export async function fetchBinancePrice(symbol: string): Promise<{ price?: number; error?: string }> {
  const symbolUpper = symbol.toUpperCase().trim();
  
  // 1. Try Primary Binance Ticker API
  try {
    const formattedSymbol = symbolUpper + "USDT";
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${formattedSymbol}`, {
      next: { revalidate: 10 },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.price) return { price: parseFloat(data.price) };
    }
  } catch {
    // Continue to fallback
  }

  // 2. Fallback to CoinGecko Simple Price API
  try {
    const cgId = COINGECKO_ID_MAP[symbolUpper];
    if (cgId) {
      const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, {
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(4000)
      });
      if (cgRes.ok) {
        const cgData = await cgRes.json();
        if (cgData?.[cgId]?.usd) {
          return { price: parseFloat(cgData[cgId].usd) };
        }
      }
    }
  } catch {
    // Fallback failed
  }

  return { error: `Price for ${symbolUpper} could not be retrieved from primary or secondary crypto APIs.` };
}

// ─── Fetch Batch Tickers ─────────────────────────────────────────────────────
export async function fetchAllBinanceTickers(symbols: string[]): Promise<Record<string, Partial<CryptoMarketData>>> {
  try {
    if (symbols.length === 0) return {};
    
    // Batch ticker endpoint
    const symbolsParam = JSON.stringify(symbols.map(s => `${s.toUpperCase()}USDT`));
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`, {
      next: { revalidate: 10 }
    });
    
    if (!res.ok) {
      // Fallback: fetch individually if batch fails
      const map: Record<string, Partial<CryptoMarketData>> = {};
      for (const s of symbols) {
        const formatted = `${s.toUpperCase()}USDT`;
        const itemRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${formatted}`);
        if (itemRes.ok) {
          const data = await itemRes.json();
          map[s.toUpperCase()] = {
            symbol: s.toUpperCase(),
            price: parseFloat(data.lastPrice),
            high24h: parseFloat(data.highPrice),
            low24h: parseFloat(data.lowPrice),
            dayChange: parseFloat(data.priceChange),
            dayChangePercent: parseFloat(data.priceChangePercent),
            quoteVolume24h: parseFloat(data.quoteVolume),
          };
        }
      }
      return map;
    }

    const dataList = await res.json();
    const map: Record<string, Partial<CryptoMarketData>> = {};
    dataList.forEach((data: any) => {
      const baseSymbol = data.symbol.replace("USDT", "");
      map[baseSymbol] = {
        symbol: baseSymbol,
        price: parseFloat(data.lastPrice),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        dayChange: parseFloat(data.priceChange),
        dayChangePercent: parseFloat(data.priceChangePercent),
        quoteVolume24h: parseFloat(data.quoteVolume),
      };
    });
    return map;
  } catch (err) {
    console.error("Error in fetchAllBinanceTickers:", err);
    return {};
  }
}

// ─── Fetch CG market stats ───────────────────────────────────────────────────
export async function fetchCoinGeckoMarketData(symbols: string[]): Promise<Record<string, { marketCap: number; rank: number }>> {
  try {
    const ids = symbols.map(s => COINGECKO_ID_MAP[s.toUpperCase()]).filter(Boolean);
    if (ids.length === 0) return {};

    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}`, {
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!res.ok) return {};
    const dataList = await res.json();
    const map: Record<string, { marketCap: number; rank: number }> = {};
    
    dataList.forEach((coin: any) => {
      const entry = Object.entries(COINGECKO_ID_MAP).find(([_, id]) => id === coin.id);
      if (entry) {
        map[entry[0]] = {
          marketCap: coin.market_cap,
          rank: coin.market_cap_rank,
        };
      }
    });
    return map;
  } catch (err) {
    console.error("Error in fetchCoinGeckoMarketData:", err);
    return {};
  }
}

// ─── Global batch refresh action ─────────────────────────────────────────────
export async function refreshAllCryptoPrices(): Promise<{ marketData: Record<string, CryptoMarketData>; updated: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized", marketData: {}, updated: 0 };

    // Fetch all active crypto symbols held by user
    const { data: holdings } = await supabase
      .from("investments")
      .select("symbol, name, id")
      .eq("type", "crypto")
      .eq("user_id", user.id);

    if (!holdings || holdings.length === 0) {
      return { marketData: {}, updated: 0 };
    }

    const uniqueSymbols = Array.from(new Set(holdings.map(h => h.symbol).filter(Boolean))) as string[];

    // Fetch API data concurrently
    const [binanceMap, cgMap] = await Promise.all([
      fetchAllBinanceTickers(uniqueSymbols),
      fetchCoinGeckoMarketData(uniqueSymbols)
    ]);

    const resultMarketData: Record<string, CryptoMarketData> = {};
    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const holding of holdings) {
      if (!holding.symbol) continue;
      const symbolUpper = holding.symbol.toUpperCase();
      const apiData = binanceMap[symbolUpper];
      const cgData = cgMap[symbolUpper];

      if (apiData && apiData.price !== undefined) {
        const fullData: CryptoMarketData = {
          symbol: symbolUpper,
          name: holding.name,
          price: apiData.price,
          high24h: apiData.high24h || 0,
          low24h: apiData.low24h || 0,
          dayChange: apiData.dayChange || 0,
          dayChangePercent: apiData.dayChangePercent || 0,
          quoteVolume24h: apiData.quoteVolume24h || 0,
          marketCap: cgData?.marketCap,
          rank: cgData?.rank
        };
        resultMarketData[symbolUpper] = fullData;

        // Persist to database
        const prevClose = apiData.price - (apiData.dayChange || 0);
        await supabase
          .from("investments")
          .update({
            current_price: apiData.price,
            previous_close: prevClose,
            day_change: apiData.dayChange || 0,
            day_change_percent: apiData.dayChangePercent || 0,
            last_fetch_at: now,
            updated_at: now
          })
          .eq("id", holding.id);

        updatedCount++;
      }
    }

    revalidatePath("/dashboard/crypto");
    revalidatePath("/dashboard/investments");
    revalidatePath("/dashboard");
    return { marketData: resultMarketData, updated: updatedCount };
  } catch (err) {
    console.error("Error in refreshAllCryptoPrices:", err);
    return { error: err instanceof Error ? err.message : "Failed to refresh prices", marketData: {}, updated: 0 };
  }
}

// ─── CRUD Operations using RPC for Interconnection ───────────────────────────
export async function createCryptoHolding(data: {
  name: string;
  symbol: string;
  quantity: number;
  buy_price: number;
  current_price: number;
  notes?: string;
  bought_at?: string;
  deduct_account_id?: string;
  trade_type?: "buy" | "sell";
  charges?: number;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!data.name || data.name.trim().length === 0) return { error: "Coin name is required" };
    if (!data.quantity || data.quantity <= 0 || !Number.isFinite(data.quantity)) return { error: "Quantity must be a positive number" };
    if (!data.buy_price || data.buy_price <= 0 || !Number.isFinite(data.buy_price)) return { error: "Buy price must be a positive number" };
    if (!data.current_price || data.current_price <= 0 || !Number.isFinite(data.current_price)) return { error: "Current price must be a positive number" };

    const cleanAccountId = data.deduct_account_id && 
      data.deduct_account_id.trim().length > 0 && 
      data.deduct_account_id !== "null" && 
      data.deduct_account_id !== "undefined" 
        ? data.deduct_account_id 
        : null;

    const cleanSymbol = data.symbol.toUpperCase().trim();
    const cleanNotes = data.notes && data.notes.trim().length > 0 ? data.notes.trim() : null;
    const boughtDate = data.bought_at || new Date().toISOString().split("T")[0];
    const turnover = data.quantity * data.buy_price;
    const charges = data.charges || 0;
    const totalCost = data.trade_type === "sell" ? turnover - charges : turnover + charges;

    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: "record_investment",
      args: {
        p_user_id: string;
        p_name: string;
        p_type: "crypto";
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
    ) => Promise<{ data: { success: boolean; error?: string } | null; error: { message: string } | null }>;

    const { data: rpcRes, error: rpcErr } = await rpc("record_investment", {
      p_user_id: user.id,
      p_name: data.name.trim(),
      p_type: "crypto",
      p_symbol: cleanSymbol,
      p_quantity: data.quantity,
      p_buy_price: data.buy_price,
      p_current_price: data.current_price,
      p_currency: "USDT",
      p_notes: cleanNotes,
      p_date: boughtDate,
      p_account_id: cleanAccountId,
      p_total_cost: totalCost,
      p_trade_type: data.trade_type || "buy",
      p_charges: charges
    });

    if (rpcErr) return { error: rpcErr.message };
    if (!rpcRes?.success) return { error: rpcRes?.error || "Failed to record investment" };

    revalidatePath("/dashboard/investments");
    revalidatePath("/dashboard/crypto");
    revalidatePath("/dashboard");
    return { success: true, message: "Crypto Holding created successfully" };
  } catch (err) {
    console.error("Error in createCryptoHolding:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function updateCryptoHolding(id: string, data: {
  name: string;
  symbol: string;
  quantity: number;
  buy_price: number;
  current_price: number;
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
        name: data.name.trim(),
        symbol: data.symbol.toUpperCase().trim(),
        quantity: data.quantity,
        buy_price: data.buy_price,
        current_price: data.current_price,
        currency: "USDT",
        notes: data.notes || null,
        bought_at: data.bought_at || new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: getFriendlyErrorMessage(error) };

    revalidatePath("/dashboard/investments");
    revalidatePath("/dashboard/crypto");
    revalidatePath("/dashboard");
    return { success: true, message: "Crypto Holding updated successfully" };
  } catch (err) {
    console.error("Error in updateCryptoHolding:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function deleteCryptoHolding(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("investments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: getFriendlyErrorMessage(error) };

    revalidatePath("/dashboard/investments");
    revalidatePath("/dashboard/crypto");
    revalidatePath("/dashboard");
    return { success: true, message: "Crypto Holding deleted successfully" };
  } catch (err) {
    console.error("Error in deleteCryptoHolding:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

// ─── Search Crypto ───────────────────────────────────────────────────────────
export async function searchCrypto(query: string) {
  try {
    if (!query || query.length < 2) return [];
    const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.coins || []).slice(0, 10).map((c: any) => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      thumb: c.thumb
    }));
  } catch (err) {
    console.error("Error searching crypto:", err);
    return [];
  }
}
