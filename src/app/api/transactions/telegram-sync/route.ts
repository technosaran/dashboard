import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import logger from "@/lib/logger";
import { sendTelegramMessage, answerCallbackQuery, setTelegramBotCommands, getBrandEmoji, sendTelegramChatAction, downloadTelegramFile, sendTelegramDocument } from "@/lib/telegram";
import { redisGet, redisSet, redisDel, isRedisConfigured } from "@/lib/redis";
import { getExchangeRate } from "@/lib/utils";
import { parseTransactionWithGemini, askGeminiFinanceAssistant, isGeminiActiveForProfile, getGeminiApiKeyForProfile, parseAutonomousTelegramIntent, parseVoiceNoteWithGemini, parseReceiptWithGemini } from "@/lib/gemini";


// Persistent Telegram Reply Keyboard (docked cleanly at the bottom drawer of Telegram text input)
const MAIN_REPLY_KEYBOARD = {
  keyboard: [
    [
      { text: "💳 Accounts & Net Worth" },
      { text: "📊 Summary & Flow" }
    ],
    [
      { text: "📈 Portfolio & Assets" },
      { text: "🎯 Budgets & Goals" }
    ],
    [
      { text: "📜 Recent Logs" },
      { text: "🤖 AI Coach" }
    ]
  ],
  resize_keyboard: true,
  is_persistent: true
};

const MAIN_MENU_KEYBOARD = MAIN_REPLY_KEYBOARD;


const TX_CONFIRM_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "↩️ Undo", callback_data: "cmd_undo" },
      { text: "📜 Recent Logs", callback_data: "cmd_recent" }
    ],
    [
      { text: "🌐 Open Web Dashboard", url: "https://technosaranfin.vercel.app/dashboard" }
    ]
  ]
};

const CATEGORY_KEYBOARD = (txId: string) => ({
  inline_keyboard: [
    [
      { text: "🍔 Food", callback_data: `cat_${txId}_Food` },
      { text: "🚗 Transport", callback_data: `cat_${txId}_Transport` },
      { text: "🛒 Shopping", callback_data: `cat_${txId}_Shopping` }
    ],
    [
      { text: "🎬 Ent.", callback_data: `cat_${txId}_Entertainment` },
      { text: "💡 Bills", callback_data: `cat_${txId}_Utilities` },
      { text: "🏥 Health", callback_data: `cat_${txId}_Health` }
    ],
    [
      { text: "↩️ Undo", callback_data: "cmd_undo" }
    ]
  ]
});

const NO_ACCOUNT_MSG = "❌ *No Bank Account Found*\n\nYou haven't created any bank account yet.\n\n👉 *Add one now directly in Telegram*:\n`add account SBI` or `add account SBI 5000`\n\nOr create one in your web dashboard!";


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

