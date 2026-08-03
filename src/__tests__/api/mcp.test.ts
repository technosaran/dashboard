const mockAccounts = [
  { id: "acc-1", name: "HDFC Bank", balance: 25000, currency: "INR", user_id: "u-1" }
];

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: "u-1", email: "test@example.com" } },
      error: null,
    }),
  },
  from: jest.fn((table: string) => {
    const getTableData = () => (table === "accounts" ? mockAccounts : []);
    const createQuery = () => {
      const res = { data: getTableData(), error: null };
      return {
        then: (resolve: any) => resolve(res),
        select: jest.fn().mockImplementation(() => createQuery()),
        eq: jest.fn().mockImplementation(() => createQuery()),
        limit: jest.fn().mockImplementation(() => createQuery()),
        order: jest.fn().mockImplementation(() => createQuery()),
        single: jest.fn().mockImplementation(() => Promise.resolve({ data: getTableData()[0] || null, error: null })),
      };
    };

    return {
      select: jest.fn().mockImplementation(() => createQuery()),
      update: jest.fn().mockImplementation(() => createQuery()),
      insert: jest.fn().mockImplementation((item: any) => {
        const data = Array.isArray(item) ? item[0] : item;
        const res = { data, error: null };
        return {
          then: (resolve: any) => resolve(res),
          select: jest.fn().mockImplementation(() => ({
            single: jest.fn().mockImplementation(() => Promise.resolve({ data: { id: "tx-1", ...data }, error: null })),
          })),
        };
      }),
    };
  }),
};

jest.mock("@/lib/supabase-server", () => ({
  createClient: jest.fn().mockImplementation(() => Promise.resolve(mockSupabaseClient)),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));


import { GET, POST } from "@/app/api/mcp/route";

describe("MCP API Route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock_key";
  });

  it("handles GET request to list tools", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.server).toContain("FinanceOS MCP");
    expect(body.tools).toContain("get_financial_overview");
  });

  it("executes get_financial_overview tool via POST", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      body: JSON.stringify({ name: "get_financial_overview" }),
    });

    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.total_bank_balance).toBe(25000);
  });

  it("executes add_transaction tool via POST", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      body: JSON.stringify({
        name: "add_transaction",
        arguments: {
          type: "expense",
          amount: 150,
          description: "Coffee",
          category: "Food",
          account_name_or_id: "HDFC Bank",
        },
      }),
    });

    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.account_updated).toBe("HDFC Bank");
  });
});
