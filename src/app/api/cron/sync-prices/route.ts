import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Background Cron Job API Route: Auto-sync stock & crypto live prices in Supabase.
 * Triggered automatically via Vercel/Cron or manually via POST/GET.
 */
export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secretParam = req.nextUrl.searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret;
      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY configuration" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch all distinct active investment symbols across users
    const { data: investments, error: fetchErr } = await supabase
      .from("investments")
      .select("id, symbol, name, type, buy_price, current_price")
      .not("symbol", "is", null);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const inv of investments || []) {
      if (!inv.symbol) continue;
      const symbolUpper = inv.symbol.toUpperCase().trim();

      if (inv.type === "crypto") {
        try {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbolUpper + "USDT")}`);
          if (res.ok) {
            const data = await res.json();
            const livePrice = parseFloat(data.lastPrice);
            const dayChangePercent = parseFloat(data.priceChangePercent);
            if (!isNaN(livePrice) && livePrice > 0) {
              await supabase
                .from("investments")
                .update({
                  current_price: livePrice,
                  day_change_percent: dayChangePercent,
                  last_fetch_at: now,
                  updated_at: now,
                })
                .eq("id", inv.id);
              updatedCount++;
            }
          }
        } catch (e) {
          console.error(`Failed background crypto sync for ${symbolUpper}:`, e);
        }
      } else if (inv.type === "stock") {
        try {
          const cleanSym = symbolUpper.includes(".") ? symbolUpper : `${symbolUpper}.NS`;
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSym)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (res.ok) {
            const data = await res.json();
            const meta = data?.chart?.result?.[0]?.meta;
            const livePrice = meta?.regularMarketPrice;
            const prevClose = meta?.chartPreviousClose || meta?.previousClose;
            if (livePrice && !isNaN(livePrice)) {
              const priceNum = parseFloat(livePrice);
              const changePct = prevClose ? ((priceNum - parseFloat(prevClose)) / parseFloat(prevClose)) * 100 : 0;
              await supabase
                .from("investments")
                .update({
                  current_price: priceNum,
                  previous_close: prevClose ? parseFloat(prevClose) : undefined,
                  day_change_percent: changePct,
                  last_fetch_at: now,
                  updated_at: now,
                })
                .eq("id", inv.id);
              updatedCount++;
            }
          }
        } catch (e) {
          console.error(`Failed background stock sync for ${symbolUpper}:`, e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Background price sync completed. Updated ${updatedCount} investments.`,
      timestamp: now,
    });
  } catch (err) {
    console.error("Cron price sync error:", err);
    return NextResponse.json({ error: "Failed to execute price sync" }, { status: 500 });
  }
}