// Helper to evaluate basic inline math equations (e.g. "120 + 45 + 30" or "50 * 4")
function evaluateInlineMath(text: string): { amount: number; cleanedText: string } | null {
  // Exclude hyphenated date strings like YYYY-MM-DD or DD-MM-YYYY from being mistaken for subtraction when alone
  if (/\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/.test(text) && !/[\+\*\/]/.test(text)) {
    return null;
  }
  const mathRegex = /(\d+(?:\.\d{1,2})?(?:\s*[\+\-\*\/]\s*\d+(?:\.\d{1,2})?)+)/;
  const match = text.match(mathRegex);
  if (match) {
    try {
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

// Helper to extract natural language date references (e.g., "yesterday", "2 days ago", "2026-07-15", "19-07-2026") and strip them from text
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

  // Check for DD-MM-YYYY or DD-MM-YY (common in Indian bank SMS)
  const ddMmMatch = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (ddMmMatch) {
    const day = parseInt(ddMmMatch[1], 10);
    const month = parseInt(ddMmMatch[2], 10);
    const yearStr = ddMmMatch[3];
    const year = yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      const formattedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return {
        date: formattedDate,
        cleanedText: text.replace(ddMmMatch[0], "").trim().replace(/\s+/g, " "),
      };
    }
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
function parseBankSmsOrNotification(text: string): {
  amount: number;
  type: "expense" | "income";
  merchant: string;
  accountEnding: string | null;
} | null {
  if (/otp|verification|verification code|password|one time password/i.test(text)) {
    return null;
  }

  const amountRegex = /(?:(?:Rs\.?|INR|₹|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)|(?:debited|credited|spent|paid|received)(?:\s+(?:by|with|for|amount of|INR|Rs\.?|₹))?\s*([\d,]+(?:\.\d{1,2})?))/i;
  const amountMatch = text.match(amountRegex);
  if (!amountMatch) return null;
  const rawAmtStr = amountMatch[1] || amountMatch[2];
  if (!rawAmtStr) return null;
  const amount = parseFloat(rawAmtStr.replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  let type: "expense" | "income" = "expense";
  if (/credited|received|deposited|added|refunded|\bcredit\b|\bcr\.?\b/i.test(text) && !/spent|debited|withdrawn|paid|\bdebit\b|\bdr\.?\b/i.test(text)) {
    type = "income";
  }

  let merchant = "Online Transaction";
  const merchantRegex = /(?:at|to|vpa|transfer to|spent on|paid to|from|towards)\s+([A-Za-z0-9\s*#&-]+?)(?:\s+on|\s+using|\s+vpa|Ref|Ref\.?|UPI|ending|A\/c|\.|\d{2}-\d{2}-\d{4}|$)/i;
  const merchantMatch = text.match(merchantRegex);
  if (merchantMatch && merchantMatch[1].trim().length > 0) {
    merchant = merchantMatch[1].trim();
  } else {
    const words = text.split(/\s+/);
    const cleanWords = words.filter(w => w.length > 2 && !/^(Rs|INR|debited|credited|from|account|card|bank|ending|avail|bal|balance|ref|upi|via|with|amount)$/i.test(w));
    if (cleanWords.length > 0) merchant = cleanWords.slice(0, 3).join(" ");
  }

  if (merchant.length > 40) merchant = merchant.substring(0, 40) + "...";

  let accountEnding: string | null = null;
  const accountRegex = /(?:A\/c|account|card|ending|ending in|ending with|xx|x|no\.?\s*)\s*(\d{4})/i;
  const accountMatch = text.match(accountRegex);
  if (accountMatch) accountEnding = accountMatch[1];

  return { amount, type, merchant, accountEnding };
}

// Calculate Levenshtein distance for typo tolerance
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const CATEGORY_FUZZY_DICT: Record<string, string[]> = {
  Food: ["food", "eat", "lunch", "dinner", "breakfast", "snack", "tea", "chai", "coffee", "cafe", "swiggy", "zomato", "grocery", "zepto", "blinkit", "instamart", "bigbasket", "milk", "paneer", "kirana", "restaurant", "hotel", "dhaba", "pizza", "burger", "subway", "mcdonalds", "kfc", "dominos", "biryani", "momos", "bakery", "cake", "pastry", "icecream", "chocolate", "samosa", "thali", "juice", "noodle"],
  Transport: ["uber", "ola", "rapido", "indrive", "cab", "taxi", "ride", "auto", "rickshaw", "metro", "petrol", "diesel", "fuel", "gas", "ev", "charging", "parking", "toll", "fastag", "bus", "train", "flight", "travel", "ticket", "vahan", "gaadi", "mechanic", "garage"],
  Entertainment: ["netflix", "prime", "hotstar", "spotify", "movie", "pvr", "inox", "bookmyshow", "game", "playstation", "xbox", "steam", "subscription", "cinema", "pub", "bar", "club", "party", "drinks", "beer", "wine", "alcohol", "concert", "event"],
  Housing: ["rent", "house", "room", "flat", "maintenance", "pg", "kiraya", "broker", "brokerage", "deposit", "furniture", "bed", "curtains"],
  Utilities: ["electricity", "water", "gas", "wifi", "broadband", "airtel", "jio", "vi", "bsnl", "recharge", "mobile", "bill", "bijli", "phonebill", "dth", "tataplay", "cylinder"],
  Shopping: ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "croma", "clothes", "shoes", "shopping", "purchase", "saman", "kapde", "mall", "electronics", "phone", "laptop", "watch", "gadget", "headphones", "dress", "shirt", "pant"],
  Health: ["doctor", "hospital", "medicine", "pharmacy", "apollo", "1mg", "pharmeasy", "gym", "fitness", "dawa", "clinic", "meds", "test", "bloodtest", "xray", "protein", "supplement"]
};

const INCOME_FUZZY_KEYWORDS = [
  "salary", "stipend", "paycheck", "credit", "credited", "received", "earned", "inflow", "refund", "dividend", "bonus", "cashback", "deposit", "deposited", "kamai", "aaya", "mila", "freelance", "profit", "interest", "gifted", "reward"
];

function classifyTextFuzzy(text: string): { type: "expense" | "income"; category: string } {
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/i).filter(w => w.length >= 2);

  // 1. Determine type
  let isIncome = false;
  for (const word of words) {
    for (const target of INCOME_FUZZY_KEYWORDS) {
      if (word === target || word.includes(target) || (word.length >= 4 && levenshteinDistance(word, target) <= 2)) {
        isIncome = true;
        break;
      }
    }
    if (isIncome) break;
  }

  if (isIncome) {
    let cat = "Salary";
    if (/freelance|project|consulting/i.test(lower)) cat = "Work";
    else if (/gift|reward|cashback/i.test(lower)) cat = "Gift";
    else if (/refund/i.test(lower)) cat = "Refund";
    return { type: "income", category: cat };
  }

  // 2. Determine expense category
  for (const word of words) {
    for (const [catName, keywords] of Object.entries(CATEGORY_FUZZY_DICT)) {
      for (const kw of keywords) {
        if (word === kw || word.includes(kw) || (word.length >= 4 && kw.length >= 4 && levenshteinDistance(word, kw) <= 2)) {
          return { type: "expense", category: catName };
        }
      }
    }
  }

  return { type: "expense", category: "Other" };
}

// Helper to build 360-degree live financial context for Gemini AI
async function buildRichUserContext(supabase: any, profile: any, accounts: any[], familyMembers: any[], goals: any[]) {
  try {
    let totalNetWorth = 0;
    if (accounts) {
      totalNetWorth = accounts.reduce((sum: number, a: any) => sum + (parseFloat(a.balance) || 0), 0);
    }

    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

    const [{ data: recentTxs }, { data: monthlyTxs }, { data: stocks }, { data: mfs }, { data: budgets }] = await Promise.all([
      supabase.from("transactions").select("amount, type, category, description, date").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(15),
      supabase.from("transactions").select("amount, category").eq("user_id", profile.id).eq("type", "expense").gte("date", firstDay),
      supabase.from("investments").select("symbol, quantity, buy_price, current_price").eq("user_id", profile.id),
      supabase.from("mutual_funds").select("fund_name, units, current_nav").eq("user_id", profile.id),
      supabase.from("budgets").select("category, amount").eq("user_id", profile.id),
    ]);

    const categorySpending: Record<string, number> = {};
    if (monthlyTxs) {
      for (const t of monthlyTxs) {
        const cat = t.category || "Other";
        categorySpending[cat] = (categorySpending[cat] || 0) + (parseFloat(t.amount) || 0);
      }
    }

    let stocksTotal = 0;
    const stockList = (stocks || []).map((s: any) => {
      const val = (parseFloat(s.quantity) || 0) * (parseFloat(s.current_price) || parseFloat(s.buy_price) || 0);
      stocksTotal += val;
      return `${s.symbol} (${s.quantity} @ ₹${s.current_price || s.buy_price})`;
    });

    let mfTotal = 0;
    const mfList = (mfs || []).map((m: any) => {
      const val = (parseFloat(m.units) || 0) * (parseFloat(m.current_nav) || 100);
      mfTotal += val;
      return `${m.fund_name} (₹${Math.round(val)})`;
    });

    const budgetStatus = (budgets || []).map((b: any) => {
      const spent = categorySpending[b.category] || 0;
      const limit = parseFloat(b.amount) || 0;
      return `${b.category}: Spent ₹${spent}/₹${limit} (${limit > 0 ? Math.round((spent / limit) * 100) : 0}%)`;
    });

    return `User Profile: Name=${profile.full_name || profile.username || 'User'}, BaseCurrency=${profile.base_currency || 'INR'}.
Bank Accounts Net Worth: ₹${totalNetWorth.toLocaleString("en-IN")}.
Accounts: ${JSON.stringify(accounts.map((a: any) => ({ name: a.name, bank: a.bank_name, balance: a.balance, type: a.type })))}.
This Month Category Spending: ${JSON.stringify(categorySpending)}.
Budgets: ${budgetStatus.join("; ") || "None set"}.
Investments: Stocks Total=₹${Math.round(stocksTotal)} [${stockList.join(", ")}], Mutual Funds Total=₹${Math.round(mfTotal)} [${mfList.join(", ")}].
Recent 15 Transactions: ${JSON.stringify((recentTxs || []).map((t: any) => `${t.date} ${t.type.toUpperCase()} ₹${t.amount} (${t.category}: ${t.description})`))}.
Goals: ${JSON.stringify((goals || []).map((g: any) => `${g.name}: saved ₹${g.current_amount || 0} / target ₹${g.target_amount}`))}.
Family: ${JSON.stringify((familyMembers || []).map((f: any) => `${f.name} (${f.relationship}): balance ₹${f.balance || 0}`))}.`;
  } catch {
    return `User: ${profile.username || 'User'}. Net Worth: ₹${accounts.reduce((sum: number, a: any) => sum + (parseFloat(a.balance) || 0), 0)}. Accounts: ${JSON.stringify(accounts)}.`;
  }
}

// Conversation Memory Helpers
async function getTelegramChatHistory(chatId: string): Promise<string> {
  try {
    const raw = await redisGet(`tg_chat_history_${chatId}`);
    if (!raw) return "";
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return "";
    return list.map((item: any) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.text}`).join("\n");
  } catch {
    return "";
  }
}

async function appendTelegramChatHistory(chatId: string, userMsg: string, aiMsg: string): Promise<void> {
  try {
    const raw = await redisGet(`tg_chat_history_${chatId}`);
    let list: any[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list.push({ role: 'user', text: userMsg });
    list.push({ role: 'assistant', text: aiMsg });
    if (list.length > 8) list = list.slice(list.length - 8);
    await redisSet(`tg_chat_history_${chatId}`, JSON.stringify(list), 7200);
  } catch (err) {
    console.error("Failed to append chat history:", err);
  }
}

export async function POST(req: NextRequest) {

  try {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
      if (!secretToken) {
        return NextResponse.json({ error: "Missing secret token header" }, { status: 401 });
      }
      const bufSecret = Buffer.from(webhookSecret);
      const bufToken = Buffer.from(secretToken);
      if (bufSecret.length !== bufToken.length || !crypto.timingSafeEqual(bufSecret, bufToken)) {
        return NextResponse.json({ error: "Unauthorized webhook request" }, { status: 401 });
      }
    }


    const body = await req.json();
    logger.info(`[Telegram Webhook] Received update: ${JSON.stringify(body)}`);

    // Basic idempotency check via update_id to prevent duplicate deliveries on retry
    if (body?.update_id) {
      const updateIdKey = `telegram_update_${body.update_id}`;
      const isDuplicate = await redisGet(updateIdKey);
      if (isDuplicate) {
        return NextResponse.json({ success: true, message: "Duplicate update skipped" });
      }
      await redisSet(updateIdKey, "1", 300); // 5-minute TTL
    }

    // Register bot auto-complete command menu with Telegram
    setTelegramBotCommands().catch(() => {});

    let chatId = "";
    let rawText = "";
    let callbackQueryId: string | null = null;

    if (body?.callback_query) {
      callbackQueryId = body.callback_query.id;
      chatId = String(body.callback_query.message?.chat?.id || body.callback_query.from?.id);
      rawText = String(body.callback_query.data || "").trim();
      if (callbackQueryId) {
        await answerCallbackQuery(callbackQueryId);
      }
    } else if (body?.message?.chat) {
      chatId = String(body.message.chat.id);
      rawText = String(body.message.text || body.message.caption || "").trim();
    } else {
      return NextResponse.json({ success: true, message: "No message or callback_query to process" });
    }

    if (chatId) {
      sendTelegramChatAction(chatId, "typing").catch(() => {});
    }

    if (rawText.startsWith("cmd_")) {
      const mappedCmd = rawText.replace(/^cmd_/, "");
      rawText = `/${mappedCmd}`;
    } else if (rawText === "💳 Accounts & Net Worth") {
      rawText = "/balance";
    } else if (rawText === "📊 Summary & Flow") {
      rawText = "/summary";
    } else if (rawText === "📈 Portfolio & Assets") {
      rawText = "/portfolio";
    } else if (rawText === "🎯 Budgets & Goals") {
      rawText = "/budget";
    } else if (rawText === "📜 Recent Logs") {
      rawText = "/recent";
    } else if (rawText === "🤖 AI Coach") {
      rawText = "/ai";
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle voice notes with live Gemini 2.5 Flash Audio Transcription
    if (!rawText && body?.message?.voice) {
      sendTelegramChatAction(chatId, "record_voice").catch(() => {});
      const voiceFileId = body.message.voice.file_id;
      const downloadedVoice = await downloadTelegramFile(voiceFileId);

      if (downloadedVoice) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("telegram_chat_id", String(chatId)).maybeSingle();
        const geminiKey = prof ? getGeminiApiKeyForProfile(prof) : null;

        if (prof && geminiKey) {
          const [accsRes, famsRes, goalsRes] = await Promise.all([
            supabase.from("accounts").select("id, name, bank_name, balance, type").eq("user_id", prof.id),
            supabase.from("family_members").select("id, name, relationship, balance").eq("user_id", prof.id),
            supabase.from("goals").select("id, name, target_amount, current_amount").eq("user_id", prof.id),
          ]);
          const accs = accsRes.data || [];
          const fams = famsRes.data || [];
          const gls = goalsRes.data || [];

          const userContext = await buildRichUserContext(supabase, prof, accs, fams, gls);
          const history = await getTelegramChatHistory(chatId);
          const audioBase64 = downloadedVoice.buffer.toString("base64");

          const voiceDecision = await parseVoiceNoteWithGemini(audioBase64, "audio/ogg", userContext, geminiKey, history);

          if (voiceDecision && voiceDecision.transcription) {
            rawText = voiceDecision.transcription;
            await sendTelegramMessage(chatId, `🎙️ *Voice Note Transcribed*: "${voiceDecision.transcription}"`);

            if (voiceDecision.action === "LOG_EXPENSE" && voiceDecision.amount) {
              const matchedAcc = accs.find((a: any) => (a.name || "").toLowerCase().includes((voiceDecision.accountName || "").toLowerCase())) || accs[0];
              if (matchedAcc) {
                const newBal = (parseFloat(matchedAcc.balance) || 0) - voiceDecision.amount;
                const cat = voiceDecision.category || "Other";
                const desc = voiceDecision.description || voiceDecision.transcription;

                const { data: txData } = await supabase.from("transactions").insert({
                  user_id: prof.id,
                  amount: voiceDecision.amount,
                  type: "expense",
                  category: cat,
                  description: desc,
                  account_id: matchedAcc.id,
                  date: new Date().toISOString().split("T")[0],
                  source_type: "expense"
                }).select("id").single();

                await supabase.from("accounts").update({ balance: newBal }).eq("id", matchedAcc.id);
                await checkAndNotifyBudget(supabase, prof.id, chatId, cat, voiceDecision.amount);

                const confirmMsg = `🤖 *Voice Decision*: Expense Logged!\n\n` +
                  `💸 *Amount*: ₹${voiceDecision.amount.toLocaleString("en-IN")}\n` +
                  `🏷️ *Category*: ${cat}\n` +
                  `📝 *Details*: ${desc}\n` +
                  `💳 *Account*: ${matchedAcc.name} (Bal: ₹${newBal.toLocaleString("en-IN")})\n` +
                  `🧠 *Reasoning*: ${voiceDecision.reasoning || "Parsed from voice audio."}\n\n` +
                  `⚡ *Status*: Synced with dashboard.`;

                await sendTelegramMessage(chatId, confirmMsg, CATEGORY_KEYBOARD(txData?.id || ""));
                await appendTelegramChatHistory(chatId, `[Voice] ${voiceDecision.transcription}`, confirmMsg);
                return NextResponse.json({ success: true });
              }
            } else if (voiceDecision.replyMessage || voiceDecision.action === "FINANCIAL_QUERY") {
              const reply = voiceDecision.replyMessage || `I transcribed your voice note: "${voiceDecision.transcription}".`;
              await sendTelegramMessage(chatId, `🤖 *Gemini AI Financial Coach*:\n\n${reply}`);
              await appendTelegramChatHistory(chatId, `[Voice] ${voiceDecision.transcription}`, reply);
              return NextResponse.json({ success: true });
            }
          }
        }
      }

      await sendTelegramMessage(
        chatId,
        "🎙️ *Voice Note Received*\nAudio transcription active. _(Tip: Ensure Gemini AI is enabled in your dashboard Settings > Gemini AI Key)_"
      );
      return NextResponse.json({ success: true });
    }

    // Handle receipt/bill photos with Gemini 2.5 Flash Vision OCR
    if (!rawText && body?.message?.photo) {
      sendTelegramChatAction(chatId, "upload_photo").catch(() => {});
      const photos = body.message.photo;
      const largestPhoto = photos[photos.length - 1];
      const downloadedPhoto = await downloadTelegramFile(largestPhoto.file_id);

      if (downloadedPhoto) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("telegram_chat_id", String(chatId)).maybeSingle();
        const geminiKey = prof ? getGeminiApiKeyForProfile(prof) : null;

        if (prof && geminiKey) {
          const [accsRes, famsRes, goalsRes] = await Promise.all([
            supabase.from("accounts").select("id, name, bank_name, balance, type").eq("user_id", prof.id),
            supabase.from("family_members").select("id, name, relationship, balance").eq("user_id", prof.id),
            supabase.from("goals").select("id, name, target_amount, current_amount").eq("user_id", prof.id),
          ]);
          const accs = accsRes.data || [];
          const fams = famsRes.data || [];
          const gls = goalsRes.data || [];

          const userContext = await buildRichUserContext(supabase, prof, accs, fams, gls);
          const imgBase64 = downloadedPhoto.buffer.toString("base64");

          const receiptRes = await parseReceiptWithGemini(imgBase64, "image/jpeg", userContext, geminiKey);

          if (receiptRes.success && receiptRes.amount && accs.length > 0) {
            const matchedAcc = accs.find((a: any) => (a.name || "").toLowerCase().includes((receiptRes.accountName || "").toLowerCase())) || accs[0];
            const newBal = (parseFloat(matchedAcc.balance) || 0) - receiptRes.amount;
            const txDate = receiptRes.date || new Date().toISOString().split("T")[0];

            const { data: txData } = await supabase.from("transactions").insert({
              user_id: prof.id,
              amount: receiptRes.amount,
              type: "expense",
              category: receiptRes.category,
              description: receiptRes.description,
              account_id: matchedAcc.id,
              date: txDate,
              source_type: "receipt_ocr"
            }).select("id").single();

            await supabase.from("accounts").update({ balance: newBal }).eq("id", matchedAcc.id);
            await checkAndNotifyBudget(supabase, prof.id, chatId, receiptRes.category, receiptRes.amount);

            const itemListStr = receiptRes.items.length > 0 ? receiptRes.items.join(", ") : receiptRes.description;

            const receiptMsg = `🧾 *Receipt Scanned with Gemini Vision!*\n\n` +
              `🏪 *Merchant*: ${receiptRes.merchantName}\n` +
              `💸 *Amount*: ₹${receiptRes.amount.toLocaleString("en-IN")}\n` +
              `🏷️ *Category*: ${receiptRes.category}\n` +
              `🛒 *Items*: ${itemListStr}\n` +
              `💳 *Account*: ${matchedAcc.name} (Bal: ₹${newBal.toLocaleString("en-IN")})\n` +
              `📅 *Date*: ${txDate}\n\n` +
              `⚡ *Status*: Expense logged live to dashboard!`;

            await sendTelegramMessage(chatId, receiptMsg, CATEGORY_KEYBOARD(txData?.id || ""));
            return NextResponse.json({ success: true });
          }
        }
      }

      await sendTelegramMessage(
        chatId,
        "📸 *Receipt Photo Received*\nTap a quick amount & category below or reply with a caption (e.g., `450 Dinner`) to log this receipt:",
        {
          inline_keyboard: [
            [
              { text: "🍔 Food (₹200)", callback_data: "200 Food Receipt" },
              { text: "🛒 Groceries (₹500)", callback_data: "500 Groceries Receipt" }
            ],
            [
              { text: "🛍️ Shopping (₹1000)", callback_data: "1000 Shopping Receipt" },
              { text: "🚗 Transport (₹300)", callback_data: "300 Transport Receipt" }
            ],
            [
              { text: "💡 Utilities (₹1500)", callback_data: "1500 Utilities Receipt" },
              { text: "☕ Coffee (₹100)", callback_data: "100 Coffee Receipt" }
            ]
          ]
        }
      );
      return NextResponse.json({ success: true });
    }

    if (!rawText) {
      return NextResponse.json({ success: true, message: "No text or caption to parse" });
    }


    // 1. Handle Account Link command (/link tg-123456, /start tg-123456, or bare tg-123456)
    const linkMatch = rawText.match(/^(?:\/)?(?:link|start)?\s*(tg-\d+)/i);

    // Handle bare /start without link code — show welcome message
    if (/^\/start$/i.test(rawText.trim())) {
      await sendTelegramMessage(
        chatId,
        `👋 *Welcome to the Finance Dashboard Bot!*\n\n` +
        `To get started, you need to link this bot to your dashboard account:\n\n` +
        `1️⃣ Go to your dashboard *Settings > Integrations*\n` +
        `2️⃣ Click *Generate Code* under Telegram Bot\n` +
        `3️⃣ Send the code here: \`/link tg-xxxxxx\`\n\n` +
        `Or scan the QR code shown on your dashboard!\n\n` +
        `_Already linked? Type \`/help\` to see all commands._`
      );
      return NextResponse.json({ success: true });
    }
    if (linkMatch) {
      const code = linkMatch[1].toLowerCase();

      // 1. Try secure definer RPC function to link Telegram account
      const { data: linkRes, error: rpcErr } = await supabase.rpc("link_telegram_account", {
        p_link_code: code,
        p_chat_id: String(chatId),
      });

      let linkedUsername = "User";

      if (!rpcErr && linkRes && typeof linkRes === "object" && linkRes.success === true) {
        linkedUsername = linkRes.username || "User";
      } else {
        // 2. Fallback JS approach if RPC function is not yet deployed to remote DB
        const { data: profile, error: searchError } = await supabase
          .from("profiles")
          .select("id, username")
          .ilike("telegram_link_code", code)
          .maybeSingle();

        if (searchError || !profile) {
          await sendTelegramMessage(chatId, "❌ *Link Failed*: Invalid or expired link code. Please check your dashboard Settings to generate a new code.");
          return NextResponse.json({ success: true });
        }

        // Unlink any old profile currently tied to this chatId to avoid UNIQUE constraint violation
        await supabase
          .from("profiles")
          .update({ telegram_chat_id: null })
          .eq("telegram_chat_id", String(chatId));

        // Link the profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            telegram_chat_id: String(chatId),
            telegram_link_code: null,
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error("Failed to update profile Telegram chat ID:", updateError);
          await sendTelegramMessage(chatId, `❌ *System Error*: Could not link account. (${updateError.message || "Database rejected update"})`);
          return NextResponse.json({ success: true });
        }

        linkedUsername = profile.username || "User";
      }

      await sendTelegramMessage(
        chatId,
        `🎉 *Success!* Bot linked to account *${linkedUsername}*.\n\n` +
        `🚀 *What can you do now?*\n` +
        `• Log quick expenses: \`50 Tea\` or \`120+45+30 Lunch\`\n` +
        `• Check balances: \`/balance\`\n` +
        `• Monthly summary: \`/summary\`\n` +
        `• Undo mistakes: \`/undo\`\n\n` +
        `👇 Tap any button below to open the interactive control menu!`,
        MAIN_REPLY_KEYBOARD
      );
      return NextResponse.json({ success: true });
    }

    // 2. Identify user & fetch context via SECURITY DEFINER RPC (bypasses RLS filtering)
    let profile: any = null;
    let accounts: any[] = [];
    let familyMembers: any[] = [];
    let goals: any[] = [];

    const { data: ctxRes, error: ctxErr } = await supabase.rpc("get_telegram_user_context", {
      p_chat_id: String(chatId),
    });

    if (!ctxErr && ctxRes && typeof ctxRes === "object" && ctxRes.success === true) {
      profile = ctxRes.profile;
      accounts = ctxRes.accounts || [];
      familyMembers = ctxRes.familyMembers || [];
      goals = ctxRes.goals || [];
    } else {
      // Fallback direct reads
      const { data: profData, error: profError } = await supabase
        .from("profiles")
        .select("id, sms_sync_token, default_accounts, username, base_currency, gemini_api_key, gemini_enabled")
        .eq("telegram_chat_id", String(chatId))
        .maybeSingle();

      if (profError || !profData) {
        await sendTelegramMessage(
          chatId,
          "⚠️ *Not Linked*: This Telegram account is not connected to your dashboard yet.\n\nTo link it:\n1. Go to your dashboard **Settings > Connected Integrations**.\n2. Click *Generate Telegram Code*.\n3. Send the code here as `/link tg-xxxxxx`."
        );
        return NextResponse.json({ success: true });
      }
      profile = profData;

      const [{ data: accsData }, { data: famsData }, { data: goalsData }] = await Promise.all([
        supabase.from("accounts").select("id, name, bank_name, balance, type").eq("user_id", profile.id),
        supabase.from("family_members").select("id, name, relationship, balance").eq("user_id", profile.id),
        supabase.from("goals").select("id, name, target_amount, current_amount").eq("user_id", profile.id),
      ]);

      accounts = accsData || [];
      familyMembers = famsData || [];
      goals = goalsData || [];
    }

    if (!profile) {
      await sendTelegramMessage(
        chatId,
        "⚠️ *Not Linked*: This Telegram account is not connected to your dashboard yet.\n\nTo link it:\n1. Go to your dashboard **Settings > Connected Integrations**.\n2. Click *Generate Telegram Code*.\n3. Send the code here as `/link tg-xxxxxx`."
      );
      return NextResponse.json({ success: true });
    }

    // ─── 0. Greetings & Friendly Natural Language AI Assistant ───
    const cleanRaw = rawText.trim().toLowerCase();
    const isGreeting = /^(hi|hello|hey|hlo|hy|hola|yo|sup|\/start|start|good\s*morning|good\s*evening|good\s*afternoon|who\s*are\s*you|\/menu|\/help|menu|help)$/i.test(cleanRaw);

    // Only show static greeting if AI is NOT available — otherwise let AI handle it
    const hasGeminiKey = !!getGeminiApiKeyForProfile(profile);
    if (isGreeting && !hasGeminiKey) {
      const userName = profile.username || profile.full_name || "there";
      const greetingMsg = `👋 *Hello ${userName}!* Welcome to your *AI Wealth & Financial Terminal*.\n\n` +
        `You can perform *all web dashboard actions* directly here in Telegram:\n\n` +
        `💳 *Accounts & Net Worth*\n` +
        `• Send \`/balance\` or \`/accounts\` to view bank balances & net worth\n` +
        `• Send \`add account SBI 5000\` to create a new bank account\n` +
        `• Send \`transfer 2000 from SBI to HDFC\` to move funds\n\n` +
        `💸 *Log Income & Expenses*\n` +
        `• Send \`450 Swiggy\` or \`1200 Petrol\`\n` +
        `• Send \`salary 50000\` or \`credit 10000 freelance\`\n` +
        `• Send \`/recent\` or \`/undo\`\n\n` +
        `📈 *Investments (Stocks, MFs, Crypto, Bonds, FnO)*\n` +
        `• Send \`buy 10 TATAMOTORS at 950\` (Stocks)\n` +
        `• Send \`invest 5000 in Parag Parikh Flexi Cap\` (Mutual Funds)\n` +
        `• Send \`buy 0.05 BTC at 65000\` (Crypto)\n` +
        `• Send \`/stocks\`, \`/mf\`, \`/crypto\`, \`/bonds\` to view portfolio\n\n` +
        `🎯 *Goals & Budget*\n` +
        `• Send \`/goals\` or \`/budget\` or \`goal Car 5000\`\n\n` +
        `🤖 *AI Chat & Financial Coach*\n` +
        `• Ask me anything! e.g. *"What is my net worth?"*, *"How much did I spend this month?"*, or *"Give me tips to save money"*`;

      await sendTelegramMessage(chatId, greetingMsg, MAIN_REPLY_KEYBOARD);
      return NextResponse.json({ success: true });
    }

    // ─── 0B. Autonomous Gemini AI Decision Engine ───
    const geminiApiKey = getGeminiApiKeyForProfile(profile);
    if (geminiApiKey && !rawText.startsWith("cat_") && !rawText.startsWith("/")) {
      try {
        const userContext = await buildRichUserContext(supabase, profile, accounts, familyMembers, goals);
        const chatHistory = await getTelegramChatHistory(chatId);

        const decision = await parseAutonomousTelegramIntent(rawText, userContext, geminiApiKey, chatHistory);


        const findAccountByName = (accName?: string | null) => {
          if (!accounts || accounts.length === 0) return null;
          if (!accName) return accounts[0];
          const target = accName.toLowerCase().trim();
          return accounts.find((a: any) => {
            const name = (a.name || "").toLowerCase().trim();
            const bank = (a.bank_name || "").toLowerCase().trim();
            return name === target || bank === target || name.includes(target) || target.includes(name) || bank.includes(target) || target.includes(bank);
          }) || accounts[0];
        };

        if (decision && decision.action !== "UNKNOWN") {
          // 1. Autonomous CREATE_ACCOUNT
          if (decision.action === "CREATE_ACCOUNT") {
            let accName = (decision.accountName || rawText.replace(/^(create|add)\s*(account|bank)\s*/i, "")).trim();
            if (accName.length <= 5) accName = accName.toUpperCase();
            else accName = accName.charAt(0).toUpperCase() + accName.slice(1);
            const initialBalance = decision.initialBalance || 0;
            const accType = decision.accountType || "checking";

            const { data: rpcRes, error: rpcErr } = await supabase.rpc("create_account_atomic", {
              p_user_id: profile.id,
              p_name: accName,
              p_type: accType,
              p_balance: initialBalance,
              p_currency: profile.base_currency || "INR",
              p_bank_name: accName,
            });

            if (!rpcErr && rpcRes && typeof rpcRes === "object" && (rpcRes as any).success !== false) {
              await sendTelegramMessage(
                chatId,
                `🤖 *Gemini AI Decision*: Created Bank Account!\n\n` +
                `• *Account Name*: ${accName}\n` +
                `• *Type*: ${accType.toUpperCase()}\n` +
                `• *Initial Balance*: ₹${initialBalance.toLocaleString("en-IN")}\n` +
                `• *Reasoning*: ${decision.reasoning || "Autonomously initialized bank account."}\n\n` +
                `⚡ *Status*: Synced live with website dashboard.`
              );
              return NextResponse.json({ success: true });
            }
          }

          // 2. Autonomous LOG_EXPENSE
          if (decision.action === "LOG_EXPENSE") {
            const amount = decision.amount || 0;
            if (amount > 0) {
              const matchedAcc = findAccountByName(decision.accountName);
              if (!matchedAcc) {
                await sendTelegramMessage(chatId, NO_ACCOUNT_MSG);
                return NextResponse.json({ success: true });
              }
              const cat = decision.category || "Other";
              const desc = decision.description || rawText;
              const newBal = (parseFloat(matchedAcc.balance) || 0) - amount;

              const { data: txData, error: txErr } = await supabase
                .from("transactions")
                .insert({
                  user_id: profile.id,
                  amount,
                  type: "expense",
                  category: cat,
                  description: desc,
                  account_id: matchedAcc.id,
                  date: new Date().toISOString().split("T")[0],
                  source_type: "expense"
                })
                .select("id")
                .single();

              if (!txErr) {
                await supabase
                  .from("accounts")
                  .update({ balance: newBal })
                  .eq("id", matchedAcc.id)
                  .eq("user_id", profile.id);

                await checkAndNotifyBudget(supabase, profile.id, chatId, cat, amount);

                await sendTelegramMessage(
                  chatId,
                  `🤖 *AI Decision*: Expense Logged!\n\n` +
                  `💸 *Amount*: ₹${amount.toLocaleString("en-IN")}\n` +
                  `🏷️ *Category*: ${cat}\n` +
                  `📝 *Description*: ${desc}\n` +
                  `💳 *Account*: ${matchedAcc.name} (Remaining: ₹${newBal.toLocaleString("en-IN")})\n` +
                  `🧠 *Reasoning*: ${decision.reasoning || "Autonomously logged expense."}\n\n` +
                  `⚡ *Status*: Synced with dashboard.`,
                  CATEGORY_KEYBOARD(txData?.id || "")
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 3. Autonomous LOG_INCOME
          if (decision.action === "LOG_INCOME") {
            const amount = decision.amount || 0;
            if (amount > 0) {
              const matchedAcc = findAccountByName(decision.accountName);
              if (!matchedAcc) {
                await sendTelegramMessage(chatId, NO_ACCOUNT_MSG);
                return NextResponse.json({ success: true });
              }
              const cat = decision.category || "Income";
              const desc = decision.description || rawText;
              const newBal = (parseFloat(matchedAcc.balance) || 0) + amount;

              const { error: txErr } = await supabase
                .from("transactions")
                .insert({
                  user_id: profile.id,
                  amount,
                  type: "income",
                  category: cat,
                  description: desc,
                  account_id: matchedAcc.id,
                  date: new Date().toISOString().split("T")[0],
                  source_type: "income"
                });

              if (!txErr) {
                await supabase
                  .from("accounts")
                  .update({ balance: newBal })
                  .eq("id", matchedAcc.id)
                  .eq("user_id", profile.id);

                await sendTelegramMessage(
                  chatId,
                  `🤖 *AI Decision*: Income Logged!\n\n` +
                  `💵 *Amount*: +₹${amount.toLocaleString("en-IN")}\n` +
                  `🏷️ *Category*: ${cat}\n` +
                  `📝 *Description*: ${desc}\n` +
                  `💳 *Account*: ${matchedAcc.name} (New Balance: ₹${newBal.toLocaleString("en-IN")})\n` +
                  `🧠 *Reasoning*: ${decision.reasoning || "Autonomously logged income."}\n\n` +
                  `⚡ *Status*: Synced with dashboard.`
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 4. Autonomous BUY_STOCK
          if (decision.action === "BUY_STOCK") {
            const symbol = (decision.symbol || decision.description || "STOCK").toUpperCase();
            const quantity = decision.quantity || 1;
            const price = decision.price || decision.amount || 0;
            const totalCost = quantity * price;

            if (price > 0 && quantity > 0) {
              const matchedAcc = findAccountByName(decision.accountName);
              const { error: invErr } = await supabase.from("investments").insert({
                user_id: profile.id,
                name: symbol,
                symbol: symbol,
                quantity: quantity,
                buy_price: price,
                current_price: price,
                currency: profile.base_currency || "INR",
                type: "stock",
                bought_at: new Date().toISOString().split("T")[0]
              });

              if (!invErr) {
                let accMsg = "";
                if (matchedAcc && totalCost > 0) {
                  const newBal = (parseFloat(matchedAcc.balance) || 0) - totalCost;
                  await supabase.from("accounts").update({ balance: newBal }).eq("id", matchedAcc.id).eq("user_id", profile.id);
                  accMsg = ` (Deducted ₹${totalCost.toLocaleString("en-IN")} from ${matchedAcc.name})`;
                }

                await sendTelegramMessage(
                  chatId,
                  `🤖 *AI Decision*: Stock Investment Recorded!\n\n` +
                  `📈 *Stock Symbol*: ${symbol}\n` +
                  `🔢 *Quantity*: ${quantity} @ ₹${price.toLocaleString("en-IN")}\n` +
                  `💰 *Total Cost*: ₹${totalCost.toLocaleString("en-IN")}${accMsg}\n` +
                  `🧠 *Reasoning*: ${decision.reasoning || "Autonomously logged stock purchase."}\n\n` +
                  `⚡ *Status*: Synced with dashboard.`
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 5. Autonomous BUY_MUTUAL_FUND
          if (decision.action === "BUY_MUTUAL_FUND") {
            const fundName = decision.fundName || decision.description || "Mutual Fund";
            const amount = decision.amount || (decision.quantity && decision.price ? decision.quantity * decision.price : 0);

            if (amount > 0) {
              const matchedAcc = findAccountByName(decision.accountName);
              const units = parseFloat((amount / 100).toFixed(4));
              const nav = 100;

              const { error: mfErr } = await supabase.from("mutual_funds").insert({
                user_id: profile.id,
                fund_name: fundName,
                units: units,
                avg_nav: nav,
                current_nav: nav,
                category: "Equity",
                amc_name: fundName.split(" ")[0] || "AMC",
                investment_type: "SIP"
              });

              if (!mfErr) {
                let accMsg = "";
                if (matchedAcc) {
                  const newBal = (parseFloat(matchedAcc.balance) || 0) - amount;
                  await supabase.from("accounts").update({ balance: newBal }).eq("id", matchedAcc.id).eq("user_id", profile.id);
                  accMsg = ` (Deducted ₹${amount.toLocaleString("en-IN")} from ${matchedAcc.name})`;
                }

                await sendTelegramMessage(
                  chatId,
                  `🤖 *AI Decision*: Mutual Fund Investment Recorded!\n\n` +
                  `📊 *Fund Name*: ${fundName}\n` +
                  `💰 *Invested Amount*: ₹${amount.toLocaleString("en-IN")}${accMsg}\n` +
                  `🧠 *Reasoning*: ${decision.reasoning || "Autonomously logged mutual fund investment."}\n\n` +
                  `⚡ *Status*: Synced with dashboard.`
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 6. Autonomous TRANSFER_BETWEEN_ACCOUNTS
          if (decision.action === "TRANSFER_BETWEEN_ACCOUNTS") {
            const amount = decision.amount || 0;
            const fromName = decision.fromAccountName;
            const toName = decision.toAccountName;

            if (amount > 0 && fromName && toName) {
              const fromAcc = findAccountByName(fromName);
              const toAcc = findAccountByName(toName);

              if (fromAcc && toAcc && fromAcc.id !== toAcc.id) {
                const fromBal = (parseFloat(fromAcc.balance) || 0) - amount;
                const toBal = (parseFloat(toAcc.balance) || 0) + amount;

                await supabase.from("accounts").update({ balance: fromBal }).eq("id", fromAcc.id).eq("user_id", profile.id);
                await supabase.from("accounts").update({ balance: toBal }).eq("id", toAcc.id).eq("user_id", profile.id);

                await sendTelegramMessage(
                  chatId,
                  `🤖 *AI Decision*: Account Transfer Completed!\n\n` +
                  `🔄 *Transferred*: ₹${amount.toLocaleString("en-IN")}\n` +
                  `📤 *From*: ${fromAcc.name} (New Bal: ₹${fromBal.toLocaleString("en-IN")})\n` +
                  `📥 *To*: ${toAcc.name} (New Bal: ₹${toBal.toLocaleString("en-IN")})\n` +
                  `🧠 *Reasoning*: ${decision.reasoning || "Autonomously executed account transfer."}\n\n` +
                  `⚡ *Status*: Synced with dashboard.`
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 7. Autonomous FAMILY_TRANSFER
          if (decision.action === "FAMILY_TRANSFER") {
            const amount = decision.amount || 0;
            const memberName = (decision.familyMemberName || "").toLowerCase().trim();

            if (amount > 0 && memberName && familyMembers && familyMembers.length > 0) {
              const matchedMember = familyMembers.find((f: any) => {
                const fName = (f.name || "").toLowerCase().trim();
                const fRel = (f.relationship || "").toLowerCase().trim();
                return fName.includes(memberName) || memberName.includes(fName) || fRel.includes(memberName);
              });

              if (matchedMember) {
                const newFamBal = (parseFloat(matchedMember.balance) || 0) + amount;
                await supabase.from("family_members").update({ balance: newFamBal }).eq("id", matchedMember.id).eq("user_id", profile.id);

                let accMsg = "";
                const matchedAcc = findAccountByName(decision.fromAccountName || decision.accountName);
                if (matchedAcc) {
                  const newAccBal = (parseFloat(matchedAcc.balance) || 0) - amount;
                  await supabase.from("accounts").update({ balance: newAccBal }).eq("id", matchedAcc.id).eq("user_id", profile.id);
                  accMsg = ` from ${matchedAcc.name}`;
                }

                await sendTelegramMessage(
                  chatId,
                  `🤖 *AI Decision*: Family Transfer Logged!\n\n` +
                  `👨‍👩‍👧 *Sent To*: ${matchedMember.name} (${matchedMember.relationship || "Family"})\n` +
                  `💰 *Amount*: ₹${amount.toLocaleString("en-IN")}${accMsg}\n` +
                  `🧠 *Reasoning*: ${decision.reasoning || "Autonomously logged family transfer."}\n\n` +
                  `⚡ *Status*: Synced with dashboard.`
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 8. Autonomous UPDATE_ACCOUNT
          if (decision.action === "UPDATE_ACCOUNT") {
            const targetAcc = findAccountByName(decision.accountName);
            if (targetAcc) {
              const updateData: any = {};
              if (decision.newAccountName) updateData.name = decision.newAccountName;
              if (typeof decision.initialBalance === "number") updateData.balance = decision.initialBalance;

              if (Object.keys(updateData).length > 0) {
                await supabase.from("accounts").update(updateData).eq("id", targetAcc.id).eq("user_id", profile.id);

                await sendTelegramMessage(
                  chatId,
                  `🤖 *AI Decision*: Account Updated!\n\n` +
                  `💳 *Account*: ${updateData.name || targetAcc.name}\n` +
                  (updateData.balance !== undefined ? `💰 *New Balance*: ₹${updateData.balance.toLocaleString("en-IN")}\n` : "") +
                  `🧠 *Reasoning*: ${decision.reasoning || "Autonomously updated account."}\n\n` +
                  `⚡ *Status*: Synced with dashboard.`
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 9. Autonomous FINANCIAL_QUERY
          if (decision.action === "FINANCIAL_QUERY" && decision.replyMessage) {
            await sendTelegramMessage(chatId, `🤖 *Gemini AI Financial Coach*:\n\n${decision.replyMessage}`);
            await appendTelegramChatHistory(chatId, rawText, decision.replyMessage);
            return NextResponse.json({ success: true });
          }


          // 10. Autonomous DELETE_ACCOUNT
          if (decision.action === "DELETE_ACCOUNT") {
            const targetName = (decision.accountName || "").toLowerCase().trim();
            if (targetName && accounts.length > 0) {
              const matchedAccount = accounts.find((a: any) => {
                const aName = (a.name || "").toLowerCase().trim();
                const aBankName = (a.bank_name || "").toLowerCase().trim();
                return aName === targetName || aBankName === targetName ||
                  aName.includes(targetName) || targetName.includes(aName) ||
                  aBankName.includes(targetName) || targetName.includes(aBankName);
              });

              if (matchedAccount) {
                const balance = parseFloat(matchedAccount.balance) || 0;
                const { error: delErr } = await supabase
                  .from("accounts")
                  .delete()
                  .eq("id", matchedAccount.id)
                  .eq("user_id", profile.id);

                if (!delErr) {
                  await sendTelegramMessage(
                    chatId,
                    `🤖 *AI Decision*: Account Deleted!\n\n` +
                    `• *Account*: ${matchedAccount.name}\n` +
                    `• *Balance was*: ₹${balance.toLocaleString("en-IN")}\n` +
                    `• *Reasoning*: ${decision.reasoning || "User requested account deletion."}\n\n` +
                    `⚡ *Status*: Synced with dashboard.`
                  );
                  return NextResponse.json({ success: true });
                }
              } else {
                await sendTelegramMessage(
                  chatId,
                  `❌ *Account not found*: Could not find an account matching "${decision.accountName}".\n\nYour accounts: ${accounts.map((a: any) => a.name).join(", ")}`
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 11. Autonomous ADD_FAMILY_MEMBER
          if (decision.action === "ADD_FAMILY_MEMBER") {
            const memberName = (decision.familyMemberName || "").trim();
            if (memberName) {
              const relationship = decision.familyRelationship || "Other";
              const { error: famErr } = await supabase
                .from("family_members")
                .insert({
                  user_id: profile.id,
                  name: memberName.charAt(0).toUpperCase() + memberName.slice(1),
                  relationship: relationship,
                  balance: 0,
                });

              if (!famErr) {
                await sendTelegramMessage(
                  chatId,
                  `🤖 *AI Decision*: Family Member Added!\n\n` +
                  `• *Name*: ${memberName.charAt(0).toUpperCase() + memberName.slice(1)}\n` +
                  `• *Relationship*: ${relationship}\n` +
                  `• *Balance*: ₹0\n\n` +
                  `⚡ *Status*: Synced with dashboard.`
                );
                return NextResponse.json({ success: true });
              }
            }
          }

          // 12. Autonomous GREETING — AI-powered welcome
          if (decision.action === "GREETING") {
            const userName = profile.username || profile.full_name || "there";
            const aiGreeting = decision.replyMessage || `Hey ${userName}! 👋`;
            const greetingMsg = `${aiGreeting}\n\n` +
              `💡 *Quick Actions*: Send \`/balance\`, \`/summary\`, or just ask me anything in natural language!`;
            await sendTelegramMessage(chatId, greetingMsg, MAIN_REPLY_KEYBOARD);
            return NextResponse.json({ success: true });
          }
        }
      } catch (geminiErr) {
        console.warn("Autonomous Gemini decision failed, falling back to pattern matchers:", geminiErr);
      }
    }

    // Handle inline category re-assignment callback (e.g. "cat_txId_Category")
    if (rawText.startsWith("cat_")) {
      const parts = rawText.split("_");
      if (parts.length >= 3) {
        const txId = parts[1];
        const newCategory = parts.slice(2).join("_");
        
        const { error: catUpdateErr } = await supabase
          .from("transactions")
          .update({ category: newCategory })
          .eq("id", txId)
          .eq("user_id", profile.id);

        if (!catUpdateErr) {
          await sendTelegramMessage(
            chatId,
            `🏷️ *Category Updated*\nTransaction category changed to *${newCategory}* successfully!`,
            MAIN_MENU_KEYBOARD
          );
        } else {
          await sendTelegramMessage(chatId, `❌ *Failed to update category*: ${catUpdateErr.message}`);
        }
        return NextResponse.json({ success: true });
      }
    }

    // Handle Add Bank Account command (e.g. "add account SBI", "add account SBI 5000", "create account HDFC", "450 add account sbi")
    const addAccountMatch = rawText.match(/^(?:([\d,]+(?:\.\d{1,2})?)\s+)?(?:\/)?(?:add\s*account|add\s*bank|create\s*account|create\s*bank|addaccount|addbank)(?:\s+(.+))?$/i);
    if (addAccountMatch) {
      const leadingAmountStr = addAccountMatch[1];
      const rest = (addAccountMatch[2] || "").trim();

      let accName = rest;
      let initialBalance = leadingAmountStr ? parseFloat(leadingAmountStr.replace(/,/g, "")) || 0 : 0;

      if (!initialBalance && rest) {
        const balanceMatch = rest.match(/^(.*?)\s+([\d,]+(?:\.\d{1,2})?)$/);
        if (balanceMatch) {
          accName = balanceMatch[1].trim();
          initialBalance = parseFloat(balanceMatch[2].replace(/,/g, "")) || 0;
        }
      }

      if (!accName) {
        await sendTelegramMessage(
          chatId,
          "⚠️ *Account Name Needed*: Please specify an account name, e.g.:\n`add account SBI` or `add account SBI 5000`."
        );
        return NextResponse.json({ success: true });
      }

      if (accName.length <= 5) accName = accName.toUpperCase();
      else accName = accName.charAt(0).toUpperCase() + accName.slice(1);

      // Try RPC first
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("create_account_atomic", {
        p_user_id: profile.id,
        p_name: accName,
        p_type: "checking",
        p_balance: initialBalance,
        p_currency: profile.base_currency || "INR",
        p_bank_name: accName,
      });

      if (rpcErr || !rpcRes || typeof rpcRes !== "object" || (rpcRes as any).success === false) {
        // Fallback direct table insert
        const { data: insertData, error: insertErr } = await supabase
          .from("accounts")
          .insert({
            user_id: profile.id,
            name: accName,
            type: "checking",
            balance: initialBalance,
            currency: profile.base_currency || "INR",
            bank_name: accName,
          })
          .select("id, name, balance")
          .single();

        if (insertErr || !insertData) {
          console.error("Failed to insert account directly:", insertErr);
          await sendTelegramMessage(
            chatId,
            `❌ *Failed to Create Account*: ${insertErr?.message || rpcErr?.message || "Database rejected insert."}`
          );
          return NextResponse.json({ success: true });
        }
      }

      await sendTelegramMessage(
        chatId,
        `💳 *Bank Account Created!*\n\n` +
        `• *Name*: ${accName}\n` +
        `• *Initial Balance*: ₹${initialBalance.toLocaleString("en-IN")}\n\n` +
        `🎉 You can now log expenses & income immediately in chat!\n` +
        `Try: \`50 Tea\` or \`credit 5000 Salary\` or \`debit 450 food\``
      );
      return NextResponse.json({ success: true });
    }

    // Run parseNaturalDate first to extract dates like 2026-07-15 before evaluateInlineMath ever sees them
    const initialDateParsed = parseNaturalDate(rawText);
    const mathEval = evaluateInlineMath(initialDateParsed.cleanedText);
    let text = mathEval ? mathEval.cleanedText : initialDateParsed.cleanedText;

    const resolveAccount = (type: "expense" | "income", queryText?: string, accountEnding?: string | null): string | null => {
      if (!accounts || accounts.length === 0) return null;
      if (accountEnding && accountEnding.length >= 4) {
        const matched = accounts.find(a => (a.name && a.name.includes(accountEnding)) || (a.bank_name && a.bank_name.includes(accountEnding)));
        if (matched) return matched.id;
      }
      if (queryText) {
        const lowerQ = queryText.toLowerCase();
        for (const acc of accounts) {
          const accLower = (acc.name || "").toLowerCase().trim();
          const bankLower = (acc.bank_name || "").toLowerCase().trim();
          if ((accLower.length >= 2 && new RegExp(`\\b${accLower.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(lowerQ)) ||
              (bankLower.length >= 2 && new RegExp(`\\b${bankLower.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(lowerQ))) {
            return acc.id;
          }
        }
      }
      const defaultAccounts = (profile.default_accounts as Record<string, string | null>) || {};
      const defaultId = type === "expense" ? defaultAccounts.expenses : defaultAccounts.income;
      if (defaultId && accounts.some((acc: any) => acc.id === defaultId)) {
        return defaultId;
      }
      return accounts[0]?.id || null;
    };

    // ─── CHECK PENDING FOLLOW-UP STATE FROM REDIS ───
    const pendingKey = `telegram_pending_${chatId}`;
    const pendingDataStr = await redisGet(pendingKey);
    if (isRedisConfigured() && pendingDataStr) {
      try {
        const pendingData = JSON.parse(pendingDataStr);
        if (pendingData.pending) {
          const { date: pendingDate, cleanedText: pendingCleanReply } = parseNaturalDate(text);
          const replyLower = pendingCleanReply.toLowerCase().trim();

          // If waiting to know if amount is CREDIT or DEBIT
          if (pendingData.reason === "unknown_type") {
            const isReplyCredit = /\b(credit|cr|cr\.|income|received|salary|inflow|got|deposit)\b/.test(replyLower) && !/\b(debit|dr|spent|paid|outflow|expense)\b/.test(replyLower);
            const isReplyDebit = /\b(debit|dr|dr\.|spent|paid|outflow|expense|bought)\b/.test(replyLower) && !/\b(credit|cr|income|received|salary)\b/.test(replyLower);

            if (isReplyCredit || isReplyDebit) {
              const txType: "expense" | "income" = isReplyCredit ? "income" : "expense";
              let category = txType === "expense" ? "Other" : "Salary";
              if (txType === "expense") {
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

              const description = pendingData.description || (txType === "expense" ? "General Expense" : "General Income");
              const targetAccount = resolveAccount(txType, replyLower);
              if (!targetAccount) {
                await sendTelegramMessage(chatId, NO_ACCOUNT_MSG);
                return NextResponse.json({ success: true });
              }

              const rpcName = txType === "expense" ? "record_expense" : "record_income";
              const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
                p_user_id: profile.id,
                p_description: `[Telegram] ${description}`,
                p_amount: pendingData.amount,
                p_category: category,
                p_date: pendingDate,
                p_account_id: targetAccount,
              });

              if (rpcError) throw rpcError;
              if (rpcData && typeof rpcData === "object" && "success" in rpcData && (rpcData as any).success === false) {
                throw new Error((rpcData as any).error || "Failed to log transaction.");
              }

              await redisDel(pendingKey);
              if (txType === "expense") await checkAndNotifyBudget(supabase, profile.id, chatId, category, pendingData.amount);

              const symbol = txType === "expense" ? "💸" : "💰";
              const accObj = accounts?.find((a: any) => a.id === targetAccount);
              const brandEmoji = getBrandEmoji(description);
              const bankEmoji = getBrandEmoji(accObj?.bank_name || accObj?.name || "");
              await sendTelegramMessage(
                chatId,
                `${symbol} *Logged ${txType === "expense" ? "Expense Outflow" : "Revenue Inflow"}*\n\n` +
                `• *Amount*: ₹${pendingData.amount.toLocaleString("en-IN")}\n` +
                `• *Merchant / Desc*: ${brandEmoji} ${description}\n` +
                `• *Category*: ${category}\n` +
                `• *Account*: ${bankEmoji} ${accObj?.name || "Default Account"}\n\n` +
                `⚡ *Status*: Synced with web dashboard.`,
                TX_CONFIRM_KEYBOARD
              );
              return NextResponse.json({ success: true });
            }
          }

          // If waiting for AMOUNT (user had typed a description without a number)
          if (pendingData.reason === "unknown_amount") {
            const numbers = (text.match(/\d+(?:\.\d{1,2})?/g) || []).map(Number);
            if (numbers.length > 0 && numbers[0] > 0) {
              const amount = numbers[0];
              const description = pendingData.description || "General Entry";
              const descLower = description.toLowerCase();
              const isIncome = /\b(received|income|salary|credited|credit|earned|refund|got)\b/.test(descLower) && !/\b(paid|spent|sent|debited|debit)\b/.test(descLower);
              const txType: "expense" | "income" = isIncome ? "income" : "expense";
              let category = txType === "expense" ? "Other" : "Salary";
              if (txType === "expense") {
                if (/food|lunch|dinner|swiggy|zomato|tea/i.test(descLower)) category = "Food";
                else if (/cab|uber|petrol|fuel/i.test(descLower)) category = "Transport";
                else if (/shopping|amazon/i.test(descLower)) category = "Shopping";
              }
              const targetAccount = resolveAccount(txType, descLower);
              if (!targetAccount) {
                await sendTelegramMessage(chatId, NO_ACCOUNT_MSG);
                return NextResponse.json({ success: true });
              }

              const rpcName = txType === "expense" ? "record_expense" : "record_income";
              const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
                p_user_id: profile.id,
                p_description: `[Telegram] ${description}`,
                p_amount: amount,
                p_category: category,
                p_date: pendingDate,
                p_account_id: targetAccount,
              });

              if (rpcError) throw rpcError;
              if (rpcData && typeof rpcData === "object" && "success" in rpcData && (rpcData as any).success === false) {
                throw new Error((rpcData as any).error || "Failed to log transaction.");
              }

              await redisDel(pendingKey);
              if (txType === "expense") await checkAndNotifyBudget(supabase, profile.id, chatId, category, amount);

              const accObj = accounts?.find((a: any) => a.id === targetAccount);
              await sendTelegramMessage(
                chatId,
                `${txType === "expense" ? "💸" : "💰"} *Confirmed & Logged ${txType === "expense" ? "Expense" : "Income"}*:\n` +
                `• *Amount*: ₹${amount}\n` +
                `• *Category*: ${category}\n` +
                `• *Account*: ${accObj?.name || "Default"}\n` +
                `• *Desc*: ${description}`
              );
              return NextResponse.json({ success: true });
            }
          }
        }
      } catch (e: any) {
        console.error("Error processing pending state:", e);
        await sendTelegramMessage(chatId, `❌ *Error processing reply*: ${e.message || "Unknown error."}`);
        return NextResponse.json({ success: true });
      }
    }

    const COMMAND_ALIASES: Record<string, string> = {
      bal: "balance",
      balanace: "balance",
      balence: "balance",
      balances: "balance",
      networth: "balance",
      sumary: "summary",
      sumry: "summary",
      stat: "summary",
      stats: "summary",
      undoo: "undo",
      revert: "undo",
      helpp: "help",
      info: "help",
      recnt: "recent",
      hist: "recent",
      "recent logs": "recent",
      ledgr: "ledger",
      audit: "ledger",
      goal: "goals",
      budgt: "budget",
      budgets: "budget",
      portfolio: "portfolio",
      stocks: "portfolio",
      mf: "portfolio",
      mutualfunds: "portfolio",
      crypto: "portfolio",
      bonds: "portfolio",
      dividends: "dividends",
      dividend: "dividends",
      backup: "backup",
      exportdata: "backup",
      ai: "ai",
      "ai score": "ai",
      "ai health": "ai",
      "ai health score": "ai",
      score: "ai",
      health: "ai",
      family: "family",
      relatives: "family",
      export: "export",
      statement: "export",
      download: "export",
      "commands & help": "help",
      "commands and help": "help",
    };

    let lowerText = text.toLowerCase();
    // Clean emojis from button taps so "💳 Balances" -> "balances"
    const cleanedText = lowerText.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "").trim();
    const rawCommand = cleanedText.replace(/^\//, "").trim();
    const commandText = COMMAND_ALIASES[rawCommand] || rawCommand;

    // 3. Handle System & Inquiry Commands (/menu, /ai, /family, /ledger, /calc, /help, /balance, /summary, /recent, /undo, /goals, /budget, /unlink)
    if (commandText === "portfolio") {
      const { data: invs } = await supabase
        .from("investments")
        .select("*")
        .eq("user_id", profile.id);

      if (!invs || invs.length === 0) {
        await sendTelegramMessage(chatId, "📈 *No Investments Found*: Add stocks, mutual funds, or crypto in your dashboard!");
        return NextResponse.json({ success: true });
      }

      let totalVal = 0;
      let totalCost = 0;
      const typeMap: Record<string, { current: number; cost: number; count: number }> = {};

      for (const i of invs) {
        const qty = Number(i.quantity || 0);
        if (qty <= 0) continue;
        const curPrice = Number(i.current_price || 0);
        const buyPrice = Number(i.buy_price || 0);
        const curVal = qty * curPrice;
        const costVal = qty * buyPrice;

        totalVal += curVal;
        totalCost += costVal;

        const type = i.type || "other";
        if (!typeMap[type]) typeMap[type] = { current: 0, cost: 0, count: 0 };
        typeMap[type].current += curVal;
        typeMap[type].cost += costVal;
        typeMap[type].count += 1;
      }

      const totalPnL = totalVal - totalCost;
      const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
      const pnlSign = totalPnL >= 0 ? "+" : "";

      let msg = `📈 *Portfolio Asset Breakdown*\n\n`;
      msg += `💼 *Total Portfolio Value*: *₹${totalVal.toLocaleString("en-IN")}*\n`;
      msg += `📊 *Total P&L*: *${pnlSign}₹${totalPnL.toLocaleString("en-IN")} (${pnlSign}${totalPnLPercent.toFixed(2)}%)*\n\n`;

      for (const [type, data] of Object.entries(typeMap)) {
        const typeTitle = type === "stock" ? "🏢 Stocks" : type === "mutual_fund" ? "🎯 Mutual Funds" : type === "crypto" ? "🪙 Crypto" : type === "bond" ? "📜 Bonds" : "💎 Assets";
        const pnl = data.current - data.cost;
        const pct = data.cost > 0 ? (pnl / data.cost) * 100 : 0;
        const sign = pnl >= 0 ? "+" : "";
        msg += `${typeTitle}: *₹${data.current.toLocaleString("en-IN")}* (${data.count} items) | P&L: ${sign}₹${pnl.toLocaleString("en-IN")} (${sign}${pct.toFixed(2)}%)\n`;
      }

      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    if (commandText === "dividends") {
      const { data: divIncomes } = await supabase
        .from("incomes")
        .select("amount, description, date, category")
        .eq("user_id", profile.id)
        .or("category.ilike.%dividend%,description.ilike.%dividend%");

      if (!divIncomes || divIncomes.length === 0) {
        await sendTelegramMessage(chatId, "💵 *No Dividends Detected*: Dividend payouts auto-detected from bank SMS & uploads will appear here!");
        return NextResponse.json({ success: true });
      }

      const totalDividends = divIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
      let msg = `💵 *Dividend Earnings Summary*\n\n`;
      msg += `💰 *Total Dividend Earned*: *₹${totalDividends.toLocaleString("en-IN")}*\n`;
      msg += `📊 *Payout Count*: ${divIncomes.length} payments\n\n`;
      msg += `📜 *Recent Payouts*:\n`;

      for (const div of divIncomes.slice(-5).reverse()) {
        msg += `• *${div.description || "Dividend"}*: +₹${Number(div.amount).toLocaleString("en-IN")} (${div.date || "recent"})\n`;
      }

      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    if (commandText === "backup") {
      sendTelegramChatAction(chatId, "upload_document").catch(() => {});

      const [accsRes, invsRes, txsRes, incsRes, expsRes, budgsRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", profile.id),
        supabase.from("investments").select("*").eq("user_id", profile.id),
        supabase.from("transactions").select("*").eq("user_id", profile.id),
        supabase.from("incomes").select("*").eq("user_id", profile.id),
        supabase.from("expenses").select("*").eq("user_id", profile.id),
        supabase.from("budgets").select("*").eq("user_id", profile.id),
      ]);

      const backupObj = {
        exportedAt: new Date().toISOString(),
        username: profile.username || "User",
        currency: profile.base_currency || "INR",
        accounts: accsRes.data || [],
        investments: invsRes.data || [],
        transactions: txsRes.data || [],
        incomes: incsRes.data || [],
        expenses: expsRes.data || [],
        budgets: budgsRes.data || [],
      };

      const jsonStr = JSON.stringify(backupObj, null, 2);
      const fileName = `arthaX_backup_${new Date().toISOString().split("T")[0]}.json`;

      await sendTelegramDocument(
        chatId,
        fileName,
        jsonStr,
        `📦 *Complete Financial Backup File*\n\nContains all your accounts, investments, transactions, and budgets. Keep this safe!`
      );
      return NextResponse.json({ success: true });
    }

    if (commandText === "menu") {
      await sendTelegramMessage(
        chatId,
        "📱 *Dashboard Quick Control Menu*\nTap any button below to get real-time insights or execute actions:",
        MAIN_MENU_KEYBOARD
      );
      return NextResponse.json({ success: true });
    }

    if (commandText === "ai" || commandText === "insight" || commandText === "health" || commandText === "score") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("amount, type, category")
        .eq("user_id", profile.id)
        .gte("date", firstDay);

      let totalIncome = 0;
      let totalExpense = 0;
      const catMap: Record<string, number> = {};

      if (monthTxs) {
        for (const t of monthTxs) {
          const amt = parseFloat(t.amount) || 0;
          if (t.type === "income") totalIncome += amt;
          else {
            totalExpense += amt;
            const cat = t.category || "Other";
            catMap[cat] = (catMap[cat] || 0) + amt;
          }
        }
      }

      const savings = totalIncome - totalExpense;
      const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;

      let score = 50;
      if (savingsRate >= 30) score += 30;
      else if (savingsRate >= 15) score += 20;
      else if (savingsRate > 0) score += 10;
      else score -= 15;

      if (accounts && accounts.length > 0) score += 10;
      if (goals && goals.length > 0) score += 10;

      score = Math.min(100, Math.max(10, score));
      const scoreBadge = score >= 80 ? "🟢 Excellent" : score >= 60 ? "🟡 Good" : "🔴 Needs Attention";

      const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
      const topCatText = topCategory ? `${topCategory[0]} (₹${topCategory[1].toLocaleString("en-IN")})` : "None";

      let advice = "Keep logging daily expenses to maintain accurate cash flow tracking.";
      if (savingsRate < 10) advice = "⚠️ Your savings rate is low. Try reviewing your top spending category to curb non-essential expenses.";
      else if (savingsRate >= 30) advice = "🚀 Stellar 30%+ savings rate! Allocate your surplus into Mutual Funds or Stocks for long-term growth.";

      if (isGeminiActiveForProfile(profile)) {
        const apiKey = getGeminiApiKeyForProfile(profile);
        if (apiKey) {
          try {
            const aiAdvice = await askGeminiFinanceAssistant(
              "Give me 2 quick actionable financial coaching tips based on my monthly stats.",
              `Monthly Income: ₹${totalIncome}, Monthly Expenses: ₹${totalExpense}, Savings Rate: ${savingsRate}%, Top Category: ${topCatText}, Health Score: ${score}/100`,
              apiKey
            );
            if (aiAdvice) advice = aiAdvice;
          } catch {
            // Silently fallback to rule-based advice
          }
        }
      }

      const msg = `🤖 *AI Financial Health & Wealth Coach*\n\n` +
        `🌟 *Health Score*: *${score}/100* (${scoreBadge})\n` +
        `💰 *Monthly Income*: ₹${totalIncome.toLocaleString("en-IN")}\n` +
        `💸 *Monthly Expense*: ₹${totalExpense.toLocaleString("en-IN")}\n` +
        `🔥 *Savings Rate*: ${savingsRate}% (₹${savings.toLocaleString("en-IN")})\n` +
        `🔝 *Top Expense Area*: ${topCatText}\n\n` +
        `💡 *Smart Advice*:\n_${advice}_`;

      await sendTelegramMessage(chatId, msg, MAIN_MENU_KEYBOARD);
      return NextResponse.json({ success: true });
    }

    if (commandText === "family" || commandText === "relatives") {
      if (!familyMembers || familyMembers.length === 0) {
        await sendTelegramMessage(
          chatId,
          "👨‍👩‍👧 *No Family Members*: Add family members in your dashboard, or log a transfer via:\n`family sent 500 Mom` or `send 1000 Rahul`."
        );
        return NextResponse.json({ success: true });
      }

      let msg = "👨‍👩‍👧 *Family Hub & Net Balances*\n\n";
      for (const m of familyMembers) {
        const bal = parseFloat((m as any).balance || 0);
        const balStr = bal >= 0 ? `+₹${bal.toLocaleString("en-IN")}` : `-₹${Math.abs(bal).toLocaleString("en-IN")}`;
        msg += `• *${m.name}* (${m.relationship || "Relative"}): *${balStr}*\n`;
      }
      msg += `\n💡 *Quick Transfer Commands*:\n• \`send 500 ${familyMembers[0].name}\`\n• \`received 1000 ${familyMembers[0].name}\``;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    if (commandText === "ledger" || commandText === "audit") {
      const { data: logs } = await supabase
        .from("ledger_logs")
        .select("created_at, action_type, amount, account_name, details")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!logs || logs.length === 0) {
        await sendTelegramMessage(chatId, "📑 *Audit Ledger*: No ledger logs found yet.");
        return NextResponse.json({ success: true });
      }

      let msg = "📑 *Live Double-Entry Audit Trail (Last 5 Entries)*\n\n";
      for (const l of logs) {
        const dateStr = new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        const amtStr = l.amount ? `₹${parseFloat(l.amount).toLocaleString("en-IN")}` : "-";
        msg += `▪️ *${l.action_type}* (${dateStr})\n  Acc: ${l.account_name || "System"} | Amt: ${amtStr}\n  _${l.details || "None"}_\n\n`;
      }
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    if (commandText === "export" || commandText === "statement" || commandText === "download") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("amount, type, category, description, date")
        .eq("user_id", profile.id)
        .gte("date", firstDay)
        .order("date", { ascending: false });

      let totalIncome = 0;
      let totalExpense = 0;
      const catMap: Record<string, number> = {};

      if (monthTxs) {
        for (const t of monthTxs) {
          const amt = parseFloat(t.amount) || 0;
          if (t.type === "income") totalIncome += amt;
          else {
            totalExpense += amt;
            const cat = t.category || "Other";
            catMap[cat] = (catMap[cat] || 0) + amt;
          }
        }
      }

      const netSavings = totalIncome - totalExpense;
      const savingsPct = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

      let msg = `📥 *Monthly Statement Report*\n*Period*: ${monthName}\n\n`;
      msg += `💰 *Total Income*: ₹${totalIncome.toLocaleString("en-IN")}\n`;
      msg += `💸 *Total Expense*: ₹${totalExpense.toLocaleString("en-IN")}\n`;
      msg += `📈 *Net Savings*: ₹${netSavings.toLocaleString("en-IN")} _(${savingsPct}% rate)_\n\n`;

      if (Object.keys(catMap).length > 0) {
        msg += `📊 *Category Breakdown*:\n`;
        for (const [cat, amt] of Object.entries(catMap)) {
          msg += `• *${cat}*: ₹${amt.toLocaleString("en-IN")}\n`;
        }
      } else {
        msg += `ℹ️ No expenses recorded for this month yet.`;
      }

      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    if (commandText.startsWith("calc") || commandText.startsWith("convert")) {
      const query = text.replace(/^\/(?:calc|convert)\s*/i, "").trim();
      if (!query) {
        await sendTelegramMessage(chatId, "🧮 *Financial Calculator & Converter*:\n• `/calc 1500 * 12`\n• `/calc 25000 * 0.18` (GST/Tax)\n• `/convert 100 USD to INR`");
        return NextResponse.json({ success: true });
      }

      const convMatch = query.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]{3})\s*(?:to\s*([a-zA-Z]{3}))?/i);
      if (convMatch) {
        const amt = parseFloat(convMatch[1]);
        const fromCurr = convMatch[2].toUpperCase();
        const toCurr = (convMatch[3] || "INR").toUpperCase();
        const rate = await getExchangeRate(fromCurr, toCurr);
        const result = (amt * rate).toFixed(2);
        await sendTelegramMessage(chatId, `💱 *Currency Conversion*:\n• ${amt} ${fromCurr} = *${result} ${toCurr}*\n• Rate: 1 ${fromCurr} = ${rate} ${toCurr}`);
        return NextResponse.json({ success: true });
      }

      try {
        const sanitizedExpr = query.replace(/[^0-9+\-*/().]/g, "");
        if (sanitizedExpr.length > 0) {
          const evalResult = Function(`"use strict"; return (${sanitizedExpr})`)();
          await sendTelegramMessage(chatId, `🧮 *Calculation Result*:\n\`${query}\` = *${evalResult.toLocaleString("en-IN")}*`);
          return NextResponse.json({ success: true });
        }
      } catch {
        await sendTelegramMessage(chatId, "❌ Could not evaluate expression. Example usage: `/calc 1500 * 12` or `/convert 100 USD`.");
        return NextResponse.json({ success: true });
      }
    }

    if (commandText === "help") {
      await sendTelegramMessage(
        chatId,
        "💡 *Universal Dashboard Assistant*\n\n" +
        "*📱 Core Navigation*\n" +
        "• `/menu` — Toggle bottom button menu\n" +
        "• `/balance` — Check bank accounts & net worth\n" +
        "• `/summary` — Monthly income, expenses & savings rate\n" +
        "• `/ai` — Instant AI Health Score & coaching\n" +
        "• `/recent` — Last 5 transactions & `/undo` to revert\n" +
        "• `/search <keyword>` — Search transactions\n\n" +
        "*🏦 Bank Accounts*\n" +
        "• `add account SBI 5000` — Create new bank account\n" +
        "• `delete account SBI` — Delete account\n" +
        "• `transfer 2000 from SBI to HDFC` — Inter-account transfer\n\n" +
        "*💸 Expenses & Income*\n" +
        "• `450 Swiggy` or `debit 1200 Petrol`\n" +
        "• `salary 50000` or `credit 5000 freelance`\n" +
        "• Forward any Bank SMS or paste notification!\n\n" +
        "*📈 Investments (Stocks, MFs, Crypto, Bonds, FnO, Forex)*\n" +
        "• `/stocks` — View holdings or `buy 10 TATAMOTORS at 950`\n" +
        "• `/mf` — View funds or `invest 5000 in Parag Parikh`\n" +
        "• `/crypto` — View crypto or `buy 0.05 BTC at 65000`\n" +
        "• `/bonds` — View bonds or `buy 10 SGB 6000`\n" +
        "• `/fno` — View derivatives or `fno buy 25 NIFTY 24500 CE 150`\n" +
        "• `/forex` — View forex or `forex buy 100 USD`\n" +
        "• `/alt` — View alt assets or `alt buy 25000 Gold`\n\n" +
        "*🎯 Family, Goals, Budgets & Liabilities*\n" +
        "• `/family` — Family balances or `send 500 to Mom`\n" +
        "• `/goals` — View goals or `add goal Car 500000`\n" +
        "• `/budget` — View budgets or `set budget Food 10000`\n" +
        "• `/liabilities` — View debts or `pay emi Home Loan 25000`\n" +
        "• `/ledger` — View live double-entry audit trail\n" +
        "• `/export` — Generate monthly statement report\n" +
        "• `/calc 1500 * 12` — Financial calculator & currency converter",
        MAIN_REPLY_KEYBOARD
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

    // ─── Command: /balance or /networth ───
    if (commandText === "balance" || commandText === "balances" || commandText === "networth") {
      if (!accounts || accounts.length === 0) {
        await sendTelegramMessage(chatId, NO_ACCOUNT_MSG);
        return NextResponse.json({ success: true });
      }

      let totalNetWorth = 0;
      let msg = "💳 *Your Account Balances & Portfolio*\n\n";
      for (const acc of accounts) {
        const bal = parseFloat((acc as any).balance || 0);
        totalNetWorth += bal;
        const typeStr = ((acc as any).type || "Bank").toLowerCase();
        const icon = typeStr.includes("card") ? "💳" : typeStr.includes("wallet") ? "📱" : typeStr.includes("cash") ? "💵" : "🏦";
        msg += `${icon} *${acc.name}*: ₹${bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`;
      }
      msg += `\n🌟 *Total Net Worth*: ₹${totalNetWorth.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /accounts ───
    if (commandText === "accounts" || commandText === "banks") {
      if (!accounts || accounts.length === 0) {
        await sendTelegramMessage(chatId, "💳 *No Accounts*: No bank accounts found in your dashboard.");
        return NextResponse.json({ success: true });
      }
      let msg = "🏦 *Active Accounts & Channels*\n\n";
      for (const a of accounts) {
        const bal = parseFloat((a as any).balance || 0);
        const curr = (a as any).currency || "INR";
        const symbol = curr === "USD" ? "$" : "₹";
        msg += `• *${a.name}* (${(a as any).type || "Bank"}): ${symbol}${bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`;
      }
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /stocks ───
    if (commandText === "stocks" || commandText === "equity") {
      const { data: stockItems } = await supabase
        .from("investments")
        .select("name, symbol, quantity, buy_price, current_price, currency")
        .eq("user_id", profile.id)
        .eq("type", "stock")
        .gt("quantity", 0);

      if (!stockItems || stockItems.length === 0) {
        await sendTelegramMessage(chatId, "📈 *No Active Stock Holdings*: You don't have active stock holdings yet. Log one via: `stock buy 10 RELIANCE 2500`.");
        return NextResponse.json({ success: true });
      }

      let totalVal = 0;
      let totalCost = 0;
      let msg = "📈 *Your Stock Holdings*\n\n";
      for (const s of stockItems) {
        const qty = parseFloat(s.quantity) || 0;
        const buyP = parseFloat(s.buy_price) || 0;
        const curP = parseFloat(s.current_price) || buyP;
        const val = qty * curP;
        const cost = qty * buyP;
        totalVal += val;
        totalCost += cost;
        const pnl = val - cost;
        const pnlSign = pnl >= 0 ? "+" : "";
        msg += `• *${s.symbol || s.name}*: ${qty} shares @ ₹${curP} (Val: ₹${val.toLocaleString("en-IN")}, P&L: ${pnlSign}₹${pnl.toFixed(0)})\n`;
      }
      const overallPnL = totalVal - totalCost;
      msg += `\n💼 *Total Stock Portfolio*: ₹${totalVal.toLocaleString("en-IN")} (P&L: ${overallPnL >= 0 ? "+" : ""}₹${overallPnL.toFixed(0)})`;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /mf ───
    if (commandText === "mf" || commandText === "mutualfunds") {
      const { data: mfs } = await supabase
        .from("mutual_funds")
        .select("fund_name, units, current_nav, avg_nav")
        .eq("user_id", profile.id)
        .gt("units", 0);

      if (!mfs || mfs.length === 0) {
        await sendTelegramMessage(chatId, "🏦 *No Mutual Fund Holdings*: Log a SIP or lumpsum via: `mf sip 5000 Nifty 50`.");
        return NextResponse.json({ success: true });
      }

      let totalVal = 0;
      let msg = "🏦 *Your Mutual Funds Portfolio*\n\n";
      for (const m of mfs) {
        const units = parseFloat(m.units) || 0;
        const nav = parseFloat(m.current_nav || m.avg_nav) || 0;
        const val = units * nav;
        totalVal += val;
        msg += `• *${m.fund_name}*: ${units.toFixed(2)} units @ NAV ₹${nav} (Val: ₹${val.toLocaleString("en-IN")})\n`;
      }
      msg += `\n💎 *Total Mutual Fund Value*: ₹${totalVal.toLocaleString("en-IN")}`;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /crypto ───
    if (commandText === "crypto") {
      const { data: cryptos } = await supabase
        .from("investments")
        .select("name, symbol, quantity, buy_price, current_price")
        .eq("user_id", profile.id)
        .eq("type", "crypto")
        .gt("quantity", 0);

      if (!cryptos || cryptos.length === 0) {
        await sendTelegramMessage(chatId, "🪙 *No Crypto Holdings*: Log a crypto trade via: `crypto buy 0.05 BTC 65000`.");
        return NextResponse.json({ success: true });
      }

      let totalValUSD = 0;
      let msg = "🪙 *Your Crypto Holdings ($ USDT)*\n\n";
      for (const c of cryptos) {
        const qty = parseFloat(c.quantity) || 0;
        const curP = parseFloat(c.current_price || c.buy_price) || 0;
        const val = qty * curP;
        totalValUSD += val;
        msg += `• *${c.symbol || c.name}*: ${qty} @ $${curP} (Val: $${val.toFixed(2)})\n`;
      }
      msg += `\n🚀 *Total Crypto Value*: $${totalValUSD.toFixed(2)}`;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /bonds ───
    if (commandText === "bonds" || commandText === "fixedincome") {
      const { data: bondList } = await supabase
        .from("bonds")
        .select("bond_name, issuer, current_value, total_invested")
        .eq("user_id", profile.id);

      if (!bondList || bondList.length === 0) {
        await sendTelegramMessage(chatId, "🔏 *No Bond Investments*: Log a bond purchase via: `bond buy 10 Sovereign Gold Bond 6000`.");
        return NextResponse.json({ success: true });
      }

      let totalVal = 0;
      let msg = "🔏 *Your Fixed Income & Bond Holdings*\n\n";
      for (const b of bondList) {
        const val = parseFloat(b.current_value || b.total_invested) || 0;
        totalVal += val;
        msg += `• *${b.bond_name || b.issuer}*: ₹${val.toLocaleString("en-IN")}\n`;
      }
      msg += `\n🛡️ *Total Bonds Value*: ₹${totalVal.toLocaleString("en-IN")}`;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /fno ───
    if (commandText === "fno" || commandText === "derivatives") {
      const { data: trades } = await supabase
        .from("fno_trades")
        .select("symbol, instrument_type, strike_price, trade_type, quantity, entry_price, status")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!trades || trades.length === 0) {
        await sendTelegramMessage(chatId, "📊 *No FnO Trades*: Log a derivative trade via: `fno buy 25 NIFTY 24500 CE 150`.");
        return NextResponse.json({ success: true });
      }

      let msg = "📊 *Recent FnO Derivatives Positions*\n\n";
      for (const t of trades) {
        msg += `• *${t.symbol} ${t.strike_price || ""} ${t.instrument_type}* (${t.trade_type}): ${t.quantity} Qty @ ₹${t.entry_price} _[${t.status}]_\n`;
      }
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /forex ───
    if (commandText === "forex") {
      const { data: fxAccounts } = await supabase
        .from("forex_accounts")
        .select("broker_name, account_label, balance, currency")
        .eq("user_id", profile.id);

      if (!fxAccounts || fxAccounts.length === 0) {
        await sendTelegramMessage(chatId, "💱 *No Forex Accounts*: Log forex trades via: `forex buy 100 USD`.");
        return NextResponse.json({ success: true });
      }

      let totalValUSD = 0;
      let msg = "💱 *Your Forex Trading Accounts*\n\n";
      for (const f of fxAccounts) {
        const bal = parseFloat(f.balance) || 0;
        totalValUSD += bal;
        msg += `• *${f.broker_name}* (${f.account_label || "Account"}): $${bal.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
      }
      msg += `\n🌐 *Total Forex Equity*: $${totalValUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /alt ───
    if (commandText === "alt" || commandText === "assets") {
      const { data: altList } = await supabase
        .from("alternative_assets")
        .select("asset_name, category, current_value")
        .eq("user_id", profile.id);

      if (!altList || altList.length === 0) {
        await sendTelegramMessage(chatId, "🏢 *No Alternative Assets*: Log alt assets via: `alt buy 25000 Gold`.");
        return NextResponse.json({ success: true });
      }

      let totalVal = 0;
      let msg = "🏢 *Your Alternative Assets*\n\n";
      for (const a of altList) {
        const val = parseFloat(a.current_value) || 0;
        totalVal += val;
        msg += `• *${a.asset_name}* (${a.category || "Asset"}): ₹${val.toLocaleString("en-IN")}\n`;
      }
      msg += `\n🏰 *Total Alt Asset Value*: ₹${totalVal.toLocaleString("en-IN")}`;
      await sendTelegramMessage(chatId, msg);
      return NextResponse.json({ success: true });
    }

    // ─── Command: /liabilities or /loans ───
    if (commandText === "liabilities" || commandText === "loans" || commandText === "debts") {
      const { data: liabList } = await supabase
        .from("liabilities")
        .select("name, total_amount, remaining_amount, emi_amount")
        .eq("user_id", profile.id);

      if (!liabList || liabList.length === 0) {
        await sendTelegramMessage(chatId, "🎉 *No Active Liabilities*: You have zero logged loans or debts.");
        return NextResponse.json({ success: true });
      }

      let totalOutstanding = 0;
      let msg = "💳 *Your Liabilities & Loans*\n\n";
      for (const l of liabList) {
        const rem = parseFloat(l.remaining_amount || l.total_amount) || 0;
        const emi = parseFloat(l.emi_amount) || 0;
        totalOutstanding += rem;
        msg += `• *${l.name}*: Remaining ₹${rem.toLocaleString("en-IN")}${emi > 0 ? ` (EMI: ₹${emi.toLocaleString("en-IN")})` : ""}\n`;
      }
      msg += `\n⚠️ *Total Outstanding Debt*: ₹${totalOutstanding.toLocaleString("en-IN")}`;
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
        .select("id, description, amount, type, account_id, category, source_id, source_type, ledger_log_id")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastTx) {
        await sendTelegramMessage(chatId, "⚠️ *Nothing to Undo*: No recent transactions found to delete.");
        return NextResponse.json({ success: true });
      }

      // 1. Revert atomically if we have a ledger_log_id
      if (lastTx.ledger_log_id) {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("revert_ledger_log", {
          p_log_id: lastTx.ledger_log_id,
          p_user_id: profile.id
        });
        if (rpcErr) {
          await sendTelegramMessage(chatId, `❌ *Undo Failed*: ${rpcErr.message}`);
          return NextResponse.json({ success: true });
        }
        const result = rpcRes as { success: boolean; error?: string } | null;
        if (result && result.success === false) {
          await sendTelegramMessage(chatId, `❌ *Undo Failed*: ${result.error || "Database rejected revert."}`);
          return NextResponse.json({ success: true });
        }
      } else {
        // 2. Check if a ledger log exists by source_id
        const { data: logs } = await supabase
          .from("ledger_logs")
          .select("id")
          .eq("source_id", lastTx.source_id || lastTx.id)
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });

        if (logs && logs.length > 0) {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc("revert_ledger_log", {
            p_log_id: logs[0].id,
            p_user_id: profile.id
          });
          if (rpcErr || (rpcRes && (rpcRes as any).success === false)) {
            const errMsg = rpcErr ? rpcErr.message : (rpcRes as any)?.error || "Failed to revert transaction.";
            await sendTelegramMessage(chatId, `❌ *Undo Failed*: ${errMsg}`);
            return NextResponse.json({ success: true });
          }
        } else {
          // 3. Fallback direct table cleanup
          if (lastTx.account_id) {
            const { data: acc } = await supabase.from("accounts").select("balance").eq("id", lastTx.account_id).maybeSingle();
            if (acc) {
              const currentBal = parseFloat(acc.balance) || 0;
              const amt = parseFloat(lastTx.amount) || 0;
              const newBal = lastTx.type === "income" ? currentBal - amt : currentBal + amt;
              await supabase.from("accounts").update({ balance: newBal }).eq("id", lastTx.account_id);
            }
          }
          if (lastTx.source_id && lastTx.source_type === "expense") {
            await supabase.from("expenses").delete().eq("id", lastTx.source_id).eq("user_id", profile.id);
          } else if (lastTx.source_id && lastTx.source_type === "income") {
            await supabase.from("incomes").delete().eq("id", lastTx.source_id).eq("user_id", profile.id);
          }
          await supabase.from("transactions").delete().eq("id", lastTx.id).eq("user_id", profile.id);
        }
      }

      await sendTelegramMessage(
        chatId,
        `⚡ *Undid Last Transaction*:\nDeleted *${lastTx.description || lastTx.category}* (₹${lastTx.amount}) successfully.`
      );
      return NextResponse.json({ success: true });
    }

    // ─── Command: /goals ───
    if (commandText === "goals") {
      if (!goals || goals.length === 0) {
        await sendTelegramMessage(chatId, "🎯 *No Active Goals*: Create a goal in your dashboard or contribute directly using `goal 5000 Vacation`.");
        return NextResponse.json({ success: true });
      }

      let msg = "🎯 *Your Savings Goals*\n\n";
      for (const g of goals) {
        const target = parseFloat((g as any).target_amount) || 1;
        const current = parseFloat((g as any).current_amount) || 0;
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

      const safeQuery = query.replace(/[,().%_\\]/g, " ").trim();
      if (!safeQuery || safeQuery.length < 2) {
        await sendTelegramMessage(chatId, "🔍 *Search Usage*:\nPlease enter a valid search term without special characters.");
        return NextResponse.json({ success: true });
      }

      const { data: results } = await supabase
        .from("transactions")
        .select("date, description, category, amount, type")
        .eq("user_id", profile.id)
        .or(`description.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%`)
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
    // Extract date and update text to have date tokens stripped so numbers in date (like `2` or `2026`) aren't parsed as amount
    const dateParsed = parseNaturalDate(text);
    const cleanDate = dateParsed.date;
    text = dateParsed.cleanedText;
    lowerText = text.toLowerCase();

    // Check if the text is OTP / verification alert
    if (/otp|verification|verification code|password|one time password/i.test(text)) {
      await sendTelegramMessage(chatId, "ℹ️ *Notice*: Ignored OTP / verification alert.");
      return NextResponse.json({ success: true });
    }

    // Check if the text is a pasted Bank SMS or Notification
    const isPastedSmsOrNotification = /(?:debited|credited|av bal|avail bal|vpa|spent on|card ending|a\/c no|account no|payment of|spent via|received in)/i.test(text) && text.length > 20;
    if (isPastedSmsOrNotification) {
      const smsData = parseBankSmsOrNotification(text);
      if (smsData) {
        const targetAccount = resolveAccount(smsData.type, text, smsData.accountEnding);
        if (!targetAccount) {
          await sendTelegramMessage(chatId, NO_ACCOUNT_MSG);
          return NextResponse.json({ success: true });
        }

        // Robust Deduplication check across a ±3 day window
        const dateObj = new Date(cleanDate);
        const minDate = new Date(dateObj.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const maxDate = new Date(dateObj.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const tableName = smsData.type === "expense" ? "expenses" : "incomes";

        const [{ data: existingTable }, { data: existingTx }] = await Promise.all([
          supabase
            .from(tableName)
            .select("id")
            .eq("user_id", profile.id)
            .eq("amount", smsData.amount)
            .gte("date", minDate)
            .lte("date", maxDate)
            .limit(1),
          supabase
            .from("transactions")
            .select("id")
            .eq("user_id", profile.id)
            .eq("amount", smsData.amount)
            .gte("date", minDate)
            .lte("date", maxDate)
            .limit(1),
        ]);

        if ((existingTable && existingTable.length > 0) || (existingTx && existingTx.length > 0)) {
          await sendTelegramMessage(chatId, `ℹ️ *Duplicate Ignored*: A transaction for ₹${smsData.amount} around ${cleanDate} already exists.`);
          return NextResponse.json({ success: true });
        }

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
        const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
          p_user_id: profile.id,
          p_description: `[SMS Alert] ${smsData.merchant}`,
          p_amount: smsData.amount,
          p_category: category,
          p_date: cleanDate,
          p_account_id: targetAccount,
        });

        if (rpcError) throw rpcError;
        if (rpcData && typeof rpcData === "object" && "success" in rpcData && (rpcData as any).success === false) {
          throw new Error((rpcData as any).error || "Failed to record SMS alert transaction.");
        }

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
      } else {
        await sendTelegramMessage(chatId, "ℹ️ *Could not parse Bank Alert*: We detected a bank or payment notification, but couldn't safely extract the exact amount or merchant. Please log it manually like: `450 Swiggy`.");
        return NextResponse.json({ success: true });
      }
    }

    const rawTokens = text.trim().split(/\s+/);
    const firstWord = rawTokens[0].toLowerCase();

    // Extract all remaining numbers from text
    const numbers = (text.match(/\d+(?:\.\d{1,2})?/g) || []).map(Number);
    const primaryAmount = numbers[0] || 0;

    try {
      // ─── A. Explicit Command Router OR Auto-Sensed Family Transfer ───
      const isExplicitFamily = firstWord === "family";
      const hasTransferKeywords = /\b(send|sent|transfer|transferred|gave|give|paid to|received from|got from|allowance|pocket money)\b/i.test(text);
      const mentionedFamilyMember = familyMembers?.find((m: any) => {
        if (!m.name || m.name.trim().length < 2) return false;
        const nameRegex = new RegExp(`\\b${m.name.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (nameRegex.test(text)) return true;
        if (m.relationship && m.relationship.trim().length >= 3) {
          const relRegex = new RegExp(`\\b${m.relationship.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
          if (relRegex.test(text)) return true;
        }
        return false;
      });

      if (isExplicitFamily || (mentionedFamilyMember && primaryAmount > 0 && hasTransferKeywords)) {
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
          const probableName = nameMatch ? nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1) : "Member";
          const { data: newMem, error: createErr } = await supabase.from("family_members").insert({
            user_id: profile.id,
            name: probableName,
            relationship: "Relative",
            balance: 0
          }).select("id, name, relationship").single();
          if (createErr) throw createErr;
          targetMember = newMem;
        }

        if (amount <= 0) throw new Error("Please specify a valid amount for the transfer (e.g. `send saran 2000`).");

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
        if (rpcRes && typeof rpcRes === "object" && "success" in rpcRes && (rpcRes as any).success === false) {
          throw new Error((rpcRes as any).error || "Transfer failed inside database.");
        }

        const accObj = accounts?.find((a: any) => a.id === targetAccount);
        await sendTelegramMessage(chatId, `💜 *Family Transfer Recorded*:\n• *Member*: ${targetMember.name} (${targetMember.relationship})\n• *Action*: ${type === "sent" ? "Sent" : "Received"} ₹${amount}\n• *Account*: ${accObj?.name || "Default"}\n• *Note*: ${cleanedNote || "None"}`);
        return NextResponse.json({ success: true });
      }

      // ─── B. Explicit OR Auto-Sensed Stock Trade ───
      const isExplicitStock = firstWord === "stock";
      const hasSpecificStockVerb = /\b(bought shares? of|sold shares? of|bought stock|sold stock|equities|nse|bse)\b/i.test(text);
      const hasStockKeywords = /\b(share|shares|stock|stocks)\b/i.test(text);
      const possibleTicker = text.split(/\s+/).find(w => /^[A-Z]{2,10}$/.test(w) && !["BUY", "SELL", "STOCK", "SHARES", "THE", "AND", "FOR", "WITH", "FROM", "TO"].includes(w));
      if (isExplicitStock || (numbers.length >= 2 && (hasSpecificStockVerb || (hasStockKeywords && possibleTicker)))) {
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
        if (!targetAccount) throw new Error("No bank account found to record stock trade.");

        const { data: rpcData, error } = await supabase.rpc("record_investment", {
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
        if (rpcData && typeof rpcData === "object" && "success" in rpcData && (rpcData as any).success === false) {
          throw new Error((rpcData as any).error || "Failed to record stock trade.");
        }
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
        if (!targetAccount) throw new Error("No bank account found to record mutual fund investment.");

        const { data: rpcData, error } = await supabase.rpc("record_mf_investment_v4", {
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
        if (rpcData && typeof rpcData === "object" && "success" in rpcData && (rpcData as any).success === false) {
          throw new Error((rpcData as any).error || "Failed to record mutual fund trade.");
        }
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
        if (!targetAccount) throw new Error("No bank account found to record forex trade.");

        const exchangeRate = await getExchangeRate(currency, "INR");
        const { error } = await supabase.from("forex_trades").insert({
          user_id: profile.id,
          currency_pair: `INR/${currency}`,
          trade_type: tradeType,
          amount: amount,
          exchange_rate: exchangeRate,
          date: cleanDate,
          account_id: targetAccount
        });
        if (error) throw error;
        await sendTelegramMessage(chatId, `💱 *Forex Trade Recorded*:\n• *Action*: ${tradeType.toUpperCase()}\n• *Amount*: ${amount} ${currency}\n• *Pair*: INR/${currency}`);
        return NextResponse.json({ success: true });
      }

      // ─── E. Inter-Account Transfer Parser ───
      const isExplicitTransfer = firstWord === "transfer" || firstWord === "xfer";
      const hasTransferKeyword = /\b(transferred|transfer|xfer|moved)\b/i.test(text);
      const toAccountMatch = text.match(/\b(?:from|in)\s+([a-zA-Z0-9\s]+?)\s+to\s+([a-zA-Z0-9\s]+)/i) || text.match(/\b([a-zA-Z0-9]+)\s+to\s+([a-zA-Z0-9]+)/i);

      if ((isExplicitTransfer || (hasTransferKeyword && primaryAmount > 0)) && accounts && accounts.length >= 2) {
        const amount = primaryAmount;
        let fromAcc = accounts[0];
        let toAcc = accounts[1] || accounts[0];

        if (toAccountMatch) {
          const fromQuery = toAccountMatch[1].trim().toLowerCase();
          const toQuery = toAccountMatch[2].trim().toLowerCase();
          const matchedFrom = accounts.find(a => a.name.toLowerCase().includes(fromQuery));
          const matchedTo = accounts.find(a => a.name.toLowerCase().includes(toQuery));
          if (matchedFrom) fromAcc = matchedFrom;
          if (matchedTo) toAcc = matchedTo;
        }

        if (fromAcc.id === toAcc.id) {
          toAcc = accounts.find(a => a.id !== fromAcc.id) || accounts[1] || accounts[0];
        }

        const { error: trErr } = await supabase.from("transfers").insert({
          user_id: profile.id,
          from_account_id: fromAcc.id,
          to_account_id: toAcc.id,
          amount: amount,
          date: cleanDate,
          notes: `[Telegram Transfer] ${text}`
        });

        if (!trErr) {
          // Adjust account balances
          await supabase.from("accounts").update({ balance: (parseFloat(fromAcc.balance) || 0) - amount }).eq("id", fromAcc.id);
          await supabase.from("accounts").update({ balance: (parseFloat(toAcc.balance) || 0) + amount }).eq("id", toAcc.id);

          await sendTelegramMessage(chatId, `🔄 *Inter-Account Transfer Logged*:\n• *Amount*: ₹${amount.toLocaleString("en-IN")}\n• *From*: ${fromAcc.name}\n• *To*: ${toAcc.name}`);
          return NextResponse.json({ success: true });
        }
      }

      // ─── F. Crypto Trade Parser ───
      const isExplicitCrypto = firstWord === "crypto";
      const hasCryptoKeywords = /\b(btc|bitcoin|eth|ethereum|sol|solana|usdt|crypto)\b/i.test(text);
      if (isExplicitCrypto || (hasCryptoKeywords && primaryAmount > 0)) {
        const tradeType = /sell|sold/i.test(lowerText) ? "sell" : "buy";
        let quantity = numbers[0] || 0.01;
        let price = numbers[1] || numbers[0] || 1;
        let symbol = "BTC";

        if (isExplicitCrypto) {
          quantity = parseFloat(rawTokens[2]) || numbers[0] || 0.01;
          symbol = (rawTokens[3] || "CRYPTO").toUpperCase();
          price = parseFloat(rawTokens[4]) || numbers[1] || 1;
        } else {
          const matchedSymbol = text.match(/\b(BTC|ETH|SOL|USDT|BNB|ADA|XRP|DOGE)\b/i);
          if (matchedSymbol) symbol = matchedSymbol[1].toUpperCase();
          if (numbers.length >= 2) {
            quantity = numbers[0];
            price = numbers[1];
          }
        }

        const targetAccount = resolveAccount(tradeType === "buy" ? "expense" : "income", text);
        if (!targetAccount) throw new Error("No bank account found to record crypto trade.");

        const { error } = await supabase.rpc("record_investment", {
          p_user_id: profile.id,
          p_name: symbol,
          p_type: "crypto",
          p_symbol: symbol,
          p_quantity: quantity,
          p_buy_price: price,
          p_current_price: price,
          p_currency: "USD",
          p_notes: `[Telegram] ${text}`,
          p_date: cleanDate,
          p_account_id: targetAccount,
          p_total_cost: quantity * price,
          p_trade_type: tradeType,
          p_charges: 0
        });

        if (error) throw error;
        await sendTelegramMessage(chatId, `🪙 *Crypto Trade Recorded*:\n• *Action*: ${tradeType.toUpperCase()}\n• *Symbol*: ${symbol}\n• *Qty*: ${quantity} @ $${price}\n• *Total*: $${(quantity * price).toFixed(2)}`);
        return NextResponse.json({ success: true });
      }

      // ─── G. Bond / Fixed Income Parser ───
      const isExplicitBond = firstWord === "bond" || firstWord === "bonds";
      const hasBondKeywords = /\b(bond|bonds|debenture|sgb|sovereign gold)\b/i.test(text);
      if (isExplicitBond || (hasBondKeywords && primaryAmount > 0)) {
        const bondName = text.replace(/\b(bond|bonds|buy|sell|for|rs|₹|\d+(?:\.\d+)?)\b/gi, "").trim() || "Government Bond";
        const amount = primaryAmount;

        const { error: bErr } = await supabase.from("bonds").insert({
          user_id: profile.id,
          bond_name: bondName,
          issuer: "RBI / Government",
          total_invested: amount,
          current_value: amount,
          purchase_date: cleanDate
        });

        if (!bErr) {
          await sendTelegramMessage(chatId, `🔏 *Bond Purchase Recorded*:\n• *Bond*: ${bondName}\n• *Amount*: ₹${amount.toLocaleString("en-IN")}`);
          return NextResponse.json({ success: true });
        }
      }

      // ─── H. FnO Derivative Trade Parser ───
      const isExplicitFno = firstWord === "fno" || firstWord === "futures" || firstWord === "options";
      const hasFnoKeywords = /\b(call|put|\bce\b|\bpe\b|nifty|banknifty|futures|options|fno)\b/i.test(text);
      if (isExplicitFno || (hasFnoKeywords && primaryAmount > 0 && numbers.length >= 2)) {
        const symbolMatch = text.match(/\b(NIFTY|BANKNIFTY|FINNIFTY|SENSEX|[A-Z]{3,10})\b/i);
        const typeMatch = text.match(/\b(CE|PE|FUT)\b/i);
        const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : "NIFTY";
        const instType = typeMatch ? typeMatch[1].toUpperCase() : "CE";
        const quantity = numbers[0] || 25;
        const entryPrice = numbers[1] || 100;
        const tradeType = /sell|sold/i.test(lowerText) ? "sell" : "buy";

        const { error: fnoErr } = await supabase.from("fno_trades").insert({
          user_id: profile.id,
          symbol,
          instrument_type: instType,
          trade_type: tradeType,
          quantity,
          entry_price: entryPrice,
          status: "OPEN",
          entry_date: cleanDate
        });

        if (!fnoErr) {
          await sendTelegramMessage(chatId, `📊 *FnO Derivative Trade Recorded*:\n• *Contract*: ${symbol} ${instType}\n• *Action*: ${tradeType.toUpperCase()}\n• *Qty*: ${quantity} @ ₹${entryPrice}`);
          return NextResponse.json({ success: true });
        }
      }

      // ─── I. Alternative Asset Parser ───
      const isExplicitAlt = firstWord === "alt" || firstWord === "asset";
      const hasAltKeywords = /\b(gold|silver|real estate|property|land|vehicle|car|watch|art)\b/i.test(text);
      if (isExplicitAlt || (hasAltKeywords && primaryAmount > 0)) {
        const assetName = text.replace(/\b(alt|asset|buy|sell|for|rs|₹|\d+(?:\.\d+)?)\b/gi, "").trim() || "Alternative Asset";
        const amount = primaryAmount;
        let category = "Gold";
        if (/property|land|flat|real estate/i.test(assetName)) category = "Real Estate";
        else if (/car|bike|vehicle/i.test(assetName)) category = "Vehicle";
        else if (/silver/i.test(assetName)) category = "Silver";

        const { error: altErr } = await supabase.from("alternative_assets").insert({
          user_id: profile.id,
          asset_name: assetName,
          category,
          purchase_price: amount,
          current_value: amount,
          purchase_date: cleanDate
        });

        if (!altErr) {
          await sendTelegramMessage(chatId, `🏢 *Alternative Asset Logged*:\n• *Asset*: ${assetName}\n• *Category*: ${category}\n• *Value*: ₹${amount.toLocaleString("en-IN")}`);
          return NextResponse.json({ success: true });
        }
      }

      // ─── J. Liability & Loan Payment Parser ───
      const isExplicitLoan = firstWord === "loan" || firstWord === "emi" || firstWord === "liability";
      const hasLoanKeywords = /\b(emi|loan|debt|liability|mortgage)\b/i.test(text);
      if (isExplicitLoan || (hasLoanKeywords && primaryAmount > 0)) {
        const amount = primaryAmount;
        const targetAccount = resolveAccount("expense", text);
        const loanQuery = text.replace(/\b(loan|emi|pay|paid|liability|debt|rs|₹|\d+(?:\.\d+)?)\b/gi, "").trim() || "Loan Payment";

        // Record loan payment as expense under Housing/Debts
        const { error } = await supabase.rpc("record_expense", {
          p_user_id: profile.id,
          p_description: `[Telegram EMI] ${loanQuery}`,
          p_amount: amount,
          p_category: "Housing",
          p_date: cleanDate,
          p_account_id: targetAccount,
        });

        if (!error) {
          await sendTelegramMessage(chatId, `💳 *Loan / EMI Payment Logged*:\n• *Payment*: ₹${amount.toLocaleString("en-IN")}\n• *Loan Note*: ${loanQuery}`);
          return NextResponse.json({ success: true });
        }
      }

      // ─── K. Explicit OR Auto-Sensed Goal Contribution ───
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
          const targetAccount = resolveAccount("expense", text);
          if (!targetAccount) throw new Error("No bank account found for goal contribution.");

          const { data: rpcData, error: rpcError } = await supabase.rpc("contribute_to_goal", {
            p_goal_id: targetGoal.id,
            p_amount: amount,
            p_user_id: profile.id,
            p_account_id: targetAccount
          });
          if (rpcError) throw rpcError;
          if (rpcData && typeof rpcData === "object" && "success" in rpcData && (rpcData as any).success === false) {
            throw new Error((rpcData as any).error || "Failed to contribute to goal.");
          }
          await sendTelegramMessage(chatId, `🎯 *Goal Contribution*:\n• *Amount*: ₹${amount}\n• *Goal*: ${targetGoal.name}`);
          return NextResponse.json({ success: true });
        }
      }
      // ─── Gemini AI Parser & Intelligence Engine (If enabled and API key is present) ───
      if (isGeminiActiveForProfile(profile) && text.length > 2) {
        const geminiApiKey = getGeminiApiKeyForProfile(profile);
        if (geminiApiKey) {
          try {
            const aiResult = await parseTransactionWithGemini(text, geminiApiKey);

            // 1. Stock Trade Intent via Gemini AI
            if (aiResult.success && aiResult.intentType === "stock" && aiResult.symbol) {
              const symbol = (aiResult.symbol || "EQUITY").toUpperCase();
              const quantity = aiResult.quantity || 1;
              const price = aiResult.price || (aiResult.amount ? aiResult.amount / quantity : 100);
              const totalCost = quantity * price;

              const targetAccount = resolveAccount("expense", text);
              if (targetAccount) {
                const { data: rpcData, error: rpcError } = await supabase.rpc("record_investment", {
                  p_user_id: profile.id,
                  p_name: symbol,
                  p_type: "stock",
                  p_symbol: symbol,
                  p_quantity: quantity,
                  p_buy_price: price,
                  p_current_price: price,
                  p_currency: "INR",
                  p_notes: `[Gemini AI Telegram] ${text}`,
                  p_date: cleanDate,
                  p_account_id: targetAccount,
                  p_total_cost: totalCost,
                  p_trade_type: "buy",
                  p_charges: 0
                });

                if (!rpcError && (!rpcData || (rpcData as any).success !== false)) {
                  await sendTelegramMessage(
                    chatId,
                    `📈 *Gemini AI Stock Trade Recorded*:\n` +
                    `• *Symbol*: ${symbol}\n` +
                    `• *Qty*: ${quantity} @ ₹${price.toLocaleString("en-IN")}\n` +
                    `• *Total Cost*: ₹${totalCost.toLocaleString("en-IN")}\n` +
                    `• *Dashboard*: ✅ Updated`
                  );
                  return NextResponse.json({ success: true });
                }
              }
            }

            // 2. Mutual Fund Investment Intent via Gemini AI
            if (aiResult.success && aiResult.intentType === "mutual_fund" && aiResult.amount) {
              const fundName = aiResult.fundName || aiResult.description || "Mutual Fund Investment";
              const amount = aiResult.amount;
              const targetAccount = resolveAccount("expense", text);

              if (targetAccount) {
                const { data: rpcData, error: rpcError } = await supabase.rpc("record_mf_investment_v4", {
                  p_user_id: profile.id,
                  p_fund_name: fundName,
                  p_scheme_code: "TELEGRAM_AI_MF",
                  p_units: 1,
                  p_nav: amount,
                  p_investment_type: "buy",
                  p_category: "Equity",
                  p_amc_name: "Universal AMC",
                  p_date: cleanDate,
                  p_account_id: targetAccount,
                  p_stamp_duty: 0,
                  p_trade_type: "buy"
                });

                if (!rpcError && (!rpcData || (rpcData as any).success !== false)) {
                  await sendTelegramMessage(
                    chatId,
                    `🏦 *Gemini AI Mutual Fund Investment Logged*:\n` +
                    `• *Fund*: ${fundName}\n` +
                    `• *Amount*: ₹${amount.toLocaleString("en-IN")}\n` +
                    `• *Dashboard*: ✅ Updated`
                  );
                  return NextResponse.json({ success: true });
                }
              }
            }

            // 3. Expense or Income Intent via Gemini AI
            if (aiResult.success && aiResult.amount && (aiResult.intentType === "expense" || aiResult.intentType === "income")) {
              const txType = aiResult.intentType;
              const category = aiResult.category;
              const description = aiResult.description || text;
              const targetAccount = resolveAccount(txType, text);

              if (targetAccount) {
                const rpcName = txType === "expense" ? "record_expense" : "record_income";
                const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
                  p_user_id: profile.id,
                  p_description: `[Gemini AI] ${description}`,
                  p_amount: aiResult.amount,
                  p_category: category,
                  p_date: cleanDate,
                  p_account_id: targetAccount,
                });

                if (!rpcError && (!rpcData || (rpcData as any).success !== false)) {
                  if (txType === "expense") {
                    await checkAndNotifyBudget(supabase, profile.id, chatId, category, aiResult.amount);
                  }
                  const accObj = accounts?.find((a: any) => a.id === targetAccount);
                  const { data: latestTx } = await supabase
                    .from("transactions")
                    .select("id")
                    .eq("user_id", profile.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  const txId = latestTx?.id;
                  const keyboard = txId && txType === "expense" ? CATEGORY_KEYBOARD(txId) : TX_CONFIRM_KEYBOARD;

                  const symbol = txType === "expense" ? "💸" : "💰";
                  const actionHeader = txType === "expense" ? "Expense Outflow Logged" : "Revenue Inflow Recorded";
                  const bankEmoji = getBrandEmoji(accObj?.bank_name || accObj?.name || "");
                  const brandEmoji = getBrandEmoji(description);
                  const currentAccBal = parseFloat(accObj?.balance || 0);
                  const updatedBal = txType === "expense" ? currentAccBal - aiResult.amount : currentAccBal + aiResult.amount;

                  await sendTelegramMessage(
                    chatId,
                    `${symbol} *${actionHeader}*\n\n` +
                    `• *Amount*: ₹${aiResult.amount.toLocaleString("en-IN")}\n` +
                    `• *Category*: ${category}\n` +
                    `• *Account*: ${bankEmoji} ${accObj?.name || "Default Account"}\n` +
                    `• *Details*: ${brandEmoji} ${description}\n` +
                    `• *New Balance*: ₹${updatedBal.toLocaleString("en-IN")}\n\n` +
                    `⚡ *Dashboard*: ✅ Updated Live`,
                    keyboard
                  );
                  return NextResponse.json({ success: true });
                }
              }
            }

            // 4. Live Data Inquiry Intent via Gemini AI
            if (aiResult.success && aiResult.intentType === "inquiry") {
              const contextSummary = await buildRichUserContext(supabase, profile, accounts, familyMembers, goals);
              const chatHistory = await getTelegramChatHistory(chatId);
              const aiAnswer = await askGeminiFinanceAssistant(text, contextSummary, geminiApiKey, chatHistory);
              await sendTelegramMessage(chatId, `🤖 *Gemini AI Financial Coach*:\n\n${aiAnswer}`);
              await appendTelegramChatHistory(chatId, text, aiAnswer);
              return NextResponse.json({ success: true });
            }

          } catch (geminiErr) {
            console.warn("Gemini AI parse failed, using rule-based fallback:", geminiErr);
          }
        }
      }

      // ─── F. Universal Auto-Categorized Income & Expense Engine ───
      if (primaryAmount <= 0) {
        if (text.length > 2 && !/help|balance|summary|recent|undo|goals|budget/i.test(text)) {
          if (!isRedisConfigured()) {
            await sendTelegramMessage(
              chatId,
              `🤖 *Amount Needed*: I see you want to log "${text}". Since multi-step conversation caching (Redis) is not configured on this server, please resend your transaction with the amount in one line (e.g. \`450 ${text}\`).`
            );
            return NextResponse.json({ success: true });
          }
          await redisSet(pendingKey, JSON.stringify({ pending: true, reason: "unknown_amount", description: text }), 600);
          await sendTelegramMessage(chatId, `🤖 *Amount Needed*: I see you want to log "${text}". How much was it?\n\n💡 _Reply with just the number (e.g. \`450\`)_`);
          return NextResponse.json({ success: true });
        }
        await sendTelegramMessage(chatId, "❓ *Could not understand*: Please include an amount and description (e.g. `120 Lunch`, `credit 5000 salary`, or `stock buy 10 AAPL 150`).");
        return NextResponse.json({ success: true });
      }

      // Auto-Sense standalone digits (e.g. "450"): Automatically log as Expense and provide 1-tap category buttons
      if (/^\d+(?:\.\d{1,2})?$/.test(text.trim())) {
        const targetAccount = resolveAccount("expense", text);
        if (!targetAccount) {
          await sendTelegramMessage(chatId, NO_ACCOUNT_MSG);
          return NextResponse.json({ success: true });
        }

        const rpcName = "record_expense";
        const { error: rpcError } = await supabase.rpc(rpcName, {
          p_user_id: profile.id,
          p_description: "[Telegram] Uncategorized Expense",
          p_amount: primaryAmount,
          p_category: "Other",
          p_date: cleanDate,
          p_account_id: targetAccount,
        });

        if (!rpcError) {
          const { data: latestTx } = await supabase
            .from("transactions")
            .select("id")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const txId = latestTx?.id;
          const keyboard = txId ? CATEGORY_KEYBOARD(txId) : TX_CONFIRM_KEYBOARD;
          const accObj = accounts?.find((a: any) => a.id === targetAccount);

          await sendTelegramMessage(
            chatId,
            `💸 *Auto-Logged Expense*: ₹${primaryAmount.toLocaleString("en-IN")}\n` +
            `• *Category*: Other\n` +
            `• *Account*: ${accObj?.name || "Default"}\n\n` +
            `💡 _Tap a category below to re-assign instantly, or tap Undo:_`,
            keyboard
          );
          return NextResponse.json({ success: true });
        }
      }

      // Fault-tolerant Fuzzy NLP classifier (handles typos, misspellings, & slang)
      const { type: txType, category } = classifyTextFuzzy(text);

      const description = text.replace(new RegExp(`\\b${primaryAmount}\\b`), "").trim().replace(/\s+/g, " ") || (txType === "expense" ? "General Expense" : "General Income");
      const targetAccount = resolveAccount(txType, text);

      // Try SECURITY DEFINER RPC first to bypass RLS restrictions
      const { data: tgRes, error: tgErr } = await supabase.rpc("record_telegram_transaction", {
        p_chat_id: String(chatId),
        p_description: `[Telegram] ${description}`,
        p_amount: primaryAmount,
        p_category: category,
        p_type: txType,
        p_date: cleanDate,
        p_account_id: targetAccount || null,
      });

      if (tgErr || (tgRes && typeof tgRes === "object" && tgRes.success === false)) {
        if (!targetAccount) {
          await sendTelegramMessage(chatId, NO_ACCOUNT_MSG);
          return NextResponse.json({ success: true });
        }
        const rpcName = txType === "expense" ? "record_expense" : "record_income";
        const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
          p_user_id: profile.id,
          p_description: `[Telegram] ${description}`,
          p_amount: primaryAmount,
          p_category: category,
          p_date: cleanDate,
          p_account_id: targetAccount,
        });

        if (rpcError) throw rpcError;
        if (rpcData && typeof rpcData === "object" && "success" in rpcData && (rpcData as any).success === false) {
          throw new Error((rpcData as any).error || "Database rejected transaction.");
        }
      }

      if (txType === "expense") {
        await checkAndNotifyBudget(supabase, profile.id, chatId, category, primaryAmount);
      }

      const symbol = txType === "expense" ? "💸" : "💰";
      const accObj = accounts?.find((a: any) => a.id === targetAccount);

      const { data: latestTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const txId = latestTx?.id;
      const keyboard = txId && txType === "expense" ? CATEGORY_KEYBOARD(txId) : TX_CONFIRM_KEYBOARD;

      await sendTelegramMessage(
        chatId,
        `${symbol} *Logged ${txType === "expense" ? "Expense" : "Income"}*:\n` +
        `• *Amount*: ₹${primaryAmount}\n` +
        `• *Category*: ${category}\n` +
        `• *Account*: ${accObj?.name || "Default"}\n` +
        `• *Desc*: ${description}`,
        keyboard
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
