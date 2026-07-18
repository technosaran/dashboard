import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    console.log("[Telegram Webhook] Received update:", JSON.stringify(body));

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
        "💡 *Telegram Transaction Tracker*\n\nSend a message containing an *amount* and a *description*:\n• \`50 Tea\`\n• \`Lunch 350\`\n• \`Rs. 2500 Rent\`\n\n*Options*:\n• \`/unlink\` — Disconnect bot\n• \`/help\` — View this guide"
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

    // 4. Parse transaction details (e.g. "50 tea", "groceries 250", "income 10000 tcs")
    // Find the first valid number in the string to use as the amount
    const amountMatch = text.match(/(?:₹|Rs\.?)?\s*(\d+(?:\.\d{1,2})?)/i);
    let amount = 0;
    let description = "";

    if (amountMatch) {
      amount = parseFloat(amountMatch[1]);
      // Remove the exact matched amount string (and any currency symbols) from the text to get the description
      description = text.replace(amountMatch[0], "").trim();
      // Clean up multiple spaces
      description = description.replace(/\s+/g, " ");
    }

    if (!description && amount > 0) {
      description = "Cash Transaction";
    }

    if (isNaN(amount) || amount <= 0 || !description) {
      await sendTelegramMessage(chatId, "❓ *Could not parse*: Please include an amount and description (e.g. `120 Lunch`, `Income 10000 TCS`).");
      return NextResponse.json({ success: true });
    }

    // 5. Categorize and type resolution
    let type: "expense" | "income" = "expense";
    if (/received|income|salary|added|refund/i.test(description)) {
      type = "income";
    }

    let category = type === "expense" ? "Food" : "Salary";
    if (type === "expense") {
      if (/zomato|swiggy|restaurant|eat|food|dining|deli|tea|coffee|lunch|dinner|snack/i.test(description)) {
        category = "Food";
      } else if (/uber|ola|ride|cab|taxi|metro|fuel|petrol|diesel|bus|train/i.test(description)) {
        category = "Transport";
      } else if (/netflix|spotify|youtube|apple|game|playstation|movie|show/i.test(description)) {
        category = "Entertainment";
      } else if (/rent|home|room/i.test(description)) {
        category = "Housing";
      } else if (/electricity|water|gas|broadband|wifi|recharge|mobile|bill/i.test(description)) {
        category = "Utilities";
      } else {
        category = "Other";
      }
    }

    // Fetch accounts to resolve fallback default
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name")
      .eq("user_id", profile.id);

    let resolvedAccountId: string | null = null;
    if (accounts && accounts.length > 0) {
      const defaultAccounts = (profile.default_accounts as Record<string, string | null>) || {};
      const defaultId = type === "expense" ? defaultAccounts.expenses : defaultAccounts.income;
      if (defaultId && accounts.some((acc: any) => acc.id === defaultId)) {
        resolvedAccountId = defaultId;
      } else {
        resolvedAccountId = accounts[0].id; // Fallback to first account
      }
    }

    const rpcName = type === "expense" ? "record_expense_by_sms" : "record_income_by_sms";
    const cleanDate = new Date().toISOString().split("T")[0];

    if (profile.sms_sync_token) {
      const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
        p_token: profile.sms_sync_token,
        p_description: `[Telegram] ${description}`,
        p_amount: amount,
        p_category: category,
        p_date: cleanDate,
        p_account_id: resolvedAccountId,
      });

      if (rpcError || (rpcData && rpcData.success === false)) {
        console.error("Telegram RPC failed:", rpcError || rpcData);
        await sendTelegramMessage(chatId, `❌ *Save Failed*: Database sync error.`);
      } else {
        const symbol = type === "expense" ? "💸" : "💰";
        await sendTelegramMessage(
          chatId,
          `${symbol} *Logged ${type}*:\n• *Amount*: ₹${amount}\n• *Description*: ${description}\n• *Category*: ${category}`
        );
      }
    } else {
      await sendTelegramMessage(chatId, `❌ *Failed*: No active sync token found in profile.`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Telegram Webhook Exception]:", error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
