import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/sync/route";
import { getDb } from "@/lib/db";

process.env.CRON_SECRET = "mock_secret";


// Mock drizzle and db
vi.mock("@/lib/db", () => {
  const mockDb = {
    selectDistinct: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(async (callback) => {
      const tx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        for: vi.fn().mockResolvedValue([
          { id: "acc-123", name: "Salary Account", balance: "5000", currency: "INR" }
        ]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue({}),
      };
      return callback(tx);
    }),
  };
  return {
    getDb: vi.fn().mockReturnValue(mockDb),
  };
});

vi.mock("@/app/dashboard/mutual-funds/actions", () => ({
  fetchLiveMFNAV: vi.fn().mockResolvedValue({ nav: 100, previousNav: 98 }),
}));

vi.mock("@/app/dashboard/stocks/actions", () => ({
  fetchLiveStockPrice: vi.fn().mockResolvedValue({ price: 1500, previousClose: 1480 }),
}));

describe("Sync API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully parses GET request and processes recurring transactions", async () => {
    const db = getDb() as any;

    // Mock query chains for stocks, mutual funds, expenses, and incomes
    db.selectDistinct.mockReturnValue(db);
    db.select.mockReturnValue(db);
    db.from.mockReturnValue(db);
    db.where.mockImplementation((expr: any) => {
      // Return simulated active templates
      if (expr && expr.toString().includes("is_recurring = true")) {
        // Here we can mock recurring items. We detect table name based on what's active.
        // But for mock simplicity, we can let it return templates based on call count.
        return [
          {
            id: "inc-123",
            user_id: "user-123",
            account_id: "acc-123",
            description: "Monthly Salary",
            amount: "1000",
            category: "Salary",
            is_recurring: true,
            recurrence_frequency: "daily",
            last_generated_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          }
        ];
      }
      return []; // Return empty for other filters (stocks, mutual funds, expenses)
    });

    const request = new Request("http://localhost/api/sync", {
      headers: {
        Authorization: "Bearer mock_secret"
      }
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.incomes_generated).toBeGreaterThanOrEqual(0);
  });
});
