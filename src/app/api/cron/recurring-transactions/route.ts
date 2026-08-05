import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";
import { logger } from "@/lib/logger";

/**
 * Cron route for processing recurring incomes and expenses.
 * Triggered automatically via cron or manual trigger.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const currentDay = today.getDate();
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const isRecurrenceMatch = (recDay: any) => {
    const dayNum = Number(recDay);
    if (!dayNum || isNaN(dayNum)) return false;
    const targetDay = Math.min(dayNum, daysInCurrentMonth);
    return targetDay === currentDay;
  };

  let postedCount = 0;

  try {
    // 1. Fetch profiles with Telegram chat ID for notifications
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, telegram_chat_id, username");

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // 2. Fetch active recurring income items
    const { data: recurringIncomes } = await supabase
      .from("incomes")
      .select("*")
      .eq("is_recurring", true);

    if (recurringIncomes && recurringIncomes.length > 0) {
      for (const inc of recurringIncomes) {
        if (isRecurrenceMatch(inc.recurrence_day)) {
          // Check if already posted today
          const { data: existing } = await supabase
            .from("incomes")
            .select("id")
            .eq("description", inc.description)
            .eq("amount", inc.amount)
            .eq("date", todayStr)
            .maybeSingle();

          if (!existing) {
            await supabase.from("incomes").insert({
              user_id: inc.user_id,
              description: inc.description,
              amount: inc.amount,
              category: inc.category || "Salary",
              account_id: inc.account_id,
              date: todayStr,
              is_recurring: false,
            });

            // Adjust account balance
            if (inc.account_id) {
              const { data: acc } = await supabase.from("accounts").select("balance").eq("id", inc.account_id).single();
              if (acc) {
                await supabase.from("accounts").update({ balance: Number(acc.balance) + Number(inc.amount) }).eq("id", inc.account_id);
              }
            }

            postedCount++;

            // Notify user via Telegram
            const prof = profileMap.get(inc.user_id);
            if (prof?.telegram_chat_id) {
              const msg = `⚡ *Auto-Recurring Income Posted*\n\n💰 *Amount*: ₹${Number(inc.amount).toLocaleString()}\n🏷️ *Description*: ${inc.description}\n📁 *Category*: ${inc.category || "Salary"}\n📅 *Date*: ${todayStr}`;
              await sendTelegramMessage(prof.telegram_chat_id, msg);
            }
          }
        }
      }
    }

    // 3. Fetch active recurring expense items
    const { data: recurringExpenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("is_recurring", true);

    if (recurringExpenses && recurringExpenses.length > 0) {
      for (const exp of recurringExpenses) {
        if (isRecurrenceMatch(exp.recurrence_day)) {
          const { data: existing } = await supabase
            .from("expenses")
            .select("id")
            .eq("description", exp.description)
            .eq("amount", exp.amount)
            .eq("date", todayStr)
            .maybeSingle();

          if (!existing) {
            await supabase.from("expenses").insert({
              user_id: exp.user_id,
              description: exp.description,
              amount: exp.amount,
              category: exp.category || "General",
              account_id: exp.account_id,
              date: todayStr,
              is_recurring: false,
            });

            if (exp.account_id) {
              const { data: acc } = await supabase.from("accounts").select("balance").eq("id", exp.account_id).single();
              if (acc) {
                await supabase.from("accounts").update({ balance: Number(acc.balance) - Number(exp.amount) }).eq("id", exp.account_id);
              }
            }

            postedCount++;

            const prof = profileMap.get(exp.user_id);
            if (prof?.telegram_chat_id) {
              const msg = `💸 *Auto-Recurring Expense Posted*\n\n💰 *Amount*: ₹${Number(exp.amount).toLocaleString()}\n🏷️ *Description*: ${exp.description}\n📁 *Category*: ${exp.category || "General"}\n📅 *Date*: ${todayStr}`;
              await sendTelegramMessage(prof.telegram_chat_id, msg);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed recurring transactions. Posted ${postedCount} items.`,
      postedCount,
    });
  } catch (err: any) {
    logger.error("[Recurring Cron Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
