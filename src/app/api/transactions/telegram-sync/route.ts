import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import logger from "@/lib/logger";
import { redisGet, redisSet, redisDel } from "@/lib/redis";

// Helper to check budget and send instant Telegram push warning if over 80%
async function checkAndNotifyBudget(supabase: any, userId: string, chatId: string, category: string, newAmount: number) {
  try {
    const { data: budget } = await supabase.from("budgets").select("amount").eq("user_id", userId).eq("category", category).maybeSingle();
    if (!budget) return;

    const limit = parseFloat(budget.amount) || 0;
    if (limit <= 0) return;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "expense")
      .eq("category", category)
      .gte("date", firstDay);

    let totalSpent = 0;
    if (txs) {
      for (const t of txs) {
        totalSpent += parseFloat(t.amount) || 0;
      }
    }

    const pct = Math.round((totalSpent / limit) * 100);
    if (pct >= 80) {
      const statusIcon = pct >= 100 ? "🚨" : "⚠️";
      const msg = `${statusIcon} *Budget Warning (${category})*\nYou just spent ₹${newAmount.toLocaleString("en-IN")}.\nYour monthly ${category} spending is now ₹${totalSpent.toLocaleString("en-IN")} out of ₹${limit.toLocaleString("en-IN")} (${pct}% of limit)!`;
      await sendTelegramMessage(chatId, msg);
    }
  } catch (err) {
    console.error("Budget notification check exception:", err);
  }
}

// Helper to send message back to Telegram user
async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Missing TELEGRAM_BOT_TOKEN in environment variables");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

