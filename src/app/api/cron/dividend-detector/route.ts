import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getCronSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable for cron execution.");
  }
  return createClient<Database>(supabaseUrl, serviceKey);
}

/**
 * Fetch dividend events for a stock symbol from Yahoo Finance events API
 */
async function fetchRecentDividends(symbol: string): Promise<{ rate: number; date: string }[]> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const candidates = [
    cleanSymbol.includes(".") ? cleanSymbol : `${cleanSymbol}.NS`,
    cleanSymbol.includes(".") ? cleanSymbol : `${cleanSymbol}.BO`,
    cleanSymbol,
  ];

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const results: { rate: number; date: string }[] = [];

  for (const sym of candidates) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=3mo&events=div`;
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const events = data?.chart?.result?.[0]?.events?.dividends;
        if (events && typeof events === "object") {
          for (const key of Object.keys(events)) {
            const divObj = events[key];
            if (divObj && typeof divObj.amount === "number" && divObj.amount > 0) {
              const divDate = divObj.date ? new Date(divObj.date * 1000).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
              results.push({ rate: divObj.amount, date: divDate });
            }
          }
          if (results.length > 0) break;
        }
      }
    } catch {
      // Try next symbol candidate
    }
  }

  return results;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    if (querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }
  }

  try {
    const supabase = getCronSupabaseClient();
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: investments, error: invError } = await supabase
      .from("investments")
      .select("*")
      .eq("type", "stock");

    if (invError || !investments || investments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stock holdings found to check dividends.",
        dividendsLogged: 0,
      });
    }

    let dividendsLogged = 0;

    for (const inv of investments) {
      const symbol = inv.symbol || inv.name;
      if (!symbol || !inv.quantity || inv.quantity <= 0) continue;

      const divEvents = await fetchRecentDividends(symbol);

      for (const divEvent of divEvents) {
        const totalAmount = Number((inv.quantity * divEvent.rate).toFixed(2));
        if (totalAmount <= 0) continue;

        const description = `Dividend: ${inv.name} (${symbol.toUpperCase()}) — ₹${divEvent.rate.toFixed(2)}/share`;
        const divDate = divEvent.date || todayStr;

        // Check for duplicate income record in 'incomes' table
        const { data: existing } = await supabase
          .from("incomes")
          .select("id")
          .eq("user_id", inv.user_id)
          .eq("description", description)
          .eq("date", divDate);

        if (!existing || existing.length === 0) {
          const { error: insertErr } = await supabase
            .from("incomes")
            .insert({
              user_id: inv.user_id,
              description: description,
              category: "dividend",
              amount: totalAmount,
              date: divDate,
              created_at: new Date().toISOString(),
            });

          if (!insertErr) {
            dividendsLogged++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stocksChecked: investments.length,
      dividendsLogged: dividendsLogged,
    });
  } catch (err: any) {
    console.error("Error in dividend-detector cron API:", err);
    return NextResponse.json({ error: err.message || "Failed to execute dividend detection" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
