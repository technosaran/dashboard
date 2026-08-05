import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { syncAllMutualFundPrices } from "@/lib/sync-mf";
import { syncAllCryptoPrices } from "@/lib/sync-crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow 60 seconds execution time

/**
 * Helper to get Service Supabase Client (bypasses RLS for cron background jobs)
 */
function getCronSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable for cron execution.");
  }
  return createClient<Database>(supabaseUrl, serviceKey);
}

/**
 * Fetch and parse AMFI Mutual Fund NAV text file
 */
async function fetchAMFINavMap(): Promise<Map<string, { nav: number; date: string }>> {
  const navMap = new Map<string, { nav: number; date: string }>();
  try {
    const res = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return navMap;

    const text = await res.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const parts = line.trim().split(";");
      if (parts.length >= 6) {
        const schemeCode = parts[0]?.trim();
        const navStr = parts[4]?.trim();
        const dateStr = parts[5]?.trim();

        if (schemeCode && navStr) {
          const nav = parseFloat(navStr);
          if (!isNaN(nav) && nav > 0) {
            navMap.set(schemeCode, { nav, date: dateStr || new Date().toISOString() });
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch AMFI NAV file:", err);
  }
  return navMap;
}

/**
 * Fetch live stock price from Yahoo Finance
 */
async function fetchStockQuote(symbol: string): Promise<{ currentPrice: number; previousClose: number } | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const candidates = [
    cleanSymbol.includes(".") ? cleanSymbol : `${cleanSymbol}.NS`,
    cleanSymbol.includes(".") ? cleanSymbol : `${cleanSymbol}.BO`,
    cleanSymbol,
  ];

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

  for (const sym of candidates) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta && typeof meta.regularMarketPrice === "number") {
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
          return { currentPrice, previousClose };
        }
      }
    } catch {
      // Continue to next symbol candidate
    }
  }
  return null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Optional cron secret verification if set
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    if (querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }
  }

  try {
    const supabase = getCronSupabaseClient();
    const nowIso = new Date().toISOString();

    // -------------------------------------------------------------
    // 1. UPDATE MUTUAL FUNDS NAVs
    // -------------------------------------------------------------
    let mfUpdatedCount = 0;
    const amfiMap = await fetchAMFINavMap();

    const { data: mutualFunds, error: mfError } = await supabase
      .from("mutual_funds")
      .select("*");

    if (!mfError && mutualFunds && mutualFunds.length > 0) {
      for (const fund of mutualFunds) {
        const schemeCode = fund.scheme_code?.trim();
        if (schemeCode && amfiMap.has(schemeCode)) {
          const amfiData = amfiMap.get(schemeCode)!;
          const newNav = amfiData.nav;
          const oldNav = fund.current_nav || fund.avg_nav;

          const dayChange = newNav - oldNav;
          const dayChangePct = oldNav > 0 ? (dayChange / oldNav) * 100 : 0;

          const { error: updateErr } = await supabase
            .from("mutual_funds")
            .update({
              previous_nav: oldNav,
              current_nav: newNav,
              day_change: Number(dayChange.toFixed(4)),
              day_change_percent: Number(dayChangePct.toFixed(2)),
              last_nav_updated_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", fund.id);

          if (!updateErr) mfUpdatedCount++;
        }
      }
    }

    // -------------------------------------------------------------
    // 2. UPDATE STOCKS & INVESTMENT PRICES
    // -------------------------------------------------------------
    let stockUpdatedCount = 0;

    const { data: investments, error: invError } = await supabase
      .from("investments")
      .select("*")
      .eq("type", "stock");

    if (!invError && investments && investments.length > 0) {
      for (const inv of investments) {
        const symbol = inv.symbol || inv.name;
        if (symbol) {
          const quote = await fetchStockQuote(symbol);
          if (quote) {
            const dayChange = quote.currentPrice - quote.previousClose;
            const dayChangePct = quote.previousClose > 0 ? (dayChange / quote.previousClose) * 100 : 0;

            const { error: updateErr } = await supabase
              .from("investments")
              .update({
                previous_close: quote.previousClose,
                current_price: quote.currentPrice,
                day_change: Number(dayChange.toFixed(4)),
                day_change_percent: Number(dayChangePct.toFixed(2)),
                last_fetch_at: nowIso,
                updated_at: nowIso,
              })
              .eq("id", inv.id);

            if (!updateErr) stockUpdatedCount++;
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 3. UPDATE CRYPTO & ASSET INVESTMENTS
    // -------------------------------------------------------------
    const cryptoSyncRes = await syncAllCryptoPrices();
    const mfSyncRes = await syncAllMutualFundPrices();

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
      mutualFundsUpdated: mfUpdatedCount + (mfSyncRes.updatedCount || 0),
      stocksUpdated: stockUpdatedCount,
      cryptoUpdated: cryptoSyncRes.updatedCount || 0,
      totalMutualFunds: mutualFunds?.length || 0,
      totalStocks: investments?.length || 0,
    });
  } catch (err: any) {
    console.error("Error in market-sync cron API:", err);
    return NextResponse.json({ error: err.message || "Failed to execute market sync" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
