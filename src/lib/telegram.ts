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
