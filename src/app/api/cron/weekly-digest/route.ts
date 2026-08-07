import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import logger from "@/lib/logger";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  return handleWeeklyDigest(req);
}

export async function POST(req: NextRequest) {
  return handleWeeklyDigest(req);
}

async function handleWeeklyDigest(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const secretParam = new URL(req.url).searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production" || expectedSecret) {
      const isAuthorized =
        expectedSecret &&
        (authHeader === `Bearer ${expectedSecret}` ||
          cronSecretHeader === expectedSecret ||
          secretParam === expectedSecret);
      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY configuration" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all users with linked Telegram chat IDs
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, telegram_chat_id, username, base_currency")
      .not("telegram_chat_id", "is", null);

    if (profErr || !profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: "No Telegram users for weekly digest." });
    }

    let notifiedCount = 0;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    for (const profile of profiles) {
      if (!profile.telegram_chat_id) continue;

      // 1. Calculate Account Balances (Net Worth)
      const { data: accounts } = await supabase
        .from("accounts")
        .select("balance")
        .eq("user_id", profile.id);

      let totalNetWorth = 0;
      if (accounts) {
        for (const a of accounts) {
          totalNetWorth += parseFloat(a.balance) || 0;
        }
      }

      // 2. Calculate Weekly Inflows & Outflows
      const { data: weeklyTxs } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("user_id", profile.id)
        .gte("date", sevenDaysAgo);

      let weeklySpent = 0;
      let weeklyIncome = 0;
      if (weeklyTxs) {
        for (const t of weeklyTxs) {
          const amt = parseFloat(t.amount) || 0;
          if (t.type === "expense") weeklySpent += amt;
          else if (t.type === "income") weeklyIncome += amt;
        }
      }

      // 3. Stock & Mutual Fund Holdings Summary
      const { data: stockHoldings } = await supabase
        .from("investments")
        .select("shares, current_price, avg_buy_price")
        .eq("user_id", profile.id);

      let totalStockValue = 0;
      if (stockHoldings) {
        for (const s of stockHoldings) {
          const qty = parseFloat(s.shares) || 0;
          const price = parseFloat(s.current_price || s.avg_buy_price) || 0;
          totalStockValue += qty * price;
        }
      }

      const currency = profile.base_currency || "INR";
      const formatCurr = (amt: number) =>
        new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(amt);

      const netWeeklyDelta = weeklyIncome - weeklySpent;
      const deltaSign = netWeeklyDelta >= 0 ? "📈 +" : "📉 ";

      const msg =
        `🌅 *Sunday Morning Wealth Digest* _(${profile.username || "Saran"})_\n\n` +
        `💎 *Total Net Worth*: *${formatCurr(totalNetWorth + totalStockValue)}*\n` +
        `📈 *Stock Holdings*: ${formatCurr(totalStockValue)}\n\n` +
        `📊 *7-Day Financial Summary*:\n` +
        `• *Income Logged*: ${formatCurr(weeklyIncome)}\n` +
        `• *Expenses Logged*: ${formatCurr(weeklySpent)}\n` +
        `• *Net Weekly Change*: ${deltaSign}${formatCurr(netWeeklyDelta)}\n\n` +
        `✨ *Tip for the week*: Review your monthly category budgets to keep your savings on target!\n\n` +
        `_💡 Type \`/balance\` or \`/portfolio\` anytime for live updates._`;

      await sendTelegramMessage(profile.telegram_chat_id, msg);
      notifiedCount++;
    }

    logger.info(`[Telegram Weekly Digest] Sent Sunday report to ${notifiedCount} users.`);
    return NextResponse.json({ success: true, notified_users: notifiedCount });
  } catch (err: any) {
    logger.error("[Telegram Weekly Digest Error]:", err);
    return NextResponse.json({ error: err.message || "Weekly digest exception" }, { status: 500 });
  }
}
