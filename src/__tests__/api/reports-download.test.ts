import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/reports/download/route";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Mock dependencies
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@react-pdf/renderer", () => ({
  renderToStream: vi.fn().mockResolvedValue("mock-pdf-stream"),
}));

vi.mock("@/components/reports/FinancialStatementPDF", () => ({
  default: () => "MockPDFComponent",
}));

// Mock Repositories resolved from DI Container
const mockAccountRepo = {
  findAll: vi.fn().mockResolvedValue([
    { id: "acc-1", name: "Savings", balance: 15000, type: "savings", currency: "INR" }
  ])
};
const mockTransactionRepo = {
  findByDateRange: vi.fn().mockResolvedValue([
    { id: "tx-1", date: "2026-07-01", description: "Salary", amount: 10000, type: "income", category: "Salary", account_id: "acc-1" }
  ])
};

const mockContainer = {
  resolve: (key: string) => {
    if (key === "accountRepo") return mockAccountRepo;
    if (key === "transactionRepo") return mockTransactionRepo;
    return null;
  }
};

vi.mock("@/lib/container", () => ({
  createAppContainer: () => mockContainer
}));

describe("Reports Download API Route", () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
  });

  it("returns 401 if user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const request = new Request("http://localhost/api/reports/download?month=7&year=2026");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("successfully retrieves user statement report and returns PDF response", async () => {
    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } }
    });

    // Mock profiles select query
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { username: "john_doe" } })
            })
          })
        };
      }
      if (table === "liabilities") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ remaining_amount: "5000" }] })
          })
        };
      }
      // For fallback or other tables
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [] })
        })
      };
    });

    const request = new Request("http://localhost/api/reports/download?month=7&year=2026");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("Financial-Statement-7-2026.pdf");
  });
});
