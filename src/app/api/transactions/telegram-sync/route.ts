import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import logger from "@/lib/logger";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    logger.info(`[Telegram Webhook] Received update: ${JSON.stringify(body)}`);

    if (!body.message || !body.message.text || !body.message.chat) {
      return NextResponse.json({ success: true, message: "No message text found" });
    }

    const chatId = String(body.message.chat.id);
    const text = String(body.message.text).trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    // Use service role key to bypass RLS for webhook profile lookup
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Handle Account Link command (/link tg-123456 or /start tg-123456)
    const linkMatch = text.match(/^\/(?:link|start)\s+(tg-\d+)/i);
    if (linkMatch) {
      const code = linkMatch[1].toLowerCase();

      // Find user with matching link code
      const { data: profile, error: searchError } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("telegram_link_code", code)
        .maybeSingle();

      if (searchError || !profile) {
        await sendTelegramMessage(chatId, "❌ *Link Failed*: Invalid or expired link code. Please check your dashboard Settings to generate a new code.");
        return NextResponse.json({ success: true });
      }

      // Link Telegram Account and clear code
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

      await sendTelegramMessage(chatId, `🎉 *Success!* Bot linked to account *${profile.username || "Saran"}*.\n\nYou can now log cash transactions by typing:\n\`50 Tea\` or \`Groceries 1200\`.`);
      return NextResponse.json({ success: true });
    }

    // 2. Identify user by telegram_chat_id
    const { data: profile, error: profError } = await supabase
      .from("profiles")
      .select("id, sms_sync_token, default_accounts, username")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();

    if (profError || !profile) {
      await sendTelegramMessage(
        chatId,
        "⚠️ *Not Linked*: This Telegram account is not connected to your dashboard yet.\n\nTo link it:\n1. Go to your dashboard **Settings > Connected Integrations**.\n2. Click *Generate Telegram Code*.\n3. Send the code here as `/link tg-xxxxxx`."
      );
      return NextResponse.json({ success: true });
    }

    // 3. Handle commands (/help, /unlink)
    if (text.toLowerCase() === "/help") {
      await sendTelegramMessage(
        chatId,
        "💡 *Universal Dashboard Bot*\n\n" +
        "You can now manage your entire financial dashboard from Telegram!\n\n" +
        "*1. Expenses & Incomes*\n" +
        "• `50 Tea` or `Income 5000 Salary`\n\n" +
        "*2. Family Transfers*\n" +
        "• `family sent 500 mom`\n\n" +
        "*3. Stocks & Equities*\n" +
        "• `stock buy 10 AAPL 150`\n\n" +
        "*4. Mutual Funds*\n" +
        "• `mf sip 5000 NIFTY`\n\n" +
        "*5. Forex*\n" +
        "• `forex buy 100 USD`\n\n" +
        "*6. Goals*\n" +
        "• `goal 5000 Vacation`\n\n" +
        "*Options*:\n• `/unlink` — Disconnect bot"
      );
      return NextResponse.json({ success: true });
    }

    if (text.toLowerCase() === "/unlink") {
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

    // 4. Universal Smart Parser & Auto-Sensing Engine
    const cleanDate = new Date().toISOString().split("T")[0];

    // Fetch user context: accounts, family members, goals
    const { data: accounts } = await supabase.from("accounts").select("id, name").eq("user_id", profile.id);
    const { data: familyMembers } = await supabase.from("family_members").select("id, name, relationship").eq("user_id", profile.id);
    const { data: goals } = await supabase.from("goals").select("id, name").eq("user_id", profile.id);

    const resolveAccount = (type: "expense" | "income", queryText?: string) => {
      if (!accounts || accounts.length === 0) return null;
      // If user mentioned an account by name (e.g. savings, savings2, hdfc, icici, cash)
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

    const rawTokens = text.trim().split(/\s+/);
    const firstWord = rawTokens[0].toLowerCase();
    const lowerText = text.toLowerCase();

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
        // Parse Family Transfer
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
            // Auto-create family member if not found
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
          // E.g., "send saran 2000 savings2" where saran isn't in DB yet
          // Extract probable name after send/sent/to/from
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

        // Clean note
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
          // Extract capital letters word or word near numbers as symbol
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
          exchange_rate: 83.5, // Standard estimate
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
        await sendTelegramMessage(chatId, "❓ *Could not understand*: Please include an amount and description (e.g. `120 Lunch`, `send saran 2000 savings2`, or `stock buy 10 AAPL 150`).");
        return NextResponse.json({ success: true });
      }

      const isIncome = /\b(received|income|salary|credited|earned|refund|dividend|bonus|cashback|got)\b/i.test(lowerText) && !/\b(paid|spent|sent|debited|to)\b/i.test(lowerText);
      const type: "expense" | "income" = isIncome ? "income" : "expense";
      
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

      const symbol = type === "expense" ? "💸" : "💰";
      const accObj = accounts?.find((a: any) => a.id === targetAccount);
      await sendTelegramMessage(chatId, `${symbol} *Logged ${type === "expense" ? "Expense" : "Income"}*:\n• *Amount*: ₹${primaryAmount}\n• *Category*: ${category}\n• *Account*: ${accObj?.name || "Default"}\n• *Desc*: ${description}`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ *Error*: ${e.message || "Failed to process command."}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Telegram Webhook Exception]:", error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
