/**
 * Shared Telegram Bot API helper
 * Used by both telegram-sync webhook and telegram-alerts cron routes
 */

/**
 * Send a message to a Telegram chat with automatic Markdown fallback.
 * If Telegram rejects the Markdown parse, retries as plain text.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: any
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Missing TELEGRAM_BOT_TOKEN in environment variables");
    return;
  }

  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Telegram API error (${res.status}): ${errBody}`);
      // If Telegram failed due to Markdown entity parsing issues, retry as plain text
      if (res.status === 400 && /can't parse entities/i.test(errBody)) {
        const plainPayload: any = { chat_id: chatId, text };
        if (replyMarkup) plainPayload.reply_markup = replyMarkup;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plainPayload),
        });
      }
    }
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

/**
 * Acknowledge an inline keyboard callback query tap from Telegram UI
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) {
    console.error("Failed to answer callback query:", err);
  }
}

/**
 * Register official bot commands with Telegram API so users get auto-complete when typing '/'
 */
export async function setTelegramBotCommands(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const commands = [
      { command: "balance", description: "💳 Accounts & Net Worth" },
      { command: "portfolio", description: "📈 Stock & Asset Breakdown" },
      { command: "summary", description: "📊 Monthly Flow & Savings" },
      { command: "history", description: "📜 Recent Transactions" },
      { command: "budget", description: "🎯 Category Budgets Status" },
      { command: "bills", description: "🗓️ Recurring Bills & Subscriptions" },
      { command: "taxharvest", description: "📉 Tax Loss Harvesting Opportunities" },
      { command: "dividends", description: "💵 Dividend Earnings Report" },
      { command: "backup", description: "📦 Download Data Backup (.json)" },
      { command: "ai", description: "🤖 AI Wealth Score & Insights" },
      { command: "goals", description: "🏆 Financial Goals Progress" },
      { command: "help", description: "💡 Commands & Assistant Guide" },
    ];
    await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
  } catch (err) {
    console.error("Failed to set Telegram bot commands:", err);
  }
}

/**
 * Send a document/file (e.g. backup JSON, report CSV) to a Telegram chat
 */
export async function sendTelegramDocument(
  chatId: string,
  fileName: string,
  fileContent: string,
  caption?: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    const formData = new FormData();
    formData.append("chat_id", chatId);
    const blob = new Blob([fileContent], { type: "application/json" });
    formData.append("document", blob, fileName);
    if (caption) {
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown");
    }

    await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    console.error("Failed to send Telegram document:", err);
  }
}

/**
 * Send a chat action status (e.g. "typing", "upload_photo") to Telegram chat
 */
export async function sendTelegramChatAction(
  chatId: string,
  action: "typing" | "upload_photo" | "record_voice" | "upload_voice" | "upload_document" = "typing"
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (err) {
    console.error("Failed to send Telegram chat action:", err);
  }
}

/**
 * Download a file sent via Telegram (voice note, photo receipt, audio)
 * Returns buffer and mimeType or null if failed
 */
export async function downloadTelegramFile(fileId: string): Promise<{ buffer: Buffer; filePath: string } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !fileId) return null;
  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    if (!fileRes.ok) return null;
    const fileData = await fileRes.json();
    const filePath = fileData?.result?.file_path;
    if (!filePath) return null;

    const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!downloadRes.ok) return null;

    const arrayBuffer = await downloadRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filePath,
    };
  } catch (err) {
    console.error("Failed to download Telegram file:", err);
    return null;
  }
}

/**
 * Get curated brand/bank emoji icon matching web app brand registry
 */
export function getBrandEmoji(name: string): string {
  if (!name) return "💳";
  const clean = name.toLowerCase().trim();
  if (/sbi|state bank/i.test(clean)) return "🏦";
  if (/hdfc/i.test(clean)) return "💳";
  if (/icici/i.test(clean)) return "🏦";
  if (/axis/i.test(clean)) return "💳";
  if (/kotak/i.test(clean)) return "🏦";
  if (/pnb|bob|canara|union|boi|iob|uco/i.test(clean)) return "🏛️";
  if (/swiggy|zomato|eats|food/i.test(clean)) return "🍔";
  if (/uber|ola|rapido|cab|taxi/i.test(clean)) return "🚗";
  if (/amazon|flipkart|myntra|ajio|shopping/i.test(clean)) return "🛍️";
  if (/apple|iphone|mac/i.test(clean)) return "🍎";
  if (/google|pay|gpay/i.test(clean)) return "🌐";
  if (/netflix|spotify|prime|pvr|movie/i.test(clean)) return "🎬";
  if (/starbucks|coffee|cafe|tea/i.test(clean)) return "☕";
  if (/petrol|fuel|shell|bpcl|hpcl/i.test(clean)) return "⛽";
  if (/salary|payroll|stipend/i.test(clean)) return "💼";
  if (/dividend|interest|stock|share|crypto|btc|eth/i.test(clean)) return "💎";
  if (/rent|house|electricity|bill|utility/i.test(clean)) return "💡";
  return "🏷️";
}

/**
 * Trigger immediate real-time Telegram alert when category budget crosses 80% or 100% threshold
 */
export async function checkAndSendBudgetOverspendAlert(params: {
  chatId: string;
  category: string;
  spentAmount: number;
  budgetLimit: number;
  currency?: string;
}): Promise<void> {
  const { chatId, category, spentAmount, budgetLimit, currency = "INR" } = params;
  if (!chatId || budgetLimit <= 0) return;

  const pct = Math.round((spentAmount / budgetLimit) * 100);
  if (pct < 80) return;

  const formatCurr = (amt: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amt);

  const statusIcon = pct >= 100 ? "🚨" : "⚠️";
  const title = pct >= 100 ? "BUDGET BREACHED" : "BUDGET WARNING";

  const message =
    `${statusIcon} *${title}*: ${category}\n\n` +
    `You have used *${pct}%* of your monthly budget limit!\n` +
    `• *Spent*: ${formatCurr(spentAmount)}\n` +
    `• *Monthly Budget Limit*: ${formatCurr(budgetLimit)}\n` +
    (pct >= 100 ? `\n‼️ *Over budget by ${formatCurr(spentAmount - budgetLimit)}*` : "");

  await sendTelegramMessage(chatId, message);
}

