import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import logger from "@/lib/logger";

// Helper to send message back to Telegram user
async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Telegram API error (${res.status}): ${errBody}`);
      if (res.status === 400 && /can't parse entities/i.test(errBody)) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
          }),
        });
      }
    }
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

export async function GET(req: NextRequest) {
  return handleCronAlerts(req);
}

export async function POST(req: NextRequest) {
  return handleCronAlerts(req);
}

async function handleCronAlerts(req: NextRequest) {
  try {
    // Optional cron secret check if configured
    const cronSecret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all users who have linked their Telegram account
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, telegram_chat_id, username, base_currency")
      .not("telegram_chat_id", "is", null);

    if (profErr || !profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: "No active Telegram linked users to notify." });
    }

    const today = new Date().toISOString().split("T")[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    let notifiedCount = 0;

    for (const profile of profiles) {
      if (!profile.telegram_chat_id) continue;

      // 1. Calculate today's spending
      const { data: todayTxs } = await supabase
        .from("transactions")
        .select("amount, description, category, type")
        .eq("user_id", profile.id)
        .eq("date", today);

      let todaySpent = 0;
      let todayIncome = 0;
      let txCount = 0;

      if (todayTxs) {
        for (const t of todayTxs) {
          const amt = parseFloat(t.amount) || 0;
          if (t.type === "expense") {
            todaySpent += amt;
            txCount++;
          } else if (t.type === "income") {
            todayIncome += amt;
          }
        }
      }

      // 2. Fetch total account balances
      const { data: accounts } = await supabase
        .from("accounts")
        .select("balance")
        .eq("user_id", profile.id);

      let netBalance = 0;
      if (accounts) {
        for (const a of accounts) {
          netBalance += parseFloat(a.balance) || 0;
        }
      }

      // 3. Check if any budget category exceeded 80% this month
      const { data: budgets } = await supabase
        .from("budgets")
        .select("category, amount")
        .eq("user_id", profile.id);

      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("category, amount")
        .eq("user_id", profile.id)
        .eq("type", "expense")
        .gte("date", firstDayOfMonth);

      const spentMap: Record<string, number> = {};
      if (monthTxs) {
        for (const t of monthTxs) {
          const cat = t.category || "Other";
          spentMap[cat] = (spentMap[cat] || 0) + (parseFloat(t.amount) || 0);
        }
      }

      const currency = profile.base_currency || "INR";
      const formatCurr = (amt: number) => new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: currency, 
        maximumFractionDigits: 0 
      }).format(amt);

      let budgetAlertsMsg = "";
      if (budgets) {
        for (const b of budgets) {
          const limit = parseFloat(b.amount) || 1;
          const spent = spentMap[b.category] || 0;
          const pct = Math.round((spent / limit) * 100);
          if (pct >= 85) {
            const statusIcon = pct >= 100 ? "🚨" : "⚠️";
            budgetAlertsMsg += `${statusIcon} *${b.category} Budget*: ${pct}% used (${formatCurr(spent)} / ${formatCurr(limit)})\n`;
          }
        }
      }

      // Format Evening Check-in Message
      let msg = `🌙 *Daily Evening Check-in* _(${profile.username || "Saran"})_\n\n`;
      if (todaySpent > 0 || todayIncome > 0) {
        msg += `📊 *Today's Activity*:\n` +
               `• *Spent Today*: ${formatCurr(todaySpent)} _(${txCount} transactions)_\n` +
               `• *Income Today*: ${formatCurr(todayIncome)}\n\n`;
      } else {
        msg += `✨ *Zero Spending Day!* You logged 0 expenses today. Keep up the disciplined habits.\n\n`;
      }

      msg += `💳 *Total Net Worth*: ${formatCurr(netBalance)}\n`;

      if (budgetAlertsMsg) {
        msg += `\n*Monthly Budget Warnings*:\n` + budgetAlertsMsg;
      }

      msg += `\n_💡 Text \`/summary\` anytime for full monthly statistics._`;

      await sendTelegramMessage(profile.telegram_chat_id, msg);
      notifiedCount++;
    }

    logger.info(`[Telegram Daily Alerts] Successfully sent alerts to ${notifiedCount} users.`);
    return NextResponse.json({ success: true, notified_users: notifiedCount });
  } catch (err: any) {
    logger.error("[Telegram Daily Alerts Error]:", err);
    return NextResponse.json({ error: err.message || "Cron exception" }, { status: 500 });
  }
}