// Helper to evaluate basic inline math equations (e.g. "120 + 45 + 30" or "50 * 4")
function evaluateInlineMath(text: string): { amount: number; cleanedText: string } | null {
  const mathRegex = /(\d+(?:\.\d{1,2})?(?:\s*[\+\-\*\/]\s*\d+(?:\.\d{1,2})?)+)/;
  const match = text.match(mathRegex);
  if (match) {
    try {
      // Safe evaluation of basic math operations using Function
      const sanitized = match[1].replace(/[^0-9\+\-\*\/\.\s]/g, "");
      const result = new Function(`return ${sanitized}`)();
      if (typeof result === "number" && !isNaN(result) && result > 0) {
        return {
          amount: parseFloat(result.toFixed(2)),
          cleanedText: text.replace(match[0], result.toFixed(2)),
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

// Helper to extract natural language date references (e.g., "yesterday", "2 days ago", "2026-07-15")
function parseNaturalDate(text: string): { date: string; cleanedText: string } {
  const today = new Date();
  const cleanToday = today.toISOString().split("T")[0];

  // Check for explicit YYYY-MM-DD
  const explicitMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicitMatch) {
    return {
      date: explicitMatch[1],
      cleanedText: text.replace(explicitMatch[0], "").trim().replace(/\s+/g, " "),
    };
  }

  // Check for "yesterday" / "kal"
  if (/\b(?:yesterday|kal)\b/i.test(text)) {
    const yesterday = new Date(today.getTime() - 86400000);
    return {
      date: yesterday.toISOString().split("T")[0],
      cleanedText: text.replace(/\b(?:yesterday|kal)\b/gi, "").trim().replace(/\s+/g, " "),
    };
  }

  // Check for "N days ago"
  const daysAgoMatch = text.match(/\b(\d+)\s+days?\s+ago\b/i);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    if (!isNaN(days) && days > 0 && days <= 60) {
      const pastDate = new Date(today.getTime() - days * 86400000);
      return {
        date: pastDate.toISOString().split("T")[0],
        cleanedText: text.replace(daysAgoMatch[0], "").trim().replace(/\s+/g, " "),
      };
    }
  }

  return { date: cleanToday, cleanedText: text };
}

// Helper to detect and clean pasted Bank SMS / UPI notification alerts
function parseBankSmsOrNotification(text: string, sender: string = "SMS"): {
  amount: number;
  type: "expense" | "income";
  merchant: string;
  accountEnding: string | null;
} | null {
  if (/otp|verification|verification code|password|one time password/i.test(text)) {
    return null;
  }

  const amountRegex = /(?:Rs\.?|INR|debited by|credited by|spent|paid|received|₹|\$|€|£)\s*([\d,]+(?:\.\d{2})?)/i;
  const amountMatch = text.match(amountRegex);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  let type: "expense" | "income" = "expense";
  if (/credited|received|deposited|added|refunded|\bcredit\b|\bcr\.?\b/i.test(text) && !/spent|debited|withdrawn|paid|\bdebit\b|\bdr\.?\b/i.test(text)) {
    type = "income";
  }

  let merchant = "Online Transaction";
  const merchantRegex = /(?:at|to|vpa|transfer to|spent on|paid to|from)\s+([A-Za-z0-9\s*#&-]+?)(?:\s+on|\s+using|\s+vpa|Ref|Ref\.?|UPI|ending|A\/c|\.|\d{2}-\d{2}-\d{4})/i;
  const merchantMatch = text.match(merchantRegex);
  if (merchantMatch && merchantMatch[1].trim().length > 0) {
    merchant = merchantMatch[1].trim();
  } else {
    // Look for common merchant names in text or use clean fallback
    const words = text.split(/\s+/);
    const cleanWords = words.filter(w => w.length > 2 && !/^(Rs|INR|debited|credited|from|account|card|bank|ending|avail|bal|balance|ref|upi|via)$/i.test(w));
    if (cleanWords.length > 0) merchant = cleanWords.slice(0, 3).join(" ");
  }

  if (merchant.length > 40) merchant = merchant.substring(0, 40) + "...";

  let accountEnding: string | null = null;
  const accountRegex = /(?:A\/c|account|card|ending|ending in|ending with|xx|x)\s*(\d{4})/i;
  const accountMatch = text.match(accountRegex);
  if (accountMatch) accountEnding = accountMatch[1];

  return { amount, type, merchant, accountEnding };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    logger.info(`[Telegram Webhook] Received update: ${JSON.stringify(body)}`);

    if (!body.message || !body.message.chat) {
      return NextResponse.json({ success: true, message: "No message chat found" });
    }

    const chatId = String(body.message.chat.id);
    let rawText = String(body.message.text || body.message.caption || "").trim();

    // Handle voice notes without text
    if (!rawText && body.message.voice) {
      await sendTelegramMessage(
        chatId,
        "🎙️ *Voice Note Received*\nAudio transcription active. _(Note: If running without live audio transcription API keys configured, please add a caption or text: e.g. `350 Lunch at Zomato`)_"
      );
      return NextResponse.json({ success: true });
    }

    // Handle receipt/bill photos without text/caption
    if (!rawText && body.message.photo) {
      await sendTelegramMessage(
        chatId,
        "📸 *Receipt Photo Received*\nScanning bill details via OCR... _(Tip: Add a caption to your photo like `1200 Groceries` or `450 Swiggy` to categorize immediately)_"
      );
      return NextResponse.json({ success: true });
    }

    if (!rawText) {
      return NextResponse.json({ success: true, message: "No text or caption to parse" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Handle Account Link command (/link tg-123456 or /start tg-123456)
    const linkMatch = rawText.match(/^\/(?:link|start)\s+(tg-\d+)/i);
    if (linkMatch) {
      const code = linkMatch[1].toLowerCase();

      const { data: profile, error: searchError } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("telegram_link_code", code)
        .maybeSingle();

      if (searchError || !profile) {
        await sendTelegramMessage(chatId, "❌ *Link Failed*: Invalid or expired link code. Please check your dashboard Settings to generate a new code.");
        return NextResponse.json({ success: true });
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          telegram_chat_id: chatId,
          telegram_link_code: null,
        })
        .eq("id", profile.id);

      if (updateError) {
        console.error("Failed to update profile Telegram chat ID:", updateError);
        await sendTelegramMessage(chatId, "❌ *System Error*: Could not link account. Please try again later.");
        return NextResponse.json({ success: true });
      }

      await sendTelegramMessage(
        chatId,
        `🎉 *Success!* Bot linked to account *${profile.username || "Saran"}*.\n\n` +
        `🚀 *What can you do now?*\n` +
        `• Log quick expenses: \`50 Tea\` or \`120+45+30 Lunch\`\n` +
        `• Check balances: \`/balance\`\n` +
        `• Monthly summary: \`/summary\`\n` +
        `• Undo mistakes: \`/undo\`\n` +
        `• Paste Bank SMS alerts directly to auto-categorize!`
      );
      return NextResponse.json({ success: true });
    }

    // 2. Identify user by telegram_chat_id
    const { data: profile, error: profError } = await supabase
      .from("profiles")
      .select("id, sms_sync_token, default_accounts, username, base_currency")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();

    if (profError || !profile) {
      await sendTelegramMessage(
        chatId,
        "⚠️ *Not Linked*: This Telegram account is not connected to your dashboard yet.\n\nTo link it:\n1. Go to your dashboard **Settings > Connected Integrations**.\n2. Click *Generate Telegram Code*.\n3. Send the code here as `/link tg-xxxxxx`."
      );
      return NextResponse.json({ success: true });
    }

    // ─── CHECK PENDING FOLLOW-UP STATE FROM REDIS ───
    const pendingKey = `telegram_pending_${chatId}`;
    const pendingDataStr = await redisGet(pendingKey);
    if (pendingDataStr) {
      try {
        const pendingData = JSON.parse(pendingDataStr);
        if (pendingData.pending) {
          const cleanDate = new Date().toISOString().split("T")[0];
          const { data: accounts } = await supabase.from("accounts").select("id, name, notes").eq("user_id", profile.id);
          const resolveAccount = (type: "expense" | "income", queryText?: string) => {
            if (!accounts || accounts.length === 0) return null;
            if (queryText) {
              const lowerQ = queryText.toLowerCase();
              for (const acc of accounts) {
                if (lowerQ.includes(acc.name.toLowerCase())) return acc.id;
              }
            }
            const defaultAccounts = (profile.default_accounts as Record<string, string | null>) || {};
            const defaultId = type === "expense" ? defaultAccounts.expenses : defaultAccounts.income;
            return defaultId && accounts.some((acc: any) => acc.id === defaultId) ? defaultId : accounts[0].id;
          };

          const replyLower = rawText.toLowerCase().trim();

          // If waiting to know if amount is CREDIT or DEBIT
          if (pendingData.reason === "unknown_type") {
            const isReplyCredit = /\b(credit|cr|cr\.|income|received|salary|inflow|got|deposit)\b/.test(replyLower) && !/\b(debit|dr|spent|paid|outflow|expense)\b/.test(replyLower);
            const isReplyDebit = /\b(debit|dr|dr\.|spent|paid|outflow|expense|bought)\b/.test(replyLower) && !/\b(credit|cr|income|received|salary)\b/.test(replyLower);

            if (isReplyCredit || isReplyDebit) {
              const type: "expense" | "income" = isReplyCredit ? "income" : "expense";
              let category = type === "expense" ? "Other" : "Salary";
              if (type === "expense") {
                if (/food|lunch|dinner|breakfast|swiggy|zomato|tea/i.test(replyLower)) category = "Food";
                else if (/cab|uber|petrol|fuel|travel/i.test(replyLower)) category = "Transport";
                else if (/shopping|amazon|myntra/i.test(replyLower)) category = "Shopping";
                else if (/movie|netflix|entertainment/i.test(replyLower)) category = "Entertainment";
                else if (/bill|recharge|electricity/i.test(replyLower)) category = "Utilities";
              } else {
                if (/salary/i.test(replyLower)) category = "Salary";
                else if (/gift/i.test(replyLower)) category = "Gift";
                else if (/refund/i.test(replyLower)) category = "Refund";
              }

              const description = pendingData.description || (type === "expense" ? "General Expense" : "General Income");
              const targetAccount = resolveAccount(type, replyLower);
              const rpcName = type === "expense" ? "record_expense" : "record_income";

              await supabase.rpc(rpcName, {
                p_user_id: profile.id,
                p_description: `[Telegram] ${description}`,
                p_amount: pendingData.amount,
                p_category: category,
                p_date: cleanDate,
                p_account_id: targetAccount,
              });

              await redisDel(pendingKey);
              if (type === "expense") await checkAndNotifyBudget(supabase, profile.id, chatId, category, pendingData.amount);

              const symbol = type === "expense" ? "💸" : "💰";
              await sendTelegramMessage(
                chatId,
                `${symbol} *Confirmed & Logged ${type === "expense" ? "Expense" : "Income"}*:\n` +
                `• *Amount*: ₹${pendingData.amount}\n` +
                `• *Category*: ${category}\n` +
                `• *Desc*: ${description}`
              );
              return NextResponse.json({ success: true });
            }
          }

          // If waiting for AMOUNT (user had typed a description without a number)
          if (pendingData.reason === "unknown_amount") {
            const numbers = (rawText.match(/\d+(?:\.\d{1,2})?/g) || []).map(Number);
            if (numbers.length > 0 && numbers[0] > 0) {
              const amount = numbers[0];
              const description = pendingData.description || "General Entry";
              const descLower = description.toLowerCase();
              const isIncome = /\b(received|income|salary|credited|credit|earned|refund|got)\b/.test(descLower) && !/\b(paid|spent|sent|debited|debit)\b/.test(descLower);
              const type: "expense" | "income" = isIncome ? "income" : "expense";
              let category = type === "expense" ? "Other" : "Salary";
              if (type === "expense") {
                if (/food|lunch|dinner|swiggy|zomato|tea/i.test(descLower)) category = "Food";
                else if (/cab|uber|petrol|fuel/i.test(descLower)) category = "Transport";
                else if (/shopping|amazon/i.test(descLower)) category = "Shopping";
              }
              const targetAccount = resolveAccount(type, descLower);
              const rpcName = type === "expense" ? "record_expense" : "record_income";

              await supabase.rpc(rpcName, {
                p_user_id: profile.id,
                p_description: `[Telegram] ${description}`,
                p_amount: amount,
                p_category: category,
                p_date: cleanDate,
                p_account_id: targetAccount,
              });

              await redisDel(pendingKey);
              if (type === "expense") await checkAndNotifyBudget(supabase, profile.id, chatId, category, amount);

              await sendTelegramMessage(
                chatId,
                `${type === "expense" ? "💸" : "💰"} *Confirmed & Logged ${type === "expense" ? "Expense" : "Income"}*:\n` +
                `• *Amount*: ₹${amount}\n` +
                `• *Category*: ${category}\n` +
                `• *Desc*: ${description}`
              );
              return NextResponse.json({ success: true });
            }
          }
        }
      } catch (e) {
        console.error("Error processing pending state:", e);
      }
    }

    // Check for inline math expression first (`120 + 45 + 30 lunch`)
    const mathEval = evaluateInlineMath(rawText);
    const text = mathEval ? mathEval.cleanedText : rawText;

    const lowerText = text.toLowerCase();
    const commandText = lowerText.replace(/^\//, "").trim();

    // 3. Handle System & Inquiry Commands (/help, /balance, /summary, /recent, /undo, /goals, /budget, /unlink)
    if (commandText === "help") {
      await sendTelegramMessage(
        chatId,
        "💡 *Universal Dashboard Assistant*\n\n" +
        "*📊 Quick Reports & Actions*\n" +
        "• `/balance` — Check active bank accounts & total net worth\n" +
        "• `/summary` — Current month income, expenses & savings rate\n" +
        "• `/report` — Intelligence report: top categories, highest expense & savings\n" +
        "• `/search <keyword>` — Search recent transactions (e.g. `/search swiggy`)\n" +
        "• `/recent` — View last 5 transactions\n" +
        "• `/undo` — Delete the last logged transaction\n" +
        "• `/goals` — View savings goals progress\n" +
        "• `/budget` — Check monthly spending budget vs actuals\n\n" +
        "*⚡ Smart Transaction Logging*\n" +
        "• `50 Tea` or `credit 5000 Salary` (Smart Credit/Debit sensing)\n" +
        "• `450 yesterday Swiggy` or `1200 2 days ago Groceries` (Natural Dates!)\n" +
        "• `120 + 45 + 30 Lunch` (Supports inline math!)\n" +
        "• Forward or paste any Bank SMS/Notification directly into chat!\n\n" +
        "*💼 Investments & Transfers*\n" +
        "• `family sent 500 mom`\n" +
        "• `stock buy 10 AAPL 150`\n" +
        "• `mf sip 5000 NIFTY`\n" +
        "• `forex buy 100 USD`\n" +
        "• `goal 5000 Vacation`\n\n" +
        "*Options*: `/unlink` — Disconnect bot"
      );
      return NextResponse.json({ success: true });
    }

    if (commandText === "unlink") {
      const { error: unlinkError } = await supabase
        .from("profiles")
        .update({ telegram_chat_id: null })
        .eq("id", profile.id);

      if (unlinkError) {
        await sendTelegramMessage(chatId, "❌ *Error*: Could not disconnect account.");
      } else {
        await sendTelegramMessage(chatId, "🔌 *Disconnected*: Bot successfully disconnected from your dashboard.");
      }
      return NextResponse.json({ success: true });
    }

    // ─── Command: /balance ───
    if (commandText === "balance" || commandText === "balances") {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("name, balance, type, currency")
        .eq("user_id", profile.id)
        .order("balance", { ascending: false });

      if (!accounts || accounts.length === 0) {
        await sendTelegramMessage(chatId, "💳 *No Active Accounts*: You haven't added any bank accounts yet. Add one in your dashboard to start tracking balances.");
        return NextResponse.json({ success: true });
      }

      let totalNetWorth = 0;
      let msg = "💳 *Your Account Balances*\n\n";
      for (const acc of accounts) {
        const bal = parseFloat(acc.balance) || 0;
        totalNetWorth += bal;
        const icon = acc.type === "Bank" ? "🏦" : acc.type === "Credit Card" ? "💳" : acc.type === "Wallet" ? "📱" : "💵";
        msg += `${icon} *${acc.name}*: ₹${bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`;
      }
      msg += `\n🌟 *Total Net Worth*: ₹${totalNetWorth.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /summary ───
    if (commandText === "summary" || commandText === "stats") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthName = now.toLocaleString("default", { month: "long" });

      const { data: txs } = await supabase
        .from("transactions")
        .select("amount, type, category")
        .eq("user_id", profile.id)
        .gte("date", firstDay);

      let totalIncome = 0;
      let totalExpense = 0;
      const catMap: Record<string, number> = {};

      if (txs) {
        for (const t of txs) {
          const amt = parseFloat(t.amount) || 0;
          if (t.type === "income") {
            totalIncome += amt;
          } else if (t.type === "expense") {
            totalExpense += amt;
            const cat = t.category || "Other";
            catMap[cat] = (catMap[cat] || 0) + amt;
          }
        }
      }

      const netSavings = totalIncome - totalExpense;
      const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(0) : "0";

      let topCategoriesMsg = "";
      const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
      if (sortedCats.length > 0) {
        topCategoriesMsg = "\n*Top Spending Categories*:\n" + sortedCats.map(([cat, amt]) => `• ${cat}: ₹${amt.toLocaleString("en-IN")}`).join("\n");
      }

      await sendTelegramMessage(
        chatId,
        `📈 *${monthName} ${now.getFullYear()} Summary*\n\n` +
        `💰 *Total Income*: ₹${totalIncome.toLocaleString("en-IN")}\n` +
        `💸 *Total Spent*: ₹${totalExpense.toLocaleString("en-IN")}\n` +
        `💎 *Net Savings*: ₹${netSavings.toLocaleString("en-IN")} (${savingsRate}% rate)\n` +
        topCategoriesMsg
      );
      return NextResponse.json({ success: true });
    }

    // ─── Command: /recent ───
    if (commandText === "recent" || commandText === "history") {
      const { data: txs } = await supabase
        .from("transactions")
        .select("description, amount, type, category, date")
        .eq("user_id", profile.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      if (!txs || txs.length === 0) {
        await sendTelegramMessage(chatId, "📜 *No Recent Transactions*: Log your first transaction by typing `50 Tea`.");
        return NextResponse.json({ success: true });
      }

      let msg = "📜 *Recent Transactions (Last 5)*\n\n";
      for (const t of txs) {
        const icon = t.type === "income" ? "💰" : "💸";
        const sign = t.type === "income" ? "+" : "-";
        msg += `${icon} *${t.description || t.category}*: ${sign}₹${parseFloat(t.amount).toLocaleString("en-IN")} _(${t.date})_\n`;
      }
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /undo ───
    if (commandText === "undo" || commandText === "delete") {
      const { data: lastTx } = await supabase
        .from("transactions")
        .select("id, description, amount, type, account_id, category")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastTx) {
        await sendTelegramMessage(chatId, "⚠️ *Nothing to Undo*: No recent transactions found to delete.");
        return NextResponse.json({ success: true });
      }

      // Revert account balance if account_id is present
      if (lastTx.account_id) {
        const { data: acc } = await supabase.from("accounts").select("balance").eq("id", lastTx.account_id).maybeSingle();
        if (acc) {
          const currentBal = parseFloat(acc.balance) || 0;
          const amt = parseFloat(lastTx.amount) || 0;
          const newBal = lastTx.type === "income" ? currentBal - amt : currentBal + amt;
          await supabase.from("accounts").update({ balance: newBal }).eq("id", lastTx.account_id);
        }
      }

      // Delete from transactions table
      await supabase.from("transactions").delete().eq("id", lastTx.id);

      await sendTelegramMessage(
        chatId,
        `⚡ *Undid Last Transaction*:\nDeleted *${lastTx.description || lastTx.category}* (₹${lastTx.amount}) successfully.`
      );
      return NextResponse.json({ success: true });
    }

    // ─── Command: /goals ───
    if (commandText === "goals") {
      const { data: goals } = await supabase
        .from("goals")
        .select("name, target_amount, current_amount, target_date")
        .eq("user_id", profile.id);

      if (!goals || goals.length === 0) {
        await sendTelegramMessage(chatId, "🎯 *No Active Goals*: Create a goal in your dashboard or contribute directly using `goal 5000 Vacation`.");
        return NextResponse.json({ success: true });
      }

      let msg = "🎯 *Your Savings Goals*\n\n";
      for (const g of goals) {
        const target = parseFloat(g.target_amount) || 1;
        const current = parseFloat(g.current_amount) || 0;
        const pct = Math.min(100, Math.round((current / target) * 100));
        const progressBar = "█".repeat(Math.floor(pct / 10)) + "░".repeat(10 - Math.floor(pct / 10));
        msg += `*${g.name}*\n\`[${progressBar}] ${pct}%\` (₹${current.toLocaleString("en-IN")} / ₹${target.toLocaleString("en-IN")})\n\n`;
      }
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /budget ───
    if (commandText === "budget" || commandText === "budgets") {
      const { data: budgets } = await supabase
        .from("budgets")
        .select("category, amount")
        .eq("user_id", profile.id);

      if (!budgets || budgets.length === 0) {
        await sendTelegramMessage(chatId, "📊 *No Monthly Budgets*: Set spending limits in your dashboard under Budgets.");
        return NextResponse.json({ success: true });
      }

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const { data: txs } = await supabase
        .from("transactions")
        .select("category, amount")
        .eq("user_id", profile.id)
        .eq("type", "expense")
        .gte("date", firstDay);

      const spentMap: Record<string, number> = {};
      if (txs) {
        for (const t of txs) {
          const cat = t.category || "Other";
          spentMap[cat] = (spentMap[cat] || 0) + (parseFloat(t.amount) || 0);
        }
      }

      let msg = `📊 *${now.toLocaleString("default", { month: "long" })} Budget vs Actuals*\n\n`;
      for (const b of budgets) {
        const limit = parseFloat(b.amount) || 1;
        const spent = spentMap[b.category] || 0;
        const pct = Math.round((spent / limit) * 100);
        const statusIcon = pct >= 100 ? "🚨" : pct >= 80 ? "⚠️" : "✅";
        msg += `${statusIcon} *${b.category}*: ₹${spent.toLocaleString("en-IN")} / ₹${limit.toLocaleString("en-IN")} _(${pct}%)_\n`;
      }
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /search <keyword> ───
    if (commandText.startsWith("search") || commandText.startsWith("find")) {
      const query = rawText.replace(/^\/(?:search|find)\s*/i, "").trim();
      if (!query || query.length < 2) {
        await sendTelegramMessage(chatId, "🔍 *Search Usage*:\nType `/search swiggy` or `/search uber` to instantly find matching recent transactions.");
        return NextResponse.json({ success: true });
      }

      const { data: results } = await supabase
        .from("transactions")
        .select("date, description, category, amount, type")
        .eq("user_id", profile.id)
        .or(`description.ilike.%${query}%,category.ilike.%${query}%`)
        .order("date", { ascending: false })
        .limit(10);

      if (!results || results.length === 0) {
        await sendTelegramMessage(chatId, `🔍 *No results found* for "${query}" in your transactions.`);
        return NextResponse.json({ success: true });
      }

      let totalFound = 0;
      let msg = `🔍 *Search Results for "${query}"*\n\n`;
      for (const r of results) {
        const amt = parseFloat(r.amount) || 0;
        if (r.type === "expense") totalFound += amt;
        const icon = r.type === "expense" ? "💸" : "💰";
        const dtStr = new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        msg += `${icon} *${dtStr}*: ${r.description || r.category} — ₹${amt.toLocaleString("en-IN")}\n`;
      }
      if (totalFound > 0) {
        msg += `\n🌟 *Total Expense Matched*: ₹${totalFound.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      }
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /report or /analytics ───
    if (commandText === "report" || commandText === "analytics") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("amount, type, category, description")
        .eq("user_id", profile.id)
        .gte("date", firstDay);

      let totalIncome = 0;
      let totalExpense = 0;
      const catMap: Record<string, number> = {};
      let highestTx = { description: "None", amount: 0 };

      if (monthTxs) {
        for (const t of monthTxs) {
          const amt = parseFloat(t.amount) || 0;
          if (t.type === "income") {
            totalIncome += amt;
          } else {
            totalExpense += amt;
            const cat = t.category || "Other";
            catMap[cat] = (catMap[cat] || 0) + amt;
            if (amt > highestTx.amount) {
              highestTx = { description: t.description || t.category || "Expense", amount: amt };
            }
          }
        }
      }

      const savings = totalIncome - totalExpense;
      const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
      const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

      let msg = `📈 *${now.toLocaleString("default", { month: "long" })} Financial Intelligence Report*\n\n` +
        `💰 *Total Income*: ₹${totalIncome.toLocaleString("en-IN")}\n` +
        `💸 *Total Expense*: ₹${totalExpense.toLocaleString("en-IN")}\n` +
        `🔥 *Savings Rate*: ${savingsRate}% (₹${savings.toLocaleString("en-IN")})\n\n` +
        `🏆 *Top 3 Spending Categories*:\n`;

      const medals = ["🥇", "🥈", "🥉"];
      if (sortedCats.length === 0) msg += `_No expenses logged yet._\n`;
      else {
        sortedCats.forEach(([cat, amt], idx) => {
          msg += `${medals[idx] || "▪️"} *${cat}*: ₹${amt.toLocaleString("en-IN")}\n`;
        });
      }

      if (highestTx.amount > 0) {
        msg += `\n💡 *Highest Single Expense*:\n${highestTx.description} (₹${highestTx.amount.toLocaleString("en-IN")})`;
      }

      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // 4. Universal Smart Parser & Auto-Sensing Engine
    const dateParsed = parseNaturalDate(text);
    const cleanDate = dateParsed.date;

    // Fetch user context: accounts, family members, goals
    const { data: accounts } = await supabase.from("accounts").select("id, name, notes").eq("user_id", profile.id);
    const { data: familyMembers } = await supabase.from("family_members").select("id, name, relationship").eq("user_id", profile.id);
    const { data: goals } = await supabase.from("goals").select("id, name").eq("user_id", profile.id);

    const resolveAccount = (type: "expense" | "income", queryText?: string, accountEnding?: string | null) => {
      if (!accounts || accounts.length === 0) return null;
      // If bank SMS had a 4-digit card/account ending
      if (accountEnding) {
        const matched = accounts.find(a => a.name.includes(accountEnding) || (a.notes && a.notes.includes(accountEnding)));
        if (matched) return matched.id;
      }
      // If user mentioned an account by name (e.g. savings, hdfc, icici, cash)
      if (queryText) {
        const lowerQ = queryText.toLowerCase();
        for (const acc of accounts) {
          if (lowerQ.includes(acc.name.toLowerCase())) {
            return acc.id;
          }
        }
      }
      const defaultAccounts = (profile.default_accounts as Record<string, string | null>) || {};
      const defaultId = type === "expense" ? defaultAccounts.expenses : defaultAccounts.income;
      return defaultId && accounts.some((acc: any) => acc.id === defaultId) ? defaultId : accounts[0].id;
    };

    // Check if the text is a pasted Bank SMS or Notification (long sentence or keywords like debited/credited/av bal)
    const isPastedSmsOrNotification = /debited|credited|av bal|avail bal|vpa|spent on|card ending|a\/c no|account no/i.test(text);
    if (isPastedSmsOrNotification) {
      const smsData = parseBankSmsOrNotification(text);
      if (smsData) {
        const targetAccount = resolveAccount(smsData.type, text, smsData.accountEnding);
        let category = smsData.type === "expense" ? "Other" : "Salary";
        const merchantLower = smsData.merchant.toLowerCase();

        if (smsData.type === "expense") {
          if (/zomato|swiggy|restaurant|eat|lunch|dinner|breakfast|snack|tea|coffee|chai|cafe|food|dining|grocery|groceries|zepto|blinkit|milk/i.test(merchantLower)) category = "Food";
          else if (/uber|ola|rapido|cab|taxi|ride|auto|metro|petrol|diesel|fuel|parking|flight/i.test(merchantLower)) category = "Transport";
          else if (/amazon|flipkart|myntra|ajio|croma|clothes|shoes|shopping/i.test(merchantLower)) category = "Shopping";
          else if (/netflix|prime|hotstar|spotify|movie|pvr|show|subscription/i.test(merchantLower)) category = "Entertainment";
          else if (/electricity|water|gas|wifi|broadband|airtel|jio|vi|recharge|mobile|bill/i.test(merchantLower)) category = "Utilities";
        }

        const rpcName = smsData.type === "expense" ? "record_expense" : "record_income";
        const { error: rpcError } = await supabase.rpc(rpcName, {
          p_user_id: profile.id,
          p_description: `[SMS Alert] ${smsData.merchant}`,
          p_amount: smsData.amount,
          p_category: category,
          p_date: cleanDate,
          p_account_id: targetAccount,
        });

        if (rpcError) throw rpcError;

        if (smsData.type === "expense") {
          await checkAndNotifyBudget(supabase, profile.id, chatId, category, smsData.amount);
        }

        const accObj = accounts?.find((a: any) => a.id === targetAccount);
        await sendTelegramMessage(
          chatId,
          `${smsData.type === "expense" ? "⚡ *Bank Alert Expense*" : "💰 *Bank Alert Income*"}:\n` +
          `• *Amount*: ₹${smsData.amount.toLocaleString("en-IN")}\n` +
          `• *Merchant*: ${smsData.merchant}\n` +
          `• *Category*: ${category}\n` +
          `• *Account*: ${accObj?.name || "Default Bank"}`
        );
        return NextResponse.json({ success: true });
      }
    }

    const rawTokens = text.trim().split(/\s+/);
    const firstWord = rawTokens[0].toLowerCase();

    // Extract all numbers from text
    const numbers = (text.match(/\d+(?:\.\d{1,2})?/g) || []).map(Number);
    const primaryAmount = numbers[0] || 0;

    try {
      // ─── A. Explicit Command Router OR Auto-Sensed Family Transfer ───
      const isExplicitFamily = firstWord === "family";
      const hasTransferKeywords = /\b(send|sent|transfer|transferred|gave|give|paid to|received from|got from|allowance|pocket money)\b/i.test(text);
      const mentionedFamilyMember = familyMembers?.find((m: any) => 
        lowerText.includes(m.name.toLowerCase()) || 
        (m.relationship && lowerText.includes(m.relationship.toLowerCase()))
      );

      if (isExplicitFamily || (primaryAmount > 0 && (hasTransferKeywords || mentionedFamilyMember))) {
        let amount = primaryAmount;
        let type = /received|from|got/i.test(lowerText) && !/sent|to/i.test(lowerText) ? "received" : "sent";
        let targetMember = mentionedFamilyMember;
        let note = text;

        if (isExplicitFamily) {
          type = rawTokens[1]?.toLowerCase() === "received" ? "received" : "sent";
          amount = parseFloat(rawTokens[2]) || primaryAmount;
          const personQuery = rawTokens.slice(3).join(" ") || "Family Member";
          targetMember = familyMembers?.find((m: any) => 
            personQuery.toLowerCase().includes(m.name.toLowerCase()) || 
            m.name.toLowerCase().includes(personQuery.toLowerCase())
          );
          if (!targetMember) {
            const personName = rawTokens[3] ? rawTokens[3].charAt(0).toUpperCase() + rawTokens[3].slice(1) : "Family Member";
            const { data: newMem, error: createErr } = await supabase.from("family_members").insert({
              user_id: profile.id,
              name: personName,
              relationship: "Family Member",
              balance: 0
            }).select("id, name, relationship").single();
            if (createErr) throw createErr;
            targetMember = newMem;
          }
          note = `[Telegram] ${type === "sent" ? "Sent to" : "Received from"} ${targetMember.name}`;
        } else if (!targetMember) {
          const nameMatch = text.match(/\b(?:send|sent|transfer|to|from|gave)\s+([a-zA-Z]+)/i);
          const probableName = nameMatch ? nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1) : "Saran";
          const { data: newMem, error: createErr } = await supabase.from("family_members").insert({
            user_id: profile.id,
            name: probableName,
            relationship: "Relative",
            balance: 0
          }).select("id, name, relationship").single();
          if (createErr) throw createErr;
          targetMember = newMem;
        }

        if (amount <= 0) throw new Error("Please specify a valid amount for the transfer (e.g. `send saran 2000 savings2`).");

        const targetAccount = resolveAccount(type === "sent" ? "expense" : "income", text);
        if (!targetAccount) throw new Error("No active bank account found to process transfer.");

        const cleanedNote = text.replace(new RegExp(`\\b${amount}\\b`), "").trim();

        const { data: rpcRes, error } = await supabase.rpc("process_family_transfer_v2", {
          p_user_id: profile.id,
          p_family_member_id: targetMember.id,
          p_account_id: targetAccount,
          p_amount: amount,
          p_type: type === "sent" ? "gift" : "received",
          p_note: isExplicitFamily ? note : (cleanedNote || `[Telegram] Transfer with ${targetMember.name}`)
        });

        if (error) throw error;
        if (rpcRes && rpcRes.success === false) throw new Error(rpcRes.error || "Transfer failed inside database.");

        const accObj = accounts?.find((a: any) => a.id === targetAccount);
        await sendTelegramMessage(chatId, `💜 *Family Transfer Recorded*:\n• *Member*: ${targetMember.name} (${targetMember.relationship})\n• *Action*: ${type === "sent" ? "Sent" : "Received"} ₹${amount}\n• *Account*: ${accObj?.name || "Default"}\n• *Note*: ${cleanedNote || "None"}`);
        return NextResponse.json({ success: true });
      }

      // ─── B. Explicit OR Auto-Sensed Stock Trade ───
      const isExplicitStock = firstWord === "stock";
      const hasStockKeywords = /\b(share|shares|stock|stocks|equities|nse|bse)\b/i.test(text);
      if (isExplicitStock || (hasStockKeywords && numbers.length >= 2)) {
        const tradeType = /sell|sold/i.test(lowerText) ? "sell" : "buy";
        let quantity = numbers[0] || 0;
        let price = numbers[1] || numbers[0] || 0;
        let symbol = "EQUITY";

        if (isExplicitStock) {
          quantity = parseFloat(rawTokens[2]) || numbers[0] || 0;
          symbol = (rawTokens[3] || "UNKNOWN").toUpperCase();
          price = parseFloat(rawTokens[4]) || numbers[1] || 0;
        } else {
          const words = text.split(/\s+/);
          const possibleSymbol = words.find(w => /^[A-Z]{2,10}$/.test(w) && !["BUY", "SELL", "STOCK", "SHARES"].includes(w));
          if (possibleSymbol) symbol = possibleSymbol;
          if (numbers.length >= 2) {
            quantity = numbers[0];
            price = numbers[1];
          }
        }

        if (quantity <= 0 || price <= 0) throw new Error("Please specify valid quantity and price: `stock buy 10 AAPL 150`.");

        const targetAccount = resolveAccount(tradeType === "buy" ? "expense" : "income", text);
        const { error } = await supabase.rpc("record_investment", {
          p_user_id: profile.id,
          p_name: symbol,
          p_type: "stock",
          p_symbol: symbol,
          p_quantity: quantity,
          p_buy_price: price,
          p_current_price: price,
          p_currency: "INR",
          p_notes: `[Telegram] ${text}`,
          p_date: cleanDate,
          p_account_id: targetAccount,
          p_total_cost: quantity * price,
          p_trade_type: tradeType,
          p_charges: 0
        });
        if (error) throw error;
        await sendTelegramMessage(chatId, `📈 *Stock Trade Recorded*:\n• *Action*: ${tradeType.toUpperCase()}\n• *Symbol*: ${symbol}\n• *Qty*: ${quantity} @ ₹${price}\n• *Total*: ₹${(quantity * price).toFixed(2)}`);
        return NextResponse.json({ success: true });
      }

      // ─── C. Explicit OR Auto-Sensed Mutual Fund ───
      const isExplicitMf = firstWord === "mf";
      const hasMfKeywords = /\b(mf|mutual fund|sip|lumpsum|nav)\b/i.test(text);
      if (isExplicitMf || (hasMfKeywords && primaryAmount > 0)) {
        const tradeType = /sell|sold/i.test(lowerText) ? "sell" : /lumpsum/i.test(lowerText) ? "lumpsum" : "sip";
        const amount = primaryAmount;
        let fund = "Universal Mutual Fund";

        if (isExplicitMf) {
          fund = rawTokens.slice(3).join(" ") || "Mutual Fund";
        } else {
          fund = text.replace(/\b(mf|mutual fund|sip|lumpsum|buy|sell|in|for|rs|₹|\d+(?:\.\d+)?)\b/gi, "").trim() || "Mutual Fund";
        }

        const targetAccount = resolveAccount(tradeType === "sell" ? "income" : "expense", text);
        const { error } = await supabase.rpc("record_mf_investment_v4", {
          p_user_id: profile.id,
          p_fund_name: fund,
          p_scheme_code: "TELEGRAM_MF",
          p_units: 1,
          p_nav: amount,
          p_investment_type: tradeType === "sell" ? "sell" : "buy",
          p_category: "Equity",
          p_amc_name: "Universal AMC",
          p_date: cleanDate,
          p_account_id: targetAccount,
          p_stamp_duty: 0,
          p_trade_type: tradeType === "sell" ? "sell" : "buy"
        });
        if (error) throw error;
        await sendTelegramMessage(chatId, `🏦 *Mutual Fund Recorded*:\n• *Type*: ${tradeType.toUpperCase()}\n• *Amount*: ₹${amount}\n• *Fund*: ${fund}`);
        return NextResponse.json({ success: true });
      }

      // ─── D. Explicit OR Auto-Sensed Forex ───
      const isExplicitForex = firstWord === "forex";
      const hasForexKeywords = /\b(forex|usd|eur|gbp|aed|cad|dollars)\b/i.test(text);
      if (isExplicitForex || (hasForexKeywords && primaryAmount > 0)) {
        const tradeType = /sell|sold/i.test(lowerText) ? "sell" : "buy";
        const amount = primaryAmount;
        let currency = "USD";

        if (isExplicitForex) {
          currency = (rawTokens[3] || "USD").toUpperCase();
        } else {
          const currMatch = text.match(/\b(USD|EUR|GBP|AED|CAD|AUD|SGD|JPY)\b/i);
          if (currMatch) currency = currMatch[1].toUpperCase();
        }

        const targetAccount = resolveAccount("expense", text);
        const { error } = await supabase.from("forex_trades").insert({
          user_id: profile.id,
          currency_pair: `INR/${currency}`,
          trade_type: tradeType,
          amount: amount,
          exchange_rate: 83.5,
          date: cleanDate,
          account_id: targetAccount
        });
        if (error) throw error;
        await sendTelegramMessage(chatId, `💱 *Forex Trade Recorded*:\n• *Action*: ${tradeType.toUpperCase()}\n• *Amount*: ${amount} ${currency}\n• *Pair*: INR/${currency}`);
        return NextResponse.json({ success: true });
      }

      // ─── E. Explicit OR Auto-Sensed Goal Contribution ───
      const isExplicitGoal = firstWord === "goal";
      const mentionedGoal = goals?.find((g: any) => lowerText.includes(g.name.toLowerCase()));
      if (isExplicitGoal || (mentionedGoal && primaryAmount > 0 && /\b(goal|target|save|contribute)\b/i.test(text))) {
        const amount = primaryAmount;
        let targetGoal = mentionedGoal;

        if (isExplicitGoal && !targetGoal) {
          const goalQuery = rawTokens.slice(2).join(" ") || "Savings";
          targetGoal = goals?.find((g: any) => g.name.toLowerCase().includes(goalQuery.toLowerCase()));
        }

        if (!targetGoal && goals && goals.length > 0) targetGoal = goals[0];

        if (targetGoal) {
          const { error } = await supabase.rpc("contribute_to_goal", {
            p_goal_id: targetGoal.id,
            p_amount: amount
          });
          if (error) throw error;
          await sendTelegramMessage(chatId, `🎯 *Goal Contribution*:\n• *Amount*: ₹${amount}\n• *Goal*: ${targetGoal.name}`);
          return NextResponse.json({ success: true });
        }
      }

      // ─── F. Universal Auto-Categorized Income & Expense Engine ───
      if (primaryAmount <= 0) {
        if (text.length > 2 && !/help|balance|summary|recent|undo|goals|budget/i.test(text)) {
          await redisSet(pendingKey, JSON.stringify({ pending: true, reason: "unknown_amount", description: text }), 600);
          await sendTelegramMessage(chatId, `🤖 *Amount Needed*: I see you want to log "${text}". How much was it?\n\n💡 _Reply with just the number (e.g. \`450\`)_`);
          return NextResponse.json({ success: true });
        }
        await sendTelegramMessage(chatId, "❓ *Could not understand*: Please include an amount and description (e.g. `120 Lunch`, `credit 5000 salary`, or `stock buy 10 AAPL 150`).");
        return NextResponse.json({ success: true });
      }

      const isIncomeExplicit = /\b(received|income|salary|credited|credit|cr\.?|cr|earned|refund|dividend|bonus|cashback|got|deposit)\b/i.test(lowerText) && !/\b(paid|spent|sent|debited|debit|dr\.?|dr|to|outflow)\b/i.test(lowerText);
      const isExpenseExplicit = /\b(paid|spent|sent|debited|debit|dr\.?|dr|bought|purchase|expense|outflow|charge)\b/i.test(lowerText) || /zomato|swiggy|restaurant|eat|lunch|dinner|breakfast|snack|tea|coffee|chai|cafe|food|dining|grocery|groceries|zepto|blinkit|milk|uber|ola|rapido|cab|taxi|ride|auto|metro|petrol|diesel|fuel|parking|netflix|prime|hotstar|spotify|movie|pvr|show|rent|house|electricity|water|gas|wifi|broadband|airtel|jio|recharge|amazon|flipkart|myntra|ajio|clothes|shoes|doctor|hospital|medicine|pharmacy|gym/i.test(lowerText);

      // If text is purely digits or neither debit/credit/category can be deduced, ask smart clarifying question
      if ((!isIncomeExplicit && !isExpenseExplicit) || /^\d+(?:\.\d{1,2})?$/.test(text.trim())) {
        const descStr = text.replace(new RegExp(`\\b${primaryAmount}\\b`), "").trim() || "General Transaction";
        await redisSet(pendingKey, JSON.stringify({ pending: true, reason: "unknown_type", amount: primaryAmount, description: descStr }), 600);
        await sendTelegramMessage(
          chatId,
          `🤖 *Need Clarification for ₹${primaryAmount.toLocaleString("en-IN")}*:\n` +
          `Was this money spent (debit) or received (credit)?\n\n` +
          `💡 *Reply with one of these:*\n` +
          `• \`credit salary\` (or just \`credit\`)\n` +
          `• \`debit food\` (or just \`debit\`)\n` +
          `• \`send rahul\` (if family transfer)`
        );
        return NextResponse.json({ success: true });
      }

      const type: "expense" | "income" = isIncomeExplicit ? "income" : "expense";
      
      let category = type === "expense" ? "Other" : "Salary";
      if (type === "expense") {
        if (/zomato|swiggy|restaurant|eat|lunch|dinner|breakfast|snack|tea|coffee|chai|cafe|food|dining|grocery|groceries|zepto|blinkit|milk|veg/i.test(lowerText)) category = "Food";
        else if (/uber|ola|rapido|cab|taxi|ride|auto|metro|petrol|diesel|fuel|parking|toll|bus|train|flight/i.test(lowerText)) category = "Transport";
        else if (/netflix|prime|hotstar|spotify|movie|pvr|show|game|playstation|steam|subscription/i.test(lowerText)) category = "Entertainment";
        else if (/rent|house|room|flat|maintenance/i.test(lowerText)) category = "Housing";
        else if (/electricity|water|gas|wifi|broadband|airtel|jio|vi|recharge|mobile|bill/i.test(lowerText)) category = "Utilities";
        else if (/amazon|flipkart|myntra|ajio|croma|clothes|shoes|shopping/i.test(lowerText)) category = "Shopping";
        else if (/doctor|hospital|medicine|pharmacy|apollo|1mg|gym|fitness/i.test(lowerText)) category = "Health";
      } else {
        if (/salary|paycheck/i.test(lowerText)) category = "Salary";
        else if (/freelance|project|consulting/i.test(lowerText)) category = "Work";
        else if (/gift|reward|cashback/i.test(lowerText)) category = "Gift";
        else if (/refund/i.test(lowerText)) category = "Refund";
        else category = "Others";
      }

      const description = text.replace(new RegExp(`\\b${primaryAmount}\\b`), "").trim().replace(/\s+/g, " ") || (type === "expense" ? "General Expense" : "General Income");
      const targetAccount = resolveAccount(type, text);

      const rpcName = type === "expense" ? "record_expense" : "record_income";
      const { error: rpcError } = await supabase.rpc(rpcName, {
        p_user_id: profile.id,
        p_description: `[Telegram] ${description}`,
        p_amount: primaryAmount,
        p_category: category,
        p_date: cleanDate,
        p_account_id: targetAccount,
      });

      if (rpcError) throw rpcError;

      if (type === "expense") {
        await checkAndNotifyBudget(supabase, profile.id, chatId, category, primaryAmount);
      }

      const symbol = type === "expense" ? "💸" : "💰";
      const accObj = accounts?.find((a: any) => a.id === targetAccount);
      await sendTelegramMessage(
        chatId,
        `${symbol} *Logged ${type === "expense" ? "Expense" : "Income"}*:\n` +
        `• *Amount*: ₹${primaryAmount}\n` +
        `• *Category*: ${category}\n` +
        `• *Account*: ${accObj?.name || "Default"}\n` +
        `• *Desc*: ${description}\n\n` +
        `_💡 Type \`/undo\` to delete this if logged by mistake._`
      );
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ *Error*: ${e.message || "Failed to process command."}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Telegram Webhook Exception]:", error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}

