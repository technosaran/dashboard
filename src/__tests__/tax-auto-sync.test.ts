import { getTaxRuleForYear, registerTaxRule, getAllRegisteredTaxRules } from "@/lib/tax/tax-rule-manager";

describe("Dynamic AI Tax Rule Manager & Auto-Sync Engine", () => {
  it("retrieves existing tax rules accurately", () => {
    const rule2025 = getTaxRuleForYear(2025);
    expect(rule2025).toBeDefined();
    expect(rule2025.fyStartYear).toBe(2025);
    expect(rule2025.standardDeductionNew).toBe(75000);
  });

  it("dynamically registers new Union Budget tax rules without code modification", () => {
    registerTaxRule({
      version: "FY2027-28-v1",
      fyStartYear: 2027,
      standardDeductionOld: 50000,
      standardDeductionNew: 90000, // New Budget 2027 rule
      cessRate: 0.04,
      oldRegimeSlabs: [{ upto: 300000, rate: 0 }],
      newRegimeSlabs: [{ upto: 500000, rate: 0 }],
      deductionLimits: { "80C": 200000 },
    });

    const registered = getTaxRuleForYear(2027);
    expect(registered).toBeDefined();
    expect(registered.fyStartYear).toBe(2027);
    expect(registered.standardDeductionNew).toBe(90000);

    const allRules = getAllRegisteredTaxRules();
    expect(allRules.some((r) => r.fyStartYear === 2027)).toBe(true);
  });
});
