import { checkAndSendBudgetOverspendAlert } from "@/lib/telegram";

describe("Budget Over-Spend Telegram Alert Engine", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "mock-token-123";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as any);
  });

  it("should send a Telegram alert when spent exceeds 80%", async () => {
    await checkAndSendBudgetOverspendAlert({
      chatId: "chat-123",
      category: "Dining Out",
      spentAmount: 12400,
      budgetLimit: 14000,
      currency: "INR",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.telegram.org/botmock-token-123/sendMessage"),
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
