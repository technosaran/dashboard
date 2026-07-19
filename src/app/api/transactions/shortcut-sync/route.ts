import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper to check budget and send instant Telegram alert if over 80%
async function checkAndNotifyBudget(supabase: any, userId: string, category: string, newAmount: number) {
  try {
    const { data: profile } = await supabase.from("profiles").select("telegram_chat_id").eq("id", userId).maybeSingle();
    if (!profile?.telegram_chat_id) return;

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
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        const statusIcon = pct >= 100 ? "🚨" : "⚠️";
        const msg = `${statusIcon} *Budget Alert (${category})*\nYou just spent ₹${newAmount.toLocaleString("en-IN")}.\nYour monthly ${category} spending is now ₹${totalSpent.toLocaleString("en-IN")} out of ₹${limit.toLocaleString("en-IN")} (${pct}% of limit)!`;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: profile.telegram_chat_id,
            text: msg,
            parse_mode: "Markdown",
          }),
        });
      }
    }
  } catch (err) {
    console.error("Budget check exception:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing sync token" }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const text = (body.text || body.message || body.notification || body.content || "").trim();
    const explicitAmount = parseFloat(body.amount);
    const explicitMerchant = body.merchant || body.description;
    const explicitCategory = body.category;
    const explicitType = body.type === "income" ? "income" : "expense";

    if (!text && isNaN(explicitAmount)) {
      return NextResponse.json({ error: "Must provide either notification text or explicit amount" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Resolve user profile using the token (matches sms_sync_token)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, default_accounts")
      .eq("sms_sync_token", token)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Unauthorized: Invalid sync token" }, { status: 401 });
    }

    const userId = profile.id;

    // 2. Extract transaction details (either explicit fields or regex on notification text)
    let amount = !isNaN(explicitAmount) && explicitAmount > 0 ? explicitAmount : 0;
    let type: "expense" | "income" = explicitType;
    let merchant = explicitMerchant || "iOS Shortcut Transaction";
    let category = explicitCategory || (type === "expense" ? "Other" : "Salary");
    let accountEnding: string | null = null;

    if (amount <= 0 && text) {
      // Parse using standard bank/UPI regex template
      if (/otp|verification|password/i.test(text)) {
        return NextResponse.json({ success: true, message: "Ignored OTP notification" });
      }

      const amountMatch = text.match(/(?:Rs\.?|INR|debited by|credited by|spent|paid|received|₹|\$|€|£)\s*([\d,]+(?:\.\d{2})?)/i);
      if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      }

      if (amount <= 0) {
        return NextResponse.json({ error: "Could not extract valid amount from notification" }, { status: 200 });
      }

      if (/credited|received|deposited|added|refunded/i.test(text) && !/spent|debited|withdrawn|paid/i.test(text)) {
        type = "income";
      }

      const merchantMatch = text.match(/(?:at|to|vpa|transfer to|spent on|paid to|from)\s+([A-Za-z0-9\s*#&-]+?)(?:\s+on|\s+using|\s+vpa|Ref|Ref\.?|UPI|ending|A\/c|\.|\d{2}-\d{2}-\d{4})/i);
      if (merchantMatch && merchantMatch[1].trim().length > 0) {
        merchant = merchantMatch[1].trim();
      } else {
        const words = text.split(/\s+/);
        const cleanWords = words.filter((w: string) => w.length > 2 && !/^(Rs|INR|debited|credited|from|account|card|bank|ending|avail|bal|balance|ref|upi|via)$/i.test(w));
        if (cleanWords.length > 0) merchant = cleanWords.slice(0, 3).join(" ");
      }

      const accountMatch = text.match(/(?:A\/c|account|card|ending|ending in|xx|x)\s*(\d{4})/i);
      if (accountMatch) accountEnding = accountMatch[1];
    }

    if (merchant.length > 50) merchant = merchant.substring(0, 50) + "...";

    // Auto-categorize if explicit category wasn't given
    if (!explicitCategory && type === "expense") {
      const lowerM = merchant.toLowerCase();
      if (/zomato|swiggy|restaurant|eat|lunch|dinner|breakfast|snack|tea|coffee|chai|cafe|food|dining|grocery|groceries|zepto|blinkit|milk/i.test(lowerM)) category = "Food";
      else if (/uber|ola|rapido|cab|taxi|ride|auto|metro|petrol|diesel|fuel|parking|flight/i.test(lowerM)) category = "Transport";
      else if (/amazon|flipkart|myntra|ajio|croma|clothes|shoes|shopping/i.test(lowerM)) category = "Shopping";
      else if (/netflix|prime|hotstar|spotify|movie|pvr|show|subscription/i.test(lowerM)) category = "Entertainment";
      else if (/electricity|water|gas|wifi|broadband|airtel|jio|vi|recharge|mobile|bill/i.test(lowerM)) category = "Utilities";
    }

    // 3. Resolve account ID
    let resolvedAccountId: string | null = body.account_id || null;
    const { data: accounts } = await supabase.from("accounts").select("id, name, notes").eq("user_id", userId);
    if (accounts && accounts.length > 0) {
      if (!resolvedAccountId && accountEnding) {
        const matched = accounts.find((a: any) => a.name.includes(accountEnding!) || (a.notes && a.notes.includes(accountEnding!)));
        if (matched) resolvedAccountId = matched.id;
      }
      if (!resolvedAccountId) {
        const defaults = (profile.default_accounts as Record<string, string | null>) || {};
        const defaultId = type === "expense" ? defaults.expenses : defaults.income;
        if (defaultId && accounts.some((a: any) => a.id === defaultId)) resolvedAccountId = defaultId;
      }
      if (!resolvedAccountId) resolvedAccountId = accounts[0].id;
    }

    // 4. Record transaction via RPC
    const rpcName = type === "expense" ? "record_expense" : "record_income";
    const cleanDate = new Date().toISOString().split("T")[0];

    const { error: rpcError } = await supabase.rpc(rpcName, {
      p_user_id: userId,
      p_description: `[iOS Shortcut] ${merchant}`,
      p_amount: amount,
      p_category: category,
      p_date: cleanDate,
      p_account_id: resolvedAccountId,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Trigger instant budget check & push alert if needed
    if (type === "expense") {
      await checkAndNotifyBudget(supabase, userId, category, amount);
    }

    return NextResponse.json({
      success: true,
      type,
      amount,
      merchant,
      category,
      account_id: resolvedAccountId,
      message: "Transaction logged via iOS Shortcut Webhook",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unexpected server error" }, { status: 500 });
  }
}
