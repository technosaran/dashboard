import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function notifySmsBudgetAlert(supabase: any, token: string, category: string, newAmount: number) {
  try {
    const { data: profile } = await supabase.from("profiles").select("id, telegram_chat_id").eq("sms_sync_token", token).maybeSingle();
    if (!profile?.telegram_chat_id) return;

    const { data: budget } = await supabase.from("budgets").select("amount").eq("user_id", profile.id).eq("category", category).maybeSingle();
    if (!budget) return;

    const limit = parseFloat(budget.amount) || 0;
    if (limit <= 0) return;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", profile.id)
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
      const tokenEnv = process.env.TELEGRAM_BOT_TOKEN;
      if (tokenEnv) {
        const statusIcon = pct >= 100 ? "🚨" : "⚠️";
        const msg = `${statusIcon} *Budget Warning (${category})*\n[Auto-SMS] You just spent ₹${newAmount.toLocaleString("en-IN")}.\nYour monthly ${category} spending is now ₹${totalSpent.toLocaleString("en-IN")} out of ₹${limit.toLocaleString("en-IN")} (${pct}% of limit)!`;
        await fetch(`https://api.telegram.org/bot${tokenEnv}/sendMessage`, {
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
    console.error("SMS budget notification error:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing sync token" }, { status: 400 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Extract SMS text and sender address from common webhook payloads
    const text = (body.text || body.message || body.body || body.msg || body.content || "").trim();
    const sender = (body.sender || body.from || body.address || "SMS Forwarder").trim();

    if (!text) {
      return NextResponse.json({ error: "Empty SMS message body" }, { status: 400 });
    }

    // Initialize public Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Resolve user profile using the token
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, default_accounts")
      .eq("sms_sync_token", token)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Unauthorized: Invalid sync token" }, { status: 401 });
    }

    const userId = profile.id;

    // 2. Parse SMS content
    const parseResult = parseSms(text, sender);
    if (!parseResult) {
      return NextResponse.json({ error: "Unrecognized transaction SMS template" }, { status: 200 });
    }

    const { amount, type, merchant, accountEnding } = parseResult;

    // 3. Resolve the target bank account
    let resolvedAccountId: string | null = null;
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, notes")
      .eq("user_id", userId);

    if (accounts && accounts.length > 0) {
      if (accountEnding) {
        // Try to match the 4-digit ending in account name or notes
        const matched = accounts.find(
          (acc) =>
            acc.name.includes(accountEnding) ||
            (acc.notes && acc.notes.includes(accountEnding))
        );
        if (matched) {
          resolvedAccountId = matched.id;
        }
      }

      // Fallback: Use profile's default accounts
      if (!resolvedAccountId) {
        const defaults = (profile.default_accounts as Record<string, string | null>) || {};
        const defaultId = type === "expense" ? defaults.expenses : defaults.income;
        if (defaultId && accounts.some((acc) => acc.id === defaultId)) {
          resolvedAccountId = defaultId;
        }
      }

      // Final fallback: Use the first account
      if (!resolvedAccountId) {
        resolvedAccountId = accounts[0].id;
      }
    }

    // Helper function to auto-categorize merchants from SMS
    let category = type === "expense" ? "Other" : "Salary";
    const merchLower = merchant.toLowerCase();
    if (type === "expense") {
      if (/zomato|swiggy|restaurant|eat|lunch|dinner|breakfast|snack|tea|coffee|chai|cafe|food|dining|grocery|groceries|zepto|blinkit|milk/i.test(merchLower)) category = "Food";
      else if (/uber|ola|rapido|cab|taxi|ride|auto|metro|petrol|diesel|fuel|parking|flight/i.test(merchLower)) category = "Transport";
      else if (/amazon|flipkart|myntra|ajio|croma|clothes|shoes|shopping/i.test(merchLower)) category = "Shopping";
      else if (/netflix|prime|hotstar|spotify|movie|pvr|show|subscription/i.test(merchLower)) category = "Entertainment";
      else if (/electricity|water|gas|wifi|broadband|airtel|jio|vi|recharge|mobile|bill/i.test(merchLower)) category = "Utilities";
      else if (/doctor|hospital|medicine|pharmacy|apollo|1mg|gym|fitness/i.test(merchLower)) category = "Health";
    } else {
      if (/salary|paycheck/i.test(merchLower)) category = "Salary";
      else if (/freelance|project|consulting/i.test(merchLower)) category = "Work";
      else if (/gift|reward|cashback/i.test(merchLower)) category = "Gift";
      else if (/refund/i.test(merchLower)) category = "Refund";
    }

    // 4. Log the transaction using SQL security definer helper functions
    const rpcName = type === "expense" ? "record_expense_by_sms" : "record_income_by_sms";
    const cleanDate = new Date().toISOString().split("T")[0];

    // Robust Deduplication check across a ±3 day window across both specific and main transaction tables
    const dateObj = new Date(cleanDate);
    const minDate = new Date(dateObj.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const maxDate = new Date(dateObj.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const tableName = type === "expense" ? "expenses" : "income";

    const [{ data: existingTable }, { data: existingTx }] = await Promise.all([
      supabase
        .from(tableName)
        .select("id")
        .eq("user_id", userId)
        .eq("amount", amount)
        .gte("date", minDate)
        .lte("date", maxDate)
        .limit(1),
      supabase
        .from("transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("amount", amount)
        .gte("date", minDate)
        .lte("date", maxDate)
        .limit(1),
    ]);

    if ((existingTable && existingTable.length > 0) || (existingTx && existingTx.length > 0)) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Duplicate transaction ignored",
      });
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
      p_token: token,
      p_description: merchant,
      p_amount: amount,
      p_category: category,
      p_date: cleanDate,
      p_account_id: resolvedAccountId,
    });

    if (rpcError || (rpcData && rpcData.success === false)) {
      return NextResponse.json(
        { error: rpcError?.message || rpcData?.error || "Transaction RPC failed" },
        { status: 500 }
      );
    }

    if (type === "expense") {
      await notifySmsBudgetAlert(supabase, token, category, amount);
    }

    return NextResponse.json({
      success: true,
      type,
      amount,
      merchant,
      account_id: resolvedAccountId,
      message: "Transaction logged successfully via SMS Webhook",
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Helper to parse UPI / Debit / Credit bank SMS text structures
function parseSms(text: string, sender: string) {
  // Ignore OTP or balance check SMS messages
  if (/otp|verification|verification code|password|one time password/i.test(text)) {
    return null;
  }

  // 1. Amount Extraction
  // Matches Rs. 100, Rs.100, Rs 100, INR 100.50, spent Rs100, debited by Rs.100, ₹100 etc.
  const amountRegex = /(?:Rs\.?|INR|debited by|credited by|spent|₹)\s*([\d,]+(?:\.\d{2})?)/i;
  const amountMatch = text.match(amountRegex);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));

  if (isNaN(amount) || amount <= 0) return null;

  // 2. Type Extraction (debit vs credit)
  let type: "expense" | "income" = "expense";
  if (
    /credited|received|deposited|added|refunded|\bcredit\b|\bcr\.?\b/i.test(text) &&
    !/spent|debited|withdrawn|paid|\bdebit\b|\bdr\.?\b/i.test(text)
  ) {
    type = "income";
  }

  // 3. Merchant / Source Extraction
  let merchant = "Online Transaction";
  // Matches "at [Merchant] on", "to [Merchant] on", "using [Card] at [Merchant]", "vpa [Merchant]"
  const merchantRegex = /(?:at|to|vpa|transfer to|spent on)\s+([A-Za-z0-9\s*#&-]+?)(?:\s+on|\s+using|\s+vpa|Ref|Ref\.?|UPI|ending|A\/c|\.|\d{2}-\d{2}-\d{4})/i;
  const merchantMatch = text.match(merchantRegex);
  if (merchantMatch && merchantMatch[1].trim().length > 0) {
    merchant = merchantMatch[1].trim();
  } else {
    // Try matching simply uppercase words or default to sender name
    merchant = `${sender.replace(/[^A-Za-z]/g, "")} Pay`;
  }

  // Limit merchant name to a clean string
  if (merchant.length > 50) {
    merchant = merchant.substring(0, 50) + "...";
  }

  // 4. Account ending digits (e.g. ending 1234, x1234, ending with 1234)
  let accountEnding: string | null = null;
  const accountRegex = /(?:A\/c|account|card|ending|ending in|ending with|ending ending|xx|x)\s*(\d{4})/i;
  const accountMatch = text.match(accountRegex);
  if (accountMatch) {
    accountEnding = accountMatch[1];
  }

  return {
    amount,
    type,
    merchant,
    accountEnding,
  };
}
