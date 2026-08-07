import { computeTaxLossHarvesting, type TaxEngineInput } from "@/lib/tax/india-tax-engine";

describe("Tax Loss Harvesting & STCG/LTCG Engine", () => {
  const baseInput: TaxEngineInput = {
    fyStartYear: 2025,
    regime: "new",
    incomes: [],
    expenses: [],
    transactions: [],
    investments: [
      {
        id: "inv-1",
        name: "Reliance",
        symbol: "RELIANCE",
        type: "equity",
        quantity: 100,
        buy_price: 2500,
        current_price: 2000, // Loss of ₹50,000 (STCG)
        bought_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // STCG (100 days)
      },
      {
        id: "inv-2",
        name: "TCS",
        symbol: "TCS",
        type: "equity",
        quantity: 50,
        buy_price: 3000,
        current_price: 4000, // Gain of ₹50,000 (LTCG)
        bought_at: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), // LTCG (400 days)
      },
    ],
    mutualFunds: [
      {
        id: "mf-1",
        fund_name: "HDFC Top 100",
        units: 100,
        avg_nav: 500,
        current_nav: 400, // Loss of ₹10,000 (LTCG)
        created_at: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(), // LTCG (500 days)
      },
    ],
    bonds: [],
    alternativeAssets: [],
    liabilities: [],
  };

  it("correctly identifies unrealized loss and gain harvesting opportunities", () => {
    const result = computeTaxLossHarvesting(baseInput);

    expect(result.items.length).toBe(3);

    const rel = result.items.find((x) => x.id === "inv-1");
    expect(rel).toBeDefined();
    expect(rel?.harvestType).toBe("Loss Harvest");
    expect(rel?.unrealizedPnl).toBe(-50000);
    expect(rel?.isLtcg).toBe(false);
    expect(rel?.potentialTaxSavings).toBe(10000); // 20% of 50k STCG loss = ₹10,000 tax savings

    const mf = result.items.find((x) => x.id === "mf-1");
    expect(mf).toBeDefined();
    expect(mf?.harvestType).toBe("Loss Harvest");
    expect(mf?.unrealizedPnl).toBe(-10000);
    expect(mf?.isLtcg).toBe(true);
    expect(mf?.potentialTaxSavings).toBe(1250); // 12.5% of 10k LTCG loss = ₹1,250 tax savings
  });

  it("calculates unused LTCG exemption threshold accurately", () => {
    const result = computeTaxLossHarvesting(baseInput);
    // Net LTCG in baseInput is 40,000 (50k gain from TCS - 10k loss from MF), leaving 85,000 unused exemption out of 1,25,000
    expect(result.unusedLtcgExemption).toBe(85000);
  });
});
